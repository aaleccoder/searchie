use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, RwLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::State;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const INDEX_TTL: Duration = Duration::from_secs(120);
const QUERY_CACHE_TTL: Duration = Duration::from_secs(18);
const MAX_INDEXED_FILES: usize = 120_000;
const DEFAULT_LIMIT: usize = 64;
const MAX_LIMIT: usize = 220;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone)]
struct IndexedFile {
    path: String,
    name: String,
    extension: Option<String>,
    path_lower: String,
    name_lower: String,
}

#[derive(Clone)]
struct FileIndexSnapshot {
    root: String,
    indexed_at_ms: u64,
    built_at: Instant,
    files: Vec<IndexedFile>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSearchResult {
    pub path: String,
    pub name: String,
    pub extension: Option<String>,
    pub indexed_at: u64,
}

#[derive(Clone)]
struct QueryCacheEntry {
    created_at: Instant,
    results: Vec<FileSearchResult>,
}

#[derive(Clone)]
pub struct FileIndexState {
    snapshot: Arc<RwLock<Option<FileIndexSnapshot>>>,
    query_cache: Arc<RwLock<HashMap<String, QueryCacheEntry>>>,
}

impl Default for FileIndexState {
    fn default() -> Self {
        Self {
            snapshot: Arc::new(RwLock::new(None)),
            query_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

impl FileIndexState {
    fn resolve_snapshot(&self, root: &Path) -> Result<FileIndexSnapshot, String> {
        let root_key = root.to_string_lossy().to_string();

        if let Ok(lock) = self.snapshot.read() {
            if let Some(snapshot) = lock.as_ref() {
                if snapshot.root.eq_ignore_ascii_case(&root_key) && snapshot.built_at.elapsed() < INDEX_TTL {
                    return Ok(snapshot.clone());
                }
            }
        }

        let next_snapshot = build_index(root)?;

        if let Ok(mut lock) = self.snapshot.write() {
            *lock = Some(next_snapshot.clone());
        }

        if let Ok(mut cache_lock) = self.query_cache.write() {
            cache_lock.clear();
        }

        Ok(next_snapshot)
    }

    fn find_cached(&self, key: &str) -> Option<Vec<FileSearchResult>> {
        let Ok(lock) = self.query_cache.read() else {
            return None;
        };

        let Some(entry) = lock.get(key) else {
            return None;
        };

        if entry.created_at.elapsed() >= QUERY_CACHE_TTL {
            return None;
        }

        Some(entry.results.clone())
    }

    fn cache_results(&self, key: String, results: Vec<FileSearchResult>) {
        if let Ok(mut lock) = self.query_cache.write() {
            lock.insert(
                key,
                QueryCacheEntry {
                    created_at: Instant::now(),
                    results,
                },
            );
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn normalize_root(root: Option<String>) -> Result<PathBuf, String> {
    let candidate = root.unwrap_or_else(default_root);
    let trimmed = candidate.trim();

    if trimmed.is_empty() {
        return Err("root path is empty".to_string());
    }

    let unquoted = trimmed.trim_matches('"');
    let path = PathBuf::from(unquoted);

    if !path.exists() || !path.is_dir() {
        return Err(format!("root path does not exist or is not a directory: {unquoted}"));
    }

    Ok(path)
}

fn default_root() -> String {
    std::env::var("USERPROFILE")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .unwrap_or_else(|| ".".to_string())
}

fn ignored_dirs() -> HashSet<&'static str> {
    HashSet::from([
        ".git",
        "node_modules",
        "target",
        "dist",
        "build",
        ".next",
        ".idea",
        ".vscode",
    ])
}

fn build_index(root: &Path) -> Result<FileIndexSnapshot, String> {
    let ignored = ignored_dirs();
    let mut stack = vec![root.to_path_buf()];
    let mut files = Vec::<IndexedFile>::new();

    while let Some(dir) = stack.pop() {
        let entries = match std::fs::read_dir(&dir) {
            Ok(e) => e,
            Err(_) => continue,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            let lowered = file_name.to_lowercase();

            if lowered.starts_with('.') {
                continue;
            }

            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                if ignored.contains(lowered.as_str()) {
                    continue;
                }

                stack.push(path);
                continue;
            }

            if !file_type.is_file() {
                continue;
            }

            let path_str = path.to_string_lossy().to_string();
            let ext = path
                .extension()
                .and_then(|value| value.to_str())
                .map(|value| value.to_lowercase());

            files.push(IndexedFile {
                path: path_str.clone(),
                name: file_name.clone(),
                extension: ext,
                path_lower: path_str.to_lowercase(),
                name_lower: file_name.to_lowercase(),
            });

            if files.len() >= MAX_INDEXED_FILES {
                break;
            }
        }

        if files.len() >= MAX_INDEXED_FILES {
            break;
        }
    }

    files.sort_by(|a, b| a.path.cmp(&b.path));

    Ok(FileIndexSnapshot {
        root: root.to_string_lossy().to_string(),
        indexed_at_ms: now_ms(),
        built_at: Instant::now(),
        files,
    })
}

fn score_file(query_tokens: &[String], compact_query: &str, file: &IndexedFile) -> i32 {
    for token in query_tokens {
        if !file.path_lower.contains(token) {
            return -1;
        }
    }

    let mut score: i32 = 0;

    if file.name_lower == compact_query {
        score += 420;
    }

    if file.name_lower.starts_with(compact_query) {
        score += 220;
    } else if file.name_lower.contains(compact_query) {
        score += 120;
    }

    for token in query_tokens {
        if file.name_lower.starts_with(token) {
            score += 74;
        } else if file.name_lower.contains(token) {
            score += 30;
        }

        if file
            .path_lower
            .split(['/', '\\'])
            .any(|segment| segment.starts_with(token))
        {
            score += 13;
        }
    }

    score += (40_i32 - (file.path.len() as i32 / 14)).max(0);
    score
}

fn ranked_search(snapshot: &FileIndexSnapshot, query: &str, limit: usize) -> Vec<FileSearchResult> {
    let tokens = query
        .to_lowercase()
        .split_whitespace()
        .filter(|token| !token.is_empty())
        .map(|token| token.to_string())
        .collect::<Vec<_>>();

    if tokens.is_empty() {
        return Vec::new();
    }

    let compact = tokens.join("");

    let mut scored = snapshot
        .files
        .iter()
        .filter_map(|file| {
            let score = score_file(&tokens, &compact, file);
            if score < 0 {
                return None;
            }

            Some((
                score,
                FileSearchResult {
                    path: file.path.clone(),
                    name: file.name.clone(),
                    extension: file.extension.clone(),
                    indexed_at: snapshot.indexed_at_ms,
                },
            ))
        })
        .collect::<Vec<_>>();

    scored.sort_by(|a, b| {
        if b.0 != a.0 {
            b.0.cmp(&a.0)
        } else {
            a.1.path.cmp(&b.1.path)
        }
    });

    scored.into_iter().take(limit).map(|(_, item)| item).collect()
}

#[tauri::command]
pub fn search_files(
    state: State<'_, FileIndexState>,
    query: String,
    root: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<FileSearchResult>, String> {
    let trimmed_query = query.trim();
    if trimmed_query.is_empty() {
        return Ok(Vec::new());
    }

    let root_path = normalize_root(root)?;
    let normalized_limit = limit.unwrap_or(DEFAULT_LIMIT).clamp(1, MAX_LIMIT);

    let snapshot = state.resolve_snapshot(&root_path)?;

    let cache_key = format!(
        "{}|{}|{}",
        snapshot.root.to_lowercase(),
        trimmed_query.to_lowercase(),
        normalized_limit
    );

    if let Some(cached) = state.find_cached(&cache_key) {
        return Ok(cached);
    }

    let results = ranked_search(&snapshot, trimmed_query, normalized_limit);
    state.cache_results(cache_key, results.clone());
    Ok(results)
}

#[tauri::command]
pub fn open_file_path(path: String, reveal: Option<bool>) -> Result<(), String> {
    let target = PathBuf::from(path.trim().trim_matches('"'));

    if !target.exists() || !target.is_file() {
        return Err("file not found".to_string());
    }

    let reveal_in_explorer = reveal.unwrap_or(false);

    #[cfg(target_os = "windows")]
    {
        let mut command = if reveal_in_explorer {
            let mut cmd = Command::new("explorer.exe");
            cmd.arg("/select,");
            cmd.arg(target.as_os_str());
            cmd
        } else {
            let mut cmd = Command::new("rundll32.exe");
            cmd.arg("url.dll,FileProtocolHandler");
            cmd.arg(target.as_os_str());
            cmd
        };

        command.creation_flags(CREATE_NO_WINDOW);
        command.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        if reveal_in_explorer {
            command.arg("-R");
        }
        command.arg(target.as_os_str());
        command.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        if reveal_in_explorer {
            let parent = target
                .parent()
                .map(Path::to_path_buf)
                .unwrap_or_else(|| target.clone());
            Command::new("xdg-open")
                .arg(parent.as_os_str())
                .spawn()
                .map_err(|e| e.to_string())?;
        } else {
            Command::new("xdg-open")
                .arg(target.as_os_str())
                .spawn()
                .map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    #[allow(unreachable_code)]
    Ok(())
}

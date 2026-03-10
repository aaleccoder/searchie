use base64::{engine::general_purpose, Engine};
use serde::Serialize;
use sqlx::SqlitePool;
use std::{
    collections::{hash_map::DefaultHasher, HashMap},
    hash::{Hash, Hasher},
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, OnceLock, RwLock},
};
use tauri::{AppHandle, Emitter, Manager, State};
use winreg::{
    enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
    RegKey,
};

use crate::{db, icons};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const WATCH_INTERVAL_SECONDS: u64 = 8;
const DETACHED_PROCESS: u32 = 0x0000_0008;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub id: String,
    pub name: String,
    pub launch_path: String,
    pub launch_args: Vec<String>,
    pub icon_path: Option<String>,
    pub version: Option<String>,
    pub publisher: Option<String>,
    pub install_location: Option<String>,
    pub source: String,
    /// Stored only in the DB; never serialised over the IPC boundary.
    #[serde(skip)]
    pub icon_blob: Option<Vec<u8>>,
}

#[derive(Clone)]
pub struct AppIndexState {
    apps: Arc<RwLock<Vec<InstalledApp>>>,
    signature: Arc<RwLock<u64>>,
    /// Shared pool; set once during bootstrap, then available to all clones.
    pool: Arc<OnceLock<SqlitePool>>,
}

impl Default for AppIndexState {
    fn default() -> Self {
        Self {
            apps: Arc::new(RwLock::new(Vec::new())),
            signature: Arc::new(RwLock::new(0)),
            pool: Arc::new(OnceLock::new()),
        }
    }
}

impl AppIndexState {
    pub fn set_apps(&self, new_apps: Vec<InstalledApp>) {
        let mut sig_hasher = DefaultHasher::new();
        for app in &new_apps {
            app.id.hash(&mut sig_hasher);
            app.name.hash(&mut sig_hasher);
            app.launch_path.hash(&mut sig_hasher);
            app.version.hash(&mut sig_hasher);
        }
        let next_sig = sig_hasher.finish();

        if let Ok(mut lock) = self.apps.write() {
            *lock = new_apps;
        }
        if let Ok(mut sig_lock) = self.signature.write() {
            *sig_lock = next_sig;
        }
    }

    pub fn get_apps(&self) -> Vec<InstalledApp> {
        self.apps
            .read()
            .map(|apps| apps.clone())
            .unwrap_or_else(|_| Vec::new())
    }

    pub fn get_signature(&self) -> u64 {
        self.signature.read().map(|s| *s).unwrap_or_default()
    }
}

fn read_string_value(key: &RegKey, name: &str) -> Option<String> {
    key.get_value::<String, _>(name)
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

fn read_u32_value(key: &RegKey, name: &str) -> Option<u32> {
    key.get_value::<u32, _>(name).ok()
}

fn clean_command_path(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if let Some(stripped) = trimmed.strip_prefix('"') {
        if let Some((inside, _)) = stripped.split_once('"') {
            return inside.trim().to_string();
        }
    }

    // Registry icon paths often look like: C:\Foo\app.exe,0
    trimmed
        .split(',')
        .next()
        .unwrap_or(trimmed)
        .trim()
        .to_string()
}

fn parse_launch_command(raw: &str) -> (String, Vec<String>) {
    let normalized = raw.trim();
    if normalized.is_empty() {
        return (String::new(), Vec::new());
    }

    if let Some(stripped) = normalized.strip_prefix('"') {
        if let Some((exe, rest)) = stripped.split_once('"') {
            let args = rest
                .split_whitespace()
                .map(|arg| arg.trim_matches('"').to_string())
                .filter(|arg| !arg.is_empty())
                .collect::<Vec<_>>();
            return (exe.trim().to_string(), args);
        }
    }

    let mut parts = normalized.split_whitespace();
    let exe = parts.next().unwrap_or_default().to_string();
    let args = parts.map(|s| s.to_string()).collect::<Vec<_>>();
    (exe, args)
}

fn make_app_id(name: &str, launch_path: &str, source: &str) -> String {
    let mut hasher = DefaultHasher::new();
    name.to_lowercase().hash(&mut hasher);
    launch_path.to_lowercase().hash(&mut hasher);
    source.hash(&mut hasher);
    format!("app-{:x}", hasher.finish())
}

fn is_launchable(path: &str) -> bool {
    if path.is_empty() {
        return false;
    }
    let p = Path::new(path);
    p.exists() && p.extension().map(|x| x.eq_ignore_ascii_case("exe")).unwrap_or(false)
}

fn read_uninstall_apps(root: &RegKey, uninstall_path: &str, source: &str) -> Vec<InstalledApp> {
    let uninstall = match root.open_subkey(uninstall_path) {
        Ok(key) => key,
        Err(_) => return Vec::new(),
    };

    let mut apps = Vec::new();

    for sub in uninstall.enum_keys().flatten() {
        let app_key = match uninstall.open_subkey(&sub) {
            Ok(k) => k,
            Err(_) => continue,
        };

        if read_u32_value(&app_key, "SystemComponent") == Some(1) {
            continue;
        }

        let Some(name) = read_string_value(&app_key, "DisplayName") else {
            continue;
        };

        let icon_raw = read_string_value(&app_key, "DisplayIcon");
        let install_location = read_string_value(&app_key, "InstallLocation");

        let mut launch_path = icon_raw
            .as_ref()
            .map(|s| clean_command_path(s))
            .unwrap_or_default();
        let mut launch_args = Vec::<String>::new();

        if !is_launchable(&launch_path) {
            if let Some(display_icon) = icon_raw.as_ref() {
                let (cmd, args) = parse_launch_command(display_icon);
                if is_launchable(&cmd) {
                    launch_path = cmd;
                    launch_args = args;
                }
            }
        }

        if !is_launchable(&launch_path) {
            continue;
        }

        let icon_path = icon_raw
            .as_ref()
            .map(|raw| clean_command_path(raw))
            .filter(|p| !p.is_empty());

        let app = InstalledApp {
            id: make_app_id(&name, &launch_path, source),
            name,
            launch_path,
            launch_args,
            icon_path,
            icon_blob: None,
            version: read_string_value(&app_key, "DisplayVersion"),
            publisher: read_string_value(&app_key, "Publisher"),
            install_location,
            source: source.to_string(),
        };

        apps.push(app);
    }

    apps
}

fn read_app_paths(root: &RegKey, source: &str) -> Vec<InstalledApp> {
    let app_paths_root = match root.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\App Paths") {
        Ok(key) => key,
        Err(_) => return Vec::new(),
    };

    let mut apps = Vec::new();

    for sub in app_paths_root.enum_keys().flatten() {
        let subkey = match app_paths_root.open_subkey(&sub) {
            Ok(k) => k,
            Err(_) => continue,
        };

        let Some(default_path) = read_string_value(&subkey, "") else {
            continue;
        };

        let (launch_path, launch_args) = parse_launch_command(&default_path);
        let cleaned = clean_command_path(&launch_path);
        if !is_launchable(&cleaned) {
            continue;
        }

        let base_name = Path::new(&sub)
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| sub.clone());

        let app = InstalledApp {
            id: make_app_id(&base_name, &cleaned, source),
            name: base_name,
            launch_path: cleaned.clone(),
            launch_args,
            icon_path: Some(cleaned.clone()),
            icon_blob: None,
            version: None,
            publisher: None,
            install_location: PathBuf::from(cleaned)
                .parent()
                .and_then(|p| p.to_str().map(|s| s.to_string())),
            source: source.to_string(),
        };

        apps.push(app);
    }

    apps
}

fn scan_installed_apps() -> Vec<InstalledApp> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let mut apps = Vec::new();
    apps.extend(read_uninstall_apps(
        &hkcu,
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "hkcu-uninstall",
    ));
    apps.extend(read_uninstall_apps(
        &hklm,
        "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "hklm-uninstall",
    ));
    apps.extend(read_uninstall_apps(
        &hklm,
        "Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "hklm-wow-uninstall",
    ));

    apps.extend(read_app_paths(&hkcu, "hkcu-app-paths"));
    apps.extend(read_app_paths(&hklm, "hklm-app-paths"));

    let mut dedup = HashMap::<String, InstalledApp>::new();
    for app in apps {
        let key = format!("{}::{}", app.name.to_lowercase(), app.launch_path.to_lowercase());
        dedup.entry(key).or_insert(app);
    }

    let mut values = dedup.into_values().collect::<Vec<_>>();
    values.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    values
}

fn fuzzy_score(query: &str, candidate: &str) -> i64 {
    if query.is_empty() {
        return 0;
    }

    let q = query.to_lowercase();
    let c = candidate.to_lowercase();

    if c == q {
        return 10_000;
    }
    if c.starts_with(&q) {
        return 8_000 - c.len() as i64;
    }
    if c.contains(&q) {
        return 5_000 - c.len() as i64;
    }

    // Subsequence fuzzy scoring.
    let mut score = 0_i64;
    let mut pos = 0_usize;
    let chars = c.chars().collect::<Vec<_>>();

    for qc in q.chars() {
        let mut found = false;
        for i in pos..chars.len() {
            if chars[i] == qc {
                score += if i == pos { 35 } else { 15 };
                pos = i + 1;
                found = true;
                break;
            }
        }
        if !found {
            return -1;
        }
    }

    score - chars.len() as i64
}

#[tauri::command]
pub fn list_installed_apps(state: State<'_, AppIndexState>) -> Vec<InstalledApp> {
    state.get_apps()
}

#[tauri::command]
pub fn search_installed_apps(
    state: State<'_, AppIndexState>,
    query: String,
    limit: Option<usize>,
) -> Vec<InstalledApp> {
    let apps = state.get_apps();
    let q = query.trim().to_string();

    if q.is_empty() {
        return apps.into_iter().take(limit.unwrap_or(120)).collect();
    }

    let mut scored = apps
        .into_iter()
        .filter_map(|app| {
            let score = fuzzy_score(&q, &app.name);
            if score < 0 {
                None
            } else {
                Some((score, app))
            }
        })
        .collect::<Vec<_>>();

    scored.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name.cmp(&b.1.name)));

    scored
        .into_iter()
        .take(limit.unwrap_or(80))
        .map(|(_, app)| app)
        .collect()
}

#[tauri::command]
pub fn launch_installed_app(state: State<'_, AppIndexState>, app_id: String) -> Result<(), String> {
    let apps = state.get_apps();
    let app = apps
        .iter()
        .find(|a| a.id == app_id)
        .ok_or_else(|| "app not found".to_string())?;

    let mut cmd = Command::new(&app.launch_path);
    if !app.launch_args.is_empty() {
        cmd.args(&app.launch_args);
    }

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(DETACHED_PROCESS);
    }

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_app_icon(
    state: State<'_, AppIndexState>,
    app_id: String,
) -> Result<Option<String>, String> {
    let pool = state
        .pool
        .get()
        .ok_or_else(|| "db not ready".to_string())?;

    let bytes = db::get_app_icon(pool, &app_id).await;
    Ok(bytes.map(|b| general_purpose::STANDARD.encode(b)))
}

pub async fn bootstrap_app_index(app: &AppHandle) {
    let pool = match db::open(app).await {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[searchie] DB open failed: {e}");
            return;
        }
    };

    let state = app.state::<AppIndexState>();
    // Store pool so commands can reach it later.
    let _ = state.pool.set(pool.clone());

    if db::is_initial_scan_done(&pool).await {
        // Fast path: load from DB, no full scan needed.
        let apps = db::load_apps(&pool).await;
        state.set_apps(apps);
    } else {
        // First run: scan registry + extract icons in a blocking thread.
        let apps_with_icons =
            tokio::task::spawn_blocking(scan_with_icons)
                .await
                .unwrap_or_default();

        db::replace_all_apps(&pool, &apps_with_icons).await;
        db::mark_initial_scan_done(&pool).await;

        // Strip blobs from in-memory representation.
        let apps: Vec<InstalledApp> = apps_with_icons
            .into_iter()
            .map(|mut a| {
                a.icon_blob = None;
                a
            })
            .collect();
        state.set_apps(apps);
    }

    // Notify frontend that the app list is ready.
    let _ = app.emit("searchie://apps-updated", ());

    // Start the incremental watch loop.
    let app_handle = app.clone();
    let state = state.inner().clone();

    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(WATCH_INTERVAL_SECONDS)).await;

            let pool = match state.pool.get() {
                Some(p) => p.clone(),
                None => continue,
            };

            let latest_with_icons =
                match tokio::task::spawn_blocking(scan_with_icons).await {
                Ok(v) => v,
                Err(_) => continue,
            };

            let next_sig = compute_signature(&latest_with_icons);
            if next_sig != state.get_signature() {
                db::replace_all_apps(&pool, &latest_with_icons).await;

                let latest: Vec<InstalledApp> = latest_with_icons
                    .into_iter()
                    .map(|mut a| {
                        a.icon_blob = None;
                        a
                    })
                    .collect();

                state.set_apps(latest);
                let _ = app_handle.emit("searchie://apps-updated", ());
            }
        }
    });
}

/// Scans the registry for installed apps and extracts their icons.
/// Intended to be called inside `spawn_blocking`.
fn scan_with_icons() -> Vec<InstalledApp> {
    let mut apps = scan_installed_apps();
    for app in &mut apps {
        app.icon_blob = icons::extract_icon_png(&app.launch_path);
    }
    apps
}

fn compute_signature(apps: &[InstalledApp]) -> u64 {
    let mut hasher = DefaultHasher::new();
    for app in apps {
        app.id.hash(&mut hasher);
        app.launch_path.hash(&mut hasher);
        app.version.hash(&mut hasher);
    }
    hasher.finish()
}

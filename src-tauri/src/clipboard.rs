use arboard::Clipboard;
use base64::{engine::general_purpose, Engine};
use png::{BitDepth, ColorType, Encoder};
use serde::Serialize;
use sqlx::{Row, SqlitePool};
use std::{
    collections::hash_map::DefaultHasher,
    hash::{Hash, Hasher},
    process::Command,
    sync::{Arc, RwLock},
};
use tauri::{AppHandle, Emitter, State};

use crate::{db, features};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const CLIPBOARD_SCAN_INTERVAL_MS: u64 = 1_200;
const MAX_HISTORY_ITEMS: usize = 350;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ClipboardKind {
    Text,
    Image,
    Files,
    Other,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardEntry {
    pub id: String,
    #[serde(skip_serializing)]
    pub signature: u64,
    pub kind: ClipboardKind,
    pub preview: String,
    pub text: Option<String>,
    pub image_base64: Option<String>,
    pub files: Vec<String>,
    pub formats: Vec<String>,
    pub created_at: i64,
}

#[derive(Clone)]
pub struct ClipboardState {
    signature: Arc<RwLock<u64>>,
}

impl Default for ClipboardState {
    fn default() -> Self {
        Self {
            signature: Arc::new(RwLock::new(0)),
        }
    }
}

impl ClipboardState {
    fn set_current_signature(&self, signature: u64) {
        if let Ok(mut sig) = self.signature.write() {
            *sig = signature;
        }
    }

    fn current_signature(&self) -> u64 {
        self.signature.read().map(|s| *s).unwrap_or_default()
    }

    fn reset_signature(&self) {
        if let Ok(mut sig) = self.signature.write() {
            *sig = 0;
        }
    }
}

fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or_default()
}

fn hash_parts(parts: &[&str]) -> u64 {
    let mut hasher = DefaultHasher::new();
    for part in parts {
        part.hash(&mut hasher);
    }
    hasher.finish()
}

fn encode_png_rgba(width: usize, height: usize, bytes: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::<u8>::new();
    let mut encoder = Encoder::new(&mut out, width as u32, height as u32);
    encoder.set_color(ColorType::Rgba);
    encoder.set_depth(BitDepth::Eight);

    let mut writer = encoder.write_header().ok()?;
    writer.write_image_data(bytes).ok()?;
    writer.finish().ok()?;
    Some(out)
}

fn read_files_from_clipboard() -> Vec<String> {
    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-Clipboard -Format FileDropList | ConvertTo-Json -Compress",
    ]);

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let output = match cmd.output() {
        Ok(v) if v.status.success() => v,
        _ => return Vec::new(),
    };

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() || raw.eq_ignore_ascii_case("null") {
        return Vec::new();
    }

    let parsed = serde_json::from_str::<serde_json::Value>(&raw).ok();
    match parsed {
        Some(serde_json::Value::Array(values)) => values
            .into_iter()
            .filter_map(|v| v.as_str().map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty())
            .collect(),
        Some(serde_json::Value::String(v)) if !v.trim().is_empty() => vec![v],
        _ => Vec::new(),
    }
}

fn compact_preview(text: &str, max_len: usize) -> String {
    let mut one_line = text.replace('\n', " ").replace('\r', " ");
    one_line = one_line.split_whitespace().collect::<Vec<_>>().join(" ");
    if one_line.len() <= max_len {
        one_line
    } else {
        format!("{}...", &one_line[..max_len])
    }
}

async fn ensure_clipboard_table(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS clipboard_history (
            id TEXT PRIMARY KEY,
            signature TEXT NOT NULL UNIQUE,
            kind TEXT NOT NULL,
            preview TEXT NOT NULL,
            text_value TEXT,
            image_blob BLOB,
            files_json TEXT NOT NULL,
            formats_json TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )",
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_clipboard_history_created_at
         ON clipboard_history (created_at DESC)",
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn persist_clipboard_entry(pool: &SqlitePool, entry: &ClipboardEntry) -> Result<(), sqlx::Error> {
    let image_blob = entry
        .image_base64
        .as_deref()
        .and_then(|v| general_purpose::STANDARD.decode(v).ok());
    let files_json = serde_json::to_string(&entry.files).unwrap_or_else(|_| "[]".to_string());
    let formats_json = serde_json::to_string(&entry.formats).unwrap_or_else(|_| "[]".to_string());
    let kind = match entry.kind {
        ClipboardKind::Text => "text",
        ClipboardKind::Image => "image",
        ClipboardKind::Files => "files",
        ClipboardKind::Other => "other",
    };
    let signature = format!("{:x}", entry.signature);

    sqlx::query(
        "INSERT INTO clipboard_history
         (id, signature, kind, preview, text_value, image_blob, files_json, formats_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(signature) DO UPDATE SET
           id = excluded.id,
           kind = excluded.kind,
           preview = excluded.preview,
           text_value = excluded.text_value,
           image_blob = excluded.image_blob,
           files_json = excluded.files_json,
           formats_json = excluded.formats_json,
           created_at = excluded.created_at",
    )
    .bind(&entry.id)
    .bind(signature)
    .bind(kind)
    .bind(&entry.preview)
    .bind(&entry.text)
    .bind(image_blob)
    .bind(files_json)
    .bind(formats_json)
    .bind(entry.created_at)
    .execute(pool)
    .await?;

    sqlx::query(
        "DELETE FROM clipboard_history
         WHERE id IN (
           SELECT id FROM clipboard_history
           ORDER BY created_at DESC
           LIMIT -1 OFFSET ?
         )",
    )
    .bind(MAX_HISTORY_ITEMS as i64)
    .execute(pool)
    .await?;

    Ok(())
}

async fn load_clipboard_entries(pool: &SqlitePool) -> Vec<ClipboardEntry> {
    let rows = sqlx::query(
        "SELECT id, signature, kind, preview, text_value, image_blob, files_json, formats_json, created_at
         FROM clipboard_history
         ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|row| {
            let kind_raw: String = row.try_get("kind").unwrap_or_else(|_| "other".to_string());
            let kind = match kind_raw.as_str() {
                "text" => ClipboardKind::Text,
                "image" => ClipboardKind::Image,
                "files" => ClipboardKind::Files,
                _ => ClipboardKind::Other,
            };

            let files_json: String = row.try_get("files_json").unwrap_or_else(|_| "[]".to_string());
            let formats_json: String =
                row.try_get("formats_json").unwrap_or_else(|_| "[]".to_string());
            let files: Vec<String> = serde_json::from_str(&files_json).unwrap_or_default();
            let formats: Vec<String> = serde_json::from_str(&formats_json).unwrap_or_default();
            let image_blob: Option<Vec<u8>> = row.try_get("image_blob").ok().flatten();
            let signature_hex: String = row.try_get("signature").unwrap_or_default();

            ClipboardEntry {
                id: row.try_get("id").unwrap_or_default(),
                signature: u64::from_str_radix(signature_hex.trim(), 16).unwrap_or_default(),
                kind,
                preview: row.try_get("preview").unwrap_or_default(),
                text: row.try_get("text_value").ok(),
                image_base64: image_blob.map(|bytes| general_purpose::STANDARD.encode(bytes)),
                files,
                formats,
                created_at: row.try_get("created_at").unwrap_or_default(),
            }
        })
        .collect()
}

fn capture_snapshot() -> Option<(ClipboardEntry, u64)> {
    let mut clipboard = Clipboard::new().ok()?;

    let files = read_files_from_clipboard();
    let mut formats = Vec::<String>::new();
    let created_at = now_ms();

    if let Ok(text) = clipboard.get_text() {
        let normalized = text.trim().to_string();
        if !normalized.is_empty() {
            formats.push("text/plain".to_string());
            if !files.is_empty() {
                formats.push("files".to_string());
            }
            let preview = compact_preview(&normalized, 120);
            let sig = hash_parts(&["text", &normalized, &files.join("|")]);
            return Some((
                ClipboardEntry {
                    id: format!("clip-{created_at}-{sig:x}"),
                    signature: sig,
                    kind: ClipboardKind::Text,
                    preview,
                    text: Some(normalized),
                    image_base64: None,
                    files,
                    formats,
                    created_at,
                },
                sig,
            ));
        }
    }

    if let Ok(image) = clipboard.get_image() {
        let png = encode_png_rgba(image.width, image.height, image.bytes.as_ref())?;
        formats.push("image/png".to_string());
        if !files.is_empty() {
            formats.push("files".to_string());
        }
        let sig = hash_parts(&[
            "image",
            &format!("{}x{}", image.width, image.height),
            &general_purpose::STANDARD.encode(&png),
            &files.join("|"),
        ]);
        return Some((
            ClipboardEntry {
                id: format!("clip-{created_at}-{sig:x}"),
                signature: sig,
                kind: ClipboardKind::Image,
                preview: format!("Image {}x{}", image.width, image.height),
                text: None,
                image_base64: Some(general_purpose::STANDARD.encode(png)),
                files,
                formats,
                created_at,
            },
            sig,
        ));
    }

    if !files.is_empty() {
        formats.push("files".to_string());
        let preview = if files.len() == 1 {
            format!("File: {}", files[0])
        } else {
            format!("{} files copied", files.len())
        };
        let sig = hash_parts(&["files", &files.join("|")]);
        return Some((
            ClipboardEntry {
                id: format!("clip-{created_at}-{sig:x}"),
                signature: sig,
                kind: ClipboardKind::Files,
                preview,
                text: None,
                image_base64: None,
                files,
                formats,
                created_at,
            },
            sig,
        ));
    }

    None
}

pub fn start_clipboard_watcher(app: &AppHandle, state: ClipboardState) {
    let handle = app.clone();

    tauri::async_runtime::spawn(async move {
        let pool = match db::open(&handle).await {
            Ok(pool) => pool,
            Err(err) => {
                eprintln!("[clipboard] Failed to open DB: {err}");
                return;
            }
        };

        if let Err(err) = ensure_clipboard_table(&pool).await {
            eprintln!("[clipboard] Failed to initialize clipboard table: {err}");
            return;
        }

        loop {
            tokio::time::sleep(std::time::Duration::from_millis(CLIPBOARD_SCAN_INTERVAL_MS)).await;

            let sampled = tokio::task::spawn_blocking(capture_snapshot).await.ok().flatten();
            let Some((entry, signature)) = sampled else {
                continue;
            };

            if signature == state.current_signature() {
                continue;
            }

            if persist_clipboard_entry(&pool, &entry).await.is_err() {
                continue;
            }

            state.set_current_signature(signature);
            let _ = handle.emit(features::events::CLIPBOARD_UPDATED, ());
        }
    });
}

#[tauri::command]
pub async fn search_clipboard_history(
    app: AppHandle,
    query: Option<String>,
    kind: Option<String>,
    limit: Option<usize>,
) -> Vec<ClipboardEntry> {
    let pool = match db::open(&app).await {
        Ok(pool) => pool,
        Err(_) => return Vec::new(),
    };
    if ensure_clipboard_table(&pool).await.is_err() {
        return Vec::new();
    }

    let q = query.unwrap_or_default().trim().to_lowercase();
    let kind_filter = kind.unwrap_or_else(|| "all".to_string()).to_lowercase();
    let max = limit.unwrap_or(80).min(MAX_HISTORY_ITEMS);

    load_clipboard_entries(&pool)
        .await
        .into_iter()
        .filter(|item| {
            if kind_filter != "all" {
                let item_kind = match item.kind {
                    ClipboardKind::Text => "text",
                    ClipboardKind::Image => "image",
                    ClipboardKind::Files => "files",
                    ClipboardKind::Other => "other",
                };
                if item_kind != kind_filter {
                    return false;
                }
            }

            if q.is_empty() {
                return true;
            }

            let files_joined = item.files.join(" ").to_lowercase();
            let text = item.text.clone().unwrap_or_default().to_lowercase();
            let preview = item.preview.to_lowercase();
            preview.contains(&q) || text.contains(&q) || files_joined.contains(&q)
        })
        .take(max)
        .collect()
}

#[tauri::command]
pub async fn clear_clipboard_history(
    app: AppHandle,
    state: State<'_, ClipboardState>,
) -> Result<(), String> {
    if let Ok(pool) = db::open(&app).await {
        if ensure_clipboard_table(&pool).await.is_ok() {
            let _ = sqlx::query("DELETE FROM clipboard_history").execute(&pool).await;
        }
    }
    state.reset_signature();
    Ok(())
}

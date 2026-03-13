use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Cursor, Read};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;
use zip::ZipArchive;

const MAX_PLUGIN_ZIP_BYTES: usize = 24 * 1024 * 1024;
const MAX_EXTRACTED_BYTES: u64 = 96 * 1024 * 1024;

#[derive(Debug, Deserialize)]
struct RuntimePluginManifest {
    name: String,
    title: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePluginInstallResult {
    pub plugin_id: String,
    pub name: String,
    pub title: Option<String>,
    pub install_path: String,
    pub file_count: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePluginListItem {
    pub plugin_id: String,
    pub name: String,
    pub title: Option<String>,
    pub install_path: String,
    pub file_count: u64,
    pub manifest_ok: bool,
    pub manifest_error: Option<String>,
}

#[tauri::command]
pub fn remove_runtime_plugin(app: tauri::AppHandle, plugin_id: String) -> Result<(), String> {
    ensure_valid_plugin_id(&plugin_id)?;

    let plugins_dir = resolve_plugins_dir(&app)?;
    let target = plugins_dir.join(&plugin_id);
    if !target.exists() {
        return Err(format!("plugin '{plugin_id}' was not found."));
    }

    if !target.is_dir() {
        return Err(format!("plugin '{plugin_id}' path is not a directory."));
    }

    fs::remove_dir_all(&target).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn list_installed_runtime_plugins(
    app: tauri::AppHandle,
) -> Result<Vec<RuntimePluginListItem>, String> {
    let plugins_dir = resolve_plugins_dir(&app)?;
    if !plugins_dir.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    for entry in fs::read_dir(&plugins_dir).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let plugin_id = entry.file_name().to_string_lossy().to_string();
        if plugin_id.starts_with('.') {
            continue;
        }

        let install_path = path.to_string_lossy().to_string();
        let file_count = count_files(&path)?;
        let manifest_path = path.join("manifest.json");

        if !manifest_path.exists() {
            results.push(RuntimePluginListItem {
                plugin_id: plugin_id.clone(),
                name: plugin_id,
                title: None,
                install_path,
                file_count,
                manifest_ok: false,
                manifest_error: Some("manifest.json not found".to_string()),
            });
            continue;
        }

        let manifest_text = fs::read_to_string(&manifest_path).map_err(|error| error.to_string())?;
        match serde_json::from_str::<RuntimePluginManifest>(&manifest_text) {
            Ok(manifest) => {
                results.push(RuntimePluginListItem {
                    plugin_id,
                    name: manifest.name,
                    title: manifest.title,
                    install_path,
                    file_count,
                    manifest_ok: true,
                    manifest_error: None,
                });
            }
            Err(error) => {
                results.push(RuntimePluginListItem {
                    plugin_id: plugin_id.clone(),
                    name: plugin_id,
                    title: None,
                    install_path,
                    file_count,
                    manifest_ok: false,
                    manifest_error: Some(format!("invalid manifest.json: {error}")),
                });
            }
        }
    }

    results.sort_by(|left, right| left.plugin_id.cmp(&right.plugin_id));
    Ok(results)
}

#[tauri::command]
pub fn install_plugin_zip(
    app: tauri::AppHandle,
    zip_base64: String,
) -> Result<RuntimePluginInstallResult, String> {
    let zip_bytes = STANDARD
        .decode(zip_base64.as_bytes())
        .map_err(|error| format!("invalid zip payload: {error}"))?;

    if zip_bytes.len() > MAX_PLUGIN_ZIP_BYTES {
        return Err(format!(
            "plugin zip is too large ({} bytes). Max allowed is {} bytes.",
            zip_bytes.len(),
            MAX_PLUGIN_ZIP_BYTES
        ));
    }

    let manifest = read_manifest(&zip_bytes)?;
    let plugin_id = slugify(&manifest.name);
    if plugin_id.is_empty() {
        return Err("plugin manifest name must contain at least one alphanumeric character.".to_string());
    }

    let plugins_dir = resolve_plugins_dir(&app)?;
    fs::create_dir_all(&plugins_dir).map_err(|error| error.to_string())?;

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();

    let temp_dir = plugins_dir.join(format!(".tmp-{plugin_id}-{timestamp}"));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let extraction_result = extract_archive(&zip_bytes, &temp_dir);
    if let Err(error) = extraction_result {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(error);
    }

    let manifest_path = temp_dir.join("manifest.json");
    if !manifest_path.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("zip must contain manifest.json at the archive root.".to_string());
    }

    let final_dir = plugins_dir.join(&plugin_id);
    if final_dir.exists() {
        fs::remove_dir_all(&final_dir).map_err(|error| error.to_string())?;
    }

    fs::rename(&temp_dir, &final_dir).map_err(|error| {
        let _ = fs::remove_dir_all(&temp_dir);
        error.to_string()
    })?;

    let file_count = count_files(&final_dir)?;

    Ok(RuntimePluginInstallResult {
        plugin_id,
        name: manifest.name,
        title: manifest.title,
        install_path: final_dir.to_string_lossy().to_string(),
        file_count,
    })
}

fn read_manifest(zip_bytes: &[u8]) -> Result<RuntimePluginManifest, String> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|error| format!("invalid zip archive: {error}"))?;

    let mut manifest_entry = archive
        .by_name("manifest.json")
        .map_err(|_| "zip must include a manifest.json file at archive root.".to_string())?;

    let mut manifest_text = String::new();
    manifest_entry
        .read_to_string(&mut manifest_text)
        .map_err(|error| format!("failed to read manifest.json: {error}"))?;

    serde_json::from_str::<RuntimePluginManifest>(&manifest_text)
        .map_err(|error| format!("invalid manifest.json: {error}"))
}

fn resolve_plugins_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let app_data = app.path().app_data_dir().map_err(|error| error.to_string())?;
    Ok(app_data.join("plugins"))
}

fn ensure_valid_plugin_id(plugin_id: &str) -> Result<(), String> {
    if plugin_id.is_empty() {
        return Err("plugin id cannot be empty.".to_string());
    }

    if plugin_id.starts_with('.') {
        return Err("plugin id cannot start with a dot.".to_string());
    }

    if plugin_id
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
    {
        return Ok(());
    }

    Err("plugin id contains invalid characters.".to_string())
}

fn extract_archive(zip_bytes: &[u8], destination: &Path) -> Result<(), String> {
    let cursor = Cursor::new(zip_bytes);
    let mut archive = ZipArchive::new(cursor).map_err(|error| format!("invalid zip archive: {error}"))?;

    let mut total_uncompressed = 0_u64;

    for index in 0..archive.len() {
        let mut entry = archive
            .by_index(index)
            .map_err(|error| format!("failed to read zip entry {index}: {error}"))?;

        total_uncompressed = total_uncompressed.saturating_add(entry.size());
        if total_uncompressed > MAX_EXTRACTED_BYTES {
            return Err(format!(
                "zip extracts to too much data (>{MAX_EXTRACTED_BYTES} bytes)."
            ));
        }

        let safe_path = entry
            .enclosed_name()
            .map(|path| path.to_owned())
            .ok_or_else(|| "zip entry path is unsafe (path traversal blocked).".to_string())?;

        let out_path = destination.join(safe_path);

        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|error| error.to_string())?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }

        let mut output = fs::File::create(&out_path).map_err(|error| error.to_string())?;
        std::io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;

    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch.to_ascii_lowercase());
            last_dash = false;
            continue;
        }

        if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

fn count_files(root: &Path) -> Result<u64, String> {
    let mut count = 0_u64;
    let mut stack = vec![root.to_path_buf()];

    while let Some(path) = stack.pop() {
        for entry in fs::read_dir(path).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let entry_path = entry.path();

            if entry_path.is_dir() {
                stack.push(entry_path);
            } else if entry_path.is_file() {
                count = count.saturating_add(1);
            }
        }
    }

    Ok(count)
}

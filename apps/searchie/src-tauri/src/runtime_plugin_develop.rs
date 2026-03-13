use crate::features;
use crate::plugins::{RuntimePluginListItem, RuntimePluginManifest};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};

#[derive(Clone, Default)]
pub struct RuntimePluginDevState {
    develop_folder: Arc<Mutex<Option<PathBuf>>>,
}

impl RuntimePluginDevState {
    pub fn set_develop_folder(&self, folder: Option<PathBuf>) -> Result<(), String> {
        let mut guard = self
            .develop_folder
            .lock()
            .map_err(|_| "failed locking runtime plugin develop state".to_string())?;
        *guard = folder;
        Ok(())
    }

    pub fn develop_folder(&self) -> Option<PathBuf> {
        self.develop_folder
            .lock()
            .ok()
            .and_then(|guard| guard.clone())
    }
}

pub fn set_initial_develop_folder(
    state: &RuntimePluginDevState,
    folder: Option<String>,
) -> Result<(), String> {
    let normalized = normalize_folder(folder)?;
    state.set_develop_folder(normalized)
}

pub fn find_develop_plugin_dir_by_id(
    state: &RuntimePluginDevState,
    plugin_id: &str,
) -> Result<Option<PathBuf>, String> {
    let Some(root) = state.develop_folder() else {
        return Ok(None);
    };

    let mut manifest_dirs = Vec::new();
    discover_manifest_dirs(&root, &mut manifest_dirs)?;

    for plugin_dir in manifest_dirs {
        let manifest_path = plugin_dir.join("manifest.json");
        let manifest_text = match fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(_) => continue,
        };

        let manifest = match serde_json::from_str::<RuntimePluginManifest>(&manifest_text) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let current_plugin_id = crate::plugins::slugify(&manifest.name);
        if current_plugin_id == plugin_id {
            return Ok(Some(plugin_dir));
        }
    }

    Ok(None)
}

pub fn list_develop_runtime_plugins(state: &RuntimePluginDevState) -> Result<Vec<RuntimePluginListItem>, String> {
    let Some(root) = state.develop_folder() else {
        return Ok(Vec::new());
    };

    let mut manifest_dirs = Vec::new();
    discover_manifest_dirs(&root, &mut manifest_dirs)?;

    let mut items = Vec::new();

    for plugin_dir in manifest_dirs {
        let manifest_path = plugin_dir.join("manifest.json");
        let install_path = plugin_dir.to_string_lossy().to_string();
        let file_count = count_files(&plugin_dir).unwrap_or(0);

        let manifest_text = match fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(error) => {
                items.push(RuntimePluginListItem {
                    plugin_id: plugin_dir
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_else(|| "develop-plugin".to_string()),
                    name: "invalid-develop-plugin".to_string(),
                    title: None,
                    install_path,
                    file_count,
                    manifest_ok: false,
                    manifest_error: Some(error.to_string()),
                });
                continue;
            }
        };

        match serde_json::from_str::<RuntimePluginManifest>(&manifest_text) {
            Ok(manifest) => {
                let plugin_id = crate::plugins::slugify(&manifest.name);
                if plugin_id.is_empty() {
                    continue;
                }

                items.push(RuntimePluginListItem {
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
                items.push(RuntimePluginListItem {
                    plugin_id: plugin_dir
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_else(|| "develop-plugin".to_string()),
                    name: "invalid-develop-plugin".to_string(),
                    title: None,
                    install_path,
                    file_count,
                    manifest_ok: false,
                    manifest_error: Some(format!("invalid manifest.json: {error}")),
                });
            }
        }
    }

    Ok(items)
}

#[tauri::command]
pub fn set_runtime_plugins_develop_folder(
    app: tauri::AppHandle,
    state: tauri::State<RuntimePluginDevState>,
    folder: Option<String>,
) -> Result<(), String> {
    let normalized = normalize_folder(folder)?;
    state.set_develop_folder(normalized)?;
    app.emit(features::events::RUNTIME_PLUGINS_UPDATED, ())
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn start_runtime_plugin_watcher(app: &tauri::AppHandle, state: RuntimePluginDevState) {
    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        let mut last_signature = String::new();

        loop {
            let signature = snapshot_signature(&app_handle, &state).unwrap_or_default();
            if signature != last_signature {
                last_signature = signature;
                let _ = app_handle.emit(features::events::RUNTIME_PLUGINS_UPDATED, ());
            }

            tokio::time::sleep(Duration::from_millis(900)).await;
        }
    });
}

fn normalize_folder(folder: Option<String>) -> Result<Option<PathBuf>, String> {
    let Some(raw) = folder else {
        return Ok(None);
    };

    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }

    Ok(Some(PathBuf::from(trimmed)))
}

fn snapshot_signature(app: &tauri::AppHandle, state: &RuntimePluginDevState) -> Result<String, String> {
    let mut rows: BTreeMap<String, String> = BTreeMap::new();

    let installed_root = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("plugins");

    collect_plugin_signatures(&installed_root, false, &mut rows)?;

    if let Some(develop_root) = state.develop_folder() {
        collect_plugin_signatures(&develop_root, true, &mut rows)?;
    }

    let mut out = String::new();
    for (plugin_id, signature) in rows {
        out.push_str(&plugin_id);
        out.push('|');
        out.push_str(&signature);
        out.push('\n');
    }

    Ok(out)
}

fn collect_plugin_signatures(
    root: &Path,
    recursive_manifest_scan: bool,
    output: &mut BTreeMap<String, String>,
) -> Result<(), String> {
    if !root.exists() || !root.is_dir() {
        return Ok(());
    }

    let mut plugin_dirs = Vec::new();

    if recursive_manifest_scan {
        discover_manifest_dirs(root, &mut plugin_dirs)?;
    } else {
        for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
            let entry = entry.map_err(|error| error.to_string())?;
            let path = entry.path();
            if path.is_dir() && path.join("manifest.json").exists() {
                plugin_dirs.push(path);
            }
        }
    }

    for plugin_dir in plugin_dirs {
        let manifest_path = plugin_dir.join("manifest.json");
        let manifest_text = match fs::read_to_string(&manifest_path) {
            Ok(text) => text,
            Err(_) => continue,
        };

        let manifest = match serde_json::from_str::<RuntimePluginManifest>(&manifest_text) {
            Ok(value) => value,
            Err(_) => continue,
        };

        let plugin_id = crate::plugins::slugify(&manifest.name);
        if plugin_id.is_empty() {
            continue;
        }

        let runtime_entry = manifest.runtime_entry.unwrap_or_else(|| "./dist/runtime.js".to_string());
        let runtime_entry_path = plugin_dir.join(runtime_entry.trim_start_matches("./"));

        let manifest_sig = file_sig(&manifest_path);
        let entry_sig = file_sig(&runtime_entry_path);
        let signature = format!(
            "{}|{}|{}",
            plugin_dir.to_string_lossy(),
            manifest_sig,
            entry_sig
        );

        output.insert(plugin_id, signature);
    }

    Ok(())
}

fn discover_manifest_dirs(root: &Path, output: &mut Vec<PathBuf>) -> Result<(), String> {
    if !root.exists() || !root.is_dir() {
        return Ok(());
    }

    if root.join("manifest.json").exists() {
        output.push(root.to_path_buf());
        return Ok(());
    }

    for entry in fs::read_dir(root).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let path = entry.path();
        if path.is_dir() {
            discover_manifest_dirs(&path, output)?;
        }
    }

    Ok(())
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

fn file_sig(path: &Path) -> String {
    match fs::metadata(path) {
        Ok(meta) => {
            let len = meta.len();
            let modified = meta
                .modified()
                .ok()
                .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|dur| dur.as_millis())
                .unwrap_or_default();
            format!("{len}:{modified}")
        }
        Err(_) => "missing".to_string(),
    }
}

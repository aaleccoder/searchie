// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod apps;
pub mod clipboard;
pub mod db;
pub mod features;
pub mod file_search;
pub mod icons;
pub mod system_controls;

use crate::apps::{
    bootstrap_app_index, get_app_icon, get_app_icons, launch_installed_app,
    launch_installed_app_as_admin,
    list_installed_apps, open_installed_app_install_location, open_installed_app_properties,
    search_installed_apps, uninstall_installed_app, AppIndexState,
};
use crate::clipboard::{
    clear_clipboard_history, delete_clipboard_entry, search_clipboard_history, start_clipboard_watcher,
    toggle_clipboard_pin, ClipboardState,
};
use crate::file_search::{open_file_path, search_files, FileIndexState};
use crate::system_controls::{
    change_brightness, change_system_volume, get_brightness, media_next, media_play_pause,
    media_previous, open_system_settings_uri, set_airplane_mode, set_bluetooth_enabled,
    set_brightness, set_hotspot_enabled, set_power_profile, set_system_mute, set_system_volume,
    set_wifi_enabled, toggle_airplane_mode, toggle_bluetooth, toggle_hotspot, toggle_system_mute,
    toggle_wifi,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_store::StoreExt;
use serde_json::json;

#[cfg(target_os = "windows")]
use std::{ffi::OsStr, iter};

#[cfg(target_os = "windows")]
use std::os::windows::ffi::OsStrExt;

#[cfg(target_os = "windows")]
use std::ptr;

#[cfg(target_os = "windows")]
use winapi::{
    shared::windef::HWND,
    um::{shellapi::ShellExecuteW, winuser::SW_SHOWNORMAL},
};

#[cfg(target_os = "windows")]
use window_vibrancy::{apply_mica};

const DEFAULT_SHORTCUT: &str = "Alt+Space";
const COMPACT_WIDTH: f64 = 680.0;
const COMPACT_HEIGHT: f64 = 45.0;
const LAUNCHER_WIDTH: f64 = 680.0;
const LAUNCHER_HEIGHT: f64 = 500.0;
const SETTINGS_WIDTH: f64 = 680.0;
const SETTINGS_HEIGHT: f64 = 500.0;

#[derive(Clone, Copy)]
enum MainWindowMode {
    Compact,
    Launcher,
    Settings,
}

fn toggle_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
fn update_shortcut(
    app: tauri::AppHandle,
    old_shortcut: String,
    new_shortcut: String,
) -> Result<(), String> {
    if !old_shortcut.is_empty() && old_shortcut != new_shortcut {
        app.global_shortcut().unregister(old_shortcut.as_str()).ok();
    }
    if !new_shortcut.is_empty() {
        app.global_shortcut()
            .register(new_shortcut.as_str())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn open_settings_panel(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
        let _ = win.emit(features::events::OPEN_SETTINGS, ());
    }
}

fn set_main_window_mode_impl(app: &tauri::AppHandle, mode: MainWindowMode) -> Result<(), String> {
    let win = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;

    let (mut width, mut height) = match mode {
        MainWindowMode::Compact => (COMPACT_WIDTH, COMPACT_HEIGHT),
        MainWindowMode::Launcher => (LAUNCHER_WIDTH, LAUNCHER_HEIGHT),
        MainWindowMode::Settings => (SETTINGS_WIDTH, SETTINGS_HEIGHT),
    };

    if let Ok(Some(monitor)) = win.current_monitor() {
        let scale = monitor.scale_factor();
        // Keep larger modes within visible monitor bounds with breathing room.
        if !matches!(mode, MainWindowMode::Compact) {
            let max_w = ((monitor.size().width as f64 / scale) * 0.82).max(COMPACT_WIDTH);
            let max_h = ((monitor.size().height as f64 / scale) * 0.78).max(420.0);
            width = width.min(max_w);
            height = height.min(max_h);
        }
    }

    win.set_size(tauri::Size::Logical(tauri::LogicalSize::new(width, height)))
        .map_err(|e| e.to_string())?;

    if let Ok(Some(monitor)) = win.current_monitor() {
        let screen = monitor.size();
        let scale = monitor.scale_factor();
        let width_px = (width * scale).round() as i32;
        let x = monitor.position().x + (screen.width as i32 - width_px) / 2;
        let y = monitor.position().y + ((screen.height as f64) * 0.14).round() as i32;
        let _ = win.set_position(tauri::PhysicalPosition::new(x, y));
    }

    Ok(())
}

#[tauri::command]
fn show_settings(app: tauri::AppHandle) {
    let _ = set_main_window_mode_impl(&app, MainWindowMode::Settings);
    open_settings_panel(&app);
}

#[tauri::command]
fn set_main_window_mode(app: tauri::AppHandle, mode: String) -> Result<(), String> {
    let parsed = match mode.as_str() {
        "compact" => MainWindowMode::Compact,
        "launcher" => MainWindowMode::Launcher,
        "settings" => MainWindowMode::Settings,
        _ => return Err("invalid mode".to_string()),
    };
    set_main_window_mode_impl(&app, parsed)
}

#[cfg(target_os = "windows")]
fn to_wide_null(value: &str) -> Vec<u16> {
    OsStr::new(value).encode_wide().chain(iter::once(0)).collect()
}

#[tauri::command]
fn shell_execute_w(target: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let verb = to_wide_null("open");
        let target_wide = to_wide_null(&target);

        let result = unsafe {
            ShellExecuteW(
                ptr::null_mut() as HWND,
                verb.as_ptr(),
                target_wide.as_ptr(),
                ptr::null(),
                ptr::null(),
                SW_SHOWNORMAL,
            )
        } as isize;

        if result <= 32 {
            return Err(format!(
                "ShellExecuteW failed with code {result} for target '{target}'"
            ));
        }

        return Ok(());
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = target;
        Err("shell_execute_w is only supported on Windows".to_string())
    }
}

#[tauri::command]
async fn google_suggest(query: String) -> Result<serde_json::Value, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(json!(["", []]));
    }

    let client = reqwest::Client::new();
    let response = client
        .get("https://suggestqueries.google.com/complete/search")
        .query(&[("client", "firefox"), ("q", trimmed)])
        .send()
        .await
        .map_err(|error| format!("google_suggest request failed: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "google_suggest failed with status {}",
            response.status()
        ));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| format!("google_suggest response parse failed: {error}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(AppIndexState::default())
        .manage(ClipboardState::default())
        .manage(FileIndexState::default())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                // Don't restore position for the main bar — we always position it ourselves.
                .skip_initial_state("main")
                // Don't track visibility — we manage show/hide ourselves.
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED,
                )
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    }
                })
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:searchie.db", db::migrations())
                .build(),
        )
        .setup(|app| {
            // Apply Mica vibrancy and position the main bar
            let window = app.get_webview_window("main").expect("no main window");
            #[cfg(target_os = "windows")]
            apply_mica(&window, Some(true)).expect("failed to apply Mica");

            // Center horizontally, place at ~25 % from the top of the screen.
            let _ = set_main_window_mode_impl(app.handle(), MainWindowMode::Compact);

            // Load persisted shortcut from the store (falls back to default)
            let shortcut = app
                .store("settings.json")
                .ok()
                .and_then(|store| {
                    let val = store.get("settings")?;
                    val["toggleShortcut"].as_str().map(|s| s.to_owned())
                })
                .unwrap_or_else(|| DEFAULT_SHORTCUT.to_owned());

            app.global_shortcut().register(shortcut.as_str()).ok();

            // Open DB and bootstrap app index asynchronously so setup isn't blocked.
            if let Err(error) = features::build_builtin_feature_registry() {
                eprintln!("[features] registry initialization failed: {error}");
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                bootstrap_app_index(&app_handle).await;
            });

            // Start clipboard watcher so the registry is always fresh.
            let clip_state = app.state::<ClipboardState>().inner().clone();
            start_clipboard_watcher(app.handle(), clip_state);

            // Build system-tray menu
            let show_item = MenuItem::with_id(app, "show", "Show / Hide", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Searchie", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &settings_item, &sep, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Searchie")
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_main_window(app),
                    "settings" => {
                        let _ = set_main_window_mode_impl(app, MainWindowMode::Settings);
                        open_settings_panel(app)
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        // Main window behaviour: hide on close-request and on focus loss.
        .on_window_event(|window, event| {
            if window.label() == "main" {
                match event {
                    tauri::WindowEvent::CloseRequested { api, .. } => {
                        api.prevent_close();
                        let win = window.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = win.hide();
                        });
                    }
                    tauri::WindowEvent::Focused(false) => {
                        let win = window.clone();
                        tauri::async_runtime::spawn(async move {
                            let _ = win.hide();
                        });
                    }
                    _ => {}
                }
            }
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            update_shortcut,
            show_settings,
            set_main_window_mode,
            shell_execute_w,
            google_suggest,
            search_clipboard_history,
            clear_clipboard_history,
            toggle_clipboard_pin,
            delete_clipboard_entry,
            search_files,
            open_file_path,
            list_installed_apps,
            search_installed_apps,
            launch_installed_app,
            launch_installed_app_as_admin,
            uninstall_installed_app,
            open_installed_app_properties,
            open_installed_app_install_location,
            get_app_icons,
            get_app_icon,
            media_play_pause,
            media_next,
            media_previous,
            set_system_volume,
            change_system_volume,
            set_system_mute,
            toggle_system_mute,
            get_brightness,
            set_brightness,
            change_brightness,
            set_wifi_enabled,
            toggle_wifi,
            set_bluetooth_enabled,
            toggle_bluetooth,
            set_airplane_mode,
            toggle_airplane_mode,
            set_hotspot_enabled,
            toggle_hotspot,
            set_power_profile,
            open_system_settings_uri
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

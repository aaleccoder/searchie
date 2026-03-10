// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod apps;
pub mod clipboard;
pub mod db;
pub mod icons;

use crate::apps::{
    bootstrap_app_index, get_app_icon, launch_installed_app, list_installed_apps,
    search_installed_apps, AppIndexState,
};
use crate::clipboard::{
    clear_clipboard_history, search_clipboard_history, start_clipboard_watcher, ClipboardState,
};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use tauri_plugin_store::StoreExt;

#[cfg(target_os = "windows")]
use window_vibrancy::apply_mica;

const DEFAULT_SHORTCUT: &str = "Alt+Space";
const COMPACT_WIDTH: f64 = 800.0;
const COMPACT_HEIGHT: f64 = 40.0;
const LAUNCHER_WIDTH: f64 = 800.0;
const LAUNCHER_HEIGHT: f64 = 600.0;
const SETTINGS_WIDTH: f64 = 800.0;
const SETTINGS_HEIGHT: f64 = 620.0;

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
        let _ = win.emit("searchie://open-settings", ());
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(AppIndexState::default())
        .manage(ClipboardState::default())
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
            search_clipboard_history,
            clear_clipboard_history,
            list_installed_apps,
            search_installed_apps,
            launch_installed_app,
            get_app_icon
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

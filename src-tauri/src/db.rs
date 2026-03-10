use sqlx::{sqlite::SqliteConnectOptions, sqlite::SqliteJournalMode, Row, SqlitePool};
use std::str::FromStr;
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};

use crate::apps::InstalledApp;

const CREATE_APPS_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS installed_apps (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        launch_path TEXT NOT NULL,
        launch_args TEXT NOT NULL,
        icon_blob BLOB,
        icon_path TEXT,
        version TEXT,
        publisher TEXT,
        install_location TEXT,
        source TEXT NOT NULL
    )
";

const CREATE_META_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
";

const CREATE_CLIPBOARD_TABLE: &str = "
    CREATE TABLE IF NOT EXISTS clipboard_history (
        id TEXT PRIMARY KEY,
        signature TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL,
        preview TEXT NOT NULL,
        text_value TEXT,
        image_blob BLOB,
        files_json TEXT NOT NULL,
        formats_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
    )
";

const CREATE_CLIPBOARD_CREATED_AT_INDEX: &str = "
    CREATE INDEX IF NOT EXISTS idx_clipboard_history_created_at
    ON clipboard_history (created_at DESC)
";

/// Migrations registered with tauri-plugin-sql (used for the preloaded JS-side connection).
pub fn migrations() -> Vec<Migration> {
    vec![
        // Version 1 must remain unchanged – the plugin stores its hash.
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT);",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_apps_and_meta_tables",
            sql: "CREATE TABLE IF NOT EXISTS installed_apps (\
                id TEXT PRIMARY KEY, \
                name TEXT NOT NULL, \
                launch_path TEXT NOT NULL, \
                launch_args TEXT NOT NULL, \
                icon_blob BLOB, \
                icon_path TEXT, \
                version TEXT, \
                publisher TEXT, \
                install_location TEXT, \
                source TEXT NOT NULL\
            ); \
            CREATE TABLE IF NOT EXISTS meta (\
                key TEXT PRIMARY KEY, \
                value TEXT NOT NULL\
            )",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_clipboard_history_table",
            sql: "CREATE TABLE IF NOT EXISTS clipboard_history (\
                id TEXT PRIMARY KEY, \
                signature TEXT NOT NULL UNIQUE, \
                kind TEXT NOT NULL, \
                preview TEXT NOT NULL, \
                text_value TEXT, \
                image_blob BLOB, \
                files_json TEXT NOT NULL, \
                formats_json TEXT NOT NULL, \
                created_at INTEGER NOT NULL\
            ); \
            CREATE INDEX IF NOT EXISTS idx_clipboard_history_created_at \
            ON clipboard_history (created_at DESC)",
            kind: MigrationKind::Up,
        },
    ]
}

/// Opens a dedicated sqlx pool pointing at the same file as the tauri-plugin-sql preload.
pub async fn open(app: &AppHandle) -> Result<SqlitePool, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let db_path = dir.join("searchie.db");
    let url = format!("sqlite:{}", db_path.display());

    let opts = SqliteConnectOptions::from_str(&url)
        .map_err(|e| e.to_string())?
        .create_if_missing(true)
        .journal_mode(SqliteJournalMode::Wal);

    let pool = SqlitePool::connect_with(opts)
        .await
        .map_err(|e| e.to_string())?;

    // Idempotent schema – also ensures tables exist when accessed without the plugin.
    sqlx::query(CREATE_APPS_TABLE)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query(CREATE_META_TABLE)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query(CREATE_CLIPBOARD_TABLE)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;
    sqlx::query(CREATE_CLIPBOARD_CREATED_AT_INDEX)
        .execute(&pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(pool)
}

pub async fn is_initial_scan_done(pool: &SqlitePool) -> bool {
    sqlx::query("SELECT 1 FROM meta WHERE key = 'initial_scan_done'")
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .is_some()
}

pub async fn mark_initial_scan_done(pool: &SqlitePool) {
    let _ =
        sqlx::query("INSERT OR REPLACE INTO meta (key, value) VALUES ('initial_scan_done', '1')")
            .execute(pool)
            .await;
}

/// Replaces the entire apps table inside a single transaction.
pub async fn replace_all_apps(pool: &SqlitePool, apps: &[InstalledApp]) {
    let mut tx = match pool.begin().await {
        Ok(t) => t,
        Err(_) => return,
    };

    let _ = sqlx::query("DELETE FROM installed_apps")
        .execute(&mut *tx)
        .await;

    for app in apps {
        let args_json =
            serde_json::to_string(&app.launch_args).unwrap_or_else(|_| "[]".to_string());
        let _ = sqlx::query(
            "INSERT INTO installed_apps
             (id, name, launch_path, launch_args, icon_blob, icon_path, version, publisher, install_location, source)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&app.id)
        .bind(&app.name)
        .bind(&app.launch_path)
        .bind(&args_json)
        .bind(&app.icon_blob)
        .bind(&app.icon_path)
        .bind(&app.version)
        .bind(&app.publisher)
        .bind(&app.install_location)
        .bind(&app.source)
        .execute(&mut *tx)
        .await;
    }

    let _ = tx.commit().await;
}

/// Loads all apps from DB without the icon blob (kept in DB only, fetched on demand).
pub async fn load_apps(pool: &SqlitePool) -> Vec<InstalledApp> {
    let rows = sqlx::query(
        "SELECT id, name, launch_path, launch_args, icon_path, version, publisher, install_location, source
         FROM installed_apps ORDER BY name COLLATE NOCASE",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    rows.into_iter()
        .map(|row| {
            let args_json: String = row.try_get("launch_args").unwrap_or_default();
            let launch_args: Vec<String> = serde_json::from_str(&args_json).unwrap_or_default();
            InstalledApp {
                id: row.try_get("id").unwrap_or_default(),
                name: row.try_get("name").unwrap_or_default(),
                launch_path: row.try_get("launch_path").unwrap_or_default(),
                launch_args,
                icon_path: row.try_get("icon_path").ok(),
                icon_blob: None,
                version: row.try_get("version").ok(),
                publisher: row.try_get("publisher").ok(),
                install_location: row.try_get("install_location").ok(),
                source: row.try_get("source").unwrap_or_default(),
            }
        })
        .collect()
}

/// Returns the raw icon PNG bytes for a single app.
pub async fn get_app_icon(pool: &SqlitePool, app_id: &str) -> Option<Vec<u8>> {
    sqlx::query("SELECT icon_blob FROM installed_apps WHERE id = ?")
        .bind(app_id)
        .fetch_optional(pool)
        .await
        .ok()
        .flatten()
        .and_then(|row| {
            row.try_get::<Option<Vec<u8>>, _>("icon_blob")
                .ok()
                .flatten()
        })
}

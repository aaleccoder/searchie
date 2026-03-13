use base64::{engine::general_purpose, Engine};
use serde::Serialize;
use serde_json::Value;
use sqlx::SqlitePool;
use std::{
    collections::{hash_map::DefaultHasher, HashMap, HashSet},
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

use crate::{db, features, icons};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const WATCH_INTERVAL_SECONDS: u64 = 8;
const DETACHED_PROCESS: u32 = 0x0000_0008;
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

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
    pub uninstall_command: Option<String>,
    pub source: String,
    /// Stored only in the DB; never serialised over the IPC boundary.
    #[serde(skip)]
    pub icon_blob: Option<Vec<u8>>,
}

fn app_by_id(state: &AppIndexState, app_id: &str) -> Result<InstalledApp, String> {
    state
        .get_apps()
        .into_iter()
        .find(|a| a.id == app_id)
        .ok_or_else(|| "app not found".to_string())
}

fn run_detached(executable: &str, args: &[String]) -> Result<(), String> {
    let mut cmd = Command::new(executable);
    if !args.is_empty() {
        cmd.args(args);
    }

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(DETACHED_PROCESS);
    }

    cmd.spawn().map_err(|e| e.to_string())?;
    Ok(())
}

fn is_uwp_shell_app(app: &InstalledApp) -> bool {
    app.launch_path.eq_ignore_ascii_case("explorer.exe")
        && app
            .launch_args
            .iter()
            .any(|arg| arg.to_lowercase().contains("shell:appsfolder\\"))
}

fn expand_windows_env_vars(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    let mut out = String::with_capacity(value.len());
    let mut i = 0usize;

    while i < chars.len() {
        if chars[i] == '%' {
            let mut j = i + 1;
            while j < chars.len() && chars[j] != '%' {
                j += 1;
            }

            if j < chars.len() && j > i + 1 {
                let key = chars[i + 1..j].iter().collect::<String>();
                if let Ok(expanded) = std::env::var(&key) {
                    out.push_str(&expanded);
                } else {
                    out.push('%');
                    out.push_str(&key);
                    out.push('%');
                }
                i = j + 1;
                continue;
            }
        }

        out.push(chars[i]);
        i += 1;
    }

    out
}

fn resolve_existing_openable_dir(raw: &str) -> Option<PathBuf> {
    let cleaned = clean_command_path(raw);
    if cleaned.is_empty() {
        return None;
    }

    let expanded = expand_windows_env_vars(&cleaned);
    let candidate = PathBuf::from(expanded.trim().trim_matches('"'));

    if candidate.is_dir() {
        return std::fs::read_dir(&candidate).ok().map(|_| candidate);
    }

    if candidate.is_file() {
        if let Some(parent) = candidate.parent() {
            let dir = parent.to_path_buf();
            return std::fs::read_dir(&dir).ok().map(|_| dir);
        }
    }

    None
}

fn resolve_existing_file_path(raw: &str) -> Option<PathBuf> {
    let cleaned = clean_command_path(raw);
    if cleaned.is_empty() {
        return None;
    }

    let expanded = expand_windows_env_vars(&cleaned);
    let candidate = PathBuf::from(expanded.trim().trim_matches('"'));
    if candidate.is_file() {
        Some(candidate)
    } else {
        None
    }
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
        let next_sig = compute_signature(&new_apps);

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
    p.exists()
        && p.extension()
            .map(|x| x.eq_ignore_ascii_case("exe"))
            .unwrap_or(false)
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
        let uninstall_command = read_string_value(&app_key, "QuietUninstallString")
            .or_else(|| read_string_value(&app_key, "UninstallString"));

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
            uninstall_command,
            source: source.to_string(),
        };

        apps.push(app);
    }

    apps
}

fn read_app_paths(root: &RegKey, source: &str) -> Vec<InstalledApp> {
    let app_paths_root =
        match root.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\App Paths") {
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
            uninstall_command: None,
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

    apps.extend(scan_uwp_apps());
    apps.extend(scan_start_apps());

    let mut dedup = HashMap::<String, InstalledApp>::new();
    for app in apps {
        let key = format!(
            "{}::{}",
            app.name.to_lowercase(),
            app.launch_path.to_lowercase()
        );
        dedup.entry(key).or_insert(app);
    }

    let mut values = dedup.into_values().collect::<Vec<_>>();
    values.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    values
}

#[derive(Clone, Default)]
struct UwpFamilyMeta {
    icon_path: Option<String>,
    version: Option<String>,
    publisher: Option<String>,
    install_location: Option<String>,
}

fn version_parts(version: &str) -> Vec<u32> {
    version
        .split('.')
        .filter_map(|p| p.trim().parse::<u32>().ok())
        .collect::<Vec<_>>()
}

fn is_version_newer(new_ver: &str, old_ver: &str) -> bool {
    let a = version_parts(new_ver);
    let b = version_parts(old_ver);
    let len = a.len().max(b.len());
    for i in 0..len {
        let av = *a.get(i).unwrap_or(&0);
        let bv = *b.get(i).unwrap_or(&0);
        if av > bv {
            return true;
        }
        if av < bv {
            return false;
        }
    }
    false
}

fn merge_uwp_family_meta(dst: &mut UwpFamilyMeta, src: UwpFamilyMeta) {
    if dst.icon_path.is_none() {
        dst.icon_path = src.icon_path.clone();
    }
    if dst.install_location.is_none() {
        dst.install_location = src.install_location.clone();
    }
    if dst.publisher.is_none() {
        dst.publisher = src.publisher.clone();
    }

    match (&dst.version, &src.version) {
        (None, Some(v)) => dst.version = Some(v.clone()),
        (Some(old), Some(new)) if is_version_newer(new, old) => dst.version = Some(new.clone()),
        _ => {}
    }
}

fn collect_uwp_family_meta_from_root(
    root: &RegKey,
    packages_path: &str,
    out: &mut HashMap<String, UwpFamilyMeta>,
) {
    let packages_key = match root.open_subkey(packages_path) {
        Ok(k) => k,
        Err(_) => return,
    };

    for pkg_name in packages_key.enum_keys().flatten() {
        if is_framework_package(&pkg_name) {
            continue;
        }

        let Some(family) = pkg_family_name(&pkg_name) else {
            continue;
        };

        let install_path = pkg_install_path(&pkg_name);
        let icon_path = install_path
            .as_ref()
            .and_then(|p| find_uwp_logo(p))
            .and_then(|p| p.to_str().map(|s| s.to_string()));

        let meta = UwpFamilyMeta {
            icon_path,
            version: pkg_version(&pkg_name),
            publisher: pkg_publisher(&pkg_name),
            install_location: install_path
                .as_ref()
                .and_then(|p| p.to_str().map(|s| s.to_string())),
        };

        if let Some(existing) = out.get_mut(&family) {
            merge_uwp_family_meta(existing, meta);
        } else {
            out.insert(family, meta);
        }
    }
}

fn build_uwp_family_meta_index() -> HashMap<String, UwpFamilyMeta> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let mut out = HashMap::new();

    collect_uwp_family_meta_from_root(
        &hkcu,
        "Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages",
        &mut out,
    );
    collect_uwp_family_meta_from_root(
        &hklm,
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages",
        &mut out,
    );

    out
}

/// Supplemental discovery from Start menu registrations.
/// This reliably includes system UWP apps like Settings/Clock.
fn scan_start_apps() -> Vec<InstalledApp> {
    let family_meta = build_uwp_family_meta_index();

    let mut cmd = Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-StartApps | Select-Object Name,AppID | ConvertTo-Json -Compress",
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
    if raw.is_empty() {
        return Vec::new();
    }

    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let rows = match parsed {
        Value::Array(v) => v,
        Value::Object(_) => vec![parsed],
        _ => return Vec::new(),
    };

    let mut seen = HashSet::<String>::new();
    let mut apps = Vec::new();

    for row in rows {
        let name = row
            .get("Name")
            .and_then(|v| v.as_str())
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or_default();

        let app_id = row
            .get("AppID")
            .and_then(|v| v.as_str())
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or_default();

        if name.is_empty() || app_id.is_empty() {
            continue;
        }

        // UWP / Store app IDs include `!` and can be launched via AppsFolder.
        if !app_id.contains('!') {
            continue;
        }

        if !seen.insert(app_id.to_string()) {
            continue;
        }

        let family = app_id.split('!').next().unwrap_or_default();
        let meta = family_meta.get(family);

        apps.push(InstalledApp {
            id: make_app_id(name, app_id, "startapps"),
            name: name.to_string(),
            launch_path: "explorer.exe".to_string(),
            launch_args: vec![format!("shell:AppsFolder\\{}", app_id)],
            icon_path: meta.and_then(|m| m.icon_path.clone()),
            icon_blob: None,
            version: meta.and_then(|m| m.version.clone()),
            publisher: meta.and_then(|m| m.publisher.clone()),
            install_location: meta.and_then(|m| m.install_location.clone()),
            uninstall_command: None,
            source: "startapps".to_string(),
        });
    }

    apps
}

// ── UWP / Microsoft Store apps ──────────────────────────────────────────────

fn is_framework_package(pkg_full_name: &str) -> bool {
    let lower = pkg_full_name.to_lowercase();
    lower.starts_with("microsoft.vclibs")
        || lower.starts_with("microsoft.net.")
        || lower.starts_with("microsoft.ui.xaml")
        || lower.starts_with("microsoft.services.")
        || lower.contains("vcjasper")
        || lower.contains("framework")
        || lower.contains("runtime")
}

/// `"Microsoft.WindowsCalculator_10.0_x64__hash"` → `"Microsoft.WindowsCalculator"`
fn pkg_identity_name(full: &str) -> &str {
    full.splitn(2, '_').next().unwrap_or(full)
}

/// `"Microsoft.WindowsCalculator_…"` → `"Windows Calculator"`
fn pkg_display_name(full: &str) -> String {
    let identity = pkg_identity_name(full);
    let short = identity.rsplit('.').next().unwrap_or(identity);
    // CamelCase → "Camel Case"
    let mut out = String::new();
    let chars: Vec<char> = short.chars().collect();
    for (i, &c) in chars.iter().enumerate() {
        let next_lower = chars.get(i + 1).map(|n| n.is_lowercase()).unwrap_or(false);
        if c.is_uppercase() && !out.is_empty() {
            let prev_upper = out.chars().last().map(|p| p.is_uppercase()).unwrap_or(false);
            if !prev_upper || next_lower {
                out.push(' ');
            }
        }
        out.push(c);
    }
    out
}

fn pkg_version(full: &str) -> Option<String> {
    full.splitn(4, '_').nth(1).map(|v| v.to_string())
}

fn pkg_publisher(full: &str) -> Option<String> {
    let identity = pkg_identity_name(full);
    let mut parts = identity.splitn(2, '.');
    let first = parts.next()?;
    if parts.next().is_some() {
        Some(first.to_string())
    } else {
        None
    }
}

/// `"Name_Version_Arch_ResourceId_PublisherId"` -> `"Name_PublisherId"`
fn pkg_family_name(full: &str) -> Option<String> {
    let parts = full.split('_').collect::<Vec<_>>();
    if parts.len() < 2 {
        return None;
    }
    let name = parts.first()?.trim();
    let publisher_id = parts.last()?.trim();
    if name.is_empty() || publisher_id.is_empty() {
        return None;
    }
    Some(format!("{}_{}", name, publisher_id))
}

/// Try `%ProgramFiles%\WindowsApps\{PackageFullName}` — may fail silently.
fn pkg_install_path(full: &str) -> Option<PathBuf> {
    let pf = std::env::var("ProgramFiles").ok()?;
    let p = PathBuf::from(pf).join("WindowsApps").join(full);
    if p.exists() { Some(p) } else { None }
}

/// Naively extract a non-resource `DisplayName` from an AppxManifest.xml.
fn manifest_display_name(pkg_path: &Path) -> Option<String> {
    let text = std::fs::read_to_string(pkg_path.join("AppxManifest.xml")).ok()?;
    // Per-application VisualElements attribute
    if let Some(pos) = text.find("VisualElements") {
        let tag_end = text[pos..].find('>').unwrap_or(text.len() - pos);
        let tag = &text[pos..pos + tag_end];
        if let Some(v) = xml_attr(tag, "DisplayName") {
            if !v.starts_with("ms-resource:") && !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    // Package-level <DisplayName> element
    if let Some(s) = text.find("<DisplayName>") {
        let rest = &text[s + "<DisplayName>".len()..];
        if let Some(e) = rest.find("</DisplayName>") {
            let v = rest[..e].trim();
            if !v.starts_with("ms-resource:") && !v.is_empty() {
                return Some(v.to_string());
            }
        }
    }
    None
}

fn xml_attr<'a>(text: &'a str, attr: &str) -> Option<&'a str> {
    let pat = format!("{}=\"", attr);
    let start = text.find(&pat)? + pat.len();
    let end = text[start..].find('"')? + start;
    Some(&text[start..end])
}

/// Returns AppxManifest `<Application ... Id="...">` values.
fn manifest_application_ids(pkg_path: &Path) -> Vec<String> {
    let text = match std::fs::read_to_string(pkg_path.join("AppxManifest.xml")) {
        Ok(t) => t,
        Err(_) => return Vec::new(),
    };

    let mut out = Vec::new();
    let mut offset = 0usize;
    while let Some(pos) = text[offset..].find("<Application") {
        let start = offset + pos;
        let end = match text[start..].find('>') {
            Some(e) => start + e,
            None => break,
        };
        let tag = &text[start..=end];
        if let Some(id) = xml_attr(tag, "Id") {
            let id = id.trim();
            if !id.is_empty() && !out.iter().any(|x| x == id) {
                out.push(id.to_string());
            }
        }
        offset = end + 1;
    }
    out
}

/// Search common asset paths for a PNG logo, including DPI-scaled variants.
fn find_uwp_logo(pkg_path: &Path) -> Option<PathBuf> {
    let candidates = [
        "Assets\\Square44x44Logo.png",
        "Assets\\SmallTile.png",
        "Assets\\StoreLogo.png",
        "Assets\\Square150x150Logo.png",
    ];
    for rel in &candidates {
        let full = pkg_path.join(rel);
        if full.exists() {
            return Some(full);
        }
        let rel_path = Path::new(rel);
        let stem = rel_path.file_stem().and_then(|s| s.to_str())?;
        let parent = rel_path.parent().unwrap_or(Path::new(""));
        for scale in &["scale-100", "scale-125", "scale-150", "scale-200"] {
            let scaled = pkg_path.join(parent).join(format!("{}.{}.png", stem, scale));
            if scaled.exists() {
                return Some(scaled);
            }
        }
        for size in &["16", "24", "32", "44", "48"] {
            let sized = pkg_path.join(parent).join(format!("{}.targetsize-{}.png", stem, size));
            if sized.exists() {
                return Some(sized);
            }
        }
    }
    None
}

fn scan_uwp_apps() -> Vec<InstalledApp> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let mut seen = HashSet::new();
    let mut apps = Vec::new();
    scan_uwp_from_root(
        &hkcu,
        "Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages",
        &mut seen,
        &mut apps,
    );
    scan_uwp_from_root(
        &hklm,
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\AppModel\\Repository\\Packages",
        &mut seen,
        &mut apps,
    );
    apps
}

fn scan_uwp_from_root(
    root: &RegKey,
    packages_path: &str,
    seen: &mut HashSet<String>,
    apps: &mut Vec<InstalledApp>,
) {
    let packages_key = match root.open_subkey(packages_path) {
        Ok(k) => k,
        Err(_) => return,
    };
    for pkg_name in packages_key.enum_keys().flatten() {
        if is_framework_package(&pkg_name) {
            continue;
        }
        let pkg_key = match packages_key.open_subkey(&pkg_name) {
            Ok(k) => k,
            Err(_) => continue,
        };
        let install_path = pkg_install_path(&pkg_name);
        let display_name = install_path
            .as_ref()
            .and_then(|p| manifest_display_name(p))
            .unwrap_or_else(|| pkg_display_name(&pkg_name));
        let version = pkg_version(&pkg_name);
        let publisher = pkg_publisher(&pkg_name);
        let icon_path_str = install_path
            .as_ref()
            .and_then(|p| find_uwp_logo(p))
            .and_then(|p| p.to_str().map(|s| s.to_string()));
        let install_location = install_path
            .as_ref()
            .and_then(|p| p.to_str().map(|s| s.to_string()));

        let mut aumids = Vec::<String>::new();

        if let Ok(apps_key) = pkg_key.open_subkey("Applications") {
            for app_id in apps_key.enum_keys().flatten() {
                let app_key = match apps_key.open_subkey(&app_id) {
                    Ok(k) => k,
                    Err(_) => continue,
                };
                let aumid: String = match app_key.get_value("AppUserModelId") {
                    Ok(v) => v,
                    Err(_) => continue,
                };
                if !aumid.is_empty() && !aumids.iter().any(|x| x == &aumid) {
                    aumids.push(aumid);
                }
            }
        }

        // Fallback when AppUserModelId registry values are missing: derive AUMID from manifest app IDs.
        if aumids.is_empty() {
            if let (Some(pkg_path), Some(family)) = (install_path.as_ref(), pkg_family_name(&pkg_name)) {
                for app_id in manifest_application_ids(pkg_path) {
                    let aumid = format!("{}!{}", family, app_id);
                    if !aumids.iter().any(|x| x == &aumid) {
                        aumids.push(aumid);
                    }
                }
            }
        }

        for aumid in aumids {
            if aumid.is_empty() || !seen.insert(aumid.clone()) {
                continue;
            }
            apps.push(InstalledApp {
                id: make_app_id(&display_name, &aumid, "uwp"),
                name: display_name.clone(),
                launch_path: "explorer.exe".to_string(),
                launch_args: vec![format!("shell:AppsFolder\\{}", aumid)],
                icon_path: icon_path_str.clone(),
                icon_blob: None,
                version: version.clone(),
                publisher: publisher.clone(),
                install_location: install_location.clone(),
                uninstall_command: None,
                source: "uwp".to_string(),
            });
        }
    }
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
    let app = app_by_id(state.inner(), &app_id)?;
    run_detached(&app.launch_path, &app.launch_args)
}

#[tauri::command]
pub fn launch_installed_app_as_admin(
    state: State<'_, AppIndexState>,
    app_id: String,
) -> Result<(), String> {
    let app = app_by_id(state.inner(), &app_id)?;

    if is_uwp_shell_app(&app) {
        return Err("run as administrator is not supported for this app type".to_string());
    }

    let mut cmd = Command::new("powershell");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "if ($args.Length -gt 1) { Start-Process -FilePath $args[0] -ArgumentList $args[1..($args.Length-1)] -Verb RunAs } else { Start-Process -FilePath $args[0] -Verb RunAs }",
        &app.launch_path,
    ]);

    if !app.launch_args.is_empty() {
        cmd.args(&app.launch_args);
    }

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(DETACHED_PROCESS);
    }

    cmd.spawn()
        .map_err(|e| format!("failed to elevate app launch: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn uninstall_installed_app(state: State<'_, AppIndexState>, app_id: String) -> Result<(), String> {
    let app = app_by_id(state.inner(), &app_id)?;
    let uninstall = app
        .uninstall_command
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .ok_or_else(|| "uninstaller command is not available for this app".to_string())?;

    let (exe, args) = parse_launch_command(uninstall);
    if exe.is_empty() {
        return Err("uninstaller command is invalid".to_string());
    }

    run_detached(&exe, &args)
}

#[tauri::command]
pub fn open_installed_app_properties(
    state: State<'_, AppIndexState>,
    app_id: String,
) -> Result<(), String> {
    let app = app_by_id(state.inner(), &app_id)?;
    let args = vec![
        "shell32.dll,ShellExec_RunDLL".to_string(),
        app.launch_path,
        "properties".to_string(),
    ];

    run_detached("rundll32.exe", &args)
}

#[tauri::command]
pub fn open_installed_app_install_location(
    state: State<'_, AppIndexState>,
    app_id: String,
) -> Result<(), String> {
    let app = app_by_id(state.inner(), &app_id)?;

    if is_uwp_shell_app(&app) {
        return Err("install location is not available for this app type".to_string());
    }

    if !app.launch_path.eq_ignore_ascii_case("explorer.exe") {
        if let Some(launch_file) = resolve_existing_file_path(&app.launch_path) {
            let select_flag = "/select,".to_string();
            let file_path = launch_file.to_string_lossy().to_string();
            return run_detached("explorer.exe", &[select_flag, file_path]);
        }
    }

    let open_target = app
        .install_location
        .as_ref()
        .and_then(|p| resolve_existing_openable_dir(p))
        .or_else(|| {
            // UWP/AppsFolder launch paths are virtual shell entries and cannot be mapped reliably.
            if app.launch_path.eq_ignore_ascii_case("explorer.exe") {
                None
            } else {
                resolve_existing_openable_dir(&app.launch_path)
            }
        })
        .ok_or_else(|| "install location is not available for this app".to_string())?;

    let open_target = open_target.to_string_lossy().to_string();
    run_detached("explorer.exe", &[open_target])
}

#[tauri::command]
pub async fn get_app_icon(
    state: State<'_, AppIndexState>,
    app_id: String,
) -> Result<Option<String>, String> {
    let pool = state.pool.get().ok_or_else(|| "db not ready".to_string())?;

    let bytes = db::get_app_icon(pool, &app_id).await;
    Ok(bytes.map(|b| general_purpose::STANDARD.encode(b)))
}

#[tauri::command]
pub async fn get_app_icons(
    state: State<'_, AppIndexState>,
    app_ids: Vec<String>,
) -> Result<HashMap<String, Option<String>>, String> {
    let pool = state.pool.get().ok_or_else(|| "db not ready".to_string())?;
    if app_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let bytes_map = db::get_app_icons(pool, &app_ids).await;
    let mut out = HashMap::new();
    for app_id in app_ids {
        let encoded = bytes_map
            .get(&app_id)
            .and_then(|bytes| bytes.as_ref().map(|raw| general_purpose::STANDARD.encode(raw)));
        out.insert(app_id, encoded);
    }

    Ok(out)
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
        let apps_with_icons = tokio::task::spawn_blocking(scan_with_icons)
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
    let _ = app.emit(features::events::APPS_UPDATED, ());

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

            let latest_with_icons = match tokio::task::spawn_blocking(scan_with_icons).await {
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
                let _ = app_handle.emit(features::events::APPS_UPDATED, ());
            }
        }
    });
}

/// Scans the registry for installed apps and extracts their icons.
/// Intended to be called inside `spawn_blocking`.
fn scan_with_icons() -> Vec<InstalledApp> {
    let mut apps = scan_installed_apps();
    for app in &mut apps {
        app.icon_blob = if app.source == "uwp" || app.source == "startapps" {
            // For packaged apps, prefer package logo files; fallback to AppsFolder shell icon.
            app.icon_path
                .as_ref()
                .and_then(|p| std::fs::read(p).ok())
                .or_else(|| {
                    app.launch_args
                        .first()
                        .and_then(|arg| arg.strip_prefix("shell:AppsFolder\\"))
                        .and_then(icons::extract_apps_folder_icon_png)
                })
        } else {
            icons::extract_icon_png(&app.launch_path)
        };
    }
    apps
}

fn compute_signature(apps: &[InstalledApp]) -> u64 {
    let mut hasher = DefaultHasher::new();
    for app in apps {
        app.id.hash(&mut hasher);
        app.name.hash(&mut hasher);
        app.launch_path.hash(&mut hasher);
        app.launch_args.hash(&mut hasher);
        app.version.hash(&mut hasher);
        app.icon_path.hash(&mut hasher);
        app.source.hash(&mut hasher);
    }
    hasher.finish()
}

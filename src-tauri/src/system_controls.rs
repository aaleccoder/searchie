use serde::Serialize;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]

#[cfg(target_os = "windows")]
use winapi::um::winuser::{
    keybd_event, KEYEVENTF_KEYUP, VK_MEDIA_NEXT_TRACK, VK_MEDIA_PLAY_PAUSE, VK_MEDIA_PREV_TRACK,
};

#[cfg(target_os = "windows")]
use windows::Win32::{
    Media::Audio::Endpoints::IAudioEndpointVolume,
    Media::Audio::{eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator},
    System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_ALL, COINIT_APARTMENTTHREADED,
    },
};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const BALANCED_GUID: &str = "381b4222-f694-41f0-9685-ff5bb260df2e";
const POWER_SAVER_GUID: &str = "a1841308-3541-4fab-bc81-f71556f20b4a";
const HIGH_PERFORMANCE_GUID: &str = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemCommandResult {
    pub applied: bool,
    pub used_fallback: bool,
    pub message: Option<String>,
}

impl SystemCommandResult {
    fn applied(message: &str) -> Self {
        Self {
            applied: true,
            used_fallback: false,
            message: Some(message.to_string()),
        }
    }

    fn fallback(message: &str) -> Self {
        Self {
            applied: true,
            used_fallback: true,
            message: Some(message.to_string()),
        }
    }
}

fn run_hidden_command(executable: &str, args: &[&str]) -> Result<String, String> {
    let mut command = Command::new(executable);
    command.args(args);

    #[cfg(target_os = "windows")]
    {
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let output = command
        .output()
        .map_err(|error| format!("failed to run '{executable}': {error}"))?;

    if !output.status.success() {
        return Err(format!(
            "'{executable}' failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn run_powershell(script: &str) -> Result<String, String> {
    run_hidden_command(
        "powershell.exe",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            script,
        ],
    )
}

fn open_settings_uri_internal(uri: &str) -> Result<SystemCommandResult, String> {
    let _ = run_hidden_command("explorer.exe", &[uri])?;
    Ok(SystemCommandResult::fallback(
        "Opened settings fallback URI.",
    ))
}

#[cfg(target_os = "windows")]
fn with_endpoint_volume<T>(
    f: impl FnOnce(IAudioEndpointVolume) -> Result<T, String>,
) -> Result<T, String> {
    unsafe {
        CoInitializeEx(None, COINIT_APARTMENTTHREADED)
            .ok()
            .map_err(|error| format!("CoInitializeEx failed: {error}"))?;

        let result = (|| {
            let enumerator: IMMDeviceEnumerator =
                CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL).map_err(|error| {
                    format!("CoCreateInstance(MMDeviceEnumerator) failed: {error}")
                })?;

            let device = enumerator
                .GetDefaultAudioEndpoint(eRender, eConsole)
                .map_err(|error| format!("GetDefaultAudioEndpoint failed: {error}"))?;

            let endpoint = device
                .Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None)
                .map_err(|error| format!("Activate(IAudioEndpointVolume) failed: {error}"))?;

            f(endpoint)
        })();

        CoUninitialize();
        result
    }
}

#[cfg(not(target_os = "windows"))]
fn with_endpoint_volume<T>(_f: impl FnOnce(()) -> Result<T, String>) -> Result<T, String> {
    Err("audio endpoint APIs are only available on Windows".to_string())
}

#[cfg(target_os = "windows")]
fn send_media_key(vk: u8, action_name: &str) -> Result<SystemCommandResult, String> {
    unsafe {
        keybd_event(vk, 0, 0, 0);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, 0);
    }

    Ok(SystemCommandResult::applied(action_name))
}

#[cfg(not(target_os = "windows"))]
fn send_media_key(_vk: u8, _action_name: &str) -> Result<SystemCommandResult, String> {
    Err("media key APIs are only available on Windows".to_string())
}

#[tauri::command]
pub fn media_play_pause() -> Result<SystemCommandResult, String> {
    send_media_key(VK_MEDIA_PLAY_PAUSE as u8, "Sent media play/pause key.")
}

#[tauri::command]
pub fn media_next() -> Result<SystemCommandResult, String> {
    send_media_key(VK_MEDIA_NEXT_TRACK as u8, "Sent media next key.")
}

#[tauri::command]
pub fn media_previous() -> Result<SystemCommandResult, String> {
    send_media_key(VK_MEDIA_PREV_TRACK as u8, "Sent media previous key.")
}

#[tauri::command]
pub fn set_system_volume(value: u8) -> Result<SystemCommandResult, String> {
    let clamped = value.min(100);
    with_endpoint_volume(|endpoint| unsafe {
        endpoint
            .SetMasterVolumeLevelScalar(clamped as f32 / 100.0, std::ptr::null() as *const windows::core::GUID)
            .map_err(|error| format!("SetMasterVolumeLevelScalar failed: {error}"))?;
        Ok(SystemCommandResult::applied("Set system volume."))
    })
}

#[tauri::command]
pub fn change_system_volume(delta: i8) -> Result<SystemCommandResult, String> {
    with_endpoint_volume(|endpoint| unsafe {
        let current = endpoint
            .GetMasterVolumeLevelScalar()
            .map_err(|error| format!("GetMasterVolumeLevelScalar failed: {error}"))?;

        let next = ((current * 100.0) + delta as f32).clamp(0.0, 100.0) / 100.0;
        endpoint
            .SetMasterVolumeLevelScalar(next, std::ptr::null() as *const windows::core::GUID)
            .map_err(|error| format!("SetMasterVolumeLevelScalar failed: {error}"))?;

        Ok(SystemCommandResult::applied("Changed system volume."))
    })
}

#[tauri::command]
pub fn set_system_mute(muted: bool) -> Result<SystemCommandResult, String> {
    with_endpoint_volume(|endpoint| unsafe {
        endpoint
            .SetMute(muted, std::ptr::null() as *const windows::core::GUID)
            .map_err(|error| format!("SetMute failed: {error}"))?;
        Ok(SystemCommandResult::applied("Updated mute state."))
    })
}

#[tauri::command]
pub fn toggle_system_mute() -> Result<SystemCommandResult, String> {
    with_endpoint_volume(|endpoint| unsafe {
        let current = endpoint
            .GetMute()
            .map_err(|error| format!("GetMute failed: {error}"))?;

        endpoint
            .SetMute(!current.as_bool(), std::ptr::null() as *const windows::core::GUID)
            .map_err(|error| format!("SetMute failed: {error}"))?;

        Ok(SystemCommandResult::applied("Toggled mute state."))
    })
}

#[tauri::command]
pub fn get_brightness() -> Result<Option<u8>, String> {
    let output = run_powershell(
        "(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1 -ExpandProperty CurrentBrightness)",
    )?;

    if output.is_empty() {
        return Ok(None);
    }

    let parsed = output.parse::<u8>().ok();
    Ok(parsed)
}

#[tauri::command]
pub fn set_brightness(value: u8) -> Result<SystemCommandResult, String> {
    let clamped = value.min(100);
    let script = format!(
        "$m=Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1; if ($m) {{ Invoke-CimMethod -InputObject $m -MethodName WmiSetBrightness -Arguments @{{ Timeout=0; Brightness={clamped} }} | Out-Null }}"
    );
    let _ = run_powershell(&script)?;
    Ok(SystemCommandResult::applied("Set brightness level."))
}

#[tauri::command]
pub fn change_brightness(delta: i8) -> Result<SystemCommandResult, String> {
    let current = get_brightness()?.unwrap_or(50) as i16;
    let next = (current + delta as i16).clamp(0, 100) as u8;
    set_brightness(next)
}

fn set_wifi_enabled_internal(enabled: bool) -> Result<SystemCommandResult, String> {
    let action = if enabled {
        "Enable-NetAdapter"
    } else {
        "Disable-NetAdapter"
    };
    let script = format!(
        "$adapter = Get-NetAdapter -Physical | Where-Object {{ $_.NdisPhysicalMedium -eq 9 -or $_.InterfaceDescription -match 'Wireless|Wi-Fi|802.11' }} | Select-Object -First 1; if ($adapter) {{ {action} -Name $adapter.Name -Confirm:$false | Out-Null }}"
    );
    let _ = run_powershell(&script)?;
    Ok(SystemCommandResult::applied("Updated Wi-Fi state."))
}

#[tauri::command]
pub fn set_wifi_enabled(enabled: bool) -> Result<SystemCommandResult, String> {
    set_wifi_enabled_internal(enabled)
}

#[tauri::command]
pub fn toggle_wifi() -> Result<SystemCommandResult, String> {
    let script = "$adapter = Get-NetAdapter -Physical | Where-Object { $_.NdisPhysicalMedium -eq 9 -or $_.InterfaceDescription -match 'Wireless|Wi-Fi|802.11' } | Select-Object -First 1; if ($adapter) { if ($adapter.Status -eq 'Up') { Disable-NetAdapter -Name $adapter.Name -Confirm:$false | Out-Null } else { Enable-NetAdapter -Name $adapter.Name -Confirm:$false | Out-Null } }";
    let _ = run_powershell(script)?;
    Ok(SystemCommandResult::applied("Toggled Wi-Fi state."))
}

#[tauri::command]
pub fn set_bluetooth_enabled(enabled: bool) -> Result<SystemCommandResult, String> {
    let _ = enabled;
    open_settings_uri_internal("ms-settings:bluetooth")
}

#[tauri::command]
pub fn toggle_bluetooth() -> Result<SystemCommandResult, String> {
    open_settings_uri_internal("ms-settings:bluetooth")
}

#[tauri::command]
pub fn set_airplane_mode(enabled: bool) -> Result<SystemCommandResult, String> {
    let _ = enabled;
    open_settings_uri_internal("ms-settings:network-airplanemode")
}

#[tauri::command]
pub fn toggle_airplane_mode() -> Result<SystemCommandResult, String> {
    open_settings_uri_internal("ms-settings:network-airplanemode")
}

#[tauri::command]
pub fn set_hotspot_enabled(enabled: bool) -> Result<SystemCommandResult, String> {
    let _ = enabled;
    open_settings_uri_internal("ms-settings:network-mobilehotspot")
}

#[tauri::command]
pub fn toggle_hotspot() -> Result<SystemCommandResult, String> {
    open_settings_uri_internal("ms-settings:network-mobilehotspot")
}

#[tauri::command]
pub fn set_power_profile(profile: String) -> Result<SystemCommandResult, String> {
    let guid = match profile.as_str() {
        "balanced" => BALANCED_GUID,
        "power-saver" => POWER_SAVER_GUID,
        "performance" => HIGH_PERFORMANCE_GUID,
        _ => return Err("invalid power profile".to_string()),
    };

    let _ = run_hidden_command("powercfg", &["/setactive", guid])?;
    Ok(SystemCommandResult::applied("Updated power profile."))
}

#[tauri::command]
pub fn open_system_settings_uri(uri: String) -> Result<SystemCommandResult, String> {
    if !uri.to_lowercase().starts_with("ms-settings:") {
        return Err("only ms-settings URIs are supported".to_string());
    }

    open_settings_uri_internal(&uri)
}

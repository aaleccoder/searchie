use crate::features::{CommandMeta, EventMeta, FeatureProvider};

pub struct SystemControlsFeatureProvider;

impl FeatureProvider for SystemControlsFeatureProvider {
    fn id(&self) -> &'static str {
        "system-controls"
    }

    fn init_order(&self) -> u8 {
        35
    }

    fn commands(&self) -> Vec<CommandMeta> {
        vec![
            CommandMeta::new("media_play_pause"),
            CommandMeta::new("media_next"),
            CommandMeta::new("media_previous"),
            CommandMeta::new("set_system_volume"),
            CommandMeta::new("change_system_volume"),
            CommandMeta::new("set_system_mute"),
            CommandMeta::new("toggle_system_mute"),
            CommandMeta::new("get_brightness"),
            CommandMeta::new("set_brightness"),
            CommandMeta::new("change_brightness"),
            CommandMeta::new("set_wifi_enabled"),
            CommandMeta::new("toggle_wifi"),
            CommandMeta::new("set_bluetooth_enabled"),
            CommandMeta::new("toggle_bluetooth"),
            CommandMeta::new("set_airplane_mode"),
            CommandMeta::new("toggle_airplane_mode"),
            CommandMeta::new("set_hotspot_enabled"),
            CommandMeta::new("toggle_hotspot"),
            CommandMeta::new("set_power_profile"),
            CommandMeta::new("open_system_settings_uri"),
        ]
    }

    fn events(&self) -> Vec<EventMeta> {
        vec![]
    }
}

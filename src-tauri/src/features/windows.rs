use crate::features::{CommandMeta, EventMeta, FeatureProvider};

pub struct WindowsFeatureProvider;

impl FeatureProvider for WindowsFeatureProvider {
    fn id(&self) -> &'static str {
        "windows"
    }

    fn init_order(&self) -> u8 {
        30
    }

    fn commands(&self) -> Vec<CommandMeta> {
        vec![
            CommandMeta::new("set_main_window_mode"),
            CommandMeta::new("show_settings"),
            CommandMeta::new("shell_execute_w"),
            CommandMeta::new("update_shortcut"),
        ]
    }

    fn events(&self) -> Vec<EventMeta> {
        vec![EventMeta::new(crate::features::events::OPEN_SETTINGS)]
    }
}

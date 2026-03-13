use crate::features::{CommandMeta, EventMeta, FeatureProvider};

pub struct ClipboardFeatureProvider;

impl FeatureProvider for ClipboardFeatureProvider {
    fn id(&self) -> &'static str {
        "clipboard"
    }

    fn init_order(&self) -> u8 {
        20
    }

    fn commands(&self) -> Vec<CommandMeta> {
        vec![
            CommandMeta::new("search_clipboard_history"),
            CommandMeta::new("clear_clipboard_history"),
            CommandMeta::new("toggle_clipboard_pin"),
            CommandMeta::new("delete_clipboard_entry"),
        ]
    }

    fn events(&self) -> Vec<EventMeta> {
        vec![EventMeta::new(crate::features::events::CLIPBOARD_UPDATED)]
    }
}

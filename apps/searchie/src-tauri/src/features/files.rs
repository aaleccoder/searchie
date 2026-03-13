use crate::features::{CommandMeta, EventMeta, FeatureProvider};

pub struct FilesFeatureProvider;

impl FeatureProvider for FilesFeatureProvider {
    fn id(&self) -> &'static str {
        "files"
    }

    fn init_order(&self) -> u8 {
        25
    }

    fn commands(&self) -> Vec<CommandMeta> {
        vec![
            CommandMeta::new("search_files"),
            CommandMeta::new("open_file_path"),
        ]
    }

    fn events(&self) -> Vec<EventMeta> {
        vec![]
    }
}

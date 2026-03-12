use crate::features::{CommandMeta, EventMeta, FeatureProvider};

pub struct AppsFeatureProvider;

impl FeatureProvider for AppsFeatureProvider {
    fn id(&self) -> &'static str {
        "apps"
    }

    fn init_order(&self) -> u8 {
        10
    }

    fn commands(&self) -> Vec<CommandMeta> {
        vec![
            CommandMeta::new("list_installed_apps"),
            CommandMeta::new("search_installed_apps"),
            CommandMeta::new("launch_installed_app"),
            CommandMeta::new("launch_installed_app_as_admin"),
            CommandMeta::new("uninstall_installed_app"),
            CommandMeta::new("open_installed_app_properties"),
            CommandMeta::new("open_installed_app_install_location"),
            CommandMeta::new("get_app_icons"),
            CommandMeta::new("get_app_icon"),
        ]
    }

    fn events(&self) -> Vec<EventMeta> {
        vec![EventMeta::new(crate::features::events::APPS_UPDATED)]
    }
}

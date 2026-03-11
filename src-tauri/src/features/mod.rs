pub mod apps;
pub mod clipboard;
pub mod events;
pub mod files;
pub mod windows;

use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CommandMeta {
    pub name: &'static str,
}

impl CommandMeta {
    pub const fn new(name: &'static str) -> Self {
        Self { name }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EventMeta {
    pub name: &'static str,
}

impl EventMeta {
    pub const fn new(name: &'static str) -> Self {
        Self { name }
    }
}

pub trait FeatureProvider: Send + Sync {
    fn id(&self) -> &'static str;
    fn init_order(&self) -> u8;
    fn commands(&self) -> Vec<CommandMeta>;
    fn events(&self) -> Vec<EventMeta>;
}

pub struct FeatureRegistry {
    providers: HashMap<&'static str, Box<dyn FeatureProvider>>,
}

impl FeatureRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
        }
    }

    pub fn register<P>(&mut self, provider: P) -> Result<(), String>
    where
        P: FeatureProvider + 'static,
    {
        let id = provider.id();
        if self.providers.contains_key(id) {
            return Err(format!("feature provider '{id}' already registered"));
        }

        self.providers.insert(id, Box::new(provider));
        Ok(())
    }

    pub fn ordered_feature_ids(&self) -> Vec<&'static str> {
        let mut providers: Vec<&dyn FeatureProvider> =
            self.providers.values().map(|p| p.as_ref()).collect();
        providers.sort_by_key(|provider| provider.init_order());
        providers
            .into_iter()
            .map(|provider| provider.id())
            .collect()
    }

    pub fn all_commands(&self) -> Vec<(&'static str, CommandMeta)> {
        let mut out = Vec::new();
        for provider in self.providers.values() {
            for command in provider.commands() {
                out.push((provider.id(), command));
            }
        }
        out
    }

    pub fn all_events(&self) -> Vec<(&'static str, EventMeta)> {
        let mut out = Vec::new();
        for provider in self.providers.values() {
            for event in provider.events() {
                out.push((provider.id(), event));
            }
        }
        out
    }

    pub fn validate_unique_commands(&self) -> Result<(), String> {
        let mut seen = HashSet::<&'static str>::new();
        for (_, command) in self.all_commands() {
            if !seen.insert(command.name) {
                return Err(format!(
                    "duplicate command metadata detected: {}",
                    command.name
                ));
            }
        }
        Ok(())
    }
}

impl Default for FeatureRegistry {
    fn default() -> Self {
        Self::new()
    }
}

pub fn build_builtin_feature_registry() -> Result<FeatureRegistry, String> {
    let mut registry = FeatureRegistry::new();
    registry.register(apps::AppsFeatureProvider)?;
    registry.register(clipboard::ClipboardFeatureProvider)?;
    registry.register(files::FilesFeatureProvider)?;
    registry.register(windows::WindowsFeatureProvider)?;
    registry.validate_unique_commands()?;
    Ok(registry)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct TestProvider {
        id: &'static str,
        order: u8,
        command_names: Vec<&'static str>,
        event_names: Vec<&'static str>,
    }

    impl FeatureProvider for TestProvider {
        fn id(&self) -> &'static str {
            self.id
        }

        fn init_order(&self) -> u8 {
            self.order
        }

        fn commands(&self) -> Vec<CommandMeta> {
            self.command_names
                .iter()
                .copied()
                .map(CommandMeta::new)
                .collect()
        }

        fn events(&self) -> Vec<EventMeta> {
            self.event_names
                .iter()
                .copied()
                .map(EventMeta::new)
                .collect()
        }
    }

    #[test]
    fn rejects_duplicate_provider_ids() {
        let mut registry = FeatureRegistry::new();
        registry
            .register(TestProvider {
                id: "same",
                order: 1,
                command_names: vec!["a"],
                event_names: vec![],
            })
            .expect("first registration should succeed");

        let duplicate = registry.register(TestProvider {
            id: "same",
            order: 2,
            command_names: vec!["b"],
            event_names: vec![],
        });

        assert!(duplicate.is_err());
    }

    #[test]
    fn exposes_command_and_event_metadata() {
        let mut registry = FeatureRegistry::new();
        registry
            .register(TestProvider {
                id: "alpha",
                order: 10,
                command_names: vec!["alpha_cmd"],
                event_names: vec!["alpha_evt"],
            })
            .expect("alpha should register");

        let commands = registry.all_commands();
        let events = registry.all_events();

        assert!(commands
            .iter()
            .any(|(id, c)| *id == "alpha" && c.name == "alpha_cmd"));
        assert!(events
            .iter()
            .any(|(id, e)| *id == "alpha" && e.name == "alpha_evt"));
    }

    #[test]
    fn sorts_features_by_init_order() {
        let mut registry = FeatureRegistry::new();
        registry
            .register(TestProvider {
                id: "third",
                order: 30,
                command_names: vec!["third_cmd"],
                event_names: vec![],
            })
            .expect("third should register");
        registry
            .register(TestProvider {
                id: "first",
                order: 10,
                command_names: vec!["first_cmd"],
                event_names: vec![],
            })
            .expect("first should register");
        registry
            .register(TestProvider {
                id: "second",
                order: 20,
                command_names: vec!["second_cmd"],
                event_names: vec![],
            })
            .expect("second should register");

        assert_eq!(
            registry.ordered_feature_ids(),
            vec!["first", "second", "third"]
        );
    }

    #[test]
    fn validates_command_uniqueness() {
        let mut registry = FeatureRegistry::new();
        registry
            .register(TestProvider {
                id: "first",
                order: 1,
                command_names: vec!["dup_cmd"],
                event_names: vec![],
            })
            .expect("first should register");
        registry
            .register(TestProvider {
                id: "second",
                order: 2,
                command_names: vec!["dup_cmd"],
                event_names: vec![],
            })
            .expect("second should register");

        let result = registry.validate_unique_commands();
        assert!(result.is_err());
    }

    #[test]
    fn builds_builtin_registry() {
        let registry = build_builtin_feature_registry().expect("builtin providers should register");
        assert!(registry
            .all_commands()
            .iter()
            .any(|(_, command)| command.name == "search_installed_apps"));
        assert!(registry
            .all_events()
            .iter()
            .any(|(_, event)| event.name == events::OPEN_SETTINGS));
    }
}

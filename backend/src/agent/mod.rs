pub mod runner;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

pub use runner::AgentRunner;

#[derive(Clone)]
pub struct TaskManager {
    runner: AgentRunner,
    channels: Arc<RwLock<HashMap<String, broadcast::Sender<String>>>>,
}

impl TaskManager {
    pub fn new(runner: AgentRunner) -> Self {
        Self {
            runner,
            channels: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_or_create_channel(&self, task_id: &str) -> broadcast::Sender<String> {
        let mut map = self.channels.write().await;
        if let Some(tx) = map.get(task_id) {
            tx.clone()
        } else {
            let (tx, _) = broadcast::channel(256);
            map.insert(task_id.to_string(), tx.clone());
            tx
        }
    }

    pub fn runner(&self) -> &AgentRunner {
        &self.runner
    }
}

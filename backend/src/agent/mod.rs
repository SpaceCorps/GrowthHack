pub mod runner;

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

pub use runner::AgentRunner;

pub struct TaskEntry {
    pub tx: broadcast::Sender<String>,
    pub history: Vec<String>,
    pub is_done: bool,
    send_log_pending: usize,
}

#[derive(Clone)]
pub struct TaskManager {
    runner: AgentRunner,
    tasks: Arc<RwLock<HashMap<String, TaskEntry>>>,
}

impl TaskManager {
    pub fn new(runner: AgentRunner) -> Self {
        Self {
            runner,
            tasks: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn get_or_create_channel(&self, task_id: &str) -> broadcast::Sender<String> {
        let mut map = self.tasks.write().await;
        if let Some(entry) = map.get(task_id) {
            entry.tx.clone()
        } else {
            let (tx, mut rx) = broadcast::channel::<String>(256);
            let tasks_clone = self.tasks.clone();
            let tid = task_id.to_string();

            tokio::spawn(async move {
                while let Ok(msg) = rx.recv().await {
                    let mut m = tasks_clone.write().await;
                    if let Some(entry) = m.get_mut(&tid) {
                        if entry.send_log_pending > 0 {
                            entry.send_log_pending -= 1;
                            continue;
                        }
                        if msg.contains("[DONE]") {
                            entry.is_done = true;
                        }
                        if entry.history.len() >= 500 {
                            entry.history.remove(0);
                        }
                        entry.history.push(msg);
                    }
                }
            });

            let entry = TaskEntry {
                tx: tx.clone(),
                history: Vec::new(),
                is_done: false,
                send_log_pending: 0,
            };
            map.insert(task_id.to_string(), entry);
            tx
        }
    }

    pub async fn send_log(&self, task_id: &str, msg: String) {
        let tx = self.get_or_create_channel(task_id).await;
        {
            let mut map = self.tasks.write().await;
            if let Some(entry) = map.get_mut(task_id) {
                if msg.contains("[DONE]") {
                    entry.is_done = true;
                }
                if entry.history.len() >= 500 {
                    entry.history.remove(0);
                }
                entry.history.push(msg.clone());
                entry.send_log_pending += 1;
            }
        }
        let _ = tx.send(msg);
    }

    pub async fn subscribe(&self, task_id: &str) -> (Vec<String>, broadcast::Receiver<String>) {
        let tx = self.get_or_create_channel(task_id).await;
        let map = self.tasks.read().await;
        let history = map
            .get(task_id)
            .map(|e| e.history.clone())
            .unwrap_or_default();
        (history, tx.subscribe())
    }

    pub async fn is_done(&self, task_id: &str) -> bool {
        let map = self.tasks.read().await;
        map.get(task_id).map(|e| e.is_done).unwrap_or(false)
    }

    pub async fn get_history(&self, task_id: &str) -> Vec<String> {
        let map = self.tasks.read().await;
        map.get(task_id)
            .map(|e| e.history.clone())
            .unwrap_or_default()
    }

    pub fn runner(&self) -> &AgentRunner {
        &self.runner
    }

    pub async fn spawn_task(
        &self,
        task_id: &str,
        prompt: impl Into<String>,
    ) -> tokio::task::JoinHandle<()> {
        self.spawn_task_with_callback(task_id, prompt, |_, _| async {}).await
    }

    pub async fn spawn_task_with_callback<F, Fut>(
        &self,
        task_id: &str,
        prompt: impl Into<String>,
        on_success: F,
    ) -> tokio::task::JoinHandle<()>
    where
        F: FnOnce(String, tokio::sync::broadcast::Sender<String>) -> Fut + Send + 'static,
        Fut: std::future::Future<Output = ()> + Send + 'static,
    {
        let tx = self.get_or_create_channel(task_id).await;
        let runner = self.runner.clone();
        let prompt = prompt.into();
        let task_id_string = task_id.to_string();

        tokio::spawn(async move {
            match runner.execute(&prompt, tx.clone()).await {
                Ok(content) => {
                    tracing::info!(task_id = %task_id_string, "Task execution completed successfully");
                    on_success(content, tx).await;
                }
                Err(err) => {
                    tracing::error!(task_id = %task_id_string, error = %err, "Task execution failed");
                    let _ = tx.send(format!("[ERROR] Generation failed: {}", err));
                }
            }
        })
    }
}

pub mod runner;

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};

pub use runner::AgentRunner;

pub const DEFAULT_COMPLETED_TASK_TTL: std::time::Duration = std::time::Duration::from_secs(3600); // 1 hour
pub const DEFAULT_MAX_COMPLETED_TASKS: usize = 100;

#[derive(Clone, Debug)]
pub struct TaskManagerConfig {
    pub completed_ttl: std::time::Duration,
    pub max_completed_tasks: usize,
}

impl Default for TaskManagerConfig {
    fn default() -> Self {
        let completed_ttl = std::env::var("TASK_COMPLETED_TTL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .map(std::time::Duration::from_secs)
            .unwrap_or(DEFAULT_COMPLETED_TASK_TTL);

        let max_completed_tasks = std::env::var("TASK_MAX_COMPLETED_TASKS")
            .ok()
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(DEFAULT_MAX_COMPLETED_TASKS);

        Self {
            completed_ttl,
            max_completed_tasks,
        }
    }
}

pub struct TaskEntry {
    pub tx: broadcast::Sender<String>,
    pub history: Vec<String>,
    pub is_done: bool,
    send_log_pending: usize,
    pub created_at: std::time::Instant,
    pub completed_at: Option<std::time::Instant>,
    pub last_accessed: std::time::Instant,
}

pub struct TaskManagerPersistence {
    pub state: crate::db::SharedState,
    pub data_file: std::path::PathBuf,
}

#[derive(Clone)]
pub struct TaskManager {
    runner: AgentRunner,
    tasks: Arc<RwLock<HashMap<String, TaskEntry>>>,
    evicted_tasks: Arc<RwLock<VecDeque<String>>>,
    config: TaskManagerConfig,
    persistence: Option<Arc<TaskManagerPersistence>>,
}

impl TaskManager {
    pub fn new(runner: AgentRunner) -> Self {
        Self::with_config(runner, TaskManagerConfig::default())
    }

    pub fn with_config(runner: AgentRunner, config: TaskManagerConfig) -> Self {
        Self {
            runner,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            evicted_tasks: Arc::new(RwLock::new(VecDeque::new())),
            config,
            persistence: None,
        }
    }

    pub async fn with_persistence(
        runner: AgentRunner,
        config: TaskManagerConfig,
        state: crate::db::SharedState,
        data_file: std::path::PathBuf,
    ) -> Self {
        let initial_tombstones = {
            let s = state.read().await;
            s.task_tombstones.clone()
        };
        let mut deque = VecDeque::new();
        for id in initial_tombstones {
            if deque.len() >= 1000 {
                deque.pop_front();
            }
            deque.push_back(id);
        }

        Self {
            runner,
            tasks: Arc::new(RwLock::new(HashMap::new())),
            evicted_tasks: Arc::new(RwLock::new(deque)),
            config,
            persistence: Some(Arc::new(TaskManagerPersistence { state, data_file })),
        }
    }

    pub async fn attach_persistence(
        &mut self,
        state: crate::db::SharedState,
        data_file: std::path::PathBuf,
    ) {
        let initial_tombstones = {
            let s = state.read().await;
            s.task_tombstones.clone()
        };
        {
            let mut evicted = self.evicted_tasks.write().await;
            for id in initial_tombstones {
                if !evicted.contains(&id) {
                    if evicted.len() >= 1000 {
                        evicted.pop_front();
                    }
                    evicted.push_back(id);
                }
            }
        }
        self.persistence = Some(Arc::new(TaskManagerPersistence { state, data_file }));
    }

    pub async fn load_tombstones(&self, tombstones: impl IntoIterator<Item = String>) {
        let mut evicted = self.evicted_tasks.write().await;
        for id in tombstones {
            if !evicted.contains(&id) {
                if evicted.len() >= 1000 {
                    evicted.pop_front();
                }
                evicted.push_back(id);
            }
        }
    }

    async fn sync_tombstones(&self, evicted: &VecDeque<String>) {
        if let Some(p) = &self.persistence {
            let mut state = p.state.write().await;
            state.task_tombstones = evicted.iter().cloned().collect();
            let _ = state.save(&p.data_file);
        }
    }

    pub fn config(&self) -> &TaskManagerConfig {
        &self.config
    }

    pub async fn get_or_create_channel(&self, task_id: &str) -> broadcast::Sender<String> {
        let (tx, need_sync, evicted_snapshot) = {
            let mut map = self.tasks.write().await;
            if let Some(entry) = map.get_mut(task_id) {
                entry.last_accessed = std::time::Instant::now();
                (entry.tx.clone(), false, VecDeque::new())
            } else {
                let (pruned_count, removed_tombstone, evicted_snapshot) = {
                    let mut evicted = self.evicted_tasks.write().await;
                    let pruned = Self::prune_completed_locked(&mut map, &mut evicted, &self.config);
                    let before_len = evicted.len();
                    evicted.retain(|id| id != task_id);
                    let removed = evicted.len() < before_len;
                    let snapshot = evicted.clone();
                    (pruned, removed, snapshot)
                };

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
                            if msg.contains("[DONE]") || msg.starts_with("[ERROR]") {
                                entry.is_done = true;
                                entry
                                    .completed_at
                                    .get_or_insert_with(std::time::Instant::now);
                            }
                            if entry.history.len() >= 500 {
                                entry.history.remove(0);
                            }
                            entry.history.push(msg);
                            entry.last_accessed = std::time::Instant::now();
                        }
                    }
                });

                let now = std::time::Instant::now();
                let entry = TaskEntry {
                    tx: tx.clone(),
                    history: Vec::new(),
                    is_done: false,
                    send_log_pending: 0,
                    created_at: now,
                    completed_at: None,
                    last_accessed: now,
                };
                map.insert(task_id.to_string(), entry);
                (tx, pruned_count > 0 || removed_tombstone, evicted_snapshot)
            }
        };

        if need_sync {
            self.sync_tombstones(&evicted_snapshot).await;
        }

        tx
    }

    pub async fn send_log(&self, task_id: &str, msg: String) {
        let tx = self.get_or_create_channel(task_id).await;
        {
            let mut map = self.tasks.write().await;
            if let Some(entry) = map.get_mut(task_id) {
                if msg.contains("[DONE]") || msg.starts_with("[ERROR]") {
                    entry.is_done = true;
                    entry
                        .completed_at
                        .get_or_insert_with(std::time::Instant::now);
                }
                if entry.history.len() >= 500 {
                    entry.history.remove(0);
                }
                entry.history.push(msg.clone());
                entry.last_accessed = std::time::Instant::now();
                entry.send_log_pending += 1;
            }
        }
        let _ = tx.send(msg);
    }

    pub async fn is_evicted(&self, task_id: &str) -> bool {
        let evicted = self.evicted_tasks.read().await;
        evicted.iter().any(|id| id == task_id)
    }

    pub async fn subscribe(&self, task_id: &str) -> (Vec<String>, broadcast::Receiver<String>) {
        if self.is_evicted(task_id).await {
            let (tx, rx) = broadcast::channel::<String>(1);
            drop(tx);
            return (
                vec![
                    "[EXPIRED] Task execution history expired and was evicted from cache."
                        .to_string(),
                ],
                rx,
            );
        }

        let tx = self.get_or_create_channel(task_id).await;
        let mut map = self.tasks.write().await;
        let history = if let Some(entry) = map.get_mut(task_id) {
            entry.last_accessed = std::time::Instant::now();
            entry.history.clone()
        } else {
            Vec::new()
        };
        (history, tx.subscribe())
    }

    pub async fn is_done(&self, task_id: &str) -> bool {
        let map = self.tasks.read().await;
        map.get(task_id).map(|e| e.is_done).unwrap_or(false)
    }

    pub async fn get_history(&self, task_id: &str) -> Vec<String> {
        if self.is_evicted(task_id).await {
            return vec![
                "[EXPIRED] Task execution history expired and was evicted from cache.".to_string(),
            ];
        }

        let mut map = self.tasks.write().await;
        if let Some(entry) = map.get_mut(task_id) {
            entry.last_accessed = std::time::Instant::now();
            entry.history.clone()
        } else {
            Vec::new()
        }
    }

    /// Prune completed tasks according to TTL and maximum completed task capacity.
    /// Incomplete tasks are never pruned. Returns the number of evicted tasks.
    pub async fn prune_completed(&self) -> usize {
        let (evicted_count, evicted_snapshot) = {
            let mut map = self.tasks.write().await;
            let mut evicted = self.evicted_tasks.write().await;
            let count = Self::prune_completed_locked(&mut map, &mut evicted, &self.config);
            let snapshot = evicted.clone();
            (count, snapshot)
        };

        if evicted_count > 0 {
            self.sync_tombstones(&evicted_snapshot).await;
        }

        evicted_count
    }

    fn prune_completed_locked(
        map: &mut HashMap<String, TaskEntry>,
        evicted_tasks: &mut VecDeque<String>,
        config: &TaskManagerConfig,
    ) -> usize {
        let now = std::time::Instant::now();
        let mut evicted = 0;

        // 1. Evict tasks exceeding TTL
        map.retain(|id, entry| {
            if entry.is_done {
                let completed_at = entry.completed_at.unwrap_or(entry.created_at);
                if now.checked_duration_since(completed_at).unwrap_or_default()
                    >= config.completed_ttl
                {
                    let _ = entry.tx.send(
                        "[EXPIRED] Task execution history expired and was evicted from cache."
                            .to_string(),
                    );
                    if evicted_tasks.len() >= 1000 {
                        evicted_tasks.pop_front();
                    }
                    evicted_tasks.push_back(id.clone());
                    evicted += 1;
                    return false;
                }
            }
            true
        });

        // 2. If completed tasks count still exceeds max_completed_tasks, evict LRU completed tasks
        let mut completed_keys: Vec<(String, std::time::Instant)> = map
            .iter()
            .filter(|(_, entry)| entry.is_done)
            .map(|(id, entry)| (id.clone(), entry.last_accessed))
            .collect();

        if completed_keys.len() > config.max_completed_tasks {
            // Sort ascending by last_accessed so oldest accessed are first
            completed_keys.sort_by_key(|(_, last_accessed)| *last_accessed);
            let excess = completed_keys.len() - config.max_completed_tasks;
            for (id, _) in completed_keys.into_iter().take(excess) {
                if let Some(entry) = map.remove(&id) {
                    let _ = entry.tx.send(
                        "[EXPIRED] Task execution history expired and was evicted from cache."
                            .to_string(),
                    );
                    if evicted_tasks.len() >= 1000 {
                        evicted_tasks.pop_front();
                    }
                    evicted_tasks.push_back(id);
                    evicted += 1;
                }
            }
        }

        evicted
    }

    /// Return total number of tracked tasks.
    pub async fn task_count(&self) -> usize {
        self.tasks.read().await.len()
    }

    /// Return total number of completed tasks.
    pub async fn completed_task_count(&self) -> usize {
        self.tasks
            .read()
            .await
            .values()
            .filter(|e| e.is_done)
            .count()
    }

    /// Check if a task exists in the task manager.
    pub async fn has_task(&self, task_id: &str) -> bool {
        self.tasks.read().await.contains_key(task_id)
    }

    pub fn runner(&self) -> &AgentRunner {
        &self.runner
    }

    pub async fn spawn_task(
        &self,
        task_id: &str,
        prompt: impl Into<String>,
    ) -> tokio::task::JoinHandle<()> {
        self.spawn_task_with_timeout(task_id, prompt, None).await
    }

    pub async fn spawn_task_with_timeout(
        &self,
        task_id: &str,
        prompt: impl Into<String>,
        timeout_override: Option<std::time::Duration>,
    ) -> tokio::task::JoinHandle<()> {
        self.spawn_task_with_callback_and_timeout(task_id, prompt, timeout_override, |_, _| async {
        })
        .await
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
        self.spawn_task_with_callback_and_timeout(task_id, prompt, None, on_success)
            .await
    }

    pub async fn spawn_task_with_callback_and_timeout<F, Fut>(
        &self,
        task_id: &str,
        prompt: impl Into<String>,
        timeout_override: Option<std::time::Duration>,
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
            match runner
                .execute_with_timeout(&prompt, tx.clone(), timeout_override)
                .await
            {
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

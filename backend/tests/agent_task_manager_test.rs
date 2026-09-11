use growthhack_backend::agent::{AgentRunner, TaskManager};
use std::path::PathBuf;

#[tokio::test]
async fn test_task_manager_history_replay() {
    let runner = AgentRunner::new(PathBuf::from("dummy_agy"));
    let task_manager = TaskManager::new(runner);

    for i in 1..=5 {
        task_manager
            .send_log("task-replay-1", format!("[LOG] Message {}", i))
            .await;
    }

    let (history, _rx) = task_manager.subscribe("task-replay-1").await;
    assert_eq!(history.len(), 5);
    for i in 1..=5 {
        assert_eq!(history[i - 1], format!("[LOG] Message {}", i));
    }
}

#[tokio::test]
async fn test_task_manager_late_subscriber_receives_done() {
    let runner = AgentRunner::new(PathBuf::from("dummy_agy"));
    let task_manager = TaskManager::new(runner);

    task_manager
        .send_log("task-done-1", "[SYSTEM] Starting task...".to_string())
        .await;
    task_manager
        .send_log(
            "task-done-1",
            "[DONE] Antigravity turn completed successfully.".to_string(),
        )
        .await;

    assert!(task_manager.is_done("task-done-1").await);

    let (history, _rx) = task_manager.subscribe("task-done-1").await;
    assert_eq!(history.len(), 2);
    assert_eq!(history[0], "[SYSTEM] Starting task...");
    assert_eq!(history[1], "[DONE] Antigravity turn completed successfully.");
}

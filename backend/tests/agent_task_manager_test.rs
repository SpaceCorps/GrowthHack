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
    assert_eq!(
        history[1],
        "[DONE] Antigravity turn completed successfully."
    );
}

#[cfg(unix)]
fn create_mock_agy_script() -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = std::env::temp_dir().join(format!("mock_agy_{}.sh", uuid::Uuid::new_v4().simple()));
    std::fs::write(&path, "#!/bin/sh\necho 'Mock generated article content'\n").unwrap();
    let mut perms = std::fs::metadata(&path).unwrap().permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(&path, perms).unwrap();
    path
}

#[cfg(windows)]
fn create_mock_agy_script() -> PathBuf {
    let path = std::env::temp_dir().join(format!("mock_agy_{}.cmd", uuid::Uuid::new_v4().simple()));
    std::fs::write(
        &path,
        "@echo off\r\necho Mock generated article content\r\n",
    )
    .unwrap();
    path
}

#[tokio::test]
async fn test_task_manager_spawn_task_handles_execution_failure() {
    let runner = AgentRunner::new(PathBuf::from("nonexistent_binary_for_test_12345"));
    let task_manager = TaskManager::new(runner);

    let task_id = "task-fail-test-1";
    let (_history, mut rx) = task_manager.subscribe(task_id).await;

    let handle = task_manager
        .spawn_task(task_id, "Test prompt that fails execution")
        .await;

    let res = handle.await;
    assert!(res.is_ok(), "Task JoinHandle should complete successfully");

    let mut error_found = false;
    while let Ok(msg) = rx.try_recv() {
        if msg.starts_with("[ERROR]") {
            error_found = true;
            break;
        }
    }
    let history = task_manager.get_history(task_id).await;
    assert!(
        error_found || history.iter().any(|m| m.starts_with("[ERROR]")),
        "Expected [ERROR] message in broadcast channel or history"
    );
}

#[tokio::test]
async fn test_task_manager_spawn_task_with_callback_invokes_on_success() {
    let mock_path = create_mock_agy_script();
    let runner = AgentRunner::new(mock_path.clone());
    let task_manager = TaskManager::new(runner);

    let task_id = "task-success-test-1";
    let (_history, _rx) = task_manager.subscribe(task_id).await;

    let (called_tx, mut called_rx) = tokio::sync::mpsc::channel::<(String, String)>(1);

    let handle = task_manager
        .spawn_task_with_callback(
            task_id,
            "Generate test content",
            move |content, tx| async move {
                let _ = tx.send("[SYSTEM] Callback executed successfully".to_string());
                let _ = called_tx
                    .send((
                        content,
                        "[SYSTEM] Callback executed successfully".to_string(),
                    ))
                    .await;
            },
        )
        .await;

    let res = handle.await;
    assert!(res.is_ok(), "Task JoinHandle should complete successfully");

    let (content, marker) = called_rx
        .recv()
        .await
        .expect("on_success callback should have been invoked");
    assert!(
        content.contains("Mock generated article content"),
        "Content should contain output from mock runner"
    );
    assert_eq!(marker, "[SYSTEM] Callback executed successfully");

    let _ = std::fs::remove_file(mock_path);
}

#[cfg(unix)]
fn create_slow_mock_agy_script() -> PathBuf {
    use std::os::unix::fs::PermissionsExt;
    let path = std::env::temp_dir().join(format!(
        "slow_mock_agy_{}.sh",
        uuid::Uuid::new_v4().simple()
    ));
    std::fs::write(&path, "#!/bin/sh\nsleep 2\n").unwrap();
    let mut perms = std::fs::metadata(&path).unwrap().permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(&path, perms).unwrap();
    path
}

#[cfg(windows)]
fn create_slow_mock_agy_script() -> PathBuf {
    let path = std::env::temp_dir().join(format!(
        "slow_mock_agy_{}.cmd",
        uuid::Uuid::new_v4().simple()
    ));
    std::fs::write(&path, "@echo off\r\nping 127.0.0.1 -n 3 > nul\r\n").unwrap();
    path
}

#[tokio::test]
async fn test_task_manager_spawn_task_with_timeout_override() {
    let mock_path = create_slow_mock_agy_script();
    let runner = AgentRunner::with_timeout(mock_path.clone(), std::time::Duration::from_secs(300));
    let task_manager = TaskManager::new(runner);

    let task_id = "task-timeout-override-1";
    let (_history, mut rx) = task_manager.subscribe(task_id).await;

    let handle = task_manager
        .spawn_task_with_timeout(
            task_id,
            "Slow task with timeout override",
            Some(std::time::Duration::from_millis(50)),
        )
        .await;

    let res = handle.await;
    assert!(res.is_ok(), "Task JoinHandle should complete successfully");

    let mut error_found = false;
    while let Ok(msg) = rx.try_recv() {
        if msg.starts_with("[ERROR]") && msg.contains("timed out after 50ms") {
            error_found = true;
            break;
        }
    }
    let history = task_manager.get_history(task_id).await;
    assert!(
        error_found
            || history
                .iter()
                .any(|m| m.starts_with("[ERROR]") && m.contains("timed out after 50ms")),
        "Expected timeout error message in broadcast channel or history, got history: {:?}",
        history
    );

    let _ = std::fs::remove_file(mock_path);
}

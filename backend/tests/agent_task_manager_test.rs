use growthhack_backend::agent::{AgentRunner, TaskManager, TaskManagerConfig};
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

#[tokio::test]
async fn test_task_manager_concurrent_tasks() {
    let mock_path = create_mock_agy_script();
    let runner = AgentRunner::new(mock_path.clone());
    let task_manager = std::sync::Arc::new(TaskManager::new(runner));

    let count = 5;
    let mut handles = Vec::new();
    let (tx, mut rx) = tokio::sync::mpsc::channel::<usize>(count);

    for i in 0..count {
        let tm = task_manager.clone();
        let task_id = format!("task-concurrent-{}", i);
        let tx_clone = tx.clone();

        let handle = tm
            .spawn_task_with_callback(
                &task_id,
                format!("Prompt {}", i),
                move |_content, _task_tx| async move {
                    let _ = tx_clone.send(i).await;
                },
            )
            .await;
        handles.push(handle);
    }

    for handle in handles {
        let res = handle.await;
        assert!(res.is_ok(), "Concurrent task join handle failed");
    }

    let mut completed = Vec::new();
    for _ in 0..count {
        if let Some(idx) = rx.recv().await {
            completed.push(idx);
        }
    }
    assert_eq!(completed.len(), count);

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

#[tokio::test]
async fn test_task_manager_prune_completed_ttl() {
    let runner = AgentRunner::new(PathBuf::from("dummy_agy"));
    let config = TaskManagerConfig {
        completed_ttl: std::time::Duration::from_millis(50),
        max_completed_tasks: 100,
    };
    let task_manager = TaskManager::with_config(runner, config);

    // Create tasks:
    // task-ttl-old: will be marked done early, then sleep > TTL
    // task-ttl-young: created early, but marked done after sleep
    // task-active: will remain in-progress (not done)
    task_manager
        .send_log("task-ttl-old", "[LOG] Starting old task".to_string())
        .await;
    task_manager
        .send_log("task-ttl-young", "[LOG] Starting young task".to_string())
        .await;
    task_manager
        .send_log("task-active", "[LOG] Still processing...".to_string())
        .await;

    // Complete task-ttl-old
    task_manager
        .send_log("task-ttl-old", "[DONE] Finished early".to_string())
        .await;
    assert!(task_manager.is_done("task-ttl-old").await);
    assert!(!task_manager.is_done("task-ttl-young").await);
    assert!(!task_manager.is_done("task-active").await);

    // Sleep long enough for task-ttl-old to exceed completed_ttl
    tokio::time::sleep(std::time::Duration::from_millis(70)).await;

    // Now complete task-ttl-young
    task_manager
        .send_log("task-ttl-young", "[DONE] Finished recently".to_string())
        .await;
    assert!(task_manager.is_done("task-ttl-young").await);

    assert_eq!(task_manager.task_count().await, 3);
    assert_eq!(task_manager.completed_task_count().await, 2);

    let evicted = task_manager.prune_completed().await;
    assert_eq!(evicted, 1, "Expected 1 task evicted due to TTL expiration");

    assert!(
        !task_manager.has_task("task-ttl-old").await,
        "Old completed task should be evicted"
    );
    assert!(
        task_manager.has_task("task-ttl-young").await,
        "Young completed task should be retained"
    );
    assert!(
        task_manager.has_task("task-active").await,
        "Active task should be retained"
    );

    assert_eq!(task_manager.task_count().await, 2);
    assert_eq!(task_manager.completed_task_count().await, 1);
}

#[tokio::test]
async fn test_task_manager_prune_lru_capacity() {
    let runner = AgentRunner::new(PathBuf::from("dummy_agy"));
    let config = TaskManagerConfig {
        completed_ttl: std::time::Duration::from_secs(3600), // high TTL so only capacity eviction triggers
        max_completed_tasks: 2,
    };
    let task_manager = TaskManager::with_config(runner, config);

    // Create an active task first so it doesn't trigger channel-creation prune later
    task_manager
        .send_log("task-active", "[LOG] In progress".to_string())
        .await;

    // 1. Complete task-lru-1
    task_manager
        .send_log("task-lru-1", "[DONE] Task 1 done".to_string())
        .await;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    // 2. Complete task-lru-2
    task_manager
        .send_log("task-lru-2", "[DONE] Task 2 done".to_string())
        .await;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    // 3. Complete task-lru-3
    task_manager
        .send_log("task-lru-3", "[DONE] Task 3 done".to_string())
        .await;
    tokio::time::sleep(std::time::Duration::from_millis(10)).await;

    // Refresh last_accessed of task-lru-1 by accessing its history
    // Now last_accessed order from oldest to newest is: task-lru-2 (oldest), task-lru-3, task-lru-1
    let history = task_manager.get_history("task-lru-1").await;
    assert!(!history.is_empty());

    assert_eq!(task_manager.task_count().await, 4);
    assert_eq!(task_manager.completed_task_count().await, 3);

    let evicted = task_manager.prune_completed().await;
    assert_eq!(
        evicted, 1,
        "Expected 1 task evicted due to max_completed_tasks cap"
    );

    // task-lru-2 was least recently accessed, so it should be evicted
    assert!(
        !task_manager.has_task("task-lru-2").await,
        "task-lru-2 should have been evicted as LRU"
    );
    assert!(
        task_manager.has_task("task-lru-1").await,
        "task-lru-1 was accessed recently, should be retained"
    );
    assert!(
        task_manager.has_task("task-lru-3").await,
        "task-lru-3 is more recent than task-lru-2, should be retained"
    );
    assert!(
        task_manager.has_task("task-active").await,
        "task-active should never be evicted"
    );

    assert_eq!(task_manager.task_count().await, 3);
    assert_eq!(task_manager.completed_task_count().await, 2);
}

#[tokio::test]
async fn test_task_manager_active_tasks_never_pruned() {
    let runner = AgentRunner::new(PathBuf::from("dummy_agy"));
    let config = TaskManagerConfig {
        completed_ttl: std::time::Duration::from_millis(5),
        max_completed_tasks: 0, // Capacity 0 for completed tasks
    };
    let task_manager = TaskManager::with_config(runner, config);

    task_manager
        .send_log("task-active-1", "[LOG] Processing step A".to_string())
        .await;
    task_manager
        .send_log("task-active-2", "[LOG] Processing step B".to_string())
        .await;

    // Wait long enough to exceed completed_ttl
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;

    let evicted = task_manager.prune_completed().await;
    assert_eq!(evicted, 0, "Active tasks must never be evicted");

    assert!(task_manager.has_task("task-active-1").await);
    assert!(task_manager.has_task("task-active-2").await);
    assert_eq!(task_manager.task_count().await, 2);
    assert_eq!(task_manager.completed_task_count().await, 0);
}

#[tokio::test]
async fn test_task_manager_auto_prune_on_create() {
    let runner = AgentRunner::new(PathBuf::from("dummy_agy"));
    let config = TaskManagerConfig {
        completed_ttl: std::time::Duration::from_millis(40),
        max_completed_tasks: 100,
    };
    let task_manager = TaskManager::with_config(runner, config);

    // Create and complete task-auto-1
    task_manager
        .send_log("task-auto-1", "[DONE] Finished".to_string())
        .await;
    assert!(task_manager.has_task("task-auto-1").await);

    // Sleep past TTL
    tokio::time::sleep(std::time::Duration::from_millis(60)).await;

    // Creating a new task channel should automatically prune task-auto-1
    let _tx = task_manager.get_or_create_channel("task-auto-new").await;

    assert!(
        !task_manager.has_task("task-auto-1").await,
        "Expired completed task should be auto-pruned on channel creation"
    );
    assert!(
        task_manager.has_task("task-auto-new").await,
        "New task should exist"
    );
    assert_eq!(task_manager.task_count().await, 1);
}

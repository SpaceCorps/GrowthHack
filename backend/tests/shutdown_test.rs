use growthhack_backend::api::{AppContext, MetricsSyncDebouncer};
use growthhack_backend::config::create_periodic_interval;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_util::sync::CancellationToken;

#[tokio::test]
async fn test_cancellation_token_propagation_exits_loop() {
    let token = CancellationToken::new();
    let task_token = token.child_token();
    let exited = Arc::new(AtomicBool::new(false));
    let exited_clone = Arc::clone(&exited);

    // Create an interval with a long period (1 hour) so it would block indefinitely without cancellation
    let handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = task_token.cancelled() => {
                    exited_clone.store(true, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    // Wait a brief moment to ensure the task has started and is awaiting tick or cancellation
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert!(!exited.load(Ordering::SeqCst));

    // Cancel the root token
    token.cancel();

    // The task should terminate promptly within 500ms
    let join_res = tokio::time::timeout(Duration::from_millis(500), handle).await;
    assert!(join_res.is_ok(), "Task loop did not exit within timeout upon cancellation");
    assert!(exited.load(Ordering::SeqCst), "Task loop did not mark exited flag upon cancellation");
}

#[tokio::test]
async fn test_child_token_cancellation_propagates_from_parent() {
    let root_token = CancellationToken::new();

    let child1 = root_token.child_token();
    let child2 = root_token.child_token();
    let child3 = root_token.child_token();
    let child4 = root_token.child_token();

    assert!(!child1.is_cancelled());
    assert!(!child2.is_cancelled());
    assert!(!child3.is_cancelled());
    assert!(!child4.is_cancelled());

    let counter = Arc::new(AtomicUsize::new(0));

    let mut handles = Vec::new();
    for child in [child1.clone(), child2.clone(), child3.clone(), child4.clone()] {
        let cnt = Arc::clone(&counter);
        handles.push(tokio::spawn(async move {
            let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(100));
            loop {
                tokio::select! {
                    _ = child.cancelled() => {
                        cnt.fetch_add(1, Ordering::SeqCst);
                        break;
                    }
                    _ = interval.tick() => {}
                }
            }
        }));
    }

    // Cancel the parent token
    root_token.cancel();

    assert!(child1.is_cancelled());
    assert!(child2.is_cancelled());
    assert!(child3.is_cancelled());
    assert!(child4.is_cancelled());

    for handle in handles {
        let res = tokio::time::timeout(Duration::from_millis(500), handle).await;
        assert!(res.is_ok(), "Child background task failed to exit within timeout");
    }

    assert_eq!(counter.load(Ordering::SeqCst), 4);
}

#[tokio::test]
async fn test_shutdown_timeout_behavior_clean_and_overdue() {
    // 1. Clean exit within timeout
    let root_token = CancellationToken::new();
    let token_a = root_token.child_token();
    let token_b = root_token.child_token();

    let handle_a = tokio::spawn(async move {
        token_a.cancelled().await;
    });
    let handle_b = tokio::spawn(async move {
        token_b.cancelled().await;
    });

    root_token.cancel();

    let shutdown_timeout = Duration::from_millis(500);
    let tasks_shutdown = async {
        let _ = tokio::join!(handle_a, handle_b);
    };

    let result = tokio::time::timeout(shutdown_timeout, tasks_shutdown).await;
    assert!(result.is_ok(), "Clean join group should succeed within timeout");

    // 2. Overdue task triggers timeout
    let slow_handle = tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(500)).await;
    });

    let short_timeout = Duration::from_millis(50);
    let overdue_result = tokio::time::timeout(short_timeout, slow_handle).await;
    assert!(overdue_result.is_err(), "Long running task should time out");
}

#[tokio::test]
async fn test_full_server_shutdown_joins_all_background_tasks() {
    let guard = AppContext::new_test_context();
    let cancel_token = CancellationToken::new();

    let (debouncer, worker) =
        MetricsSyncDebouncer::new(Duration::from_millis(20), Duration::from_millis(40));
    let metrics_handle = worker.spawn(Arc::downgrade(&guard.ctx), cancel_token.child_token());

    let exit_count = Arc::new(AtomicUsize::new(0));

    let sync_token = cancel_token.child_token();
    let sync_exit_count = Arc::clone(&exit_count);
    let sync_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = sync_token.cancelled() => {
                    sync_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    let timeout_token = cancel_token.child_token();
    let timeout_exit_count = Arc::clone(&exit_count);
    let timeout_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = timeout_token.cancelled() => {
                    timeout_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    let pr_poll_token = cancel_token.child_token();
    let pr_poll_exit_count = Arc::clone(&exit_count);
    let pr_poll_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = pr_poll_token.cancelled() => {
                    pr_poll_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    let prune_token = cancel_token.child_token();
    let prune_exit_count = Arc::clone(&exit_count);
    let prune_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = prune_token.cancelled() => {
                    prune_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    // Wait for all tasks to reach their await point before cancelling.
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(exit_count.load(Ordering::SeqCst), 0);

    cancel_token.cancel();

    let tasks_shutdown = async {
        let _ = tokio::join!(
            sync_handle,
            timeout_handle,
            pr_poll_handle,
            prune_handle,
            metrics_handle,
        );
    };
    let result = tokio::time::timeout(Duration::from_millis(500), tasks_shutdown).await;
    assert!(
        result.is_ok(),
        "Full background task group did not join within shutdown timeout"
    );

    assert_eq!(exit_count.load(Ordering::SeqCst), 4);
    assert_eq!(debouncer.sync_count(), 0);
    assert!(!debouncer.is_syncing());
}

#[tokio::test]
async fn test_full_server_shutdown_with_metrics_sync_pending() {
    let guard = AppContext::new_test_context();
    let cancel_token = CancellationToken::new();

    let (debouncer, worker) =
        MetricsSyncDebouncer::new(Duration::from_millis(20), Duration::from_millis(40));
    let metrics_handle = worker.spawn(Arc::downgrade(&guard.ctx), cancel_token.child_token());

    let exit_count = Arc::new(AtomicUsize::new(0));

    let sync_token = cancel_token.child_token();
    let sync_exit_count = Arc::clone(&exit_count);
    let sync_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = sync_token.cancelled() => {
                    sync_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    let timeout_token = cancel_token.child_token();
    let timeout_exit_count = Arc::clone(&exit_count);
    let timeout_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = timeout_token.cancelled() => {
                    timeout_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    let pr_poll_token = cancel_token.child_token();
    let pr_poll_exit_count = Arc::clone(&exit_count);
    let pr_poll_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = pr_poll_token.cancelled() => {
                    pr_poll_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    let prune_token = cancel_token.child_token();
    let prune_exit_count = Arc::clone(&exit_count);
    let prune_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(Duration::from_secs(3600), Duration::from_millis(50));
        loop {
            tokio::select! {
                _ = prune_token.cancelled() => {
                    prune_exit_count.fetch_add(1, Ordering::SeqCst);
                    break;
                }
                _ = interval.tick() => {}
            }
        }
    });

    // Wait for all tasks to reach their await point before cancelling.
    tokio::time::sleep(Duration::from_millis(20)).await;
    assert_eq!(exit_count.load(Ordering::SeqCst), 0);

    // Queue a sync trigger right before cancellation, mirroring a request landing as SIGTERM arrives.
    debouncer.trigger();
    cancel_token.cancel();

    let tasks_shutdown = async {
        let _ = tokio::join!(
            sync_handle,
            timeout_handle,
            pr_poll_handle,
            prune_handle,
            metrics_handle,
        );
    };
    let result = tokio::time::timeout(Duration::from_millis(500), tasks_shutdown).await;
    assert!(
        result.is_ok(),
        "Full background task group did not join within shutdown timeout"
    );

    assert_eq!(exit_count.load(Ordering::SeqCst), 4);
    assert_eq!(debouncer.sync_count(), 0);
}

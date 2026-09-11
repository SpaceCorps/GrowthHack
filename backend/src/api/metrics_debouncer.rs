use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, Weak};
use std::time::Duration;
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::mpsc::{channel, Receiver, Sender};

use crate::api::AppContext;

#[derive(Clone)]
pub struct MetricsSyncDebouncer {
    sender: Sender<()>,
    debounce_duration: Duration,
    cooldown_duration: Duration,
    sync_count: Arc<AtomicUsize>,
    is_syncing: Arc<AtomicBool>,
}

pub struct MetricsSyncWorker {
    receiver: Receiver<()>,
    debounce_duration: Duration,
    cooldown_duration: Duration,
    sync_count: Arc<AtomicUsize>,
    is_syncing: Arc<AtomicBool>,
}

impl MetricsSyncDebouncer {
    pub fn new(
        debounce_duration: Duration,
        cooldown_duration: Duration,
    ) -> (Self, MetricsSyncWorker) {
        let (sender, receiver) = channel(1);
        let sync_count = Arc::new(AtomicUsize::new(0));
        let is_syncing = Arc::new(AtomicBool::new(false));

        let debouncer = Self {
            sender,
            debounce_duration,
            cooldown_duration,
            sync_count: Arc::clone(&sync_count),
            is_syncing: Arc::clone(&is_syncing),
        };

        let worker = MetricsSyncWorker {
            receiver,
            debounce_duration,
            cooldown_duration,
            sync_count,
            is_syncing,
        };

        (debouncer, worker)
    }

    pub fn trigger(&self) -> bool {
        match self.sender.try_send(()) {
            Ok(_) => true,
            Err(TrySendError::Full(_)) => {
                tracing::debug!("Metrics sync trigger coalesced (queue full)");
                false
            }
            Err(TrySendError::Closed(_)) => {
                tracing::debug!("Metrics sync channel closed or no worker listening");
                false
            }
        }
    }

    pub fn sync_count(&self) -> usize {
        self.sync_count.load(Ordering::SeqCst)
    }

    pub fn is_syncing(&self) -> bool {
        self.is_syncing.load(Ordering::SeqCst)
    }

    pub fn debounce_duration(&self) -> Duration {
        self.debounce_duration
    }

    pub fn cooldown_duration(&self) -> Duration {
        self.cooldown_duration
    }
}

impl Default for MetricsSyncDebouncer {
    fn default() -> Self {
        let (debouncer, _) = Self::new(Duration::from_millis(20), Duration::from_millis(40));
        debouncer
    }
}

impl MetricsSyncWorker {
    pub fn spawn(self, ctx: Weak<AppContext>) -> tokio::task::JoinHandle<()> {
        tokio::spawn(async move {
            self.run(ctx).await;
        })
    }

    pub async fn run(mut self, ctx: Weak<AppContext>) {
        while let Some(()) = self.receiver.recv().await {
            // 1. Sleep for debounce_duration to gather any closely-spaced sibling triggers
            tokio::time::sleep(self.debounce_duration).await;

            // 2. Drain any additional tokens that arrived in the channel during debounce window
            while self.receiver.try_recv().is_ok() {}

            // 3. Upgrade Weak<AppContext> to Arc<AppContext>. If dropped, terminate cleanly.
            let ctx_arc = match ctx.upgrade() {
                Some(c) => c,
                None => {
                    tracing::info!("AppContext dropped, terminating MetricsSyncWorker loop");
                    break;
                }
            };

            // 4. Set is_syncing = true, log the sync run, and invoke sync_all_metrics_internal
            self.is_syncing.store(true, Ordering::SeqCst);
            tracing::info!("Executing debounced syndication metrics sync pass...");
            if let Err(e) = crate::api::articles::sync_all_metrics_internal(&ctx_arc).await {
                tracing::warn!("Debounced metrics sync error: {}", e);
            }

            // 5. Reset is_syncing = false and increment sync_count
            self.is_syncing.store(false, Ordering::SeqCst);
            self.sync_count.fetch_add(1, Ordering::SeqCst);

            // 6. Sleep for cooldown_duration before listening for subsequent triggers
            tokio::time::sleep(self.cooldown_duration).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_debouncer_coalesces_burst_triggers() {
        let guard = AppContext::new_test_context();
        let (debouncer, worker) =
            MetricsSyncDebouncer::new(Duration::from_millis(30), Duration::from_millis(60));
        let _worker_handle = worker.spawn(Arc::downgrade(&guard.ctx));

        for _ in 0..10 {
            debouncer.trigger();
        }

        // Wait for debounce window (30ms) plus a buffer for execution
        tokio::time::sleep(Duration::from_millis(70)).await;
        assert_eq!(
            debouncer.sync_count(),
            1,
            "10 burst triggers should coalesce into 1 sync pass"
        );

        // Sleep past cooldown to verify no phantom runs occur
        tokio::time::sleep(Duration::from_millis(60)).await;
        assert_eq!(
            debouncer.sync_count(),
            1,
            "Sync count must remain 1 after cooldown without new triggers"
        );
    }

    #[tokio::test]
    async fn test_debouncer_cooldown_delays_followup() {
        let guard = AppContext::new_test_context();
        let (debouncer, worker) =
            MetricsSyncDebouncer::new(Duration::from_millis(20), Duration::from_millis(100));
        let _worker_handle = worker.spawn(Arc::downgrade(&guard.ctx));

        // Initial trigger
        debouncer.trigger();

        // Wait for first pass to complete debounce and increment count
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert_eq!(debouncer.sync_count(), 1);

        // Trigger during active cooldown (cooldown is 100ms, about 50ms remaining)
        debouncer.trigger();

        // Check quickly during cooldown - followup should NOT have executed yet
        tokio::time::sleep(Duration::from_millis(30)).await;
        assert_eq!(
            debouncer.sync_count(),
            1,
            "Followup trigger must be held in cooldown"
        );

        // Sleep past remaining cooldown (70ms) + debounce (20ms) + execution buffer
        tokio::time::sleep(Duration::from_millis(80)).await;
        assert_eq!(
            debouncer.sync_count(),
            2,
            "Followup trigger must execute once cooldown elapses"
        );
    }

    #[tokio::test]
    async fn test_debouncer_terminates_on_context_drop() {
        let ctx = Arc::new(AppContext::default());
        let (debouncer, worker) =
            MetricsSyncDebouncer::new(Duration::from_millis(10), Duration::from_millis(20));
        let worker_handle = worker.spawn(Arc::downgrade(&ctx));

        // Trigger once to start debounce
        debouncer.trigger();

        // Drop the AppContext so upgrade() will fail
        drop(ctx);

        // Worker should terminate cleanly
        let result = tokio::time::timeout(Duration::from_millis(300), worker_handle).await;
        assert!(
            result.is_ok(),
            "Worker task should terminate promptly when AppContext drops"
        );
    }
}

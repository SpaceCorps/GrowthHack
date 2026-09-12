use growthhack_backend::agent::{AgentRunner, TaskManager, TaskManagerConfig};
use growthhack_backend::api::{self, AppContext};
use growthhack_backend::config::{create_periodic_interval, Config};
use growthhack_backend::db::GrowthState;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "growthhack_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = Config::load();
    tracing::info!("Starting GrowthHack Backend on port {}", config.port);
    tracing::info!("Target Antigravity binary: {:?}", config.agy_path);

    let state = Arc::new(RwLock::new(GrowthState::load_or_init(&config.data_file)));
    let runner = AgentRunner::new(config.agy_path.clone());
    let task_manager = TaskManager::with_persistence(
        runner,
        TaskManagerConfig::default(),
        Arc::clone(&state),
        config.data_file.clone(),
    )
    .await;

    let (metrics_debouncer, metrics_worker) = growthhack_backend::api::MetricsSyncDebouncer::new(
        tokio::time::Duration::from_secs(3),
        tokio::time::Duration::from_secs(15),
    );
    let metrics_debouncer = Arc::new(metrics_debouncer);

    let ctx = Arc::new(AppContext {
        state,
        task_manager,
        data_file: config.data_file.clone(),
        ivy_web_content_path: config.ivy_web_content_path.clone(),
        ivy_web_images_path: config.ivy_web_images_path.clone(),
        config: config.clone(),
        rate_limiter: Arc::new(
            growthhack_backend::api::middleware::rate_limit::IpRateLimiter::default(),
        ),
        metrics_debouncer: Arc::clone(&metrics_debouncer),
    });

    metrics_worker.spawn(Arc::downgrade(&ctx));

    let base_delay = ctx.config.background_tasks_initial_delay;
    let cancel_token = tokio_util::sync::CancellationToken::new();

    let sync_ctx = Arc::clone(&ctx);
    let sync_token = cancel_token.child_token();
    let sync_handle = tokio::spawn(async move {
        let mut interval =
            create_periodic_interval(sync_ctx.config.engagement_sync_interval, base_delay);
        loop {
            tokio::select! {
                _ = sync_token.cancelled() => {
                    tracing::info!("Shutdown signal received: exiting syndication engagement metrics sync loop");
                    break;
                }
                _ = interval.tick() => {
                    tracing::info!("Running periodic syndication engagement metrics sync...");
                    if let Err(e) = api::articles::sync_all_metrics_internal(&sync_ctx).await {
                        tracing::warn!("Periodic metrics sync warning: {}", e);
                    }
                }
            }
        }
    });

    let timeout_ctx = Arc::clone(&ctx);
    let timeout_token = cancel_token.child_token();
    let timeout_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(
            timeout_ctx.config.claim_timeout_interval,
            base_delay + std::time::Duration::from_secs(5),
        );
        loop {
            tokio::select! {
                _ = timeout_token.cancelled() => {
                    tracing::info!("Shutdown signal received: exiting contributor issue claim timeout sweep loop");
                    break;
                }
                _ = interval.tick() => {
                    tracing::info!("Running periodic contributor issue claim timeout sweep...");
                    match api::contributors::check_claim_timeouts_internal(&timeout_ctx, 7).await {
                        Ok(unclaimed) => {
                            tracing::info!(
                                "Claim timeout sweep completed: {} issues automatically unclaimed ({:?})",
                                unclaimed.len(),
                                unclaimed
                            );
                        }
                        Err(e) => {
                            tracing::warn!("Claim timeout sweep warning: {}", e);
                        }
                    }
                }
            }
        }
    });

    let pr_poll_ctx = Arc::clone(&ctx);
    let pr_poll_token = cancel_token.child_token();
    let pr_poll_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(
            pr_poll_ctx.config.listing_pr_poll_interval,
            base_delay + std::time::Duration::from_secs(10),
        );
        loop {
            tokio::select! {
                _ = pr_poll_token.cancelled() => {
                    tracing::info!("Shutdown signal received: exiting listing PR merge status check loop");
                    break;
                }
                _ = interval.tick() => {
                    tracing::info!("Running periodic PR merge status check for submitted listings...");
                    if let Err(e) = api::listings::sync_listing_pr_statuses_internal(&pr_poll_ctx).await {
                        tracing::warn!("Periodic listing PR status check warning: {}", e);
                    }
                }
            }
        }
    });

    let prune_tm = ctx.task_manager.clone();
    let task_eviction_interval = ctx.config.task_eviction_interval;
    let prune_token = cancel_token.child_token();
    let prune_handle = tokio::spawn(async move {
        let mut interval = create_periodic_interval(
            task_eviction_interval,
            base_delay + std::time::Duration::from_secs(15),
        );
        loop {
            tokio::select! {
                _ = prune_token.cancelled() => {
                    tracing::info!("Shutdown signal received: exiting completed task eviction sweep loop");
                    break;
                }
                _ = interval.tick() => {
                    tracing::info!("Running periodic completed task eviction sweep...");
                    let evicted = prune_tm.prune_completed().await;
                    if evicted > 0 {
                        tracing::info!("Periodic task eviction: pruned {} completed tasks", evicted);
                    }
                }
            }
        }
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = api::router(ctx);

    // Serve built frontend if available
    if let Some(dist) = &config.frontend_dist_dir {
        tracing::info!("Serving frontend assets from: {:?}", dist);
        let serve_dir = ServeDir::new(dist).fallback(ServeFile::new(dist.join("index.html")));
        app = app.fallback_service(serve_dir);
    } else {
        tracing::info!("Frontend distribution assets not found; static asset serving is disabled");
    }

    let app = app.layer(cors).layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from((config.host, config.port));
    tracing::info!(
        "🚀 GrowthHack Server listening on http://{}:{}",
        config.host,
        config.port
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal(cancel_token.clone()))
        .await?;

    tracing::info!("HTTP server stopped. Waiting for background tasks to terminate...");
    let shutdown_timeout = std::time::Duration::from_secs(10);
    let tasks_shutdown = async {
        let _ = tokio::join!(sync_handle, timeout_handle, pr_poll_handle, prune_handle);
    };
    if tokio::time::timeout(shutdown_timeout, tasks_shutdown).await.is_err() {
        tracing::warn!("Timed out waiting for background tasks to stop cleanly");
    } else {
        tracing::info!("All background tasks stopped cleanly. Shutdown complete.");
    }

    Ok(())
}

async fn shutdown_signal(token: tokio_util::sync::CancellationToken) {
    let ctrl_c = async {
        if let Err(err) = tokio::signal::ctrl_c().await {
            tracing::error!("Failed to install Ctrl+C signal handler: {}", err);
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(err) => {
                tracing::error!("Failed to install SIGTERM signal handler: {}", err);
                std::future::pending::<()>().await;
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            tracing::info!("Received Ctrl+C (SIGINT), initiating graceful shutdown...");
        }
        _ = terminate => {
            tracing::info!("Received SIGTERM, initiating graceful shutdown...");
        }
    }

    token.cancel();
}

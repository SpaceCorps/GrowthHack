use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::AppContext;
use growthhack_backend::config::Config;
use growthhack_backend::db::GrowthState;
use growthhack_backend::*;
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
    let runner = AgentRunner::new(config.agy_path);
    let task_manager = TaskManager::new(runner);

    let ctx = Arc::new(AppContext {
        state,
        task_manager,
        data_file: config.data_file,
        ivy_web_content_path: config.ivy_web_content_path,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut app = api::router(ctx);

    // Serve built frontend if available
    let possible_paths = [
        std::path::PathBuf::from("frontend/dist"),
        std::path::PathBuf::from("../frontend/dist"),
    ];

    for dist in &possible_paths {
        if dist.exists() {
            tracing::info!("Serving frontend assets from: {:?}", dist);
            let serve_dir = ServeDir::new(dist)
                .fallback(ServeFile::new(dist.join("index.html")));
            app = app.fallback_service(serve_dir);
            break;
        }
    }

    let app = app
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([127, 0, 0, 1], config.port));
    tracing::info!("🚀 GrowthHack Server listening on http://127.0.0.1:{}", config.port);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

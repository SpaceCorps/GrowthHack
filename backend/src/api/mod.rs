pub mod agent;
pub mod articles;
pub mod issues;
pub mod listings;
pub mod trends;

use axum::{
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

pub use issues::AppContext;

pub fn router(ctx: Arc<AppContext>) -> Router {
    Router::new()
        // Growth Issues
        .route("/api/issues", get(issues::list_issues).post(issues::create_issue))
        .route("/api/issues/{id}", put(issues::update_issue))
        .route("/api/issues/{id}/run", post(issues::run_issue))
        // Content Articles (10x Engine)
        .route("/api/articles", get(articles::list_articles).post(articles::create_article))
        .route("/api/articles/{id}", get(articles::get_article).put(articles::update_article).delete(articles::delete_article))
        .route("/api/articles/generate", post(articles::generate_article))
        // Trends Radar & Newsroom
        .route("/api/trends", get(trends::list_trends))
        .route("/api/trends/scout", post(trends::scout_trends))
        .route("/api/trends/{id}/synthesize", post(trends::synthesize_trend))
        // Listings & Awesome Blitz
        .route("/api/listings", get(listings::list_listings).post(listings::create_listing))
        .route("/api/listings/{id}", put(listings::update_listing))
        .route("/api/listings/{id}/generate-blurb", post(listings::generate_listing_blurb))
        // Agent Status & SSE Streaming
        .route("/api/agent/status", get(agent::get_agent_status))
        .route("/api/agent/run", post(agent::run_custom_agent_task))
        .route("/api/agent/stream/{task_id}", get(agent::stream_agent_logs))
        .with_state(ctx)
}

pub mod agent;
pub mod articles;
pub mod badges;
pub mod banner;
pub mod contributors;
pub mod demos;
pub mod issues;
pub mod listings;
pub mod packages;
pub mod recipes;
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
        .route(
            "/api/issues",
            get(issues::list_issues).post(issues::create_issue),
        )
        .route("/api/issues/{id}", put(issues::update_issue))
        .route("/api/issues/{id}/run", post(issues::run_issue))
        // Content Articles (10x Engine & Spotlights)
        .route(
            "/api/articles",
            get(articles::list_articles).post(articles::create_article),
        )
        .route(
            "/api/articles/{id}",
            get(articles::get_article)
                .put(articles::update_article)
                .delete(articles::delete_article),
        )
        .route("/api/articles/generate", post(articles::generate_article))
        .route(
            "/api/articles/generate-spotlight",
            post(articles::generate_spotlight),
        )
        .route(
            "/api/articles/{id}/export/ivy-web",
            post(articles::export_ivy_web),
        )
        .route(
            "/api/articles/{id}/sync-assets",
            post(articles::sync_assets),
        )
        .route("/api/articles/{id}/hero-banner.svg", get(articles::get_hero_banner_svg))
        .route("/api/articles/{id}/upload-hero-image", post(articles::upload_hero_image))
        .route(
            "/api/articles/{id}/format/{channel}",
            get(articles::format_article_channel),
        )
        .route(
            "/api/articles/{id}/record-export",
            post(articles::record_export),
        )
        .route(
            "/api/articles/{id}/publish/devto",
            post(articles::publish_devto),
        )
        .route(
            "/api/articles/{id}/publish/hashnode",
            post(articles::publish_hashnode),
        )
        // Syndication Metrics & Webhooks
        .route(
            "/api/articles/sync-metrics",
            post(articles::sync_metrics),
        )
        .route(
            "/api/articles/{id}/sync-metrics",
            post(articles::sync_article_metrics),
        )
        .route(
            "/api/webhooks/syndication",
            post(articles::handle_syndication_webhook),
        )
        // Syndication Settings
        .route(
            "/api/settings/syndication",
            get(articles::get_syndication_settings).post(articles::update_syndication_settings),
        )
        // Feature Video Demos & LinkedIn
        .route("/api/demos", get(demos::list_demos).post(demos::create_demo))
        .route("/api/demos/{id}", get(demos::get_demo).put(demos::update_demo).delete(demos::delete_demo))
        .route("/api/demos/generate", post(demos::generate_feature_demo))
        // Trends Radar & Newsroom
        .route("/api/trends", get(trends::list_trends))
        .route("/api/trends/{id}", get(trends::get_trend).put(trends::update_trend).delete(trends::delete_trend))
        .route("/api/trends/scout", post(trends::scout_trends))
        .route(
            "/api/trends/{id}/synthesize",
            post(trends::synthesize_trend),
        )
        // Listings & Awesome Blitz
        .route(
            "/api/listings",
            get(listings::list_listings).post(listings::create_listing),
        )
        .route(
            "/api/listings/generate-batch",
            post(listings::generate_batch_listings),
        )
        .route("/api/listings/{id}", put(listings::update_listing))
        .route(
            "/api/listings/{id}/generate-blurb",
            post(listings::generate_listing_blurb),
        )
        .route(
            "/api/listings/{id}/verify-backlink",
            post(listings::verify_backlink),
        )
        // Package Manager & One-Line Install Blitz
        .route("/api/packages", get(packages::list_packages))
        .route("/api/packages/{target}/manifest", get(packages::get_manifest))
        .route("/api/packages/{id}/status", put(packages::update_package_status))
        .route("/api/packages/{id}/dispatch", post(packages::dispatch_package_pr))
        .route("/api/packages/{id}/commands", get(packages::get_package_dispatch_commands))
        // PR Badges and Workflows Flywheel
        .route("/api/badges/generate", post(badges::generate_badge))
        .route("/api/badges/svg", get(badges::render_svg_badge))
        .route("/api/badges/workflows", get(badges::get_workflow_templates))
        // Ready-to-Run Recipes & Community Hub
        .route(
            "/api/recipes",
            get(recipes::list_recipes).post(recipes::create_or_update_recipe),
        )
        .route("/api/recipes/{id}", get(recipes::get_recipe))
        .route("/api/recipes/{id}/run", post(recipes::run_recipe))
        .route("/api/recipes/submit", post(recipes::submit_recipe))
        // Contributor Flywheel & Fast Track Onboarding
        .route(
            "/api/contributors/issues",
            get(contributors::list_contributor_issues),
        )
        .route(
            "/api/contributors/issues/{id}/claim",
            post(contributors::claim_contributor_issue),
        )
        .route(
            "/api/contributors/contributing-md",
            get(contributors::get_contributing_guide),
        )
        .route(
            "/api/contributors/all-contributors",
            get(contributors::get_all_contributors),
        )
        // Agent Status & SSE Streaming
        .route("/api/agent/status", get(agent::get_agent_status))
        .route("/api/agent/run", post(agent::run_custom_agent_task))
        .route("/api/agent/stream/{task_id}", get(agent::stream_agent_logs))
        .with_state(ctx)
}

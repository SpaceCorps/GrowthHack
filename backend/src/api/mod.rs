pub mod agent;
pub mod articles;
pub mod badges;
pub mod banner;
pub mod contributors;
pub mod demo;
pub mod demos;
pub mod doctor;
pub mod issues;
pub mod launch;
pub mod listings;
pub mod middleware;
pub mod packages;
pub mod playground;
pub mod recipes;
pub mod submission;
pub mod trends;

use axum::{
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

pub use issues::{AppContext, TestContextGuard};

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
        .route(
            "/api/articles/{id}/hero-banner.svg",
            get(articles::get_hero_banner_svg),
        )
        .route(
            "/api/articles/{id}/upload-hero-image",
            post(articles::upload_hero_image),
        )
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
        .route("/api/articles/sync-metrics", post(articles::sync_metrics))
        .route(
            "/api/articles/{id}/sync-metrics",
            post(articles::sync_article_metrics),
        )
        .route(
            "/api/articles/engagement-history",
            get(articles::get_global_engagement_history),
        )
        .route(
            "/api/articles/{id}/engagement-history",
            get(articles::get_article_engagement_history),
        )
        .route(
            "/api/webhooks/syndication",
            post(articles::handle_syndication_webhook)
                .layer(axum::middleware::from_fn_with_state(
                    Arc::clone(&ctx),
                    middleware::webhook_auth::verify_webhook_hmac,
                ))
                .layer(axum::middleware::from_fn_with_state(
                    Arc::clone(&ctx),
                    middleware::rate_limit::rate_limit_middleware,
                )),
        )
        // Syndication Settings
        .route(
            "/api/settings/syndication",
            get(articles::get_syndication_settings).post(articles::update_syndication_settings),
        )
        // Feature Video Demos & LinkedIn
        .route(
            "/api/demos",
            get(demos::list_demos).post(demos::create_demo),
        )
        .route(
            "/api/demos/{id}",
            get(demos::get_demo)
                .put(demos::update_demo)
                .delete(demos::delete_demo),
        )
        .route("/api/demos/generate", post(demos::generate_feature_demo))
        // Trends Radar & Newsroom
        .route("/api/trends", get(trends::list_trends))
        .route(
            "/api/trends/{id}",
            get(trends::get_trend)
                .put(trends::update_trend)
                .delete(trends::delete_trend),
        )
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
        .route(
            "/api/listings/{id}/submit-upstream",
            post(listings::submit_upstream),
        )
        .route("/api/listings/submit-batch", post(listings::submit_batch))
        // Upstream Submissions & GitHub Token Status
        .route(
            "/api/submissions/github-status",
            get(submission::get_github_status),
        )
        .route(
            "/api/listings/{id}/submit-pr",
            post(listings::submit_listing_pr),
        )
        .route(
            "/api/listings/batch-submit-pr",
            post(listings::batch_submit_listing_prs),
        )
        .route("/api/listings/sync-prs", post(listings::sync_all_listing_prs))
        .route(
            "/api/listings/{id}/sync-pr",
            post(listings::check_single_listing_pr),
        )
        .route(
            "/api/webhooks/github/pr",
            post(listings::handle_github_pr_webhook),
        )
        // Package Manager & One-Line Install Blitz
        .route("/api/packages", get(packages::list_packages))
        .route(
            "/api/packages/gh-auth-status",
            get(packages::get_gh_auth_status),
        )
        .route(
            "/api/packages/{target}/manifest",
            get(packages::get_manifest),
        )
        .route(
            "/api/packages/refresh-release",
            post(packages::refresh_release),
        )
        .route(
            "/api/packages/{id}/status",
            put(packages::update_package_status),
        )
        .route(
            "/api/packages/{id}/dispatch",
            post(packages::dispatch_package_pr),
        )
        .route(
            "/api/packages/{id}/commands",
            get(packages::get_package_dispatch_commands),
        )
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
            "/api/contributors/issues/{id}/github",
            put(contributors::link_github_issue),
        )
        .route(
            "/api/contributors/contributing-md",
            get(contributors::get_contributing_guide),
        )
        .route(
            "/api/contributors/all-contributors",
            get(contributors::get_all_contributors),
        )
        .route(
            "/api/contributors/all-contributorsrc",
            get(contributors::get_all_contributorsrc),
        )
        .route(
            "/api/contributors/verify",
            post(contributors::verify_contributor),
        )
        .route(
            "/api/contributors/generate-pr",
            post(contributors::generate_all_contributors_pr),
        )
        // Agent Status & SSE Streaming
        .route("/api/agent/status", get(agent::get_agent_status))
        .route("/api/agent/run", post(agent::run_custom_agent_task))
        .route("/api/agent/stream/{task_id}", get(agent::stream_agent_logs))
        // Tendril Doctor Diagnostic Engine
        .route(
            "/api/doctor/diagnose",
            get(doctor::diagnose).post(doctor::diagnose),
        )
        .route("/api/doctor/fix", post(doctor::fix_diagnostics))
        // Zero-Config Demo Simulator
        .route(
            "/api/demo/scenarios",
            get(demo::list_scenarios).post(demo::create_scenario),
        )
        .route(
            "/api/demo/scenarios/reset",
            post(demo::reset_scenarios),
        )
        .route(
            "/api/demo/scenarios/{id}",
            get(demo::get_scenario)
                .put(demo::update_scenario)
                .delete(demo::delete_scenario),
        )
        .route("/api/demo/status", get(demo::get_status))
        .route("/api/demo/start", post(demo::start_demo))
        .route("/api/demo/stream/{task_id}", get(demo::stream_demo_logs))
        .route("/api/demo/reset", post(demo::reset_demo))
        .route("/api/demo/diff", get(demo::get_diff))
        .route("/api/demo/metrics", get(demo::get_metrics))
        .route("/api/demo/star-click", post(demo::record_star_click))
        // Coordinated 48-Hour Launch Campaign Orchestrator
        .route("/api/launch/overview", get(launch::get_launch_overview))
        .route("/api/launch/show-hn/analyze", post(launch::analyze_show_hn))
        .route("/api/launch/show-hn", put(launch::update_show_hn))
        .route("/api/launch/product-hunt", put(launch::update_product_hunt))
        .route("/api/launch/product-hunt/checklist/{id}", put(launch::toggle_product_hunt_checklist))
        .route("/api/launch/testers/{id}", put(launch::update_beta_tester))
        .route("/api/launch/checklist/{id}", put(launch::toggle_syndication_checklist))
        .route("/api/launch/timeline/{phase_id}/tasks/{task_id}", put(launch::toggle_timeline_task))
        .route("/api/launch/reset", post(launch::reset_launch_campaign))
        // Interactive Browser Web Playground (tendril.run)
        .route("/api/playground/scenarios", get(playground::list_scenarios))
        .route("/api/playground/import-issue", post(playground::import_issue))
        .route("/api/playground/tree", get(playground::get_tree))
        .route("/api/playground/status", get(playground::get_status))
        .route("/api/playground/start", post(playground::start_simulation))
        .route("/api/playground/reset", post(playground::reset_simulation))
        .route("/api/playground/diff", get(playground::get_diff))
        .route("/api/playground/metrics", get(playground::get_metrics))
        .route("/api/playground/star-click", post(playground::record_star_click))
        .route("/api/playground/banner", get(playground::get_banner_info))
        .with_state(ctx)
}

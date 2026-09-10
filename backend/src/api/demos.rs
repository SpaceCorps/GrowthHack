use crate::api::issues::AppContext;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct GenerateDemoRequest {
    pub feature: String,
    pub target_platform: String, // "LinkedIn", "X/Twitter", "YouTube Shorts"
    pub duration_seconds: Option<u32>, // default 30
}

#[derive(Serialize)]
pub struct GenerateDemoResponse {
    pub task_id: String,
    pub message: String,
}

pub async fn generate_feature_demo(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateDemoRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-demo-{}", Uuid::new_v4().simple());
    let duration = payload.duration_seconds.unwrap_or(30);

    let prompt = format!(
        r#"You are a technical social media strategist and motion demo director for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).
We are producing a viral {duration}-second feature demo video and companion social post using SpaceCorps/web-demo-generator.

Target Feature: {feature}
Target Platform: {platform}
Video Length: {duration} seconds

Produce a complete release package with two distinct sections:

SECTION 1: VIRAL {platform} POST COPY
- Hook: A captivating first line that stops developers from scrolling (addressing a real headache like agent hallucination, race conditions, or broken main).
- The Breakthrough: Explain how Tendril solves this with {feature}.
- Key Metrics / Proof: Cite practical speed, isolation, or verification benefits.
- Call to Action: Direct invite to star the repo (https://github.com/Ivy-Interactive/Ivy-Tendril) and run the 1-command installer.
- Strategic Hashtags: #AI #DevTools #SoftwareEngineering #AgenticAI #OpenSource

SECTION 2: SECOND-BY-SECOND VIDEO STORYBOARD (FOR SpaceCorps/web-demo-generator)
Format for Playwright browser automation:
- 00:00 - 00:05: Hook scene showing the developer pain point or split terminal.
- 00:05 - 00:15: Tendril launches {feature} in an isolated worktree.
- 00:15 - 00:25: Agent executes changes and verification test suite passes.
- 00:25 - 00:30: Clean pull request opened with verification badge. Outro card with GitHub star link.
"#,
        duration = duration,
        feature = payload.feature,
        platform = payload.target_platform
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();

    tokio::spawn(async move {
        let _ = runner.execute(&prompt, tx).await;
    });

    (
        StatusCode::ACCEPTED,
        Json(GenerateDemoResponse {
            task_id,
            message: "Feature demo & LinkedIn post generation started with Antigravity".to_string(),
        }),
    )
}

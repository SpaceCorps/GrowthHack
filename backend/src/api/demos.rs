use crate::api::issues::AppContext;
use crate::db::VideoDemo;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
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

#[derive(Deserialize)]
pub struct CreateDemoRequest {
    pub feature: String,
    pub target_platform: String,
    pub duration_seconds: Option<u32>,
    pub headline: String,
    pub body: String,
    pub storyboard: String,
    pub status: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct UpdateDemoRequest {
    pub feature: Option<String>,
    pub target_platform: Option<String>,
    pub duration_seconds: Option<u32>,
    pub headline: Option<String>,
    pub body: Option<String>,
    pub storyboard: Option<String>,
    pub status: Option<String>,
}

pub async fn list_demos(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.video_demos.clone())
}

pub async fn get_demo(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> Result<Json<VideoDemo>, StatusCode> {
    let state = ctx.state.read().await;
    match state.video_demos.iter().find(|d| d.id == id) {
        Some(demo) => Ok(Json(demo.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn create_demo(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<CreateDemoRequest>,
) -> impl IntoResponse {
    let now = Utc::now();
    let demo = VideoDemo {
        id: format!("demo-{}", Uuid::new_v4().simple()),
        feature: payload.feature,
        target_platform: payload.target_platform,
        duration_seconds: payload.duration_seconds.unwrap_or(30),
        headline: payload.headline,
        body: payload.body,
        storyboard: payload.storyboard,
        status: payload.status.unwrap_or_else(|| "Pending".to_string()),
        created_at: now,
        updated_at: now,
    };

    let mut state = ctx.state.write().await;
    state.video_demos.push(demo.clone());
    let _ = state.save(&ctx.data_file);

    (StatusCode::CREATED, Json(demo))
}

pub async fn update_demo(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateDemoRequest>,
) -> Result<Json<VideoDemo>, StatusCode> {
    let mut state = ctx.state.write().await;
    match state.video_demos.iter_mut().find(|d| d.id == id) {
        Some(demo) => {
            let text_modified = payload.headline.as_ref().is_some_and(|h| h != &demo.headline)
                || payload.body.as_ref().is_some_and(|b| b != &demo.body)
                || payload.storyboard.as_ref().is_some_and(|s| s != &demo.storyboard);

            if let Some(f) = payload.feature {
                demo.feature = f;
            }
            if let Some(tp) = payload.target_platform {
                demo.target_platform = tp;
            }
            if let Some(ds) = payload.duration_seconds {
                demo.duration_seconds = ds;
            }
            if let Some(h) = payload.headline {
                demo.headline = h;
            }
            if let Some(b) = payload.body {
                demo.body = b;
            }
            if let Some(s) = payload.storyboard {
                demo.storyboard = s;
            }
            if let Some(st) = payload.status {
                demo.status = st;
            } else if text_modified {
                demo.status = "Pending".to_string();
            }
            demo.updated_at = Utc::now();
            let updated = demo.clone();
            let _ = state.save(&ctx.data_file);
            Ok(Json(updated))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_demo(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> Result<StatusCode, StatusCode> {
    let mut state = ctx.state.write().await;
    let initial_len = state.video_demos.len();
    state.video_demos.retain(|d| d.id != id);
    if state.video_demos.len() < initial_len {
        let _ = state.save(&ctx.data_file);
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
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
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let feature = payload.feature.clone();
    let platform = payload.target_platform.clone();

    tokio::spawn(async move {
        match runner.execute(&prompt, tx.clone()).await {
            Ok(output) => {
                let headline = output
                    .lines()
                    .find(|l| {
                        let lower = l.to_lowercase();
                        lower.contains("hook:") || lower.contains("headline:") || l.starts_with("# ")
                    })
                    .map(|l| {
                        let trimmed = l.trim_start_matches("# ").trim();
                        if let Some(idx) = trimmed.find(':') {
                            trimmed[idx + 1..].trim().to_string()
                        } else {
                            trimmed.to_string()
                        }
                    })
                    .unwrap_or_else(|| format!("Feature Demo: {}", feature));

                let storyboard = if let Some(pos) = output.find("SECTION 2") {
                    output[pos..].to_string()
                } else {
                    format!("00:00 - 00:{:02}: Automated walkthrough of {}", duration, feature)
                };

                let demo = VideoDemo {
                    id: format!("demo-{}", Uuid::new_v4().simple()),
                    feature,
                    target_platform: platform,
                    duration_seconds: duration,
                    headline,
                    body: output,
                    storyboard,
                    status: "Pending".to_string(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                };

                let mut state = state_arc.write().await;
                state.video_demos.push(demo);
                let _ = state.save(&data_file);
                let _ = tx.send("[SYSTEM] Video demo package created and saved to review queue!".to_string());
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Generation failed: {}", e));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(GenerateDemoResponse {
            task_id,
            message: "Feature demo & LinkedIn post generation started with Antigravity".to_string(),
        }),
    )
}

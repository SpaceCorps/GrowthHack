use crate::api::issues::AppContext;
use crate::db::{AutomationConfig, PlatformCopy, StoryboardScene, VideoDemo};
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
    pub target_platform: String, // "LinkedIn", "X/Twitter", "YouTube Shorts", "All" / "Multi-Platform"
    pub duration_seconds: Option<u32>, // default 30
    pub transcode_format: Option<String>, // default "mp4", fallback "webm"
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
    #[serde(default)]
    pub scenes: Option<Vec<StoryboardScene>>,
    #[serde(default)]
    pub platform_copy: Option<PlatformCopy>,
    #[serde(default)]
    pub automation_config: Option<AutomationConfig>,
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
    #[serde(default)]
    pub scenes: Option<Vec<StoryboardScene>>,
    #[serde(default)]
    pub platform_copy: Option<PlatformCopy>,
    #[serde(default)]
    pub automation_config: Option<AutomationConfig>,
}

pub fn resolve_generator_path() -> String {
    if let Ok(val) = std::env::var("WEB_DEMO_GENERATOR_PATH") {
        let trimmed = val.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let default_path = std::path::Path::new("/Users/rorychatt/git/web-demo-generator");
    if default_path.exists() {
        default_path.to_string_lossy().to_string()
    } else {
        "/Users/rorychatt/git/web-demo-generator".to_string()
    }
}

pub fn build_default_scenes(feature: &str, duration: u32) -> Vec<StoryboardScene> {
    let t_hook = (duration * 5 / 30).max(3).min(duration);
    let t_worktree = (duration * 15 / 30).max(t_hook + 1).min(duration);
    let t_verify = (duration * 25 / 30).max(t_worktree + 1).min(duration);
    let t_outro = duration;

    vec![
        StoryboardScene {
            stage: "Hook".to_string(),
            start_second: 0,
            end_second: t_hook,
            title: format!("{} Pain Point Hook", feature),
            visual_action: format!(
                "Split terminal demonstrating git index lock error or developer friction for {}.",
                feature
            ),
            playwright_action: Some("await page.goto('/'); await page.waitForSelector('.hook-scene');".to_string()),
        },
        StoryboardScene {
            stage: "WorktreeIsolation".to_string(),
            start_second: t_hook,
            end_second: t_worktree,
            title: format!("Isolated Worktree Launch for {}", feature),
            visual_action: format!(
                "Tendril spins up isolated git worktree environment in background for {}.",
                feature
            ),
            playwright_action: Some("await page.click('#spawn-worktree'); await page.waitForSelector('.worktree-ready');".to_string()),
        },
        StoryboardScene {
            stage: "TestVerification".to_string(),
            start_second: t_worktree,
            end_second: t_verify,
            title: format!("Automated Test Verification for {}", feature),
            visual_action: "Parallel execution and automated verification suite checks passing with green status.".to_string(),
            playwright_action: Some("await page.click('#verify-btn'); await page.waitForSelector('.verification-passed');".to_string()),
        },
        StoryboardScene {
            stage: "PrBadgeOutro".to_string(),
            start_second: t_verify,
            end_second: t_outro,
            title: "Verified PR & Outro CTA".to_string(),
            visual_action: "Verified PR created badge with green checkmarks and Tendril GitHub star CTA.".to_string(),
            playwright_action: Some("await page.waitForSelector('.pr-badge'); await page.screenshot({ path: 'outro.png' });".to_string()),
        },
    ]
}

pub fn build_default_platform_copy(feature: &str, headline: &str, body: &str) -> PlatformCopy {
    let linkedin = if !body.trim().is_empty() {
        body.to_string()
    } else {
        format!(
            "{}\n\nStop fighting git collisions and unverified code snippets.\n\nWith Ivy-Tendril, {} runs in isolated worktrees with automated verification gates.\n\nStar the repo on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril\n\n#AI #DevTools #SoftwareEngineering #AgenticAI #OpenSource #GitHub",
            headline, feature
        )
    };

    PlatformCopy {
        linkedin_post: linkedin,
        twitter_thread: vec![
            format!("1/4 🚨 {} in action with @IvyTendril 🧵", feature),
            "2/4 Single-agent coding breaks easily on shared branches. Tendril isolates each task into its own git worktree.".to_string(),
            "3/4 Automated test verifications ensure PRs are always passing before code is merged.".to_string(),
            "4/4 Check it out and star the repo: https://github.com/Ivy-Interactive/Ivy-Tendril #DevTools #AI".to_string(),
        ],
        youtube_shorts_caption: format!(
            "See how {} works in Ivy-Tendril in 30 seconds! ⚡ Star us on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril #Shorts #Coding #DevTools",
            feature
        ),
    }
}

pub fn build_default_automation_config(
    feature: &str,
    transcode_format: Option<String>,
) -> AutomationConfig {
    let fmt = transcode_format.unwrap_or_else(|| "mp4".to_string());
    let fmt_clean = if fmt.to_lowercase() == "webm" {
        "webm".to_string()
    } else {
        "mp4".to_string()
    };

    AutomationConfig {
        generator_path: resolve_generator_path(),
        playwright_script: format!(
            r#"import {{ test, expect }} from '@playwright/test';

test('{} interactive tour', async ({{ page }}) => {{
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle');
  await page.click('[data-testid="demo-trigger"]');
  await expect(page.locator('.verified-badge')).toBeVisible();
}});"#,
            feature
        ),
        transcode_format: fmt_clean,
        output_video_path: None,
    }
}

pub fn parse_demo_package(
    output: &str,
    feature: &str,
    _platform: &str,
    duration: u32,
    transcode_format: Option<String>,
) -> (
    String,
    String,
    String,
    Vec<StoryboardScene>,
    PlatformCopy,
    AutomationConfig,
) {
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
        format!(
            "00:00 - 00:{:02}: Automated walkthrough of {}",
            duration, feature
        )
    };

    let scenes = build_default_scenes(feature, duration);
    let platform_copy = build_default_platform_copy(feature, &headline, output);
    let automation_config = build_default_automation_config(feature, transcode_format);

    (
        headline,
        output.to_string(),
        storyboard,
        scenes,
        platform_copy,
        automation_config,
    )
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
    let duration = payload.duration_seconds.unwrap_or(30);
    let scenes = payload
        .scenes
        .unwrap_or_else(|| build_default_scenes(&payload.feature, duration));
    let platform_copy = payload.platform_copy.or_else(|| {
        Some(build_default_platform_copy(
            &payload.feature,
            &payload.headline,
            &payload.body,
        ))
    });
    let automation_config = payload
        .automation_config
        .or_else(|| Some(build_default_automation_config(&payload.feature, None)));

    let demo = VideoDemo {
        id: format!("demo-{}", Uuid::new_v4().simple()),
        feature: payload.feature,
        target_platform: payload.target_platform,
        duration_seconds: duration,
        headline: payload.headline,
        body: payload.body,
        storyboard: payload.storyboard,
        status: payload.status.unwrap_or_else(|| "Pending".to_string()),
        created_at: now,
        updated_at: now,
        scenes,
        platform_copy,
        automation_config,
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
            }
            if let Some(scenes) = payload.scenes {
                demo.scenes = scenes;
            }
            if let Some(pc) = payload.platform_copy {
                demo.platform_copy = Some(pc);
            }
            if let Some(ac) = payload.automation_config {
                demo.automation_config = Some(ac);
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
    let transcode_fmt = payload
        .transcode_format
        .clone()
        .unwrap_or_else(|| "mp4".to_string());

    let prompt = format!(
        r#"You are a technical social media strategist and motion demo director for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).
We are producing a viral {duration}-second feature demo video and companion social post using SpaceCorps/web-demo-generator.

Target Feature: {feature}
Target Platform: {platform}
Video Length: {duration} seconds
Transcode Format: {transcode_fmt}

Produce a complete release package with four distinct sections:

SECTION 1: 4-STAGE STORYBOARD SCENES (FOR SpaceCorps/web-demo-generator)
Format with exact intervals matching {duration}s:
- Stage 1 [STAGE:HOOK] (0:00 - 0:05): Developer pain point, split terminal, git collision error.
- Stage 2 [STAGE:WORKTREE] (0:05 - 0:15): Tendril spinning up isolated worktrees in background.
- Stage 3 [STAGE:VERIFY] (0:15 - 0:25): Parallel execution and passing test suite verification.
- Stage 4 [STAGE:OUTRO] (0:25 - 0:30): Verified PR created, green badge, star CTA.

SECTION 2: MULTI-PLATFORM COPY PACKAGE
- LinkedIn Post: Hook-first developer post with pain points, solutions, and metrics.
- X/Twitter Thread: 4-tweet numbered thread breakdown.
- YouTube Shorts Caption: Short-form video copy with hashtags (#DevTools #Coding #AI).

SECTION 3: PLAYWRIGHT BROWSER AUTOMATION SCRIPT
Executable interaction script compatible with web-demo-generator to automate UI navigation.

SECTION 4: TRANSCODE CONFIGURATION
H.264 profile settings, resolution, and ffmpeg fallback handling for {transcode_fmt}.
"#,
        duration = duration,
        feature = payload.feature,
        platform = payload.target_platform,
        transcode_fmt = transcode_fmt,
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let feature = payload.feature.clone();
    let platform = payload.target_platform.clone();
    let transcode_fmt_clone = transcode_fmt.clone();

    tokio::spawn(async move {
        // Stream generation stages to SSE subscriber
        let _ = tx.send(format!(
            "[STAGE:HOOK] Generating Hook scene for {} (0:00 - 0:05)...",
            feature
        ));
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        let _ = tx.send(
            "[STAGE:WORKTREE] Generating Worktree Isolation scene (0:05 - 0:15)...".to_string(),
        );
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        let _ = tx.send(
            "[STAGE:VERIFY] Generating Automated Test Verification scene (0:15 - 0:25)..."
                .to_string(),
        );
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        let _ = tx.send(format!(
            "[STAGE:OUTRO] Generating PR Badge Outro scene (0:25 - 0:{:02})...",
            duration
        ));
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        let _ = tx.send("[GEN:COPY] Drafting synchronized LinkedIn, X/Twitter thread, and YouTube Shorts copy...".to_string());
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        let _ = tx.send(format!(
            "[GEN:PLAYWRIGHT] Synthesizing Playwright automation script & {} transcode config...",
            transcode_fmt_clone
        ));

        match runner.execute(&prompt, tx.clone()).await {
            Ok(output) => {
                let (headline, body, storyboard, scenes, platform_copy, automation_config) =
                    parse_demo_package(
                        &output,
                        &feature,
                        &platform,
                        duration,
                        Some(transcode_fmt_clone),
                    );

                let demo = VideoDemo {
                    id: format!("demo-{}", Uuid::new_v4().simple()),
                    feature,
                    target_platform: platform,
                    duration_seconds: duration,
                    headline,
                    body,
                    storyboard,
                    status: "Pending".to_string(),
                    created_at: Utc::now(),
                    updated_at: Utc::now(),
                    scenes,
                    platform_copy: Some(platform_copy),
                    automation_config: Some(automation_config),
                };

                let mut state = state_arc.write().await;
                state.video_demos.push(demo);
                let _ = state.save(&data_file);
                let _ = tx.send(
                    "[SYSTEM] Video demo package created and saved to review queue!".to_string(),
                );
                let _ = tx.send("[DONE] Feature demo generation complete".to_string());
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
            message:
                "Feature demo & multi-platform social blitz generation started with Antigravity"
                    .to_string(),
        }),
    )
}

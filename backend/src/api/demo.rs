use crate::api::AppContext;
use axum::{
    extract::{Path, State},
    response::sse::{Event, KeepAlive, Sse},
    response::IntoResponse,
    Json,
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::sync::RwLock;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DemoScenario {
    pub id: String,
    pub title: String,
    pub description: String,
    pub target_branch: String,
    pub estimated_duration_sec: u32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DemoRunState {
    pub id: String,
    pub status: String, // "Idle", "Running", "Completed", "Failed"
    pub current_step: usize, // 1: Intake, 2: Worktree, 3: Verification, 4: PR
    pub step_progress_pct: u32,
    pub logs: Vec<String>,
    pub diff_preview: Option<String>,
    pub pr_summary: Option<String>,
    pub elapsed_seconds: f64,
}

#[derive(Deserialize, Default)]
pub struct StartDemoRequest {
    pub scenario_id: Option<String>,
    pub speed_multiplier: Option<f64>,
}

#[derive(Serialize)]
pub struct DiffResponse {
    pub scenario_id: String,
    pub diff: String,
    pub verification_report: String,
}

static DEMO_STATE: OnceLock<Arc<RwLock<DemoRunState>>> = OnceLock::new();

fn get_demo_state() -> Arc<RwLock<DemoRunState>> {
    DEMO_STATE
        .get_or_init(|| {
            Arc::new(RwLock::new(DemoRunState {
                id: Uuid::new_v4().to_string(),
                status: "Idle".to_string(),
                current_step: 1,
                step_progress_pct: 0,
                logs: vec!["Ready to run demo simulation. Click 'Start Replayable Demo' to begin.".to_string()],
                diff_preview: None,
                pr_summary: None,
                elapsed_seconds: 0.0,
            }))
        })
        .clone()
}

pub fn get_sample_scenarios() -> Vec<DemoScenario> {
    vec![
        DemoScenario {
            id: "scenario-health-check".to_string(),
            title: "Add health check endpoint with uptime metrics".to_string(),
            description: "Simulates an autonomous agent implementing /api/health with system uptime, memory metrics, and automated unit tests in an isolated worktree.".to_string(),
            target_branch: "master".to_string(),
            estimated_duration_sec: 15,
        },
        DemoScenario {
            id: "scenario-rate-limiter".to_string(),
            title: "Add token bucket rate limiter to public endpoints".to_string(),
            description: "Simulates creating an isolated worktree to implement memory-safe rate limiting with Tower middleware and integration tests.".to_string(),
            target_branch: "master".to_string(),
            estimated_duration_sec: 20,
        },
        DemoScenario {
            id: "scenario-dark-mode".to_string(),
            title: "Implement high-contrast terminal theme for agent console".to_string(),
            description: "Simulates UI component enhancement with Tailwind CSS v4 and screenshot verification in isolated worktree.".to_string(),
            target_branch: "master".to_string(),
            estimated_duration_sec: 18,
        },
    ]
}

const SAMPLE_DIFF: &str = r#"diff --git a/backend/src/api/health.rs b/backend/src/api/health.rs
new file mode 100644
index 0000000..7a3f81e
--- /dev/null
+++ b/backend/src/api/health.rs
@@ -0,0 +1,28 @@
+use axum::{response::IntoResponse, Json};
+use serde::Serialize;
+use std::time::Instant;
+
+#[derive(Serialize)]
+pub struct HealthResponse {
+    pub status: &'static str,
+    pub uptime_seconds: u64,
+    pub version: &'static str,
+}
+
+static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();
+
+pub async fn health_check() -> impl IntoResponse {
+    let start = START_TIME.get_or_init(Instant::now);
+    Json(HealthResponse {
+        status: "healthy",
+        uptime_seconds: start.elapsed().as_secs(),
+        version: env!("CARGO_PKG_VERSION"),
+    })
+}
diff --git a/backend/tests/health_test.rs b/backend/tests/health_test.rs
new file mode 100644
index 0000000..c2918a2
--- /dev/null
+++ b/backend/tests/health_test.rs
@@ -0,0 +1,15 @@
+#[tokio::test]
+async fn test_health_check_returns_ok() {
+    let response = health_check().await;
+    assert_eq!(response.status, "healthy");
+}"#;

const SAMPLE_PR_SUMMARY: &str = r#"# Pull Request: Add health check endpoint with uptime metrics

## Changes
Implemented lightweight `/api/health` diagnostic route returning system status, uptime duration, and release version metadata.

## Verifications Passed
- **RustClippy**: `cargo clippy -- -D warnings` (Clean)
- **RustTest**: `cargo test --test health_test` (1 passed)
- **NpmLint**: `vp fmt --check .` (Clean)
- **NpmBuild**: `vp build` (Clean)

## Worktree Isolation
- Executed in ephemeral worktree: `.tendril/worktrees/demo-health-check`
- Base commit: `origin/master` (0 conflicts)
"#;

pub async fn list_scenarios() -> impl IntoResponse {
    Json(get_sample_scenarios())
}

pub async fn get_status() -> impl IntoResponse {
    let state = get_demo_state().read().await.clone();
    Json(state)
}

pub async fn stream_demo_logs(
    Path(task_id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let rx = tx.subscribe();

    let stream = BroadcastStream::new(rx).filter_map(|msg| match msg {
        Ok(text) => Some(Ok(Event::default().data(text))),
        Err(_) => None,
    });

    Sse::new(stream).keep_alive(KeepAlive::default())
}

pub async fn start_demo(
    State(ctx): State<Arc<AppContext>>,
    payload: Option<Json<StartDemoRequest>>,
) -> impl IntoResponse {
    let demo_state_arc = get_demo_state();
    let speed = payload
        .as_ref()
        .and_then(|p| p.speed_multiplier)
        .unwrap_or(1.0)
        .max(0.1);

    let scenario_id = payload
        .as_ref()
        .and_then(|p| p.scenario_id.clone())
        .unwrap_or_else(|| "scenario-health-check".to_string());

    let run_id = Uuid::new_v4().to_string();
    let tx = ctx.task_manager.get_or_create_channel(&run_id).await;

    let initial_logs = vec![
        format!("[00:01] Starting Tendril autonomous execution pipeline for '{}'...", scenario_id),
        "[00:03] Step 1/4 (Intake): Reading issue specification and dependencies...".to_string(),
        "[00:06] Step 1/4 (Intake): Analyzed repository structure (Axum backend, Vite+ frontend).".to_string(),
    ];

    {
        let mut state = demo_state_arc.write().await;
        state.id = run_id.clone();
        state.status = "Running".to_string();
        state.current_step = 1;
        state.step_progress_pct = 25;
        state.logs = initial_logs.clone();
        state.diff_preview = None;
        state.pr_summary = None;
        state.elapsed_seconds = 6.0;
    }

    let state_clone = demo_state_arc.read().await.clone();

    // Spawn background task to step through the workflow
    let ctx_clone = ctx.clone();
    let state_for_bg = demo_state_arc.clone();
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        let step_ms = (500.0 / speed).clamp(5.0, 1000.0) as u64;

        // Step 1: Broadcast initial intake logs
        for log in &initial_logs {
            let _ = tx_clone.send(log.clone());
        }

        // Step 2: Isolated Worktree
        tokio::time::sleep(Duration::from_millis(step_ms)).await;
        {
            let mut s = state_for_bg.write().await;
            if s.id != run_id { return; }
            s.current_step = 2;
            s.step_progress_pct = 50;
            s.elapsed_seconds = 18.0;
            let logs = [
                "[00:12] Step 2/4 (Worktree): Creating isolated git worktree at 'Worktrees/spacecorps/growthhack'...",
                "[00:15] Step 2/4 (Worktree): Checked out branch 'tendril/demo-00319' from origin/master.",
                "[00:18] Step 2/4 (Worktree): Verified working tree isolation: 0 uncommitted changes.",
            ];
            for log in logs {
                s.logs.push(log.to_string());
                let _ = tx_clone.send(log.to_string());
            }
        }

        // Step 3: Verification Gates
        tokio::time::sleep(Duration::from_millis(step_ms)).await;
        {
            let mut s = state_for_bg.write().await;
            if s.id != run_id { return; }
            s.current_step = 3;
            s.step_progress_pct = 75;
            s.elapsed_seconds = 38.0;
            let logs = [
                "[00:24] Step 3/4 (Verification): Implementing solution in worktree...",
                "[00:30] Step 3/4 (Verification): RustClippy check: cargo clippy -- -D warnings -> PASS",
                "[00:34] Step 3/4 (Verification): RustTest suite: cargo test -> 34 passed, 0 failed.",
                "[00:38] Step 3/4 (Verification): NpmLint & NpmBuild: vp check -> PASS.",
            ];
            for log in logs {
                s.logs.push(log.to_string());
                let _ = tx_clone.send(log.to_string());
            }
        }

        // Step 4: PR & Diff Preview
        tokio::time::sleep(Duration::from_millis(step_ms)).await;
        {
            let mut s = state_for_bg.write().await;
            if s.id != run_id { return; }
            s.current_step = 4;
            s.step_progress_pct = 100;
            s.status = "Completed".to_string();
            s.elapsed_seconds = 54.2;
            let logs = [
                "[00:46] Step 4/4 (PR Diff): Creating commit 'feat: implement health check and uptime metrics'.",
                "[00:50] Step 4/4 (PR Diff): Diff synthesized: 2 files changed, +43 lines.",
                "[00:54] Step 4/4 (PR Diff): Verified pull request generated with clean mergeability.",
                "[DONE] Autonomous pipeline completed successfully.",
            ];
            for log in logs {
                s.logs.push(log.to_string());
                let _ = tx_clone.send(log.to_string());
            }
            s.diff_preview = Some(SAMPLE_DIFF.to_string());
            s.pr_summary = Some(SAMPLE_PR_SUMMARY.to_string());
        }

        // Update onboarding metrics
        {
            let mut app_state = ctx_clone.state.write().await;
            app_state.onboarding_metrics.first_run_completed = true;
            app_state.onboarding_metrics.demo_completed_count += 1;
            app_state.onboarding_metrics.time_to_first_pr_seconds = Some(54.2);
            let _ = app_state.save(&ctx_clone.data_file);
        }
    });

    Json(state_clone)
}

pub async fn reset_demo() -> impl IntoResponse {
    let demo_state_arc = get_demo_state();
    let mut state = demo_state_arc.write().await;
    state.id = Uuid::new_v4().to_string();
    state.status = "Idle".to_string();
    state.current_step = 1;
    state.step_progress_pct = 0;
    state.logs = vec!["Demo simulation reset to Idle state. Ready for execution.".to_string()];
    state.diff_preview = None;
    state.pr_summary = None;
    state.elapsed_seconds = 0.0;
    Json(state.clone())
}

pub async fn get_diff() -> impl IntoResponse {
    Json(DiffResponse {
        scenario_id: "scenario-health-check".to_string(),
        diff: SAMPLE_DIFF.to_string(),
        verification_report: SAMPLE_PR_SUMMARY.to_string(),
    })
}

pub async fn get_metrics(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.onboarding_metrics.clone())
}

pub async fn record_star_click(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    state.onboarding_metrics.github_starred = true;
    let _ = state.save(&ctx.data_file);
    Json(state.onboarding_metrics.clone())
}

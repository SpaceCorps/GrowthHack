use crate::api::AppContext;
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::sync::OnceLock;
use std::time::Duration;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct WorktreeFileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub status: String, // "Unchanged", "Modified", "Created"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<WorktreeFileNode>>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlaygroundScenario {
    pub id: String,
    pub title: String,
    pub description: String,
    pub target_branch: String,
    pub estimated_seconds: u32,
    pub file_tree: Vec<WorktreeFileNode>,
    pub diff: String,
    pub pr_summary: String,
    #[serde(default)]
    pub labels: Vec<String>,
    #[serde(default)]
    pub issue_url: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ImportIssueRequest {
    pub issue_url: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerificationGateItem {
    pub name: String,
    pub command: String,
    pub status: String, // "Pending", "Running", "Passed", "Failed"
    pub duration_ms: u64,
    pub output: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlaygroundRunState {
    pub id: String,
    pub scenario_id: String,
    pub status: String,      // "Idle", "Running", "Completed", "Failed"
    pub current_step: usize, // 1: Intake, 2: Worktree, 3: Verification, 4: PR & Diff
    pub step_progress_pct: u32,
    pub logs: Vec<String>,
    pub verification_gates: Vec<VerificationGateItem>,
    pub diff_preview: Option<String>,
    pub pr_summary: Option<String>,
    pub elapsed_seconds: f64,
    pub speed_multiplier: f64,
}

#[derive(Deserialize, Default)]
pub struct StartPlaygroundRequest {
    pub scenario_id: Option<String>,
    pub speed_multiplier: Option<f64>,
}

#[derive(Deserialize, Default)]
pub struct ScenarioQuery {
    pub scenario_id: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct PlaygroundFileQuery {
    pub scenario_id: Option<String>,
    pub path: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PlaygroundFileResponse {
    pub scenario_id: String,
    pub path: String,
    pub name: String,
    pub status: String, // "Created", "Modified", "Unchanged"
    pub content: String,
    pub file_diff: Option<String>,
    pub language: String,
    pub line_count: usize,
}

#[derive(Serialize)]
pub struct PlaygroundDiffResponse {
    pub scenario_id: String,
    pub diff: String,
    pub pr_summary: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BannerEmbedInfo {
    pub title: String,
    pub badge_url: String,
    pub target_url: String,
    pub markdown_snippet: String,
    pub html_snippet: String,
    pub raw_svg: String,
}

static PLAYGROUND_STATE: OnceLock<Arc<RwLock<PlaygroundRunState>>> = OnceLock::new();
static CUSTOM_SCENARIOS: OnceLock<Arc<RwLock<Vec<PlaygroundScenario>>>> = OnceLock::new();

fn get_playground_state() -> Arc<RwLock<PlaygroundRunState>> {
    PLAYGROUND_STATE
        .get_or_init(|| {
            Arc::new(RwLock::new(PlaygroundRunState {
                id: Uuid::new_v4().to_string(),
                scenario_id: "scenario-health-check".to_string(),
                status: "Idle".to_string(),
                current_step: 1,
                step_progress_pct: 0,
                logs: vec![
                    "tendril.run interactive browser sandbox ready.".to_string(),
                    "Select a scenario or import a GitHub issue to test the 30-second loop."
                        .to_string(),
                ],
                verification_gates: default_verification_gates(),
                diff_preview: None,
                pr_summary: None,
                elapsed_seconds: 0.0,
                speed_multiplier: 1.0,
            }))
        })
        .clone()
}

fn get_custom_scenarios() -> Arc<RwLock<Vec<PlaygroundScenario>>> {
    CUSTOM_SCENARIOS
        .get_or_init(|| Arc::new(RwLock::new(Vec::new())))
        .clone()
}

pub fn default_verification_gates() -> Vec<VerificationGateItem> {
    vec![
        VerificationGateItem {
            name: "RustClippy".to_string(),
            command: "cargo clippy -- -D warnings".to_string(),
            status: "Pending".to_string(),
            duration_ms: 0,
            output: "Pending execution in isolated worktree.".to_string(),
        },
        VerificationGateItem {
            name: "RustTest".to_string(),
            command: "cargo test".to_string(),
            status: "Pending".to_string(),
            duration_ms: 0,
            output: "Pending execution in isolated worktree.".to_string(),
        },
        VerificationGateItem {
            name: "NpmLint".to_string(),
            command: "vp fmt --check . && vp lint .".to_string(),
            status: "Pending".to_string(),
            duration_ms: 0,
            output: "Pending execution in isolated worktree.".to_string(),
        },
        VerificationGateItem {
            name: "NpmBuild".to_string(),
            command: "vp install && vp build".to_string(),
            status: "Pending".to_string(),
            duration_ms: 0,
            output: "Pending execution in isolated worktree.".to_string(),
        },
        VerificationGateItem {
            name: "CheckResult".to_string(),
            command: "tendril verify check-result".to_string(),
            status: "Pending".to_string(),
            duration_ms: 0,
            output: "Pending verification report generation.".to_string(),
        },
    ]
}

pub fn curated_scenarios() -> Vec<PlaygroundScenario> {
    vec![
        PlaygroundScenario {
            id: "scenario-health-check".to_string(),
            title: "Health check endpoint with uptime metrics".to_string(),
            description: "Simulates an autonomous agent implementing /api/health with system uptime, memory metrics, and automated unit tests in an isolated worktree.".to_string(),
            target_branch: "master".to_string(),
            estimated_seconds: 15,
            file_tree: vec![
                WorktreeFileNode {
                    name: "backend".to_string(),
                    path: "backend".to_string(),
                    is_dir: true,
                    status: "Modified".to_string(),
                    children: Some(vec![
                        WorktreeFileNode {
                            name: "Cargo.toml".to_string(),
                            path: "backend/Cargo.toml".to_string(),
                            is_dir: false,
                            status: "Unchanged".to_string(),
                            children: None,
                        },
                        WorktreeFileNode {
                            name: "src".to_string(),
                            path: "backend/src".to_string(),
                            is_dir: true,
                            status: "Modified".to_string(),
                            children: Some(vec![
                                WorktreeFileNode {
                                    name: "api".to_string(),
                                    path: "backend/src/api".to_string(),
                                    is_dir: true,
                                    status: "Modified".to_string(),
                                    children: Some(vec![
                                        WorktreeFileNode {
                                            name: "health.rs".to_string(),
                                            path: "backend/src/api/health.rs".to_string(),
                                            is_dir: false,
                                            status: "Created".to_string(),
                                            children: None,
                                        },
                                        WorktreeFileNode {
                                            name: "mod.rs".to_string(),
                                            path: "backend/src/api/mod.rs".to_string(),
                                            is_dir: false,
                                            status: "Modified".to_string(),
                                            children: None,
                                        },
                                    ]),
                                },
                                WorktreeFileNode {
                                    name: "main.rs".to_string(),
                                    path: "backend/src/main.rs".to_string(),
                                    is_dir: false,
                                    status: "Unchanged".to_string(),
                                    children: None,
                                },
                            ]),
                        },
                        WorktreeFileNode {
                            name: "tests".to_string(),
                            path: "backend/tests".to_string(),
                            is_dir: true,
                            status: "Created".to_string(),
                            children: Some(vec![
                                WorktreeFileNode {
                                    name: "health_test.rs".to_string(),
                                    path: "backend/tests/health_test.rs".to_string(),
                                    is_dir: false,
                                    status: "Created".to_string(),
                                    children: None,
                                },
                            ]),
                        },
                    ]),
                },
                WorktreeFileNode {
                    name: "frontend".to_string(),
                    path: "frontend".to_string(),
                    is_dir: true,
                    status: "Unchanged".to_string(),
                    children: Some(vec![
                        WorktreeFileNode {
                            name: "package.json".to_string(),
                            path: "frontend/package.json".to_string(),
                            is_dir: false,
                            status: "Unchanged".to_string(),
                            children: None,
                        },
                    ]),
                },
            ],
            diff: r#"diff --git a/backend/src/api/health.rs b/backend/src/api/health.rs
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
+}"#.to_string(),
            pr_summary: r#"# Pull Request: Add health check endpoint with uptime metrics

## Changes
Implemented lightweight `/api/health` diagnostic route returning system status, uptime duration, and release version metadata.

## Verifications Passed
- **RustClippy**: `cargo clippy -- -D warnings` (Clean)
- **RustTest**: `cargo test --test health_test` (1 passed)
- **NpmLint**: `vp fmt --check .` (Clean)
- **NpmBuild**: `vp build` (Clean)
- **CheckResult**: Verified all plan requirements satisfied.

## Worktree Isolation
- Executed in ephemeral worktree: `.tendril/Worktrees/growthhack-demo`
- Base commit: `origin/master` (0 conflicts)
"#.to_string(),
            labels: vec!["backend".to_string(), "api".to_string(), "metrics".to_string()],
            issue_url: None,
        },
        PlaygroundScenario {
            id: "scenario-rate-limiter".to_string(),
            title: "Token bucket rate limiter Tower middleware".to_string(),
            description: "Simulates creating an isolated worktree to implement memory-safe rate limiting with Tower middleware and integration tests.".to_string(),
            target_branch: "master".to_string(),
            estimated_seconds: 20,
            file_tree: vec![
                WorktreeFileNode {
                    name: "backend".to_string(),
                    path: "backend".to_string(),
                    is_dir: true,
                    status: "Modified".to_string(),
                    children: Some(vec![
                        WorktreeFileNode {
                            name: "src".to_string(),
                            path: "backend/src".to_string(),
                            is_dir: true,
                            status: "Modified".to_string(),
                            children: Some(vec![
                                WorktreeFileNode {
                                    name: "middleware".to_string(),
                                    path: "backend/src/middleware".to_string(),
                                    is_dir: true,
                                    status: "Created".to_string(),
                                    children: Some(vec![
                                        WorktreeFileNode {
                                            name: "rate_limit.rs".to_string(),
                                            path: "backend/src/middleware/rate_limit.rs".to_string(),
                                            is_dir: false,
                                            status: "Created".to_string(),
                                            children: None,
                                        },
                                    ]),
                                },
                                WorktreeFileNode {
                                    name: "main.rs".to_string(),
                                    path: "backend/src/main.rs".to_string(),
                                    is_dir: false,
                                    status: "Modified".to_string(),
                                    children: None,
                                },
                            ]),
                        },
                        WorktreeFileNode {
                            name: "tests".to_string(),
                            path: "backend/tests".to_string(),
                            is_dir: true,
                            status: "Created".to_string(),
                            children: Some(vec![
                                WorktreeFileNode {
                                    name: "rate_limit_test.rs".to_string(),
                                    path: "backend/tests/rate_limit_test.rs".to_string(),
                                    is_dir: false,
                                    status: "Created".to_string(),
                                    children: None,
                                },
                            ]),
                        },
                    ]),
                },
            ],
            diff: r#"diff --git a/backend/src/middleware/rate_limit.rs b/backend/src/middleware/rate_limit.rs
new file mode 100644
index 0000000..9b1f234
--- /dev/null
+++ b/backend/src/middleware/rate_limit.rs
@@ -0,0 +1,24 @@
+use tower::limit::RateLimitLayer;
+use std::time::Duration;
+
+pub fn build_rate_limiter() -> RateLimitLayer {
+    RateLimitLayer::new(100, Duration::from_secs(60))
+}"#.to_string(),
            pr_summary: r#"# Pull Request: Token bucket rate limiter Tower middleware

## Changes
Integrated Tower RateLimitLayer enforcing a 100 req/min threshold across public API endpoints.

## Verifications Passed
- **RustClippy**: Clean
- **RustTest**: 2 tests passed
- **NpmLint**: Clean
- **NpmBuild**: Clean
- **CheckResult**: Verified.
"#.to_string(),
            labels: vec!["backend".to_string(), "middleware".to_string(), "security".to_string()],
            issue_url: None,
        },
        PlaygroundScenario {
            id: "scenario-terminal-theme".to_string(),
            title: "High-contrast terminal UI theme".to_string(),
            description: "Simulates UI component enhancement with Tailwind CSS v4 and screenshot verification in an isolated worktree.".to_string(),
            target_branch: "master".to_string(),
            estimated_seconds: 18,
            file_tree: vec![
                WorktreeFileNode {
                    name: "frontend".to_string(),
                    path: "frontend".to_string(),
                    is_dir: true,
                    status: "Modified".to_string(),
                    children: Some(vec![
                        WorktreeFileNode {
                            name: "src".to_string(),
                            path: "frontend/src".to_string(),
                            is_dir: true,
                            status: "Modified".to_string(),
                            children: Some(vec![
                                WorktreeFileNode {
                                    name: "components".to_string(),
                                    path: "frontend/src/components".to_string(),
                                    is_dir: true,
                                    status: "Modified".to_string(),
                                    children: Some(vec![
                                        WorktreeFileNode {
                                            name: "LiveTerminal.tsx".to_string(),
                                            path: "frontend/src/components/LiveTerminal.tsx".to_string(),
                                            is_dir: false,
                                            status: "Modified".to_string(),
                                            children: None,
                                        },
                                    ]),
                                },
                            ]),
                        },
                    ]),
                },
            ],
            diff: r#"diff --git a/frontend/src/components/LiveTerminal.tsx b/frontend/src/components/LiveTerminal.tsx
index a123b45..c678d90 100644
--- a/frontend/src/components/LiveTerminal.tsx
+++ b/frontend/src/components/LiveTerminal.tsx
@@ -42,3 +42,7 @@
+export const HighContrastTheme = {
+  bg: "bg-slate-950 border-emerald-500/50",
+  text: "text-emerald-400 font-mono tracking-tight",
+};"#.to_string(),
            pr_summary: r#"# Pull Request: High-contrast terminal UI theme

## Changes
Enhanced terminal theme with accessibility-focused color contrast and Tailwind CSS v4 styling.

## Verifications Passed
- **NpmLint**: Clean
- **NpmBuild**: Clean
- **Screenshots**: Captured UI verification evidence.
- **CheckResult**: Verified.
"#.to_string(),
            labels: vec!["frontend".to_string(), "ui".to_string(), "accessibility".to_string()],
            issue_url: None,
        },
    ]
}

pub async fn list_scenarios() -> impl IntoResponse {
    let mut all = curated_scenarios();
    let custom = get_custom_scenarios().read().await.clone();
    all.extend(custom);
    Json(all)
}

#[derive(Deserialize, Debug)]
struct GitHubLabel {
    name: String,
}

#[derive(Deserialize, Debug)]
struct GitHubIssueMetadata {
    title: String,
    body: Option<String>,
    #[serde(default)]
    labels: Vec<GitHubLabel>,
    #[serde(default)]
    #[allow(dead_code)]
    html_url: Option<String>,
}

pub fn parse_github_issue_url(url: &str) -> Option<(String, String, u64)> {
    let clean_url = url.trim();
    let after_scheme = if let Some(stripped) = clean_url.strip_prefix("https://") {
        stripped
    } else if let Some(stripped) = clean_url.strip_prefix("http://") {
        stripped
    } else {
        clean_url
    };

    let without_anchor = after_scheme.split('#').next().unwrap_or(after_scheme);
    let without_query = without_anchor.split('?').next().unwrap_or(without_anchor);
    let trimmed = without_query.trim_end_matches('/');

    let parts: Vec<&str> = trimmed.split('/').collect();
    let domain_idx = parts
        .iter()
        .position(|&p| p == "github.com" || p == "www.github.com")?;
    if parts.len() >= domain_idx + 5 {
        let owner = parts[domain_idx + 1];
        let repo = parts[domain_idx + 2];
        let issues_segment = parts[domain_idx + 3];
        let num_str = parts[domain_idx + 4];

        if issues_segment == "issues" && !owner.is_empty() && !repo.is_empty() {
            if let Ok(issue_num) = num_str.parse::<u64>() {
                return Some((owner.to_string(), repo.to_string(), issue_num));
            }
        }
    }
    None
}

async fn fetch_github_issue_metadata(
    owner: &str,
    repo: &str,
    issue_number: u64,
    token: &str,
) -> Result<GitHubIssueMetadata, reqwest::Error> {
    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{owner}/{repo}/issues/{issue_number}");
    let res = client
        .get(&url)
        .header("Authorization", format!("Bearer {token}"))
        .header("User-Agent", "GrowthHack-Playground/0.1.0")
        .header("Accept", "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .timeout(Duration::from_secs(10))
        .send()
        .await?;

    if !res.status().is_success() {
        return Err(res.error_for_status().unwrap_err());
    }

    res.json::<GitHubIssueMetadata>().await
}

pub async fn import_issue(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<ImportIssueRequest>,
) -> impl IntoResponse {
    let issue_id = format!("custom-{}", Uuid::new_v4().simple());

    let parsed_coords = payload
        .issue_url
        .as_deref()
        .and_then(parse_github_issue_url);
    let mut live_metadata: Option<GitHubIssueMetadata> = None;

    if let Some((ref owner, ref repo, issue_num)) = parsed_coords {
        if let Some(token) = ctx.get_github_token() {
            if let Ok(meta) = fetch_github_issue_metadata(owner, repo, issue_num, &token).await {
                live_metadata = Some(meta);
            }
        }
    }

    let labels: Vec<String> = live_metadata
        .as_ref()
        .map(|m| m.labels.iter().map(|l| l.name.clone()).collect())
        .unwrap_or_default();

    let title = payload
        .title
        .filter(|t| !t.trim().is_empty())
        .or_else(|| live_metadata.as_ref().map(|m| m.title.clone()))
        .or_else(|| {
            payload.issue_url.as_ref().map(|url| {
                let parts: Vec<&str> = url.trim_end_matches('/').split('/').collect();
                if parts.len() >= 2 {
                    format!("Imported GitHub Issue #{}", parts[parts.len() - 1])
                } else {
                    "Custom GitHub Issue Implementation".to_string()
                }
            })
        })
        .unwrap_or_else(|| "Custom Issue Implementation".to_string());

    let description = payload
        .description
        .filter(|d| !d.trim().is_empty())
        .or_else(|| {
            live_metadata
                .as_ref()
                .and_then(|m| m.body.clone())
                .filter(|b| !b.trim().is_empty())
                .map(|b| {
                    if b.len() > 500 {
                        format!("{}...", &b[..500])
                    } else {
                        b
                    }
                })
        })
        .or_else(|| {
            payload
                .issue_url
                .as_ref()
                .map(|url| format!("Autonomous implementation synthesized from issue: {}", url))
        })
        .unwrap_or_else(|| {
            "Simulated custom developer workflow and test verification.".to_string()
        });

    let label_lines = if labels.is_empty() {
        String::new()
    } else {
        format!(
            "\n## Labels\n{}\n",
            labels
                .iter()
                .map(|l| format!("- `{}`", l))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };

    let diff_labels_comment = if labels.is_empty() {
        String::new()
    } else {
        format!("\n// Labels: [{}]", labels.join(", "))
    };

    let issue_url = payload.issue_url.clone();

    let scenario = PlaygroundScenario {
        id: issue_id.clone(),
        title: title.clone(),
        description: description.clone(),
        target_branch: "master".to_string(),
        estimated_seconds: 25,
        file_tree: vec![
            WorktreeFileNode {
                name: "backend".to_string(),
                path: "backend".to_string(),
                is_dir: true,
                status: "Modified".to_string(),
                children: Some(vec![
                    WorktreeFileNode {
                        name: "src".to_string(),
                        path: "backend/src".to_string(),
                        is_dir: true,
                        status: "Modified".to_string(),
                        children: Some(vec![
                            WorktreeFileNode {
                                name: "api".to_string(),
                                path: "backend/src/api".to_string(),
                                is_dir: true,
                                status: "Modified".to_string(),
                                children: Some(vec![
                                    WorktreeFileNode {
                                        name: "feature.rs".to_string(),
                                        path: "backend/src/api/feature.rs".to_string(),
                                        is_dir: false,
                                        status: "Created".to_string(),
                                        children: None,
                                    },
                                ]),
                            },
                        ]),
                    },
                    WorktreeFileNode {
                        name: "tests".to_string(),
                        path: "backend/tests".to_string(),
                        is_dir: true,
                        status: "Created".to_string(),
                        children: Some(vec![
                            WorktreeFileNode {
                                name: "feature_test.rs".to_string(),
                                path: "backend/tests/feature_test.rs".to_string(),
                                is_dir: false,
                                status: "Created".to_string(),
                                children: None,
                            },
                        ]),
                    },
                ]),
            },
        ],
        diff: format!(
            r#"diff --git a/backend/src/api/feature.rs b/backend/src/api/feature.rs
new file mode 100644
index 0000000..8a9b1c2
--- /dev/null
+++ b/backend/src/api/feature.rs
@@ -0,0 +1,15 @@
+// Feature implementation for {}{}
+pub fn execute_feature() -> bool {{
+    true
+}}"#,
            title, diff_labels_comment
        ),
        pr_summary: format!(
            "# Pull Request: {}\n\n## Changes\n{}\n{}\n## Verifications Passed\n- RustClippy: Pass\n- RustTest: Pass\n- NpmLint: Pass\n- CheckResult: Pass\n",
            title, description, label_lines
        ),
        labels,
        issue_url,
    };

    {
        let custom_arc = get_custom_scenarios();
        let mut custom = custom_arc.write().await;
        custom.push(scenario.clone());
    }

    // Update metrics
    {
        let mut app_state = ctx.state.write().await;
        app_state.playground_metrics.issues_imported += 1;
        let _ = app_state.save(&ctx.data_file);
    }

    Json(scenario)
}

pub async fn get_tree(Query(query): Query<ScenarioQuery>) -> impl IntoResponse {
    let scenario_id = query
        .scenario_id
        .unwrap_or_else(|| "scenario-health-check".to_string());

    let all_scenarios = {
        let mut list = curated_scenarios();
        let custom = get_custom_scenarios().read().await.clone();
        list.extend(custom);
        list
    };

    let tree = all_scenarios
        .into_iter()
        .find(|s| s.id == scenario_id)
        .map(|s| s.file_tree)
        .unwrap_or_else(|| curated_scenarios()[0].file_tree.clone());

    Json(tree)
}

pub async fn get_status() -> impl IntoResponse {
    let state = get_playground_state().read().await.clone();
    Json(state)
}

pub async fn start_simulation(
    State(ctx): State<Arc<AppContext>>,
    payload: Option<Json<StartPlaygroundRequest>>,
) -> impl IntoResponse {
    let state_arc = get_playground_state();
    let speed = payload
        .as_ref()
        .and_then(|p| p.speed_multiplier)
        .unwrap_or(1.0)
        .max(0.1);

    let scenario_id = payload
        .as_ref()
        .and_then(|p| p.scenario_id.clone())
        .unwrap_or_else(|| "scenario-health-check".to_string());

    let all_scenarios = {
        let mut list = curated_scenarios();
        let custom = get_custom_scenarios().read().await.clone();
        list.extend(custom);
        list
    };

    let active_scenario = all_scenarios
        .into_iter()
        .find(|s| s.id == scenario_id)
        .unwrap_or_else(|| curated_scenarios()[0].clone());

    let run_id = Uuid::new_v4().to_string();

    {
        let mut s = state_arc.write().await;
        s.id = run_id.clone();
        s.scenario_id = scenario_id.clone();
        s.status = "Running".to_string();
        s.current_step = 1;
        s.step_progress_pct = 25;
        s.speed_multiplier = speed;
        s.logs = vec![
            format!(
                "[00:01] Initializing Tendril autonomous agent for '{}'...",
                active_scenario.title
            ),
            "[00:03] Step 1/4 (Intake): Analyzing task specification and acceptance criteria..."
                .to_string(),
            "[00:05] Step 1/4 (Intake): Target branch identified as 'master'. Plan validated."
                .to_string(),
        ];
        s.verification_gates = default_verification_gates();
        s.diff_preview = None;
        s.pr_summary = None;
        s.elapsed_seconds = 5.2;
    }

    let initial_clone = state_arc.read().await.clone();

    // Background asynchronous progression
    let ctx_clone = ctx.clone();
    let state_for_bg = state_arc.clone();
    let scenario_for_bg = active_scenario.clone();

    tokio::spawn(async move {
        let step_ms = (450.0 / speed).clamp(5.0, 1000.0) as u64;

        // Step 2: Isolated Worktree
        tokio::time::sleep(Duration::from_millis(step_ms)).await;
        {
            let mut s = state_for_bg.write().await;
            if s.id != run_id {
                return;
            }
            s.current_step = 2;
            s.step_progress_pct = 50;
            s.elapsed_seconds = 14.8;
            s.logs.push("[00:10] Step 2/4 (Worktree): Provisioning ephemeral git worktree at 'Worktrees/spacecorps/growthhack'...".to_string());
            s.logs.push(format!(
                "[00:13] Step 2/4 (Worktree): Checked out branch 'tendril/{}' from origin/master.",
                scenario_for_bg.id
            ));
            s.logs.push("[00:15] Step 2/4 (Worktree): Zero uncommitted changes. Worktree sandbox isolation confirmed.".to_string());
            for gate in &mut s.verification_gates {
                gate.status = "Running".to_string();
                gate.output = "Executing verification inside worktree sandbox...".to_string();
            }
        }

        // Step 3: Verification Gates
        tokio::time::sleep(Duration::from_millis(step_ms)).await;
        {
            let mut s = state_for_bg.write().await;
            if s.id != run_id {
                return;
            }
            s.current_step = 3;
            s.step_progress_pct = 75;
            s.elapsed_seconds = 23.4;
            s.logs.push(
                "[00:18] Step 3/4 (Verification Gates): Running automated test and lint suite..."
                    .to_string(),
            );
            s.logs.push("[00:20] Step 3/4 (Verification Gates): RustClippy -> cargo clippy -- -D warnings [PASS]".to_string());
            s.logs.push("[00:22] Step 3/4 (Verification Gates): RustTest -> cargo test [PASS: 36 passed, 0 failed]".to_string());
            s.logs.push("[00:24] Step 3/4 (Verification Gates): NpmLint -> vp check [PASS: clean formatting]".to_string());
            s.logs.push("[00:26] Step 3/4 (Verification Gates): NpmBuild -> vp build [PASS: bundle compiled cleanly]".to_string());

            for (idx, gate) in s.verification_gates.iter_mut().enumerate() {
                gate.status = "Passed".to_string();
                gate.duration_ms = 850 + (idx as u64 * 320);
                gate.output = match gate.name.as_str() {
                    "RustClippy" => {
                        "cargo clippy -- -D warnings: 0 warnings, clean build.".to_string()
                    }
                    "RustTest" => "cargo test: 36 passed, 0 failed, 0 filtered out.".to_string(),
                    "NpmLint" => "vp fmt --check && vp lint: 0 errors found in TypeScript modules."
                        .to_string(),
                    "NpmBuild" => "vp build: Production bundle generated successfully.".to_string(),
                    _ => "All verification criteria passed without defects.".to_string(),
                };
            }
        }

        // Step 4: PR & Diff
        tokio::time::sleep(Duration::from_millis(step_ms)).await;
        {
            let mut s = state_for_bg.write().await;
            if s.id != run_id {
                return;
            }
            s.current_step = 4;
            s.step_progress_pct = 100;
            s.status = "Completed".to_string();
            s.elapsed_seconds = 28.6;
            s.logs.push(format!(
                "[00:27] Step 4/4 (PR & Diff): Generating commit for '{}'...",
                scenario_for_bg.title
            ));
            s.logs.push(
                "[00:28] Step 4/4 (PR & Diff): Unified Git diff preview synthesized cleanly."
                    .to_string(),
            );
            s.logs.push(
                "[00:29] Step 4/4 (PR & Diff): Pull request opened with 0 merge conflicts."
                    .to_string(),
            );
            s.logs.push(
                "[00:30] Workflow execution completed successfully in 28.6s! All 5 gates green."
                    .to_string(),
            );
            s.diff_preview = Some(scenario_for_bg.diff.clone());
            s.pr_summary = Some(scenario_for_bg.pr_summary.clone());
        }

        // Update persistent growth metrics
        {
            let mut app_state = ctx_clone.state.write().await;
            app_state.playground_metrics.walkthroughs_completed += 1;
            app_state.playground_metrics.total_sessions += 1;
            let count = app_state.playground_metrics.walkthroughs_completed as f64;
            let current_avg = app_state.playground_metrics.avg_completion_seconds;
            app_state.playground_metrics.avg_completion_seconds = if count <= 1.0 {
                28.6
            } else {
                ((current_avg * (count - 1.0)) + 28.6) / count
            };
            let _ = app_state.save(&ctx_clone.data_file);
        }
    });

    Json(initial_clone)
}

pub async fn reset_simulation() -> impl IntoResponse {
    let state_arc = get_playground_state();
    let mut state = state_arc.write().await;
    state.id = Uuid::new_v4().to_string();
    state.status = "Idle".to_string();
    state.current_step = 1;
    state.step_progress_pct = 0;
    state.logs = vec![
        "Simulation reset to Idle state.".to_string(),
        "Ready to run interactive workflow in under 30 seconds.".to_string(),
    ];
    state.verification_gates = default_verification_gates();
    state.diff_preview = None;
    state.pr_summary = None;
    state.elapsed_seconds = 0.0;
    Json(state.clone())
}

pub async fn get_diff(Query(query): Query<ScenarioQuery>) -> impl IntoResponse {
    let scenario_id = query
        .scenario_id
        .unwrap_or_else(|| "scenario-health-check".to_string());

    let all_scenarios = {
        let mut list = curated_scenarios();
        let custom = get_custom_scenarios().read().await.clone();
        list.extend(custom);
        list
    };

    let scenario = all_scenarios
        .into_iter()
        .find(|s| s.id == scenario_id)
        .unwrap_or_else(|| curated_scenarios()[0].clone());

    Json(PlaygroundDiffResponse {
        scenario_id,
        diff: scenario.diff,
        pr_summary: scenario.pr_summary,
    })
}

fn find_file_node<'a>(
    tree: &'a [WorktreeFileNode],
    target_path: &str,
) -> Option<&'a WorktreeFileNode> {
    for node in tree {
        if node.path == target_path && !node.is_dir {
            return Some(node);
        }
        if let Some(ref children) = node.children {
            if let Some(found) = find_file_node(children, target_path) {
                return Some(found);
            }
        }
    }
    None
}

fn infer_language(path: &str) -> String {
    if path.ends_with(".rs") {
        "rust".to_string()
    } else if path.ends_with(".toml") {
        "toml".to_string()
    } else if path.ends_with(".json") {
        "json".to_string()
    } else if path.ends_with(".ts") || path.ends_with(".tsx") {
        "typescript".to_string()
    } else if path.ends_with(".js") || path.ends_with(".jsx") {
        "javascript".to_string()
    } else if path.ends_with(".md") {
        "markdown".to_string()
    } else if path.ends_with(".html") {
        "html".to_string()
    } else if path.ends_with(".css") {
        "css".to_string()
    } else {
        "plaintext".to_string()
    }
}

fn extract_file_diff(full_diff: &str, path: &str) -> Option<String> {
    let header = format!("diff --git a/{} b/{}", path, path);
    if let Some(start_idx) = full_diff.find(&header) {
        let after_start = &full_diff[start_idx..];
        let end_idx = after_start[header.len()..]
            .find("\ndiff --git ")
            .map(|i| header.len() + i)
            .unwrap_or(after_start.len());
        Some(after_start[..end_idx].trim().to_string())
    } else {
        None
    }
}

pub fn get_simulated_file_content(
    scenario: &PlaygroundScenario,
    path: &str,
) -> Option<PlaygroundFileResponse> {
    let node = find_file_node(&scenario.file_tree, path)?;
    let name = node.name.clone();
    let status = node.status.clone();
    let language = infer_language(path);

    let content = match (scenario.id.as_str(), path) {
        ("scenario-health-check", "backend/src/api/health.rs") => {
            r#"use axum::{response::IntoResponse, Json};
use serde::Serialize;
use std::time::Instant;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub uptime_seconds: u64,
    pub version: &'static str,
}

static START_TIME: std::sync::OnceLock<Instant> = std::sync::OnceLock::new();

pub async fn health_check() -> impl IntoResponse {
    let start = START_TIME.get_or_init(Instant::now);
    Json(HealthResponse {
        status: "healthy",
        uptime_seconds: start.elapsed().as_secs(),
        version: env!("CARGO_PKG_VERSION"),
    })
}
"#
            .to_string()
        }
        ("scenario-health-check", "backend/tests/health_test.rs") => {
            r#"use growthhack_backend::api::health::health_check;

#[tokio::test]
async fn test_health_check_returns_ok() {
    let response = health_check().await;
    assert_eq!(response.status, "healthy");
}
"#
            .to_string()
        }
        ("scenario-health-check", "backend/Cargo.toml") => {
            r#"[package]
name = "growthhack-backend"
version = "0.1.0"
edition = "2021"

[dependencies]
axum = { version = "0.8", features = ["macros"] }
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tower = "0.5"
tower-http = { version = "0.6", features = ["cors", "trace", "fs"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
uuid = { version = "1.0", features = ["v4", "serde"] }
"#
            .to_string()
        }
        ("scenario-health-check", "backend/src/api/mod.rs") => {
            r#"pub mod health;
pub mod playground;

use axum::{routing::get, Router};
use std::sync::Arc;

pub fn router(ctx: Arc<AppContext>) -> Router {
    Router::new()
        .route("/api/health", get(health::health_check))
        .route("/api/playground/scenarios", get(playground::list_scenarios))
        .route("/api/playground/tree", get(playground::get_tree))
        .route("/api/playground/file-content", get(playground::get_file_content))
        .with_state(ctx)
}
"#
            .to_string()
        }
        ("scenario-health-check", "backend/src/main.rs") => {
            r#"use axum::Router;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info"))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = Router::new().nest("/api", growthhack_backend::api::router(ctx));
    let addr = SocketAddr::from(([127, 0, 0, 1], 4200));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
"#
            .to_string()
        }
        ("scenario-health-check", "frontend/package.json") => {
            r#"{
  "name": "growthhack-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vp dev",
    "build": "tsc && vp build",
    "preview": "vp preview",
    "test": "vp test"
  },
  "dependencies": {
    "lucide-react": "^1.43.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.7.3",
    "vite-plus": "^0.3.0"
  }
}
"#
            .to_string()
        }
        ("scenario-rate-limiter", "backend/src/middleware/rate_limit.rs") => {
            r#"use tower::limit::RateLimitLayer;
use std::time::Duration;

pub fn build_rate_limiter() -> RateLimitLayer {
    RateLimitLayer::new(100, Duration::from_secs(60))
}
"#
            .to_string()
        }
        ("scenario-rate-limiter", "backend/tests/rate_limit_test.rs") => {
            r#"use growthhack_backend::middleware::rate_limit::build_rate_limiter;

#[tokio::test]
async fn test_rate_limiter_allows_under_threshold() {
    let limiter = build_rate_limiter();
    assert_eq!(limiter.num_requests(), 0);
}
"#
            .to_string()
        }
        ("scenario-rate-limiter", "backend/src/main.rs") => {
            r#"use axum::Router;
use growthhack_backend::middleware::rate_limit::build_rate_limiter;

#[tokio::main]
async fn main() {
    let limiter = build_rate_limiter();
    let app = Router::new().layer(limiter);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:4200").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
"#
            .to_string()
        }
        ("scenario-terminal-theme", "frontend/src/components/LiveTerminal.tsx") => {
            r#"import React from "react";

export const HighContrastTheme = {
  bg: "bg-slate-950 border-emerald-500/50",
  text: "text-emerald-400 font-mono tracking-tight",
};

export const LiveTerminal: React.FC<{ logs: string[] }> = ({ logs }) => {
  return (
    <div className={`p-4 rounded-xl border ${HighContrastTheme.bg}`}>
      {logs.map((log, i) => (
        <div key={i} className={HighContrastTheme.text}>
          &gt; {log}
        </div>
      ))}
    </div>
  );
};
"#
            .to_string()
        }
        (_, "backend/src/api/feature.rs") => format!(
            "// Feature implementation for {}\npub fn execute_feature() -> bool {{\n    true\n}}\n",
            scenario.title
        ),
        (_, "backend/tests/feature_test.rs") => format!(
            "// Integration test for {}\n#[test]\nfn test_feature_execution() {{\n    assert!(true);\n}}\n",
            scenario.title
        ),
        _ => match language.as_str() {
            "rust" => {
                format!("// {}\npub fn handler() {{\n    // Simulated implementation\n}}\n", path)
            }
            "typescript" => {
                format!("// {}\nexport const Component = () => {{\n  return null;\n}};\n", path)
            }
            "toml" => format!("# {}\n[package]\nname = \"growthhack-backend\"\n", path),
            "json" => "{\n  \"name\": \"growthhack\"\n}\n".to_string(),
            _ => format!("// Content of {}\n", path),
        },
    };

    let file_diff = if status == "Unchanged" {
        None
    } else {
        extract_file_diff(&scenario.diff, path)
    };

    let line_count = content.lines().count().max(1);

    Some(PlaygroundFileResponse {
        scenario_id: scenario.id.clone(),
        path: path.to_string(),
        name,
        status,
        content,
        file_diff,
        language,
        line_count,
    })
}

pub async fn get_file_content(
    Query(query): Query<PlaygroundFileQuery>,
) -> impl IntoResponse {
    let scenario_id = query
        .scenario_id
        .clone()
        .unwrap_or_else(|| "scenario-health-check".to_string());

    let all_scenarios = {
        let mut list = curated_scenarios();
        let custom = get_custom_scenarios().read().await.clone();
        list.extend(custom);
        list
    };

    let scenario = match all_scenarios.into_iter().find(|s| s.id == scenario_id) {
        Some(s) => s,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "error": format!("Scenario '{}' not found", scenario_id)
                })),
            )
                .into_response();
        }
    };

    match get_simulated_file_content(&scenario, &query.path) {
        Some(file_resp) => (
            StatusCode::OK,
            Json(serde_json::to_value(file_resp).unwrap()),
        )
            .into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": format!("File '{}' not found in scenario '{}'", query.path, scenario_id)
            })),
        )
            .into_response(),
    }
}

pub async fn get_metrics(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.playground_metrics.clone())
}

pub async fn record_star_click(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    state.playground_metrics.github_stars_clicked += 1;
    state.onboarding_metrics.github_starred = true;
    let _ = state.save(&ctx.data_file);
    Json(state.playground_metrics.clone())
}

pub async fn get_banner_info() -> impl IntoResponse {
    let badge_url = "https://img.shields.io/badge/Try%20Tendril-30s%20Interactive%20Playground-06b6d4?style=for-the-badge&logo=visualstudiocode&logoColor=white";
    let target_url = "https://tendril.run/playground";
    let markdown_snippet = format!(
        "[![Try Tendril in 30 Seconds]({})]({})",
        badge_url, target_url
    );
    let html_snippet = format!(
        "<a href=\"{}\" target=\"_blank\" rel=\"noopener noreferrer\"><img src=\"{}\" alt=\"Try Tendril in 30 Seconds\" /></a>",
        target_url, badge_url
    );
    let raw_svg = r##"<svg xmlns="http://www.w3.org/2000/svg" width="310" height="40" viewBox="0 0 310 40">
  <rect width="310" height="40" rx="8" fill="#020617" stroke="#1e293b" stroke-width="1.5" />
  <rect x="0" y="0" width="110" height="40" rx="8" fill="#0f172a" />
  <text x="55" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#94a3b8">TRY TENDRIL</text>
  <rect x="110" y="0" width="200" height="40" rx="8" fill="#06b6d4" />
  <text x="210" y="24" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#020617">30s Interactive Playground ⚡</text>
</svg>"##.to_string();

    Json(BannerEmbedInfo {
        title: "Try Tendril in 30 Seconds Embed Banner".to_string(),
        badge_url: badge_url.to_string(),
        target_url: target_url.to_string(),
        markdown_snippet,
        html_snippet,
        raw_svg,
    })
}

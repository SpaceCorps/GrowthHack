use crate::agent::TaskManager;
use crate::db::{GrowthIssue, SharedState};
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

use crate::config::Config;

#[derive(Clone)]
pub struct AppContext {
    pub state: SharedState,
    pub task_manager: TaskManager,
    pub data_file: std::path::PathBuf,
    pub ivy_web_content_path: std::path::PathBuf,
    pub ivy_web_images_path: std::path::PathBuf,
    pub config: Config,
    pub rate_limiter: std::sync::Arc<crate::api::middleware::rate_limit::IpRateLimiter>,
    pub metrics_debouncer: std::sync::Arc<crate::api::metrics_debouncer::MetricsSyncDebouncer>,
}

impl Default for AppContext {
    fn default() -> Self {
        let temp_dir = std::env::temp_dir();
        let file_id = uuid::Uuid::new_v4().simple().to_string();
        let data_file = temp_dir.join(format!("test_growth_data_{}.json", file_id));
        Self {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(
                crate::db::GrowthState::seed_default(),
            )),
            task_manager: crate::agent::TaskManager::new(crate::agent::AgentRunner::new(
                std::path::PathBuf::from("agy"),
            )),
            data_file,
            ivy_web_content_path: temp_dir.clone(),
            ivy_web_images_path: temp_dir,
            config: crate::config::Config::default(),
            rate_limiter: std::sync::Arc::new(
                crate::api::middleware::rate_limit::IpRateLimiter::default(),
            ),
            metrics_debouncer: std::sync::Arc::new(
                crate::api::metrics_debouncer::MetricsSyncDebouncer::default(),
            ),
        }
    }
}

impl AppContext {
    pub fn get_github_token(&self) -> Option<String> {
        if let Ok(state) = self.state.try_read() {
            if let Some(ref token) = state.syndication_settings.github_token {
                let trimmed = token.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
        self.config.github_token.clone()
    }

    pub fn get_webhook_secret(&self) -> Option<String> {
        if let Ok(state) = self.state.try_read() {
            if let Some(ref secret) = state.syndication_settings.webhook_secret {
                let trimmed = secret.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
        self.config.syndication_webhook_secret.clone()
    }

    pub fn new_test() -> Self {
        Self::default()
    }

    pub fn new_test_context() -> TestContextGuard {
        let ctx = Self::default();
        let data_file = ctx.data_file.clone();
        if let Ok(state) = ctx.state.try_read() {
            let _ = state.save(&data_file);
        }
        TestContextGuard::new(std::sync::Arc::new(ctx), data_file)
    }
}

pub struct TestContextGuard {
    pub ctx: std::sync::Arc<AppContext>,
    pub data_file: std::path::PathBuf,
}

impl TestContextGuard {
    pub fn new(ctx: std::sync::Arc<AppContext>, data_file: std::path::PathBuf) -> Self {
        Self { ctx, data_file }
    }

    pub fn ctx(&self) -> std::sync::Arc<AppContext> {
        self.ctx.clone()
    }

    pub fn data_file(&self) -> &std::path::Path {
        &self.data_file
    }
}

impl std::ops::Deref for TestContextGuard {
    type Target = AppContext;

    fn deref(&self) -> &Self::Target {
        &self.ctx
    }
}

impl Drop for TestContextGuard {
    fn drop(&mut self) {
        if self.data_file.exists() {
            let _ = std::fs::remove_file(&self.data_file);
        }
    }
}

#[derive(Deserialize)]
pub struct CreateIssueRequest {
    pub title: String,
    pub category: String,
    pub priority: String,
    pub description: String,
    pub direct_actions: Vec<String>,
    pub routine_schedule: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateIssueRequest {
    pub status: Option<String>,
    pub priority: Option<String>,
    pub description: Option<String>,
    pub direct_actions: Option<Vec<String>>,
    pub routine_schedule: Option<String>,
}

#[derive(Serialize)]
pub struct RunIssueResponse {
    pub task_id: String,
    pub issue_id: String,
    pub message: String,
}

pub async fn list_issues(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.issues.clone())
}

pub async fn create_issue(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<CreateIssueRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let next_number = state.issues.iter().map(|i| i.number).max().unwrap_or(0) + 1;
    let now = Utc::now();
    let new_issue = GrowthIssue {
        id: format!("issue-{}", Uuid::new_v4().simple()),
        number: next_number,
        title: payload.title,
        category: payload.category,
        status: "Todo".to_string(),
        priority: payload.priority,
        description: payload.description,
        direct_actions: payload.direct_actions,
        routine_schedule: payload.routine_schedule,
        run_count: 0,
        last_run_at: None,
        created_at: now,
        updated_at: now,
    };
    state.issues.push(new_issue.clone());
    let _ = state.save(&ctx.data_file);
    (StatusCode::CREATED, Json(new_issue))
}

pub async fn update_issue(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateIssueRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    if let Some(issue) = state.issues.iter_mut().find(|i| i.id == id) {
        if let Some(status) = payload.status {
            issue.status = status;
        }
        if let Some(priority) = payload.priority {
            issue.priority = priority;
        }
        if let Some(desc) = payload.description {
            issue.description = desc;
        }
        if let Some(actions) = payload.direct_actions {
            issue.direct_actions = actions;
        }
        if let Some(schedule) = payload.routine_schedule {
            issue.routine_schedule = Some(schedule);
        }
        issue.updated_at = Utc::now();
        let cloned = issue.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(Some(cloned)))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub async fn run_issue(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let issue_opt = state.issues.iter_mut().find(|i| i.id == id);
    if issue_opt.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(RunIssueResponse {
                task_id: String::new(),
                issue_id: id,
                message: "Issue not found".to_string(),
            }),
        );
    }

    let issue = issue_opt.unwrap();
    issue.run_count += 1;
    issue.last_run_at = Some(Utc::now());
    let title = issue.title.clone();
    let desc = issue.description.clone();
    let actions = issue.direct_actions.join("\n- ");
    let _ = state.save(&ctx.data_file);
    drop(state);

    let task_id = format!("task-{}", Uuid::new_v4().simple());
    let prompt = format!(
        "Execute growth hacking direct action for Ivy-Tendril:\nIssue: {}\nDescription: {}\nDirect Actions:\n- {}\n\nPlease research, draft concrete artifacts, and provide ready-to-use output.",
        title, desc, actions
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();

    tokio::spawn(async move {
        let _ = runner.execute(&prompt, tx).await;
    });

    (
        StatusCode::ACCEPTED,
        Json(RunIssueResponse {
            task_id,
            issue_id: id,
            message: "Agent task started".to_string(),
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_context_default() {
        let ctx = AppContext::default();
        assert!(!ctx.data_file.to_string_lossy().is_empty());
        assert!(!ctx.ivy_web_content_path.to_string_lossy().is_empty());
        assert!(!ctx.ivy_web_images_path.to_string_lossy().is_empty());
        assert_eq!(ctx.config.port, 4200);
        let state_guard = ctx.state.try_read();
        assert!(state_guard.is_ok());
        let state = state_guard.unwrap();
        assert!(!state.issues.is_empty());
    }

    #[test]
    fn test_app_context_new_test_context_persists_data_file() {
        let guard = AppContext::new_test_context();
        assert!(guard.data_file.exists());
        assert_eq!(guard.ctx.data_file, guard.data_file);
        let content = std::fs::read_to_string(&guard.data_file).unwrap();
        assert!(content.contains("issues"));
    }

    #[test]
    fn test_test_context_guard_deletes_file_on_drop() {
        let data_file = {
            let guard = AppContext::new_test_context();
            let path = guard.data_file().to_path_buf();
            assert!(path.exists());
            path
        };
        assert!(!data_file.exists());
    }

    #[test]
    fn test_test_context_guard_deref_access() {
        let guard = AppContext::new_test_context();
        assert_eq!(guard.config.port, 4200);
        let state_guard = guard.state.try_read();
        assert!(state_guard.is_ok());
    }
}

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

#[derive(Clone)]
pub struct AppContext {
    pub state: SharedState,
    pub task_manager: TaskManager,
    pub data_file: std::path::PathBuf,
    pub ivy_web_content_path: std::path::PathBuf,
    pub ivy_web_images_path: std::path::PathBuf,
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

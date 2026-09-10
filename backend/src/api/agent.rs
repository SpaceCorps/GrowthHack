use crate::api::issues::AppContext;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::sse::{Event, KeepAlive, Sse},
    response::IntoResponse,
    Json,
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use std::convert::Infallible;
use std::sync::Arc;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt as _;
use uuid::Uuid;

#[derive(Serialize)]
pub struct AgentStatusResponse {
    pub is_available: bool,
    pub agy_path: String,
    pub version: Option<String>,
}

#[derive(Deserialize)]
pub struct CustomAgentRunRequest {
    pub prompt: String,
}

#[derive(Serialize)]
pub struct CustomAgentRunResponse {
    pub task_id: String,
    pub message: String,
}

pub async fn get_agent_status(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let path = &ctx.task_manager.runner().agy_path;
    let is_available = path.exists();

    let version = if is_available {
        let output = tokio::process::Command::new(path)
            .arg("--help")
            .output()
            .await
            .ok();
        output.map(|_| "Antigravity CLI (agy)".to_string())
    } else {
        None
    };

    Json(AgentStatusResponse {
        is_available,
        agy_path: path.to_string_lossy().to_string(),
        version,
    })
}

pub async fn run_custom_agent_task(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<CustomAgentRunRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-custom-{}", Uuid::new_v4().simple());
    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let prompt = payload.prompt.clone();

    tokio::spawn(async move {
        let _ = runner.execute(&prompt, tx).await;
    });

    (
        StatusCode::ACCEPTED,
        Json(CustomAgentRunResponse {
            task_id,
            message: "Custom task launched".to_string(),
        }),
    )
}

pub async fn stream_agent_logs(
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

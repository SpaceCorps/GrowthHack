use crate::api::issues::AppContext;
use crate::db::Listing;
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
pub struct CreateListingRequest {
    pub name: String,
    pub category: String,
    pub url: String,
    pub submission_blurb: String,
    pub notes: String,
    #[serde(default)]
    pub blurb_status: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateListingRequest {
    pub status: Option<String>,
    pub pr_url: Option<String>,
    pub submission_blurb: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub blurb_status: Option<String>,
}

#[derive(Serialize)]
pub struct ListingActionResponse {
    pub task_id: String,
    pub message: String,
}

pub async fn list_listings(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.listings.clone())
}

pub async fn create_listing(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<CreateListingRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let blurb_status = payload.blurb_status.or_else(|| {
        if !payload.submission_blurb.trim().is_empty() {
            Some("Pending".to_string())
        } else {
            None
        }
    });
    let new_listing = Listing {
        id: format!("list-{}", Uuid::new_v4().simple()),
        name: payload.name,
        category: payload.category,
        url: payload.url,
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: payload.submission_blurb,
        notes: payload.notes,
        blurb_status,
        updated_at: Utc::now(),
    };
    state.listings.push(new_listing.clone());
    let _ = state.save(&ctx.data_file);
    (StatusCode::CREATED, Json(new_listing))
}

pub async fn update_listing(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateListingRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    if let Some(listing) = state.listings.iter_mut().find(|l| l.id == id) {
        if let Some(status) = payload.status {
            listing.status = status;
        }
        if let Some(pr_url) = payload.pr_url {
            listing.pr_url = Some(pr_url);
        }
        if let Some(blurb) = payload.submission_blurb {
            listing.submission_blurb = blurb;
        }
        if let Some(notes) = payload.notes {
            listing.notes = notes;
        }
        if let Some(blurb_status) = payload.blurb_status {
            listing.blurb_status = Some(blurb_status);
        }
        listing.updated_at = Utc::now();
        let cloned = listing.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(Some(cloned)))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub async fn generate_listing_blurb(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    let listing = match state.listings.iter().find(|l| l.id == id) {
        Some(l) => l.clone(),
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ListingActionResponse {
                    task_id: String::new(),
                    message: "Listing target not found".to_string(),
                }),
            )
        }
    };
    drop(state);

    let task_id = format!("task-list-{}", Uuid::new_v4().simple());
    let prompt = format!(
        r#"You are an open-source maintainer preparing a pull request submission.
Target Repository/Directory: {}
URL: {}
Category: {}

Goal:
Write a perfectly tailored submission entry and GitHub Pull Request description to add Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril) to this list.

Tendril Core Pitch:
Autonomous multi-agent software factory. Plans tasks, executes agents (Claude Code, Gemini, Codex) in isolated Git worktrees, and runs automated verification gates to output tested pull requests.

Provide:
1. Exact Markdown line or table entry matching typical formatting for this repository.
2. Complete GitHub Pull Request title and description explaining why this addition provides genuine value to the community.
3. Checklist verifying adherence to standard Awesome list contribution guidelines (alphabetical sorting, proper link format, concise description).
"#,
        listing.name, listing.url, listing.category
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let list_id_clone = id.clone();

    tokio::spawn(async move {
        match runner.execute(&prompt, tx.clone()).await {
            Ok(content) => {
                let mut state = state_arc.write().await;
                if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id_clone) {
                    l.submission_blurb = content;
                    l.blurb_status = Some("Pending".to_string());
                    l.updated_at = Utc::now();
                }
                let _ = state.save(&data_file);
                let _ = tx.send("[SYSTEM] Custom submission entry generated and saved!".to_string());
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Generation failed: {}", e));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(ListingActionResponse {
            task_id,
            message: "Listing PR blurb generation started with Antigravity".to_string(),
        }),
    )
}

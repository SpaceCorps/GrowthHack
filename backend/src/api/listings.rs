use crate::api::issues::AppContext;
use crate::db::Listing;
use axum::{
    extract::{Path, State},
    http::StatusCode,
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
}

#[derive(Deserialize)]
pub struct UpdateListingRequest {
    pub status: Option<String>,
    pub pr_url: Option<String>,
    pub submission_blurb: Option<String>,
    pub notes: Option<String>,
}

#[derive(Serialize)]
pub struct ListingActionResponse {
    pub task_id: String,
    pub message: String,
}

#[derive(Deserialize)]
pub struct GenerateBatchRequest {
    pub listing_ids: Option<Vec<String>>,
    pub category: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GenerateBatchResponse {
    pub task_ids: Vec<String>,
    pub targeted_count: usize,
    pub message: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct VerifyBacklinkResponse {
    pub id: String,
    pub url: String,
    pub verified: bool,
    pub status: String,
    pub message: String,
}

pub fn build_tailored_prompt(listing: &Listing) -> String {
    match listing.category.as_str() {
        "Awesome Repo" => format!(
            r#"You are an open-source maintainer preparing a pull request submission for an Awesome list.
Target Repository: {}
URL: {}
Category: {}

Goal:
Write a perfectly tailored submission entry and GitHub Pull Request description to add Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril) to this list.

Tendril Core Pitch:
Autonomous multi-agent software factory. Plans tasks, executes agents in isolated Git worktrees, and runs automated verification gates to output tested pull requests.

Provide:
1. Exact Markdown list entry: `- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - <concise description>` matching this repository's formatting guidelines.
2. Complete GitHub Pull Request title: `Add Ivy-Tendril to <Section>` and PR body with justification.
3. Alphabetical ordering compliance checklist and link format verification.
"#,
            listing.name, listing.url, listing.category
        ),
        "Dev Directory" => format!(
            r#"You are a developer relations specialist preparing a product directory submission.
Target Directory: {}
URL: {}
Category: {}

Goal:
Write a comprehensive developer directory profile for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).

Tendril Core Pitch:
Open-source multi-agent software factory and coding platform.

Provide:
1. Product profile and punchy taglines.
2. Direct 'Alternative To' comparisons against Cursor, Devin, Cline, and CodeRabbit highlighting Tendril's open-source architecture.
3. Key capabilities breakdown: Git worktree isolation, SWE-bench verification gates, autonomous issue-to-PR workflows.
4. Website and GitHub repository links with category tags.
"#,
            listing.name, listing.url, listing.category
        ),
        "Software Factory" => format!(
            r#"You are a systems architect preparing an ecosystem integration listing.
Target Registry / Platform: {}
URL: {}
Category: {}

Goal:
Position Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril) in the software factory and coding agent registry.

Provide:
1. Technical architecture overview highlighting multi-agent orchestration across Claude Code, Gemini, and local LLMs.
2. Deep dive into automated verification test gates and Git worktree sandboxing.
3. Autonomous issue-to-PR pipeline specifications and integration hooks.
"#,
            listing.name, listing.url, listing.category
        ),
        "Package Manager" => format!(
            r#"You are a software release engineer preparing package distribution manifests.
Target Package Manager: {}
URL: {}
Category: {}

Goal:
Create package manager installation instructions and manifest blurbs for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).

Provide:
1. Command-line installation snippets (e.g., brew, scoop, winget, cargo, npm, aur).
2. Package description, license (MIT/Apache), and homepage URLs.
3. Quickstart CLI verification instructions (`tendril --version`, `tendril doctor`).
"#,
            listing.name, listing.url, listing.category
        ),
        "Community" => format!(
            r#"You are a community advocate preparing a developer showcase post.
Target Community: {}
URL: {}
Category: {}

Goal:
Draft a compelling community announcement and tool showcase for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).

Provide:
1. Engaging post title (e.g. Show HN or Show LocalLLaMA) and community announcement blurb.
2. Narrative detailing how Tendril solves agent workspace collisions and hallucination using Git worktrees.
3. Interactive invitation for contributors, testers, and feedback.
"#,
            listing.name, listing.url, listing.category
        ),
        _ => format!(
            r#"You are an open-source maintainer preparing a submission entry.
Target: {}
URL: {}
Category: {}

Goal:
Write a submission entry and description for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).
"#,
            listing.name, listing.url, listing.category
        ),
    }
}

pub fn check_backlink_content(content: &str) -> bool {
    let lower = content.to_lowercase();
    lower.contains("ivy-tendril")
        || lower.contains("tendril")
        || content.contains("github.com/Ivy-Interactive/Ivy-Tendril")
        || content.contains("Ivy-Tendril")
}

pub async fn list_listings(State(ctx): State<Arc<AppContext>>) -> Json<Vec<Listing>> {
    let state = ctx.state.read().await;
    Json(state.listings.clone())
}

pub async fn create_listing(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<CreateListingRequest>,
) -> (StatusCode, Json<Listing>) {
    let mut state = ctx.state.write().await;
    let new_listing = Listing {
        id: format!("list-{}", Uuid::new_v4().simple()),
        name: payload.name,
        category: payload.category,
        url: payload.url,
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: payload.submission_blurb,
        notes: payload.notes,
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
) -> (StatusCode, Json<Option<Listing>>) {
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
) -> (StatusCode, Json<ListingActionResponse>) {
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
    let prompt = build_tailored_prompt(&listing);

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

pub async fn generate_batch_listings(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateBatchRequest>,
) -> (StatusCode, Json<GenerateBatchResponse>) {
    let state = ctx.state.read().await;
    let mut targets: Vec<Listing> = state
        .listings
        .iter()
        .filter(|l| {
            if let Some(ref ids) = payload.listing_ids {
                if !ids.is_empty() && !ids.contains(&l.id) {
                    return false;
                }
            }
            if let Some(ref cat) = payload.category {
                if cat != "all" && !cat.is_empty() && &l.category != cat {
                    return false;
                }
            }
            true
        })
        .cloned()
        .collect();

    if let Some(limit) = payload.limit {
        targets.truncate(limit);
    }

    drop(state);

    let targeted_count = targets.len();
    let mut task_ids = Vec::new();

    for listing in targets {
        let task_id = format!("task-list-{}", Uuid::new_v4().simple());
        task_ids.push(task_id.clone());

        let prompt = build_tailored_prompt(&listing);
        let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
        let runner = ctx.task_manager.runner().clone();
        let state_arc = ctx.state.clone();
        let data_file = ctx.data_file.clone();
        let list_id = listing.id.clone();

        tokio::spawn(async move {
            match runner.execute(&prompt, tx.clone()).await {
                Ok(content) => {
                    let mut state = state_arc.write().await;
                    if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id) {
                        l.submission_blurb = content;
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
    }

    (
        StatusCode::ACCEPTED,
        Json(GenerateBatchResponse {
            task_ids,
            targeted_count,
            message: format!("Started batch generation for {} listings", targeted_count),
        }),
    )
}

pub async fn verify_backlink(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<VerifyBacklinkResponse>) {

    let state = ctx.state.read().await;
    let listing = match state.listings.iter().find(|l| l.id == id) {
        Some(l) => l.clone(),
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(VerifyBacklinkResponse {
                    id,
                    url: String::new(),
                    verified: false,
                    status: "NotFound".to_string(),
                    message: "Listing target not found".to_string(),
                }),
            )
        }
    };
    drop(state);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .build()
        .unwrap_or_default();

    let (verified, message) = match client.get(&listing.url).send().await {
        Ok(resp) => match resp.text().await {
            Ok(body) => {
                if check_backlink_content(&body) {
                    (true, "Backlink verified! Status updated to Live.".to_string())
                } else {
                    (
                        false,
                        "Target page accessible, but no backlink or mention of Ivy-Tendril was found.".to_string(),
                    )
                }
            }
            Err(e) => (false, format!("Failed to read response body: {}", e)),
        },
        Err(e) => (false, format!("Failed to connect to target URL: {}", e)),
    };

    let mut state = ctx.state.write().await;
    let current_status = if let Some(l) = state.listings.iter_mut().find(|l| l.id == id) {
        if verified {
            l.status = "Live".to_string();
            l.updated_at = Utc::now();
        }
        l.status.clone()
    } else {
        listing.status.clone()
    };
    let _ = state.save(&ctx.data_file);

    (
        StatusCode::OK,
        Json(VerifyBacklinkResponse {
            id,
            url: listing.url,
            verified,
            status: current_status,
            message,
        }),
    )
}


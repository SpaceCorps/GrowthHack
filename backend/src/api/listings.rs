use crate::api::issues::AppContext;
pub use crate::api::packages::extract_pr_url;
use crate::api::submission::{
    extract_github_repo, insert_listing_entry, parse_github_pr_url, GitHubClient,
    SubmitBatchRequest,
};
use crate::db::Listing;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
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

#[derive(Deserialize)]
pub struct GenerateBatchRequest {
    pub listing_ids: Option<Vec<String>>,
    pub category: Option<String>,
    pub limit: Option<usize>,
}

#[derive(Deserialize)]
pub struct BatchSubmitPrRequest {
    pub listing_ids: Option<Vec<String>>,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncPrStatusSummary {
    pub checked_count: usize,
    pub merged_count: usize,
    pub transitioned_ids: Vec<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListingPrCheckResponse {
    pub id: String,
    pub pr_url: Option<String>,
    pub state: String,
    pub merged: bool,
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

pub fn build_pr_submission_prompt(listing: &Listing) -> String {
    format!(
        r#"You are an automated open-source contributor preparing and submitting a pull request for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).
Target Repository: {}
URL: {}
Category: {}

Approved Submission Blurb:
{}

Goal:
Execute automated PR generation and submission for this target:
1. Determine git branch name (e.g. `add-ivy-tendril`) and commit message.
2. Determine target file path (e.g. README.md) and exact insertion position (alphabetical ordering).
3. Format the complete GitHub Pull Request title and body with checklist.
4. Generate and output the GitHub CLI submission command: `gh pr create --repo <owner/repo> --title "<title>" --body "<body>"`.
5. IMPORTANT: Once the Pull Request is created or output, output the final PR URL on a single line starting with:
[PR_URL] <pr_url>
"#,
        listing.name,
        listing.url,
        listing.category,
        if listing.submission_blurb.trim().is_empty() {
            "No custom blurb provided. Use standard Ivy-Tendril submission entry."
        } else {
            &listing.submission_blurb
        }
    )
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
            if blurb != listing.submission_blurb && payload.blurb_status.is_none() {
                listing.blurb_status = if !blurb.trim().is_empty() {
                    Some("Pending".to_string())
                } else {
                    None
                };
            }
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

    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let list_id_clone = id.clone();

    ctx.task_manager
        .spawn_task_with_callback(&task_id, prompt, move |content, tx| async move {
            let mut state = state_arc.write().await;
            if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id_clone) {
                l.submission_blurb = content;
                l.blurb_status = Some("Pending".to_string());
                l.updated_at = Utc::now();
            }
            let _ = state.save(&data_file);
            let _ =
                tx.send("[SYSTEM] Custom submission entry generated and saved!".to_string());
        })
        .await;

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
        let state_arc = ctx.state.clone();
        let data_file = ctx.data_file.clone();
        let list_id = listing.id.clone();

        ctx.task_manager
            .spawn_task_with_callback(&task_id, prompt, move |content, tx| async move {
                let mut state = state_arc.write().await;
                if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id) {
                    l.submission_blurb = content;
                    l.updated_at = Utc::now();
                }
                let _ = state.save(&data_file);
                let _ = tx
                    .send("[SYSTEM] Custom submission entry generated and saved!".to_string());
            })
            .await;
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
                    (
                        true,
                        "Backlink verified! Status updated to Live.".to_string(),
                    )
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

pub async fn submit_upstream(
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
            );
        }
    };
    drop(state);

    if extract_github_repo(&listing.url).is_none() {
        return (
            StatusCode::BAD_REQUEST,
            Json(ListingActionResponse {
                task_id: String::new(),
                message: "Listing URL is not a valid GitHub repository".to_string(),
            }),
        );
    }

    let token = match ctx.get_github_token() {
        Some(t) if !t.trim().is_empty() => t,
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ListingActionResponse {
                    task_id: String::new(),
                    message: "GitHub token is not configured. Please set GITHUB_TOKEN or configure in Settings.".to_string(),
                }),
            );
        }
    };

    let task_id = format!("task-upstream-{}", Uuid::new_v4().simple());
    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let list_id = listing.id.clone();
    let listing_name = listing.name.clone();

    tokio::spawn(async move {
        let _ = tx.send(format!(
            "[START] Automated upstream submission worker initialized for listing '{}'",
            listing.name
        ));

        // 1. Authenticating GitHub user token
        let _ = tx.send("[STEP 1/6] Authenticating GitHub user token...".to_string());
        let client = match GitHubClient::new(&token) {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Failed to initialize GitHub client: {}", e));
                return;
            }
        };

        let _user = match client.get_authenticated_user().await {
            Ok(u) => {
                let _ = tx.send(format!("[INFO] Authenticated as GitHub user @{}", u.login));
                u
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] GitHub authentication failed: {}", e));
                return;
            }
        };

        // 2. Verifying upstream repository and retrieving default branch
        let _ = tx.send(
            "[STEP 2/6] Verifying upstream repository and retrieving default branch...".to_string(),
        );
        let (owner, repo) = match extract_github_repo(&listing.url) {
            Some(pair) => pair,
            None => {
                let _ = tx.send(format!("[ERROR] Invalid repository URL: {}", listing.url));
                return;
            }
        };

        let repo_info = match client.get_repo_info(&owner, &repo).await {
            Ok(info) => {
                let _ = tx.send(format!(
                    "[INFO] Target repository {}/{} verified. Default branch: '{}'",
                    owner, repo, info.default_branch
                ));
                info
            }
            Err(e) => {
                let _ = tx.send(format!(
                    "[ERROR] Failed to fetch upstream repository info: {}",
                    e
                ));
                return;
            }
        };

        // 3. Creating or verifying fork repository
        let _ = tx.send("[STEP 3/6] Creating or verifying fork repository...".to_string());
        let fork_user = match client.ensure_fork(&owner, &repo).await {
            Ok(u) => {
                let _ = tx.send(format!("[INFO] Fork verified under user @{}", u));
                u
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Fork creation failed: {}", e));
                return;
            }
        };

        // 4. Creating dedicated feature branch
        let branch_name = format!("add-ivy-tendril-{}", list_id);
        let _ = tx.send(format!(
            "[STEP 4/6] Creating dedicated feature branch '{}'...",
            branch_name
        ));
        let base_sha = match client
            .get_branch_sha(&owner, &repo, &repo_info.default_branch)
            .await
        {
            Ok(sha) => sha,
            Err(e) => {
                let _ = tx.send(format!(
                    "[ERROR] Failed to fetch base branch commit SHA: {}",
                    e
                ));
                return;
            }
        };

        if let Err(e) = client
            .create_branch(&fork_user, &repo, &branch_name, &base_sha)
            .await
        {
            let _ = tx.send(format!("[ERROR] Failed to create branch: {}", e));
            return;
        }
        let _ = tx.send(format!(
            "[INFO] Branch '{}' created from SHA {}",
            branch_name,
            &base_sha[..7.min(base_sha.len())]
        ));

        // 5. Fetching target README.md, inserting entry, and committing change
        let _ = tx.send("[STEP 5/6] Fetching target README.md and inserting entry...".to_string());
        let (readme_content, blob_sha) = match client
            .get_file_content(&owner, &repo, "README.md", &repo_info.default_branch)
            .await
        {
            Ok(res) => res,
            Err(e) => {
                let _ = tx.send(format!(
                    "[ERROR] Failed to fetch README.md from upstream: {}",
                    e
                ));
                return;
            }
        };

        let entry = if !listing.submission_blurb.trim().is_empty() {
            let lines: Vec<&str> = listing.submission_blurb.lines().collect();
            if let Some(l) = lines.iter().find(|l| l.trim().starts_with("- [")) {
                l.trim().to_string()
            } else {
                listing.submission_blurb.trim().to_string()
            }
        } else {
            "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory with isolated Git worktrees and verification gates.".to_string()
        };

        let updated_readme = insert_listing_entry(&readme_content, &entry, &listing.category);
        let commit_message = format!("Add Ivy-Tendril to {}", listing.name);

        if let Err(e) = client
            .update_file(
                &fork_user,
                &repo,
                "README.md",
                &branch_name,
                &commit_message,
                &updated_readme,
                &blob_sha,
            )
            .await
        {
            let _ = tx.send(format!("[ERROR] Failed to commit README.md changes: {}", e));
            return;
        }
        let _ = tx.send("[INFO] README.md entry committed successfully".to_string());

        // 6. Opening upstream pull request
        let _ = tx.send("[STEP 6/6] Opening upstream pull request...".to_string());
        let head_ref = if fork_user.eq_ignore_ascii_case(&owner) {
            branch_name.clone()
        } else {
            format!("{}:{}", fork_user, branch_name)
        };

        let pr_title = format!("Add Ivy-Tendril to {}", listing.name);
        let pr_body = format!(
            "## Add Ivy-Tendril to {}\n\n### Description\n[Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) is an open-source autonomous multi-agent software factory that plans tasks, runs agents in isolated Git worktrees, and executes verification gates.\n\n### Entry\n{}\n\n### Checklist\n- [x] Item placed in alphabetical order\n- [x] Verified link to repository and documentation\n- [x] Adheres to repository contribution guidelines\n",
            listing.name, entry
        );

        match client
            .create_pull_request(
                &owner,
                &repo,
                &head_ref,
                &repo_info.default_branch,
                &pr_title,
                &pr_body,
                false,
            )
            .await
        {
            Ok(pr) => {
                let _ = tx.send(format!(
                    "[SUCCESS] Upstream Pull Request opened successfully: {}",
                    pr.html_url
                ));
                let mut state = state_arc.write().await;
                if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id) {
                    l.status = "PR Submitted".to_string();
                    l.pr_url = Some(pr.html_url);
                    l.updated_at = Utc::now();
                }
                let _ = state.save(&data_file);
            }
            Err(e) => {
                let _ = tx.send(format!(
                    "[ERROR] Failed to create upstream pull request: {}",
                    e
                ));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(ListingActionResponse {
            task_id,
            message: format!(
                "Automated upstream PR submission worker started for '{}'",
                listing_name
            ),
        }),
    )
}

pub async fn submit_listing_pr(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<ListingActionResponse>) {
    let mut state = ctx.state.write().await;
    let listing = match state.listings.iter_mut().find(|l| l.id == id) {
        Some(l) => {
            if l.status == "Targeted" {
                l.status = "PR Submitted".to_string();
            }
            l.updated_at = Utc::now();
            l.clone()
        }
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ListingActionResponse {
                    task_id: String::new(),
                    message: "Listing target not found".to_string(),
                }),
            );
        }
    };
    let _ = state.save(&ctx.data_file);
    drop(state);

    let task_id = format!("task-pr-{}", Uuid::new_v4().simple());
    let prompt = build_pr_submission_prompt(&listing);

    let list_id_clone = listing.id.clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();

    ctx.task_manager
        .spawn_task_with_callback(&task_id, prompt, move |content, tx| async move {
            if let Some(pr_url) = extract_pr_url(&content) {
                let mut state = state_arc.write().await;
                if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id_clone) {
                    l.pr_url = Some(pr_url.clone());
                    l.status = "PR Submitted".to_string();
                    l.updated_at = Utc::now();
                }
                let _ = state.save(&data_file);
                let _ = tx.send(format!("[SYSTEM] Upstream PR registered: {}", pr_url));
            }
            let _ = tx.send("[SYSTEM] Automated PR generation completed!".to_string());
        })
        .await;

    (
        StatusCode::ACCEPTED,
        Json(ListingActionResponse {
            task_id,
            message: format!(
                "PR submission and automated generation initiated for {}",
                listing.name
            ),
        }),
    )
}

pub async fn submit_batch(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<SubmitBatchRequest>,
) -> (StatusCode, Json<GenerateBatchResponse>) {
    let state = ctx.state.read().await;
    let mut targets: Vec<Listing> = state
        .listings
        .iter()
        .filter(|l| {
            if extract_github_repo(&l.url).is_none() {
                return false;
            }
            if l.status == "PR Submitted" || l.status == "Merged" || l.status == "Live" {
                return false;
            }
            if let Some(ref ids) = payload.listing_ids {
                if !ids.is_empty() && !ids.contains(&l.id) {
                    return false;
                }
            }
            if let Some(ref cat) = payload.category {
                if cat != "All" && cat != "all" && !cat.is_empty() && &l.category != cat {
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

    let token = ctx.get_github_token();

    for (i, listing) in targets.into_iter().enumerate() {
        let task_id = format!("task-upstream-{}", Uuid::new_v4().simple());
        task_ids.push(task_id.clone());

        let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
        let state_arc = ctx.state.clone();
        let data_file = ctx.data_file.clone();
        let list_id = listing.id.clone();
        let token_opt = token.clone();

        tokio::spawn(async move {
            // Pacing: 2-second delay between sequential submission tasks
            if i > 0 {
                tokio::time::sleep(Duration::from_secs(2 * (i as u64))).await;
            }

            let token = match token_opt {
                Some(t) if !t.trim().is_empty() => t,
                _ => {
                    let _ = tx.send(
                        "[ERROR] GitHub token not configured. Aborting submission.".to_string(),
                    );
                    return;
                }
            };

            let client = match GitHubClient::new(&token) {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] Client initialization failed: {}", e));
                    return;
                }
            };

            let _user = match client.get_authenticated_user().await {
                Ok(u) => u,
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] Authentication failed: {}", e));
                    return;
                }
            };

            let (owner, repo) = match extract_github_repo(&listing.url) {
                Some(p) => p,
                None => {
                    let _ = tx.send(format!("[ERROR] Invalid repo URL: {}", listing.url));
                    return;
                }
            };

            let repo_info = match client.get_repo_info(&owner, &repo).await {
                Ok(info) => info,
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] Target repo info failed: {}", e));
                    return;
                }
            };

            let fork_user = match client.ensure_fork(&owner, &repo).await {
                Ok(u) => u,
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] Fork failed: {}", e));
                    return;
                }
            };

            let branch_name = format!("add-ivy-tendril-{}", list_id);
            let base_sha = match client
                .get_branch_sha(&owner, &repo, &repo_info.default_branch)
                .await
            {
                Ok(sha) => sha,
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] Base SHA lookup failed: {}", e));
                    return;
                }
            };

            if let Err(e) = client
                .create_branch(&fork_user, &repo, &branch_name, &base_sha)
                .await
            {
                let _ = tx.send(format!("[ERROR] Branch creation failed: {}", e));
                return;
            }

            let (readme_content, blob_sha) = match client
                .get_file_content(&owner, &repo, "README.md", &repo_info.default_branch)
                .await
            {
                Ok(c) => c,
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] README fetch failed: {}", e));
                    return;
                }
            };

            let entry = if !listing.submission_blurb.trim().is_empty() {
                let lines: Vec<&str> = listing.submission_blurb.lines().collect();
                if let Some(l) = lines.iter().find(|l| l.trim().starts_with("- [")) {
                    l.trim().to_string()
                } else {
                    listing.submission_blurb.trim().to_string()
                }
            } else {
                "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory with isolated Git worktrees and verification gates.".to_string()
            };

            let updated_readme = insert_listing_entry(&readme_content, &entry, &listing.category);
            let commit_message = format!("Add Ivy-Tendril to {}", listing.name);

            if let Err(e) = client
                .update_file(
                    &fork_user,
                    &repo,
                    "README.md",
                    &branch_name,
                    &commit_message,
                    &updated_readme,
                    &blob_sha,
                )
                .await
            {
                let _ = tx.send(format!("[ERROR] File update failed: {}", e));
                return;
            }

            let head_ref = if fork_user.eq_ignore_ascii_case(&owner) {
                branch_name.clone()
            } else {
                format!("{}:{}", fork_user, branch_name)
            };

            let pr_title = format!("Add Ivy-Tendril to {}", listing.name);
            let pr_body = format!(
                "## Add Ivy-Tendril to {}\n\n### Description\n[Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) is an open-source autonomous multi-agent software factory.\n\n### Entry\n{}\n",
                listing.name, entry
            );

            match client
                .create_pull_request(
                    &owner,
                    &repo,
                    &head_ref,
                    &repo_info.default_branch,
                    &pr_title,
                    &pr_body,
                    false,
                )
                .await
            {
                Ok(pr) => {
                    let _ = tx.send(format!("[SUCCESS] Upstream PR opened: {}", pr.html_url));
                    let mut state = state_arc.write().await;
                    if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id) {
                        l.status = "PR Submitted".to_string();
                        l.pr_url = Some(pr.html_url);
                        l.updated_at = Utc::now();
                    }
                    let _ = state.save(&data_file);
                }
                Err(e) => {
                    let _ = tx.send(format!("[ERROR] Pull request creation failed: {}", e));
                }
            }
        });
    }

    (
        StatusCode::ACCEPTED,
        Json(GenerateBatchResponse {
            task_ids,
            targeted_count,
            message: format!(
                "Started batch upstream submission for {} listings",
                targeted_count
            ),
        }),
    )
}

pub async fn batch_submit_listing_prs(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<BatchSubmitPrRequest>,
) -> (StatusCode, Json<GenerateBatchResponse>) {
    let mut state = ctx.state.write().await;
    let mut targets: Vec<Listing> = Vec::new();

    for l in state.listings.iter_mut() {
        let is_match = match &payload.listing_ids {
            Some(ids) => ids.is_empty() || ids.contains(&l.id),
            None => true,
        };
        if is_match && l.status == "Targeted" {
            l.status = "PR Submitted".to_string();
            l.updated_at = Utc::now();
            targets.push(l.clone());
        }
    }
    let _ = state.save(&ctx.data_file);
    drop(state);

    let targeted_count = targets.len();
    let mut task_ids = Vec::new();

    for listing in targets {
        let task_id = format!("task-pr-{}", Uuid::new_v4().simple());
        task_ids.push(task_id.clone());

        let prompt = build_pr_submission_prompt(&listing);
        let list_id_clone = listing.id.clone();
        let state_arc = ctx.state.clone();
        let data_file = ctx.data_file.clone();

        ctx.task_manager
            .spawn_task_with_callback(&task_id, prompt, move |content, tx| async move {
                if let Some(pr_url) = extract_pr_url(&content) {
                    let mut state = state_arc.write().await;
                    if let Some(l) = state.listings.iter_mut().find(|l| l.id == list_id_clone) {
                        l.pr_url = Some(pr_url.clone());
                        l.status = "PR Submitted".to_string();
                        l.updated_at = Utc::now();
                    }
                    let _ = state.save(&data_file);
                    let _ = tx.send(format!("[SYSTEM] Upstream PR registered: {}", pr_url));
                }
                let _ = tx.send("[SYSTEM] Automated PR generation completed!".to_string());
            })
            .await;
    }

    (
        StatusCode::ACCEPTED,
        Json(GenerateBatchResponse {
            task_ids,
            targeted_count,
            message: format!("Started PR submission for {} listings", targeted_count),
        }),
    )
}

pub async fn sync_listing_pr_statuses_internal(
    ctx: &Arc<AppContext>,
) -> Result<SyncPrStatusSummary, String> {
    let candidates: Vec<(String, String)> = {
        let state = ctx.state.read().await;
        state
            .listings
            .iter()
            .filter(|l| {
                (l.status == "PR Submitted" || l.status == "Under Review") && l.pr_url.is_some()
            })
            .map(|l| (l.id.clone(), l.pr_url.clone().unwrap()))
            .collect()
    };

    if candidates.is_empty() {
        return Ok(SyncPrStatusSummary {
            checked_count: 0,
            merged_count: 0,
            transitioned_ids: Vec::new(),
            message: "No submitted or under-review listings with PR URLs found.".to_string(),
        });
    }

    let token = ctx.get_github_token();
    let client = match match token {
        Some(t) if !t.trim().is_empty() => GitHubClient::new(&t),
        _ => GitHubClient::new_unauthenticated(),
    } {
        Ok(c) => c,
        Err(e) => return Err(format!("Failed to create GitHub client: {}", e)),
    };

    let mut checked_count = 0;
    let mut merged_count = 0;
    let mut transitioned_ids = Vec::new();

    for (id, pr_url) in candidates {
        if let Some((owner, repo, number)) = parse_github_pr_url(&pr_url) {
            checked_count += 1;
            match client.get_pull_request(&owner, &repo, number).await {
                Ok(details) => {
                    let is_merged = details.merged || details.merged_at.is_some();
                    if is_merged {
                        transitioned_ids.push(id);
                        merged_count += 1;
                    }
                }
                Err(err) => {
                    tracing::warn!(
                        "Failed to query PR status for listing {} ({}): {}",
                        id,
                        pr_url,
                        err
                    );
                }
            }
        }
    }

    if !transitioned_ids.is_empty() {
        let mut state = ctx.state.write().await;
        for l in state.listings.iter_mut() {
            if transitioned_ids.contains(&l.id) {
                l.status = "Live".to_string();
                l.updated_at = Utc::now();
            }
        }
        let _ = state.save(&ctx.data_file);
    }

    Ok(SyncPrStatusSummary {
        checked_count,
        merged_count,
        transitioned_ids,
        message: format!(
            "Checked {} listings: {} merged PRs transitioned to Live",
            checked_count, merged_count
        ),
    })
}

pub async fn sync_all_listing_prs(
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<SyncPrStatusSummary>) {
    match sync_listing_pr_statuses_internal(&ctx).await {
        Ok(summary) => (StatusCode::OK, Json(summary)),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SyncPrStatusSummary {
                checked_count: 0,
                merged_count: 0,
                transitioned_ids: Vec::new(),
                message: format!("Failed to sync PR statuses: {}", e),
            }),
        ),
    }
}

pub async fn check_single_listing_pr(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<ListingPrCheckResponse>) {
    let listing_opt = {
        let state = ctx.state.read().await;
        state.listings.iter().find(|l| l.id == id).cloned()
    };

    let listing = match listing_opt {
        Some(l) => l,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(ListingPrCheckResponse {
                    id,
                    pr_url: None,
                    state: "not_found".to_string(),
                    merged: false,
                    status: "unknown".to_string(),
                    message: "Listing not found".to_string(),
                }),
            );
        }
    };

    let pr_url = match &listing.pr_url {
        Some(url) if !url.trim().is_empty() => url.clone(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ListingPrCheckResponse {
                    id: listing.id,
                    pr_url: None,
                    state: "none".to_string(),
                    merged: false,
                    status: listing.status,
                    message: "Listing has no PR URL registered".to_string(),
                }),
            );
        }
    };

    let (owner, repo, number) = match parse_github_pr_url(&pr_url) {
        Some(parsed) => parsed,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ListingPrCheckResponse {
                    id: listing.id,
                    pr_url: Some(pr_url),
                    state: "invalid_url".to_string(),
                    merged: false,
                    status: listing.status,
                    message: "Could not parse GitHub PR URL".to_string(),
                }),
            );
        }
    };

    let token = ctx.get_github_token();
    let client = match match token {
        Some(t) if !t.trim().is_empty() => GitHubClient::new(&t),
        _ => GitHubClient::new_unauthenticated(),
    } {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ListingPrCheckResponse {
                    id: listing.id,
                    pr_url: Some(pr_url),
                    state: "error".to_string(),
                    merged: false,
                    status: listing.status,
                    message: format!("Failed to create GitHub client: {}", e),
                }),
            );
        }
    };

    match client.get_pull_request(&owner, &repo, number).await {
        Ok(details) => {
            let is_merged = details.merged || details.merged_at.is_some();
            if is_merged {
                let mut state = ctx.state.write().await;
                if let Some(l) = state.listings.iter_mut().find(|l| l.id == id) {
                    l.status = "Live".to_string();
                    l.updated_at = Utc::now();
                }
                let _ = state.save(&ctx.data_file);

                (
                    StatusCode::OK,
                    Json(ListingPrCheckResponse {
                        id,
                        pr_url: Some(pr_url),
                        state: details.state,
                        merged: true,
                        status: "Live".to_string(),
                        message: "Pull request merged! Listing transitioned to Live.".to_string(),
                    }),
                )
            } else {
                (
                    StatusCode::OK,
                    Json(ListingPrCheckResponse {
                        id,
                        pr_url: Some(pr_url),
                        state: details.state.clone(),
                        merged: false,
                        status: listing.status.clone(),
                        message: format!(
                            "PR state is '{}'. Listing remains in '{}'.",
                            details.state, listing.status
                        ),
                    }),
                )
            }
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            Json(ListingPrCheckResponse {
                id,
                pr_url: Some(pr_url),
                state: "error".to_string(),
                merged: false,
                status: listing.status,
                message: format!("GitHub API query failed: {}", e),
            }),
        ),
    }
}

pub async fn handle_github_pr_webhook(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<serde_json::Value>,
) -> (StatusCode, Json<serde_json::Value>) {
    let action = payload.get("action").and_then(|a| a.as_str()).unwrap_or("");
    let pr_val = payload.get("pull_request");
    let is_merged = pr_val
        .and_then(|pr| pr.get("merged").and_then(|m| m.as_bool()))
        .unwrap_or(false)
        || pr_val
            .and_then(|pr| pr.get("merged_at").and_then(|m| m.as_str()))
            .is_some();

    let pr_html_url = pr_val
        .and_then(|pr| pr.get("html_url").and_then(|u| u.as_str()))
        .unwrap_or("");

    if !is_merged || pr_html_url.is_empty() {
        return (
            StatusCode::OK,
            Json(serde_json::json!({
                "received": true,
                "action": action,
                "merged": is_merged,
                "message": "Webhook received; no merged PR action to process"
            })),
        );
    }

    let parsed_target = parse_github_pr_url(pr_html_url);
    let mut transitioned_id: Option<String> = None;

    {
        let mut state = ctx.state.write().await;
        for l in state.listings.iter_mut() {
            let matches = if let Some(ref l_url) = l.pr_url {
                if l_url == pr_html_url {
                    true
                } else if let (Some(ref target), Some(existing)) = (&parsed_target, parse_github_pr_url(l_url)) {
                    target == &existing
                } else {
                    false
                }
            } else {
                false
            };

            if matches {
                l.status = "Live".to_string();
                l.updated_at = Utc::now();
                transitioned_id = Some(l.id.clone());
                break;
            }
        }
        if transitioned_id.is_some() {
            let _ = state.save(&ctx.data_file);
        }
    }

    if let Some(id) = transitioned_id {
        (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "listing_id": id,
                "pr_url": pr_html_url,
                "status": "Live",
                "message": "Listing successfully transitioned to Live via GitHub webhook."
            })),
        )
    } else {
        (
            StatusCode::OK,
            Json(serde_json::json!({
                "received": true,
                "pr_url": pr_html_url,
                "message": "Merged PR received, but no matching listing was found."
            })),
        )
    }
}

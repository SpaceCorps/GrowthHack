use crate::api::issues::AppContext;
use crate::api::submission::GitHubClient;
use crate::db::{AllContributorsConfig, AllContributorsEntry, ContributorIssue, ContributorRecord};
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Debug, Deserialize, Default)]
pub struct ContributorIssuesQuery {
    pub category: Option<String>,
    pub difficulty: Option<String>,
    pub claimed: Option<bool>,
    pub max_time: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct ClaimIssueRequest {
    pub contributor_name: String,
    pub github_handle: Option<String>,
    #[serde(default)]
    pub github_issue_number: Option<u64>,
    #[serde(default)]
    pub auto_sync_github: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct LinkGitHubIssueRequest {
    pub github_issue_number: Option<u64>,
    pub github_repo: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ContributingGuideResponse {
    pub content: String,
    pub filename: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AllContributorsResponse {
    pub contributors: Vec<ContributorRecord>,
    pub markdown_table: String,
    pub html_grid: String,
    pub badge_markdown: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct VerifyContributorRequest {
    pub issue_id: Option<String>,
    pub contributor_name: String,
    pub github_handle: String,
    pub contributions: Vec<String>,
    pub auto_generate_pr: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VerifyContributorResponse {
    pub success: bool,
    pub contributor: ContributorRecord,
    pub issue: Option<ContributorIssue>,
    pub pr: Option<GenerateAllContributorsPrResponse>,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AllContributorsRcResponse {
    pub content: String,
    pub config: AllContributorsConfig,
    pub contributor_count: usize,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct GenerateAllContributorsPrRequest {
    pub github_handle: String,
    pub contributor_name: String,
    pub contributions: Vec<String>,
    pub branch_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GenerateAllContributorsPrResponse {
    pub branch_name: String,
    pub pr_title: String,
    pub pr_body: String,
    pub file_path: String,
    pub file_content: String,
    pub cli_commands: Vec<String>,
    pub pr_url: Option<String>,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GitHubWebhookUser {
    pub login: String,
    #[serde(default)]
    pub id: Option<u64>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GitHubWebhookLabel {
    pub name: String,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GitHubWebhookIssue {
    pub number: u64,
    #[serde(default)]
    pub state: String,
    #[serde(default)]
    pub assignees: Vec<GitHubWebhookUser>,
    #[serde(default)]
    pub labels: Vec<GitHubWebhookLabel>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GitHubWebhookRepo {
    #[serde(default)]
    pub full_name: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GitHubWebhookPayload {
    #[serde(default)]
    pub action: String,
    #[serde(default)]
    pub issue: Option<GitHubWebhookIssue>,
    #[serde(default)]
    pub assignee: Option<GitHubWebhookUser>,
    #[serde(default)]
    pub repository: Option<GitHubWebhookRepo>,
    #[serde(default)]
    pub sender: Option<GitHubWebhookUser>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GitHubWebhookResponse {
    pub received: bool,
    pub action: String,
    pub matched_issue_id: Option<String>,
    pub message: String,
}

pub async fn list_contributor_issues(
    State(ctx): State<Arc<AppContext>>,
    Query(query): Query<ContributorIssuesQuery>,
) -> Json<Vec<ContributorIssue>> {
    let state = ctx.state.read().await;
    let mut filtered: Vec<ContributorIssue> = state.contributor_issues.clone();

    if let Some(category) = &query.category {
        let cat_lower = category.to_lowercase();
        filtered.retain(|item| item.category.to_lowercase() == cat_lower);
    }

    if let Some(diff) = &query.difficulty {
        let diff_lower = diff.to_lowercase();
        filtered.retain(|item| item.difficulty.to_lowercase() == diff_lower);
    }

    if let Some(claimed) = query.claimed {
        filtered.retain(|item| item.claimed == claimed);
    }

    if let Some(max_time) = query.max_time {
        filtered.retain(|item| item.estimated_minutes <= max_time);
    }

    Json(filtered)
}

pub async fn claim_contributor_issue(
    State(ctx): State<Arc<AppContext>>,
    Path(id): Path<String>,
    Json(payload): Json<ClaimIssueRequest>,
) -> Result<(StatusCode, Json<ContributorIssue>), (StatusCode, Json<ErrorResponse>)> {
    let mut state = ctx.state.write().await;

    let issue = state
        .contributor_issues
        .iter_mut()
        .find(|item| item.id == id);

    let issue = match issue {
        Some(i) => i,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Contributor issue with id '{}' not found", id),
                }),
            ));
        }
    };

    if issue.claimed {
        return Err((
            StatusCode::CONFLICT,
            Json(ErrorResponse {
                error: format!(
                    "Issue '{}' has already been claimed by {}",
                    id,
                    issue.claimed_by.as_deref().unwrap_or("another contributor")
                ),
            }),
        ));
    }

    let claimer = payload
        .github_handle
        .as_ref()
        .filter(|h| !h.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| payload.contributor_name.trim().to_string());

    issue.claimed = true;
    issue.claimed_by = Some(claimer.clone());
    issue.claimed_at = Some(Utc::now());

    let resolved_issue_number = payload.github_issue_number.or(issue.github_issue_number);
    if let Some(num) = payload.github_issue_number {
        issue.github_issue_number = Some(num);
    }

    if let Some(num) = resolved_issue_number {
        if payload.auto_sync_github != Some(false) {
            let raw_handle = payload
                .github_handle
                .as_deref()
                .filter(|h| !h.trim().is_empty())
                .unwrap_or(&claimer);
            let normalized_handle = raw_handle.trim().trim_start_matches('@').trim().to_string();

            let token = ctx.get_github_token();
            match token {
                None => {
                    issue.github_sync_status = Some("Skipped (No GitHub Token)".to_string());
                    issue.github_sync_message =
                        Some("GitHub token not configured; local claim recorded.".to_string());
                }
                Some(tok) if tok.trim().is_empty() => {
                    issue.github_sync_status = Some("Skipped (No GitHub Token)".to_string());
                    issue.github_sync_message =
                        Some("GitHub token not configured; local claim recorded.".to_string());
                }
                Some(tok) => {
                    let client_res = GitHubClient::new(&tok);
                    match client_res {
                        Err(e) => {
                            issue.github_sync_status = Some("Failed".to_string());
                            issue.github_sync_message =
                                Some(format!("Failed to initialize GitHub client: {}", e));
                        }
                        Ok(client) => {
                            let repo_target = issue
                                .github_repo
                                .as_deref()
                                .unwrap_or("SpaceCorps/GrowthHack");
                            let (owner, repo_name) = match repo_target.split_once('/') {
                                Some((o, r)) => (o.trim(), r.trim()),
                                None => ("SpaceCorps", "GrowthHack"),
                            };

                            let mut sync_errors = Vec::new();
                            let mut assigned_logins = Vec::new();

                            // 1. Add label 'claimed'
                            match client.add_issue_labels(owner, repo_name, num, &["claimed"]).await {
                                Ok(_) => {}
                                Err(e) => sync_errors.push(format!("Labeling failed: {}", e)),
                            }

                            // 2. Assign user if handle available
                            if !normalized_handle.is_empty() {
                                match client
                                    .add_issue_assignees(owner, repo_name, num, &[&normalized_handle])
                                    .await
                                {
                                    Ok(logins) => assigned_logins = logins,
                                    Err(e) => sync_errors.push(format!("Assignment failed: {}", e)),
                                }
                            }

                            // 3. Post notification comment
                            let comment_body = format!(
                                "Issue claimed by @{} via SpaceCorps GrowthHack Contributor Flywheel.",
                                normalized_handle
                            );
                            match client
                                .create_issue_comment(owner, repo_name, num, &comment_body)
                                .await
                            {
                                Ok(_) => {}
                                Err(e) => sync_errors.push(format!("Comment failed: {}", e)),
                            }

                            if sync_errors.is_empty() {
                                issue.github_sync_status = Some("Synced".to_string());
                                let msg = if !assigned_logins.is_empty() {
                                    format!(
                                        "Assigned to @{}; labeled 'claimed'",
                                        assigned_logins.join(", @")
                                    )
                                } else {
                                    "Labeled 'claimed'; comment posted".to_string()
                                };
                                issue.github_sync_message = Some(msg);
                            } else {
                                issue.github_sync_status = Some("Failed".to_string());
                                issue.github_sync_message = Some(sync_errors.join("; "));
                            }
                        }
                    }
                }
            }
        }
    }

    let updated_issue = issue.clone();
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::OK, Json(updated_issue)))
}

pub async fn link_github_issue(
    State(ctx): State<Arc<AppContext>>,
    Path(id): Path<String>,
    Json(payload): Json<LinkGitHubIssueRequest>,
) -> Result<(StatusCode, Json<ContributorIssue>), (StatusCode, Json<ErrorResponse>)> {
    let mut state = ctx.state.write().await;

    let issue = state
        .contributor_issues
        .iter_mut()
        .find(|item| item.id == id);

    let issue = match issue {
        Some(i) => i,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Contributor issue with id '{}' not found", id),
                }),
            ));
        }
    };

    if let Some(num) = payload.github_issue_number {
        issue.github_issue_number = Some(num);
    }
    if let Some(repo) = payload.github_repo {
        issue.github_repo = Some(repo);
    }

    let updated_issue = issue.clone();
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::OK, Json(updated_issue)))
}

pub async fn get_contributing_guide() -> Json<ContributingGuideResponse> {
    let guide = r#"# Contributing to SpaceCorps GrowthHack

Thank you for your interest in contributing to GrowthHack! GrowthHack is an engineering-grade growth hacking and community adoption engine designed for Ivy-Tendril.

This guide provides a streamlined path from `git clone` to passing verifications and merged pull requests in under 15 minutes.

---

## 1. Prerequisites

Ensure the following runtimes and toolchains are installed on your workstation:
- **Rust & Cargo**: 1.95+ (`rustc --version`)
- **Node.js**: 24+ (`node --version`)
- **Package Managers**: `pnpm` 10+ (`pnpm --version`) and Vite+ CLI `vp` (`vp --version`)

---

## 2. Fast-Track Setup (<5 Minutes)

```bash
# 1. Clone the repository
git clone https://github.com/SpaceCorps/GrowthHack.git
cd GrowthHack

# 2. Setup Frontend dependencies
cd frontend
vp install # or pnpm install
cd ..

# 3. Verify Backend compilation
cd backend
cargo check
cd ..
```

---

## 3. Local Verification Gates

Before submitting any code changes or opening a pull request, run the following verification commands locally:

### Backend Checks
```bash
cd backend
# 1. Static analysis and linter
cargo clippy -- -D warnings

# 2. Automated test suite
cargo test
```

### Frontend Checks
```bash
cd frontend
# 1. Code formatting check
vp fmt --check .

# 2. Linting
vp lint .

# 3. Unit and component tests
vp test
```

---

## 4. Good First Issues (15 to 30 Minutes)

We curate beginner-friendly tasks with explicit scope, mentor contacts, and reproduction steps:
- Browse available issues in the **Contributor Flywheel** tab of the GrowthHack web dashboard.
- Pick an unclaimed issue matching your stack interest (Frontend, Backend, CLI, Documentation, or Tests).
- Click **Claim Issue** to notify mentors and claim ownership.

---

## 5. Development Workflow & Pull Request Guidelines

1. **Branching**: Create a branch off `master`:
   ```bash
   git checkout -b fix/issue-short-title
   # or
   git checkout -b feat/issue-short-title
   ```
2. **Commit Style**: Write clear, descriptive commit messages without em dashes.
3. **Run Verifications**: Ensure all local tests and linter commands pass.
4. **Open Pull Request**: Include:
   - Reference to the claimed issue (`Fixes #14`, `Resolves cf-issue-X`).
   - Summary of changes and before/after behavior.
   - Verification checklist demonstrating green test results.
"#;

    Json(ContributingGuideResponse {
        content: guide.to_string(),
        filename: "CONTRIBUTING.md".to_string(),
    })
}

pub async fn get_all_contributors(
    State(ctx): State<Arc<AppContext>>,
) -> Json<AllContributorsResponse> {
    let state = ctx.state.read().await;
    let contributors = state.contributors.clone();

    let mut markdown_table = String::from("| Contributor | Role & Contributions | GitHub Profile |\n| :--- | :--- | :--- |\n");
    for c in &contributors {
        let contrib_tags = c.contributions.join(", ");
        markdown_table.push_str(&format!(
            "| **{}** | `{}` | [{}]({}) |\n",
            c.name, contrib_tags, c.name, c.profile_url
        ));
    }

    let mut html_grid = String::from("<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->\n<table>\n  <tbody>\n    <tr>\n");
    for c in &contributors {
        let contrib_list = c
            .contributions
            .iter()
            .map(|badge| format!("<code>{}</code>", badge))
            .collect::<Vec<String>>()
            .join(" ");

        html_grid.push_str(&format!(
            r#"      <td align="center" valign="top" width="20%">
        <a href="{}">
          <img src="{}" width="80px" style="border-radius:50%" alt="{}"/>
          <br />
          <sub><b>{}</b></sub>
        </a>
        <br />
        {}
      </td>
"#,
            c.profile_url, c.avatar_url, c.name, c.name, contrib_list
        ));
    }
    html_grid.push_str("    </tr>\n  </tbody>\n</table>\n<!-- ALL-CONTRIBUTORS-LIST:END -->\n");

    let badge_markdown = format!(
        "[![All Contributors](https://img.shields.io/badge/all_contributors-{}-orange.svg?style=flat-square)](#contributors)",
        contributors.len()
    );

    Json(AllContributorsResponse {
        contributors,
        markdown_table,
        html_grid,
        badge_markdown,
    })
}

pub fn build_all_contributors_pr_commands(
    handle: &str,
    _name: &str,
    contributions: &[String],
    branch: &str,
    content: &str,
) -> Vec<String> {
    let clean_handle = handle.trim().trim_start_matches('@');
    let contrib_str = contributions.join(", ");
    vec![
        format!("git checkout -b {}", branch),
        format!("cat << 'EOF' > .all-contributorsrc\n{}\nEOF", content),
        "git add .all-contributorsrc".to_string(),
        format!(
            "git commit -m \"docs: update .all-contributorsrc for @{} [skip ci]\"",
            clean_handle
        ),
        format!("git push origin {}", branch),
        format!(
            "gh pr create --title \"docs: update .all-contributorsrc for @{}\" --body \"Automated update to .all-contributorsrc recognizing @{} for contributions: {}.\"",
            clean_handle, clean_handle, contrib_str
        ),
    ]
}

pub async fn get_all_contributorsrc(
    State(ctx): State<Arc<AppContext>>,
) -> Json<AllContributorsRcResponse> {
    let state = ctx.state.read().await;
    let config = state.generate_all_contributorsrc();
    let content = serde_json::to_string_pretty(&config).unwrap_or_default();
    let contributor_count = config.contributors.len();

    Json(AllContributorsRcResponse {
        content,
        config,
        contributor_count,
    })
}

pub async fn generate_all_contributors_pr(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateAllContributorsPrRequest>,
) -> Result<Json<GenerateAllContributorsPrResponse>, (StatusCode, Json<ErrorResponse>)> {
    let clean_handle = payload.github_handle.trim().trim_start_matches('@').to_string();
    if clean_handle.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "GitHub handle is required".to_string(),
            }),
        ));
    }

    let branch_name = payload
        .branch_name
        .clone()
        .filter(|b| !b.trim().is_empty())
        .unwrap_or_else(|| format!("docs/all-contributors-{}", clean_handle));

    let mut config = {
        let state = ctx.state.read().await;
        state.generate_all_contributorsrc()
    };

    let mut found = false;
    for entry in &mut config.contributors {
        if entry.login.eq_ignore_ascii_case(&clean_handle) {
            found = true;
            for c in &payload.contributions {
                if !entry.contributions.contains(c) {
                    entry.contributions.push(c.clone());
                }
            }
            break;
        }
    }
    if !found {
        let contributions = if payload.contributions.is_empty() {
            vec!["code".to_string()]
        } else {
            payload.contributions.clone()
        };
        config.contributors.push(AllContributorsEntry {
            login: clean_handle.clone(),
            name: if payload.contributor_name.trim().is_empty() {
                clean_handle.clone()
            } else {
                payload.contributor_name.trim().to_string()
            },
            avatar_url: format!("https://avatars.githubusercontent.com/{}?v=4", clean_handle),
            profile: format!("https://github.com/{}", clean_handle),
            contributions,
        });
    }

    let file_content = match serde_json::to_string_pretty(&config) {
        Ok(c) => c,
        Err(e) => {
            return Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: format!("Failed to serialize .all-contributorsrc: {}", e),
                }),
            ));
        }
    };
    let file_path = ".all-contributorsrc".to_string();
    let pr_title = format!("docs: update .all-contributorsrc for @{}", clean_handle);
    let contrib_str = payload.contributions.join(", ");
    let pr_body = format!(
        "Automated update to .all-contributorsrc recognizing @{} for contributions: {}.",
        clean_handle, contrib_str
    );

    let cli_commands = build_all_contributors_pr_commands(
        &clean_handle,
        &payload.contributor_name,
        &payload.contributions,
        &branch_name,
        &file_content,
    );

    let mut pr_url = None;
    let mut status = "generated".to_string();

    if let Some(token) = ctx.get_github_token() {
        if !token.trim().is_empty() {
            if let Ok(gh) = GitHubClient::new(&token) {
                let owner = "SpaceCorps";
                let repo = "GrowthHack";
                let default_branch = "master";
                if let Ok(base_sha) = gh.get_branch_sha(owner, repo, default_branch).await {
                    let branch_ok = gh.create_branch(owner, repo, &branch_name, &base_sha).await.is_ok();
                    let file_ok = branch_ok && gh.create_or_update_file(
                        owner,
                        repo,
                        &file_path,
                        &branch_name,
                        &pr_title,
                        &file_content,
                    ).await.is_ok();
                    if file_ok {
                        if let Ok(pr_res) = gh
                            .create_pull_request(
                                owner,
                                repo,
                                &branch_name,
                                default_branch,
                                &pr_title,
                                &pr_body,
                                false,
                            )
                            .await
                        {
                            pr_url = Some(pr_res.html_url);
                            status = "submitted".to_string();
                        }
                    }
                }
            }
        }
    }

    Ok(Json(GenerateAllContributorsPrResponse {
        branch_name,
        pr_title,
        pr_body,
        file_path,
        file_content,
        cli_commands,
        pr_url,
        status,
    }))
}

pub async fn verify_contributor(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<VerifyContributorRequest>,
) -> Result<Json<VerifyContributorResponse>, (StatusCode, Json<ErrorResponse>)> {
    let clean_handle = payload.github_handle.trim().trim_start_matches('@').to_string();
    if clean_handle.is_empty() && payload.contributor_name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Contributor name or GitHub handle is required".to_string(),
            }),
        ));
    }

    let handle_for_login = if !clean_handle.is_empty() {
        clean_handle.clone()
    } else {
        payload.contributor_name.to_lowercase().replace(' ', "-")
    };

    let contributions = if payload.contributions.is_empty() {
        vec!["code".to_string()]
    } else {
        payload.contributions.clone()
    };

    let now = Utc::now();

    let pr_response = if payload.auto_generate_pr == Some(true) {
        let pr_req = GenerateAllContributorsPrRequest {
            github_handle: handle_for_login.clone(),
            contributor_name: payload.contributor_name.clone(),
            contributions: contributions.clone(),
            branch_name: None,
        };
        match generate_all_contributors_pr(State(ctx.clone()), Json(pr_req)).await {
            Ok(Json(res)) => Some(res),
            Err(_) => None,
        }
    } else {
        None
    };

    let pr_url_opt = pr_response.as_ref().and_then(|pr| pr.pr_url.clone());

    let (updated_contributor, updated_issue) = {
        let mut state = ctx.state.write().await;
        let mut target_issue: Option<ContributorIssue> = None;

        let existing_idx = state.contributors.iter().position(|c| {
            c.login.as_ref().map(|l| l.eq_ignore_ascii_case(&handle_for_login)).unwrap_or(false)
                || c.name.eq_ignore_ascii_case(&payload.contributor_name)
        });

        let target_contributor = if let Some(idx) = existing_idx {
            let c = &mut state.contributors[idx];
            c.verified = true;
            c.verified_at = Some(now);
            if c.login.is_none() {
                c.login = Some(handle_for_login.clone());
            }
            for tag in &contributions {
                if !c.contributions.contains(tag) {
                    c.contributions.push(tag.clone());
                }
            }
            if pr_url_opt.is_some() {
                c.pr_url = pr_url_opt.clone();
            }
            c.clone()
        } else {
            let record = ContributorRecord {
                name: if payload.contributor_name.trim().is_empty() {
                    handle_for_login.clone()
                } else {
                    payload.contributor_name.trim().to_string()
                },
                login: Some(handle_for_login.clone()),
                avatar_url: format!("https://avatars.githubusercontent.com/{}?v=4", handle_for_login),
                profile_url: format!("https://github.com/{}", handle_for_login),
                contributions: contributions.clone(),
                verified: true,
                verified_at: Some(now),
                pr_url: pr_url_opt.clone(),
            };
            state.contributors.push(record.clone());
            record
        };

        if let Some(ref issue_id) = payload.issue_id {
            if let Some(issue) = state.contributor_issues.iter_mut().find(|i| &i.id == issue_id) {
                issue.claimed = true;
                if issue.claimed_by.is_none() {
                    issue.claimed_by = Some(format!("@{}", handle_for_login));
                }
                if issue.claimed_at.is_none() {
                    issue.claimed_at = Some(now);
                }
                if pr_url_opt.is_some() {
                    issue.pr_url = pr_url_opt.clone();
                }
                target_issue = Some(issue.clone());
            }
        }

        let _ = state.save(&ctx.data_file);
        (target_contributor, target_issue)
    };

    let contributor = updated_contributor;

    Ok(Json(VerifyContributorResponse {
        success: true,
        contributor,
        issue: updated_issue,
        pr: pr_response,
        message: "Contributor verified successfully".to_string(),
    }))
}

pub async fn handle_github_webhook(
    State(ctx): State<Arc<AppContext>>,
    headers: HeaderMap,
    Json(payload): Json<GitHubWebhookPayload>,
) -> (StatusCode, Json<GitHubWebhookResponse>) {
    let event_header = headers
        .get("x-github-event")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.trim());

    if let Some("ping") = event_header {
        return (
            StatusCode::OK,
            Json(GitHubWebhookResponse {
                received: true,
                action: "ping".to_string(),
                matched_issue_id: None,
                message: "pong".to_string(),
            }),
        );
    }

    let is_issues_event = match event_header {
        Some("issues") => true,
        None if !payload.action.is_empty() && payload.issue.is_some() => true,
        Some(ev) if ev != "ping" && !payload.action.is_empty() && payload.issue.is_some() => true,
        _ => false,
    };

    if !is_issues_event {
        return (
            StatusCode::OK,
            Json(GitHubWebhookResponse {
                received: true,
                action: if payload.action.is_empty() {
                    event_header.unwrap_or("unknown").to_string()
                } else {
                    payload.action.clone()
                },
                matched_issue_id: None,
                message: "Event ignored (not an issues event)".to_string(),
            }),
        );
    }

    let issue_payload = match &payload.issue {
        Some(i) => i,
        None => {
            return (
                StatusCode::OK,
                Json(GitHubWebhookResponse {
                    received: true,
                    action: payload.action.clone(),
                    matched_issue_id: None,
                    message: "No issue payload provided".to_string(),
                }),
            );
        }
    };

    let payload_repo = payload
        .repository
        .as_ref()
        .and_then(|r| r.full_name.as_deref());

    let (matched_id, sync_msg, remove_label_info) = {
        let mut state = ctx.state.write().await;
        let target_issue = state.contributor_issues.iter_mut().find(|issue| {
            if issue.github_issue_number != Some(issue_payload.number) {
                return false;
            }
            if let (Some(pr), Some(ir)) = (payload_repo, issue.github_repo.as_deref()) {
                ir.eq_ignore_ascii_case(pr)
            } else {
                true
            }
        });

        match target_issue {
            None => (
                None,
                format!(
                    "No local contributor issue matched GitHub issue #{}",
                    issue_payload.number
                ),
                None,
            ),
            Some(issue) => {
                let id = issue.id.clone();
                let mut remove_label = None;
                let action_lower = payload.action.to_lowercase();

                match action_lower.as_str() {
                    "unassigned" => {
                        let unassigned_login = payload.assignee.as_ref().map(|u| u.login.as_str());
                        let matches_claim = match (&issue.claimed_by, unassigned_login) {
                            (Some(claimed_by), Some(unassigned)) => {
                                let clean_claimed = claimed_by.trim().trim_start_matches('@');
                                let clean_unassigned = unassigned.trim().trim_start_matches('@');
                                clean_claimed.eq_ignore_ascii_case(clean_unassigned)
                            }
                            _ => false,
                        };
                        let should_unassign = matches_claim || issue_payload.assignees.is_empty();

                        if should_unassign {
                            issue.claimed = false;
                            issue.claimed_by = None;
                            issue.claimed_at = None;
                            issue.github_sync_status =
                                Some("Unassigned (Webhook)".to_string());
                            issue.github_sync_message =
                                Some("Contributor unassigned externally on GitHub".to_string());

                            let repo_target = issue
                                .github_repo
                                .as_deref()
                                .or(payload_repo)
                                .unwrap_or("SpaceCorps/GrowthHack");
                            let (owner, repo_name) = match repo_target.split_once('/') {
                                Some((o, r)) => (o.trim().to_string(), r.trim().to_string()),
                                None => ("SpaceCorps".to_string(), "GrowthHack".to_string()),
                            };
                            remove_label = Some((owner, repo_name, issue_payload.number));
                        }
                    }
                    "closed" => {
                        issue.closed = true;
                        issue.closed_at = Some(Utc::now());
                        issue.github_sync_status = Some("Closed (Webhook)".to_string());
                        issue.github_sync_message = Some(format!(
                            "Issue #{} was closed externally on GitHub",
                            issue_payload.number
                        ));
                    }
                    "reopened" => {
                        issue.closed = false;
                        issue.closed_at = None;
                        issue.github_sync_status = Some("Reopened (Webhook)".to_string());
                        issue.github_sync_message = Some(format!(
                            "Issue #{} was reopened on GitHub",
                            issue_payload.number
                        ));
                    }
                    "assigned" if !issue.claimed => {
                        if let Some(assignee) = &payload.assignee {
                            issue.claimed = true;
                            issue.claimed_by = Some(assignee.login.clone());
                            issue.claimed_at = Some(Utc::now());
                            issue.github_sync_status = Some("Assigned (Webhook)".to_string());
                            issue.github_sync_message =
                                Some(format!("Assigned to @{} on GitHub", assignee.login));
                        }
                    }
                    _ => {
                        // Unhandled actions ignored
                    }
                }

                let final_msg = issue.github_sync_message.clone().unwrap_or_else(|| {
                    format!(
                        "Processed action {} for issue #{}",
                        payload.action, issue_payload.number
                    )
                });
                let _ = state.save(&ctx.data_file);
                (
                    Some(id),
                    final_msg,
                    remove_label,
                )
            }
        }
    };

    if let Some((owner, repo, num)) = remove_label_info {
        if let Some(tok) = ctx.get_github_token().filter(|t| !t.trim().is_empty()) {
            if let Ok(client) = GitHubClient::new(&tok) {
                let _ = client
                    .remove_issue_label(&owner, &repo, num, "claimed")
                    .await;
            }
        }
    }

    (
        StatusCode::OK,
        Json(GitHubWebhookResponse {
            received: true,
            action: payload.action,
            matched_issue_id: matched_id,
            message: sync_msg,
        }),
    )
}

use crate::api::issues::AppContext;
use crate::db::{ContributorIssue, ContributorRecord};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
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

#[derive(Clone, Debug, Deserialize)]
pub struct ClaimIssueRequest {
    pub contributor_name: String,
    pub github_handle: Option<String>,
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
        .filter(|h| !h.trim().is_empty())
        .unwrap_or_else(|| payload.contributor_name.trim().to_string());

    issue.claimed = true;
    issue.claimed_by = Some(claimer);
    issue.claimed_at = Some(Utc::now());

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

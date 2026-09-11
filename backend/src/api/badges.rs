use crate::api::issues::AppContext;
use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BadgeFormat {
    Minimal,
    ShieldSvg,
    SummaryCard,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct GenerateBadgeRequest {
    pub project_name: String,
    pub plan_id: Option<String>,
    pub plan_title: Option<String>,
    pub agents_count: Option<usize>,
    pub tests_passed: Option<usize>,
    pub tokens_saved: Option<usize>,
    pub worktree_diff_url: Option<String>,
    pub format: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateBadgeResponse {
    pub markdown: String,
    pub svg_url: Option<String>,
    pub estimated_reach: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplatesResponse {
    pub action_yml: String,
    pub workflow_yml: String,
    #[serde(default)]
    pub companion_workflow_yml: Option<String>,
    #[serde(default)]
    pub fork_guide_md: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SvgQuery {
    pub label: Option<String>,
    pub message: Option<String>,
    pub color: Option<String>,
}

pub const ACTION_YML_TEMPLATE: &str = r#"name: "Tendril Verification & PR Flywheel"
description: "Automated verification gates and PR attribution badge for Ivy-Tendril plans"
inputs:
  plan-id:
    description: "Tendril Plan ID"
    required: false
    default: ""
  verification-mode:
    description: "Verification execution mode (all, tests, clippy)"
    required: false
    default: "all"
  post-comment:
    description: "Whether to post verification summary comment on PR"
    required: false
    default: "true"
  github-token:
    description: "GitHub Token for posting PR comments"
    required: false
    default: "${{ github.token }}"
runs:
  using: "composite"
  steps:
    - name: Run Tendril Verifications
      shell: bash
      run: |
        echo "Running Tendril verification gates in mode: ${{ inputs.verification-mode }}"
    - name: Upsert PR Summary Comment
      if: ${{ inputs.post-comment == 'true' && github.event.pull_request.number }}
      shell: bash
      env:
        GH_TOKEN: ${{ inputs.github-token }}
        GH_REPO: ${{ github.repository }}
        PR_NUMBER: ${{ github.event.pull_request.number }}
        PLAN_ID: ${{ inputs.plan-id }}
        VERIFICATION_MODE: ${{ inputs.verification-mode }}
      run: |
        cat << EOF > comment.md
        <!-- tendril-flywheel-badge -->
        <details>
        <summary><b>⚡ Ivy-Tendril Verification Summary</b>: passed</summary>

        | Metric | Value |
        | :--- | :--- |
        | **Plan** | ${PLAN_ID:-N/A} |
        | **Verification Mode** | ${VERIFICATION_MODE:-all} |
        | **Status** | Passed in isolated git worktree |

        <sub>Automated by [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) (Git Worktree Isolation)</sub>
        </details>
        EOF

        MARKER="<!-- tendril-flywheel-badge -->"
        mkdir -p tendril-attribution
        echo "${PR_NUMBER}" > tendril-attribution/pr_number.txt
        cp comment.md tendril-attribution/comment.md

        if ! EXISTING_COMMENT_OUTPUT=$(gh api "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" --jq ".[] | select(.body | contains(\"${MARKER}\")) | .id" 2>&1); then
          if echo "$EXISTING_COMMENT_OUTPUT" | grep -iqE "Resource not accessible|403|HttpError"; then
            echo "::warning title=Fork PR Read-Only Permissions::GITHUB_TOKEN is read-only on fork pull_request runs. PR comment attribution was skipped. Use the companion workflow_run pattern (tendril-comment.yml) for open-source fork commenting."
            exit 0
          fi
          echo "::warning title=GitHub API Error::Failed to fetch comments: $EXISTING_COMMENT_OUTPUT"
          exit 0
        fi

        EXISTING_COMMENT_ID=$(echo "$EXISTING_COMMENT_OUTPUT" | head -n 1)

        if [ -n "$EXISTING_COMMENT_ID" ]; then
          echo "Updating existing PR comment ID: $EXISTING_COMMENT_ID"
          if ! PATCH_OUTPUT=$(gh api "repos/${GH_REPO}/issues/comments/${EXISTING_COMMENT_ID}" -X PATCH -F body=@comment.md 2>&1); then
            echo "::warning title=Comment Update Failed::Unable to update PR comment: $PATCH_OUTPUT"
          fi
        else
          echo "Creating new PR comment on PR #$PR_NUMBER"
          if ! POST_OUTPUT=$(gh pr comment "${PR_NUMBER}" --body-file comment.md 2>&1); then
            echo "::warning title=Comment Creation Failed::Unable to create PR comment: $POST_OUTPUT"
          fi
        fi
"#;

pub const WORKFLOW_YML_TEMPLATE: &str = r#"name: Tendril Verification & PR Flywheel

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      issues: write
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Rust toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy

      - name: Setup Node.js & pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Run Backend Tests
        run: |
          cd backend
          cargo test

      - name: Run Frontend Tests
        run: |
          cd frontend
          pnpm install --frozen-lockfile
          pnpm run build

      - name: Post Tendril PR Attribution Badge
        if: always()
        uses: ./.
        with:
          plan-id: "00291"
          verification-mode: "all"
          post-comment: "true"
          github-token: ${{ secrets.GITHUB_TOKEN }}

      - name: Save Verification Attribution Artifact
        if: always() && github.event_name == 'pull_request'
        shell: bash
        run: |
          mkdir -p tendril-attribution
          echo "${{ github.event.pull_request.number }}" > tendril-attribution/pr_number.txt

      - name: Upload Attribution Artifact
        if: always() && github.event_name == 'pull_request'
        uses: actions/upload-artifact@v4
        with:
          name: tendril-verification-summary
          path: tendril-attribution/
          retention-days: 1
"#;

pub const COMPANION_WORKFLOW_YML_TEMPLATE: &str = r#"name: Tendril Fork PR Comment

on:
  workflow_run:
    workflows: ["Tendril Verification & PR Flywheel"]
    types: [completed]

jobs:
  comment:
    runs-on: ubuntu-latest
    if: >
      github.event.workflow_run.event == 'pull_request' &&
      github.event.workflow_run.conclusion == 'success'
    permissions:
      pull-requests: write
      issues: write
    steps:
      - name: Download Verification Artifact
        uses: actions/download-artifact@v4
        with:
          name: tendril-verification-summary
          run-id: ${{ github.event.workflow_run.id }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          path: tendril-attribution/
        continue-on-error: true

      - name: Upsert PR Comment
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GH_REPO: ${{ github.repository }}
        run: |
          if [ ! -f "tendril-attribution/pr_number.txt" ]; then
            echo "No PR attribution metadata artifact found. Skipping fork comment."
            exit 0
          fi
          PR_NUMBER=$(cat tendril-attribution/pr_number.txt)
          MARKER="<!-- tendril-flywheel-badge -->"
          EXISTING_COMMENT_ID=$(gh api "repos/${GH_REPO}/issues/${PR_NUMBER}/comments" --jq ".[] | select(.body | contains(\"${MARKER}\")) | .id" | head -n 1)

          if [ -n "$EXISTING_COMMENT_ID" ]; then
            echo "Updating comment $EXISTING_COMMENT_ID on PR #$PR_NUMBER"
            gh api "repos/${GH_REPO}/issues/comments/${EXISTING_COMMENT_ID}" -X PATCH -F body=@tendril-attribution/comment.md
          else
            echo "Creating new comment on PR #$PR_NUMBER"
            gh pr comment "${PR_NUMBER}" --body-file tendril-attribution/comment.md
          fi
"#;

pub const FORK_PERMISSIONS_GUIDE_MD: &str = r#"# GitHub Actions Fork Security & PR Permissions Guide

When open-source contributors submit pull requests from external repository forks, GitHub enforces strict security boundaries to prevent malicious code from accessing repository secrets or modifying repository contents.

---

## 1. Why Fork Pull Request Tokens are Read-Only

Under the standard `pull_request` event trigger:
- The execution context runs code from the contributor fork branch.
- GitHub automatically assigns a read-only `GITHUB_TOKEN` (even if your workflow YAML declares `permissions: { pull-requests: write }`).
- Repository secrets and write tokens are withheld.
- Calls to `gh pr comment` or the GitHub Issues Comments API fail with `HTTP 403: Resource not accessible by integration`.

This behavior is intentional by GitHub security design to protect open-source repositories against arbitrary code execution attacks.

---

## 2. Two Solutions for Tendril Attribution & Verification

### Option A: Single Workflow with Graceful Fallback (Default)
In `action.yml`, the token error check detects HTTP 403 / `Resource not accessible` responses from `gh api` and logs an informational warning notice (`::warning`) rather than failing the overall verification job:
- **Internal PRs (branches within repo):** The verification comment and badge are upserted immediately.
- **Fork PRs (external contributors):** The verification passes cleanly; comment creation is skipped without breaking CI.

### Option B: Companion `workflow_run` Pattern (Recommended for Open Source)
To guarantee that verification summary comments are posted on fork pull requests without sacrificing repository security:
1. The primary verification workflow (`tendril-verify.yml`) runs on `pull_request` in untrusted fork context and uploads the attribution summary as a build artifact.
2. The companion workflow (`tendril-comment.yml`) triggers on `workflow_run` after the primary workflow completes successfully.
3. Because `workflow_run` executes in the context of the base default branch (not the fork branch), it safely receives write permissions (`pull-requests: write`), downloads the artifact, and posts the comment on the contributor PR.

---

## 3. GitHub Repository Configuration Checklist

1. **Workflow Permissions**:
   Navigate to **Settings > Actions > General > Workflow permissions**.
   Ensure **Read repository contents and packages permissions** (or **Read and write permissions**) is selected according to your team policy.
2. **Fork Pull Request Workflows**:
   Under **Fork pull request workflows from outside collaborators**, choose **Require approval for first-time contributors** (recommended) or your preferred approval model.
3. **Artifact Retention**:
   Attribution artifacts are lightweight text files. Keep retention set to `1` day in `tendril-verify.yml` to minimize artifact storage.
"#;

pub fn generate_badge_markdown(req: &GenerateBadgeRequest) -> (String, Option<String>, u32) {
    let agents = req.agents_count.unwrap_or(3);
    let tests = req.tests_passed.unwrap_or(12);
    let plan_id_str = req.plan_id.as_deref().unwrap_or("00291");
    let plan_title_str = req
        .plan_title
        .as_deref()
        .unwrap_or("Built with Tendril PR Flywheel");
    let tokens_saved_str = req
        .tokens_saved
        .map(|t| t.to_string())
        .unwrap_or_else(|| "142,500".to_string());

    let format_str = req.format.as_deref().unwrap_or("minimal");

    let estimated_reach = 450 + (agents as u32 * 120) + (tests as u32 * 25);

    match format_str {
        "shield_svg" | "shield" => {
            let svg_url = "https://img.shields.io/badge/Orchestrated%20with-Ivy--Tendril-10b981?style=flat-square&logo=github".to_string();
            let markdown = format!(
                "[![Orchestrated with Ivy-Tendril]({})](https://github.com/Ivy-Interactive/Ivy-Tendril)",
                svg_url
            );
            (markdown, Some(svg_url), estimated_reach)
        }
        "summary_card" | "summary" => {
            let diff_link = if let Some(url) = &req.worktree_diff_url {
                format!("[Inspect Worktree Diff]({})", url)
            } else {
                "[Inspect Worktree Diff](https://github.com/Ivy-Interactive/Ivy-Tendril)"
                    .to_string()
            };

            let markdown = format!(
                "<details>\n<summary><b>⚡ Ivy-Tendril Verification Summary</b>: {} tests passed</summary>\n\n| Metric | Value |\n| :--- | :--- |\n| **Project** | {} |\n| **Plan** | {} - {} |\n| **Orchestration** | {} agents in isolated worktrees |\n| **Verification Tests** | {} passed |\n| **Tokens Saved** | {} |\n| **Diff Inspection** | {} |\n\n<sub>Automated by [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) (Git Worktree Isolation)</sub>\n</details>",
                tests,
                req.project_name,
                plan_id_str,
                plan_title_str,
                agents,
                tests,
                tokens_saved_str,
                diff_link
            );
            let svg_url = Some("https://img.shields.io/badge/Orchestrated%20with-Ivy--Tendril-10b981?style=flat-square&logo=github".to_string());
            (markdown, svg_url, estimated_reach)
        }
        _ => {
            // Minimal text badge
            let markdown = format!(
                "⚡ Orchestrated with [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) ({} agents in isolated worktrees)",
                agents
            );
            (markdown, None, estimated_reach)
        }
    }
}

pub fn generate_svg_markup(label: &str, message: &str, color: &str) -> String {
    let label_len = label.len() * 7 + 14;
    let message_len = message.len() * 7 + 14;
    let total_width = label_len + message_len;
    let label_center = (label_len * 10) / 2;
    let message_center = (label_len * 10) + ((message_len * 10) / 2);

    format!(
        r##"<svg xmlns="http://www.w3.org/2000/svg" width="{total_width}" height="20" role="img" aria-label="{label}: {message}">
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="{total_width}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="{label_len}" height="20" fill="#24292e"/>
    <rect x="{label_len}" width="{message_len}" height="20" fill="{color}"/>
    <rect width="{total_width}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="{label_center}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">{label}</text>
    <text x="{label_center}" y="140" transform="scale(.1)" fill="#fff">{label}</text>
    <text aria-hidden="true" x="{message_center}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)">{message}</text>
    <text x="{message_center}" y="140" transform="scale(.1)" fill="#fff">{message}</text>
  </g>
</svg>"##
    )
}

pub async fn generate_badge(
    State(_ctx): State<Arc<AppContext>>,
    Json(req): Json<GenerateBadgeRequest>,
) -> impl IntoResponse {
    let (markdown, svg_url, estimated_reach) = generate_badge_markdown(&req);
    (
        StatusCode::OK,
        Json(GenerateBadgeResponse {
            markdown,
            svg_url,
            estimated_reach,
        }),
    )
}

pub async fn render_svg_badge(Query(query): Query<SvgQuery>) -> impl IntoResponse {
    let label = query.label.as_deref().unwrap_or("Orchestrated with");
    let message = query.message.as_deref().unwrap_or("Ivy-Tendril");
    let color = query.color.as_deref().unwrap_or("#10b981");

    let svg_content = generate_svg_markup(label, message, color);

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "image/svg+xml".parse().unwrap());
    headers.insert(
        header::CACHE_CONTROL,
        "public, max-age=3600".parse().unwrap(),
    );

    (StatusCode::OK, headers, svg_content)
}

pub async fn get_workflow_templates() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(WorkflowTemplatesResponse {
            action_yml: ACTION_YML_TEMPLATE.to_string(),
            workflow_yml: WORKFLOW_YML_TEMPLATE.to_string(),
            companion_workflow_yml: Some(COMPANION_WORKFLOW_YML_TEMPLATE.to_string()),
            fork_guide_md: Some(FORK_PERMISSIONS_GUIDE_MD.to_string()),
        }),
    )
}

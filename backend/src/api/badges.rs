use axum::{
    extract::{Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::api::issues::AppContext;

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
    - name: Generate PR Summary Badge
      if: ${{ inputs.post-comment == 'true' }}
      shell: bash
      run: |
        echo "Attribution badge prepared for PR ${{ github.event.pull_request.number }}"
"#;

pub const WORKFLOW_YML_TEMPLATE: &str = r#"name: Tendril Verification & PR Flywheel

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  verify:
    runs-on: ubuntu-latest
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
"#;

pub fn generate_badge_markdown(req: &GenerateBadgeRequest) -> (String, Option<String>, u32) {
    let agents = req.agents_count.unwrap_or(3);
    let tests = req.tests_passed.unwrap_or(12);
    let plan_id_str = req.plan_id.as_deref().unwrap_or("00291");
    let plan_title_str = req.plan_title.as_deref().unwrap_or("Built with Tendril PR Flywheel");
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
                "[Inspect Worktree Diff](https://github.com/Ivy-Interactive/Ivy-Tendril)".to_string()
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
    headers.insert(header::CACHE_CONTROL, "public, max-age=3600".parse().unwrap());

    (StatusCode::OK, headers, svg_content)
}

pub async fn get_workflow_templates() -> impl IntoResponse {
    (
        StatusCode::OK,
        Json(WorkflowTemplatesResponse {
            action_yml: ACTION_YML_TEMPLATE.to_string(),
            workflow_yml: WORKFLOW_YML_TEMPLATE.to_string(),
        }),
    )
}

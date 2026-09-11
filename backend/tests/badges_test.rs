mod common;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use growthhack_backend::api::badges::{
    generate_badge, get_workflow_templates, render_svg_badge, GenerateBadgeRequest,
    GenerateBadgeResponse, SvgQuery, WorkflowTemplatesResponse,
};

#[tokio::test]
async fn test_generate_minimal_badge() {
    let ctx = common::create_test_context();
    let req = GenerateBadgeRequest {
        project_name: "growthhack".to_string(),
        plan_id: Some("00291".to_string()),
        plan_title: Some("PR Flywheel".to_string()),
        agents_count: Some(3),
        tests_passed: Some(15),
        tokens_saved: Some(120_000),
        worktree_diff_url: None,
        format: Some("minimal".to_string()),
    };

    let response = generate_badge(State(ctx.ctx()), Json(req))
        .await
        .into_response();
    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let res: GenerateBadgeResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert!(res.markdown.contains(
        "⚡ Orchestrated with [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril)"
    ));
    assert!(res.markdown.contains("3 agents in isolated worktrees"));
    assert!(res.svg_url.is_none());
    assert!(res.estimated_reach > 0);
}

#[tokio::test]
async fn test_generate_shield_svg_badge() {
    let ctx = common::create_test_context();
    let req = GenerateBadgeRequest {
        project_name: "growthhack".to_string(),
        plan_id: Some("00291".to_string()),
        plan_title: Some("PR Flywheel".to_string()),
        agents_count: Some(4),
        tests_passed: Some(20),
        tokens_saved: Some(150_000),
        worktree_diff_url: None,
        format: Some("shield_svg".to_string()),
    };

    let response = generate_badge(State(ctx.ctx()), Json(req))
        .await
        .into_response();
    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let res: GenerateBadgeResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert!(res.markdown.contains("[![Orchestrated with Ivy-Tendril]"));
    assert!(res
        .markdown
        .contains("https://github.com/Ivy-Interactive/Ivy-Tendril"));
    assert!(res.svg_url.is_some());
    assert!(res.svg_url.unwrap().contains("shields.io"));
}

#[tokio::test]
async fn test_generate_summary_card() {
    let ctx = common::create_test_context();
    let diff_url = "https://github.com/spacecorps/growthhack/pull/5/files".to_string();
    let req = GenerateBadgeRequest {
        project_name: "growthhack".to_string(),
        plan_id: Some("00291".to_string()),
        plan_title: Some("PR Flywheel".to_string()),
        agents_count: Some(3),
        tests_passed: Some(28),
        tokens_saved: Some(180_000),
        worktree_diff_url: Some(diff_url.clone()),
        format: Some("summary_card".to_string()),
    };

    let response = generate_badge(State(ctx.ctx()), Json(req))
        .await
        .into_response();
    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let res: GenerateBadgeResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert!(res.markdown.contains("<details>"));
    assert!(res.markdown.contains(
        "<summary><b>⚡ Ivy-Tendril Verification Summary</b>: 28 tests passed</summary>"
    ));
    assert!(res.markdown.contains("| **Plan** | 00291 - PR Flywheel |"));
    assert!(res.markdown.contains(&diff_url));
    assert!(res.markdown.contains("</details>"));
}

#[tokio::test]
async fn test_render_svg_badge_endpoint() {
    let query = SvgQuery {
        label: Some("Orchestrated with".to_string()),
        message: Some("Ivy-Tendril".to_string()),
        color: Some("#10b981".to_string()),
    };

    let response = render_svg_badge(Query(query)).await.into_response();
    assert_eq!(response.status(), StatusCode::OK);

    let content_type = response
        .headers()
        .get("content-type")
        .unwrap()
        .to_str()
        .unwrap();
    assert_eq!(content_type, "image/svg+xml");

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let svg_text = String::from_utf8(body_bytes.to_vec()).unwrap();

    assert!(svg_text.contains("<svg"));
    assert!(svg_text.contains("xmlns=\"http://www.w3.org/2000/svg\""));
    assert!(svg_text.contains("Orchestrated with"));
    assert!(svg_text.contains("Ivy-Tendril"));
    assert!(svg_text.contains("</svg>"));
}

#[tokio::test]
async fn test_get_workflows_endpoint() {
    let response = get_workflow_templates().await.into_response();
    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let res: WorkflowTemplatesResponse = serde_json::from_slice(&body_bytes).unwrap();

    assert!(res
        .action_yml
        .contains("name: \"Tendril Verification & PR Flywheel\""));
    assert!(res.action_yml.contains("inputs:"));
    assert!(res.action_yml.contains("<!-- tendril-flywheel-badge -->"));
    assert!(res.action_yml.contains("EXISTING_COMMENT_ID"));
    assert!(
        res.action_yml.contains("Resource not accessible")
            || res.action_yml.contains("Fork PR Read-Only Permissions")
    );
    assert!(res
        .action_yml
        .contains("gh api \"repos/${GH_REPO}/issues/comments/${EXISTING_COMMENT_ID}\""));
    assert!(res.action_yml.contains("gh pr comment \"${PR_NUMBER}\""));
    assert!(res
        .workflow_yml
        .contains("name: Tendril Verification & PR Flywheel"));
    assert!(res.workflow_yml.contains("on:"));
    assert!(res.workflow_yml.contains("pull_request:"));
    assert!(res.workflow_yml.contains("pull-requests: write"));
    assert!(res.workflow_yml.contains("issues: write"));

    assert!(res.companion_workflow_yml.is_some());
    let companion = res.companion_workflow_yml.unwrap();
    assert!(companion.contains("workflow_run:"));
    assert!(companion.contains("workflows: [\"Tendril Verification & PR Flywheel\"]"));
    assert!(companion.contains("pull-requests: write"));
    assert!(companion.contains("workflow_dispatch:"));
    assert!(companion.contains("dry_run"));
    assert!(companion.contains("comment.md"));

    assert!(res.workflow_yml.contains("Test Companion Workflow Run Trigger"));
    assert!(res.workflow_yml.contains("python3 -c \"import yaml"));

    assert!(res.fork_guide_md.is_some());
    let guide = res.fork_guide_md.unwrap();
    assert!(guide.contains("GitHub Actions Fork Security"));
    assert!(guide.contains("workflow_run"));
    assert!(guide.contains("Automated Workflow Testing in CI"));
}

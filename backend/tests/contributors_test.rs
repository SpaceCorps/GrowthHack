use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::contributors::{
    claim_contributor_issue, get_all_contributors, get_contributing_guide, link_github_issue,
    list_contributor_issues, ClaimIssueRequest, ContributorIssuesQuery, LinkGitHubIssueRequest,
};
use growthhack_backend::api::issues::AppContext;
use growthhack_backend::db::GrowthState;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

fn create_test_context() -> Arc<AppContext> {
    let state = Arc::new(RwLock::new(GrowthState::seed_default()));
    let runner = AgentRunner::new(PathBuf::from("nonexistent_agy_binary_for_tests"));
    let task_manager = TaskManager::new(runner);
    let data_file =
        std::env::temp_dir().join(format!("growth_data_test_{}.json", uuid::Uuid::new_v4()));
    let ivy_web_content_path =
        std::env::temp_dir().join(format!("growth_ivy_web_test_{}", uuid::Uuid::new_v4()));
    let ivy_web_images_path =
        std::env::temp_dir().join(format!("growth_ivy_images_test_{}", uuid::Uuid::new_v4()));
    let config = growthhack_backend::config::Config::load();

    Arc::new(AppContext {
        state,
        task_manager,
        data_file,
        ivy_web_content_path,
        ivy_web_images_path,
        config,
        rate_limiter: Arc::new(
            growthhack_backend::api::middleware::rate_limit::IpRateLimiter::default(),
        ),
    })
}

#[tokio::test]
async fn test_list_seeded_contributor_issues() {
    let ctx = create_test_context();
    let Json(issues) =
        list_contributor_issues(State(ctx), Query(ContributorIssuesQuery::default())).await;

    assert_eq!(
        issues.len(),
        15,
        "Expected exactly 15 seeded contributor issues"
    );

    // Check first and last issues
    let first = issues
        .iter()
        .find(|i| i.id == "cf-issue-1")
        .expect("cf-issue-1 not found");
    assert_eq!(first.title, "Add CLI shell completion for zsh");
    assert_eq!(first.category, "CLI");
    assert_eq!(first.difficulty, "Good First Issue");
    assert_eq!(first.estimated_minutes, 15);
    assert!(!first.claimed);

    let last = issues
        .iter()
        .find(|i| i.id == "cf-issue-15")
        .expect("cf-issue-15 not found");
    assert_eq!(last.title, "Add contributor guide link to bottom footer");
    assert_eq!(last.category, "Documentation");
    assert_eq!(last.estimated_minutes, 15);
}

#[tokio::test]
async fn test_filter_issues_by_category_and_max_time() {
    let ctx = create_test_context();

    // Filter category: Frontend
    let query_fe = ContributorIssuesQuery {
        category: Some("Frontend".to_string()),
        ..Default::default()
    };
    let Json(fe_issues) = list_contributor_issues(State(ctx.clone()), Query(query_fe)).await;
    assert!(!fe_issues.is_empty());
    for issue in &fe_issues {
        assert_eq!(issue.category, "Frontend");
    }

    // Filter max_time: 15 minutes
    let query_15m = ContributorIssuesQuery {
        max_time: Some(15),
        ..Default::default()
    };
    let Json(quick_issues) = list_contributor_issues(State(ctx.clone()), Query(query_15m)).await;
    assert!(!quick_issues.is_empty());
    for issue in &quick_issues {
        assert!(issue.estimated_minutes <= 15);
    }

    // Filter combined: Backend and max_time <= 15
    let query_be_15 = ContributorIssuesQuery {
        category: Some("Backend".to_string()),
        max_time: Some(15),
        ..Default::default()
    };
    let Json(be_15_issues) = list_contributor_issues(State(ctx), Query(query_be_15)).await;
    assert!(!be_15_issues.is_empty());
    for issue in &be_15_issues {
        assert_eq!(issue.category, "Backend");
        assert!(issue.estimated_minutes <= 15);
    }
}

#[tokio::test]
async fn test_claim_issue_and_reject_duplicate() {
    let ctx = create_test_context();

    let claim_req = ClaimIssueRequest {
        contributor_name: "Test Contributor".to_string(),
        github_handle: Some("@test-contributor".to_string()),
        ..Default::default()
    };

    // First claim should succeed
    let result = claim_contributor_issue(
        State(ctx.clone()),
        Path("cf-issue-1".to_string()),
        Json(claim_req.clone()),
    )
    .await;

    assert!(result.is_ok());
    let (status, Json(claimed_issue)) = result.unwrap();
    assert_eq!(status, StatusCode::OK);
    assert!(claimed_issue.claimed);
    assert_eq!(
        claimed_issue.claimed_by.as_deref(),
        Some("@test-contributor")
    );
    assert!(claimed_issue.claimed_at.is_some());

    // Duplicate claim should fail with 409 Conflict
    let duplicate_result = claim_contributor_issue(
        State(ctx.clone()),
        Path("cf-issue-1".to_string()),
        Json(claim_req),
    )
    .await;

    assert!(duplicate_result.is_err());
    let (status, Json(err)) = duplicate_result.unwrap_err();
    assert_eq!(status, StatusCode::CONFLICT);
    assert!(err.error.contains("already been claimed"));

    // Verify list returns claimed issue as claimed
    let Json(issues) = list_contributor_issues(
        State(ctx),
        Query(ContributorIssuesQuery {
            claimed: Some(true),
            ..Default::default()
        }),
    )
    .await;

    assert_eq!(issues.len(), 1);
    assert_eq!(issues[0].id, "cf-issue-1");
}

#[tokio::test]
async fn test_claim_nonexistent_issue_returns_not_found() {
    let ctx = create_test_context();

    let claim_req = ClaimIssueRequest {
        contributor_name: "Nobody".to_string(),
        github_handle: None,
        ..Default::default()
    };

    let result = claim_contributor_issue(
        State(ctx),
        Path("nonexistent-issue".to_string()),
        Json(claim_req),
    )
    .await;

    assert!(result.is_err());
    let (status, _) = result.unwrap_err();
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_get_contributing_guide_mandatory_sections() {
    let Json(guide) = get_contributing_guide().await;

    assert_eq!(guide.filename, "CONTRIBUTING.md");
    assert!(guide
        .content
        .contains("# Contributing to SpaceCorps GrowthHack"));
    assert!(
        guide.content.contains("Prerequisites"),
        "Missing Prerequisites section"
    );
    assert!(
        guide.content.contains("Rust & Cargo"),
        "Missing Rust requirement"
    );
    assert!(
        guide.content.contains("Node.js"),
        "Missing Node requirement"
    );
    assert!(
        guide.content.contains("Fast-Track Setup"),
        "Missing Setup section"
    );
    assert!(
        guide.content.contains("git clone"),
        "Missing git clone command"
    );
    assert!(
        guide.content.contains("Local Verification Gates"),
        "Missing Verification section"
    );
    assert!(
        guide.content.contains("cargo clippy -- -D warnings"),
        "Missing cargo clippy command"
    );
    assert!(
        guide.content.contains("cargo test"),
        "Missing cargo test command"
    );
    assert!(
        guide.content.contains("vp fmt --check ."),
        "Missing vp fmt command"
    );
    assert!(
        guide.content.contains("vp lint ."),
        "Missing vp lint command"
    );
    assert!(guide.content.contains("vp test"), "Missing vp test command");
    assert!(
        guide.content.contains("Good First Issues"),
        "Missing Good First Issues section"
    );
    assert!(
        guide.content.contains("Pull Request Guidelines"),
        "Missing PR guidelines"
    );
}

#[tokio::test]
async fn test_get_all_contributors() {
    let ctx = create_test_context();
    let Json(resp) = get_all_contributors(State(ctx)).await;

    assert_eq!(
        resp.contributors.len(),
        5,
        "Expected 5 initial contributors"
    );
    assert!(resp.markdown_table.contains("Rory Chatt"));
    assert!(resp.markdown_table.contains("Sarah Jenkins"));
    assert!(resp.html_grid.contains("ALL-CONTRIBUTORS-LIST:START"));
    assert!(resp.html_grid.contains("ALL-CONTRIBUTORS-LIST:END"));
    assert!(resp.html_grid.contains("Alex Vance"));
    assert!(resp
        .badge_markdown
        .contains("all_contributors-5-orange.svg"));
}

#[tokio::test]
async fn test_claim_issue_with_github_sync_skipped_without_token() {
    let ctx = create_test_context();
    let claim_req = ClaimIssueRequest {
        contributor_name: "Alex Contributor".to_string(),
        github_handle: Some("@alexcontributor".to_string()),
        github_issue_number: Some(14),
        auto_sync_github: Some(true),
    };

    let result = claim_contributor_issue(
        State(ctx),
        Path("cf-issue-1".to_string()),
        Json(claim_req),
    )
    .await;

    assert!(result.is_ok());
    let (status, Json(claimed_issue)) = result.unwrap();
    assert_eq!(status, StatusCode::OK);
    assert!(claimed_issue.claimed);
    assert_eq!(
        claimed_issue.github_sync_status.as_deref(),
        Some("Skipped (No GitHub Token)")
    );
    assert!(claimed_issue
        .github_sync_message
        .unwrap()
        .contains("GitHub token not configured"));
}

#[tokio::test]
async fn test_link_github_issue_endpoint() {
    let ctx = create_test_context();
    let link_req = LinkGitHubIssueRequest {
        github_issue_number: Some(42),
        github_repo: Some("SpaceCorps/GrowthHack-Demo".to_string()),
    };

    let result = link_github_issue(
        State(ctx.clone()),
        Path("cf-issue-3".to_string()),
        Json(link_req),
    )
    .await;

    assert!(result.is_ok());
    let (status, Json(updated_issue)) = result.unwrap();
    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated_issue.github_issue_number, Some(42));
    assert_eq!(
        updated_issue.github_repo.as_deref(),
        Some("SpaceCorps/GrowthHack-Demo")
    );

    // Verify link to nonexistent issue returns 404
    let not_found_result = link_github_issue(
        State(ctx),
        Path("nonexistent-issue".to_string()),
        Json(LinkGitHubIssueRequest {
            github_issue_number: Some(99),
            github_repo: None,
        }),
    )
    .await;
    assert!(not_found_result.is_err());
    let (status, _) = not_found_result.unwrap_err();
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_claim_issue_with_mock_github_client() {
    use axum::routing::post;
    use axum::Router;
    use std::sync::atomic::{AtomicUsize, Ordering};

    let labels_hit = Arc::new(AtomicUsize::new(0));
    let assignees_hit = Arc::new(AtomicUsize::new(0));
    let comments_hit = Arc::new(AtomicUsize::new(0));

    let l_hit = labels_hit.clone();
    let a_hit = assignees_hit.clone();
    let c_hit = comments_hit.clone();

    let mock_app = Router::new()
        .route(
            "/repos/{owner}/{repo}/issues/{num}/labels",
            post(move || {
                let hit = l_hit.clone();
                async move {
                    hit.fetch_add(1, Ordering::SeqCst);
                    Json(serde_json::json!([
                        {"id": 1, "name": "claimed"}
                    ]))
                }
            }),
        )
        .route(
            "/repos/{owner}/{repo}/issues/{num}/assignees",
            post(move || {
                let hit = a_hit.clone();
                async move {
                    hit.fetch_add(1, Ordering::SeqCst);
                    Json(serde_json::json!({
                        "assignees": [{"login": "mockuser"}]
                    }))
                }
            }),
        )
        .route(
            "/repos/{owner}/{repo}/issues/{num}/comments",
            post(move || {
                let hit = c_hit.clone();
                async move {
                    hit.fetch_add(1, Ordering::SeqCst);
                    (StatusCode::CREATED, Json(serde_json::json!({"id": 101})))
                }
            }),
        );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let local_addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, mock_app).await.unwrap();
    });

    std::env::set_var("GITHUB_API_BASE_URL", format!("http://{}", local_addr));

    let mut ctx_val = (*create_test_context()).clone();
    ctx_val.config.github_token = Some("ghp_mock_token_123".to_string());
    let ctx = Arc::new(ctx_val);

    let claim_req = ClaimIssueRequest {
        contributor_name: "Mock Contributor".to_string(),
        github_handle: Some("@mockuser".to_string()),
        github_issue_number: Some(14),
        auto_sync_github: Some(true),
    };

    let result = claim_contributor_issue(
        State(ctx),
        Path("cf-issue-1".to_string()),
        Json(claim_req),
    )
    .await;

    std::env::remove_var("GITHUB_API_BASE_URL");

    assert!(result.is_ok());
    let (status, Json(claimed_issue)) = result.unwrap();
    assert_eq!(status, StatusCode::OK);
    assert!(claimed_issue.claimed);
    assert_eq!(claimed_issue.github_sync_status.as_deref(), Some("Synced"));
    assert!(claimed_issue.github_sync_message.unwrap().contains("claimed"));
    assert_eq!(labels_hit.load(Ordering::SeqCst), 1);
    assert_eq!(assignees_hit.load(Ordering::SeqCst), 1);
    assert_eq!(comments_hit.load(Ordering::SeqCst), 1);
}

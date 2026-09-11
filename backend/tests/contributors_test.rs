use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::contributors::{
    claim_contributor_issue, generate_all_contributors_pr, get_all_contributors,
    get_all_contributorsrc, get_contributing_guide, link_github_issue, list_contributor_issues,
    verify_contributor, ClaimIssueRequest, ContributorIssuesQuery,
    GenerateAllContributorsPrRequest, LinkGitHubIssueRequest, VerifyContributorRequest,
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
        metrics_debouncer: Arc::new(growthhack_backend::api::MetricsSyncDebouncer::default()),
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

    let result =
        claim_contributor_issue(State(ctx), Path("cf-issue-1".to_string()), Json(claim_req)).await;

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

    let result =
        claim_contributor_issue(State(ctx), Path("cf-issue-1".to_string()), Json(claim_req)).await;

    std::env::remove_var("GITHUB_API_BASE_URL");

    assert!(result.is_ok());
    let (status, Json(claimed_issue)) = result.unwrap();
    assert_eq!(status, StatusCode::OK);
    assert!(claimed_issue.claimed);
    assert_eq!(claimed_issue.github_sync_status.as_deref(), Some("Synced"));
    assert!(claimed_issue
        .github_sync_message
        .unwrap()
        .contains("claimed"));
    assert_eq!(labels_hit.load(Ordering::SeqCst), 1);
    assert_eq!(assignees_hit.load(Ordering::SeqCst), 1);
    assert_eq!(comments_hit.load(Ordering::SeqCst), 1);
}

#[tokio::test]
async fn test_get_all_contributorsrc_schema() {
    let ctx = create_test_context();
    let Json(resp) = get_all_contributorsrc(State(ctx)).await;

    assert_eq!(resp.config.project_name, "GrowthHack");
    assert_eq!(resp.config.project_owner, "SpaceCorps");
    assert_eq!(resp.config.repo_type, "github");
    assert_eq!(resp.config.repo_host, "https://github.com");
    assert!(resp.config.files.contains(&"README.md".to_string()));
    assert_eq!(resp.config.image_size, 100);
    assert_eq!(resp.config.contributors_per_line, 7);
    assert_eq!(resp.contributor_count, 5);

    let parsed: serde_json::Value =
        serde_json::from_str(&resp.content).expect("Failed to parse .all-contributorsrc json");
    assert_eq!(parsed["projectName"], "GrowthHack");
    assert_eq!(parsed["projectOwner"], "SpaceCorps");
    assert_eq!(parsed["repoType"], "github");
    assert_eq!(parsed["repoHost"], "https://github.com");
    assert_eq!(parsed["imageSize"], 100);
    assert_eq!(parsed["contributorsPerLine"], 7);
    assert!(parsed["contributors"].is_array());
    assert_eq!(parsed["contributors"].as_array().unwrap().len(), 5);

    let first_contributor = &parsed["contributors"][0];
    assert!(first_contributor["login"].is_string());
    assert!(first_contributor["name"].is_string());
    assert!(first_contributor["avatar_url"].is_string());
    assert!(first_contributor["profile"].is_string());
    assert!(first_contributor["contributions"].is_array());
}

#[tokio::test]
async fn test_verify_contributor_and_update_state() {
    let ctx = create_test_context();

    let req = VerifyContributorRequest {
        issue_id: Some("cf-issue-1".to_string()),
        contributor_name: "Community Champion".to_string(),
        github_handle: "@champ-dev".to_string(),
        contributions: vec!["code".to_string(), "test".to_string()],
        auto_generate_pr: Some(false),
    };

    let result = verify_contributor(State(ctx.clone()), Json(req)).await;
    assert!(result.is_ok());
    let Json(resp) = result.unwrap();

    assert!(resp.success);
    assert!(resp.contributor.verified);
    assert_eq!(resp.contributor.login.as_deref(), Some("champ-dev"));
    assert_eq!(resp.contributor.name, "Community Champion");
    assert!(resp.contributor.contributions.contains(&"code".to_string()));
    assert!(resp.contributor.contributions.contains(&"test".to_string()));

    let issue = resp.issue.expect("Expected updated issue in response");
    assert!(issue.claimed);
    assert_eq!(issue.claimed_by.as_deref(), Some("@champ-dev"));

    // Verify persisted state
    let state = ctx.state.read().await;
    let saved_c = state
        .contributors
        .iter()
        .find(|c| c.login.as_deref() == Some("champ-dev"))
        .expect("Contributor not saved in state");
    assert!(saved_c.verified);

    let saved_issue = state
        .contributor_issues
        .iter()
        .find(|i| i.id == "cf-issue-1")
        .expect("Issue not found in state");
    assert!(saved_issue.claimed);
    assert_eq!(saved_issue.claimed_by.as_deref(), Some("@champ-dev"));
}

#[tokio::test]
async fn test_generate_all_contributors_pr_payload() {
    let ctx = create_test_context();

    let req = GenerateAllContributorsPrRequest {
        github_handle: "@rocket-dev".to_string(),
        contributor_name: "Rocket Dev".to_string(),
        contributions: vec!["doc".to_string(), "review".to_string()],
        branch_name: Some("docs/add-rocket-dev".to_string()),
    };

    let result = generate_all_contributors_pr(State(ctx), Json(req)).await;
    assert!(result.is_ok());
    let Json(resp) = result.unwrap();

    assert_eq!(resp.branch_name, "docs/add-rocket-dev");
    assert_eq!(resp.file_path, ".all-contributorsrc");
    assert_eq!(
        resp.pr_title,
        "docs: update .all-contributorsrc for @rocket-dev"
    );
    assert!(resp.pr_body.contains("@rocket-dev"));
    assert!(resp.pr_body.contains("doc, review"));
    assert!(resp.file_content.contains("rocket-dev"));
    assert_eq!(resp.status, "generated");

    assert_eq!(resp.cli_commands.len(), 6);
    assert_eq!(resp.cli_commands[0], "git checkout -b docs/add-rocket-dev");
    assert!(resp.cli_commands[1].starts_with("cat << 'EOF' > .all-contributorsrc"));
    assert_eq!(resp.cli_commands[2], "git add .all-contributorsrc");
    assert!(resp.cli_commands[3]
        .contains("git commit -m \"docs: update .all-contributorsrc for @rocket-dev [skip ci]\""));
    assert_eq!(resp.cli_commands[4], "git push origin docs/add-rocket-dev");
    assert!(resp.cli_commands[5]
        .starts_with("gh pr create --title \"docs: update .all-contributorsrc for @rocket-dev\""));
}

#[tokio::test]
async fn test_remove_issue_label_client_mock() {
    use axum::routing::delete;
    use axum::Router;
    use growthhack_backend::api::submission::GitHubClient;

    let app = Router::new().route(
        "/repos/{owner}/{repo}/issues/{issue_number}/labels/{label}",
        delete(
            |axum::extract::Path((owner, repo, issue_number, label)): axum::extract::Path<(
                String,
                String,
                u64,
                String,
            )>| async move {
                assert_eq!(owner, "SpaceCorps");
                assert_eq!(repo, "GrowthHack");
                assert_eq!(issue_number, 42);
                assert_eq!(label, "claimed");
                StatusCode::NO_CONTENT
            },
        ),
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    let mock_url = format!("http://{}", addr);
    let client = GitHubClient::with_base_url("mock_token", &mock_url).unwrap();

    let res = client
        .remove_issue_label("SpaceCorps", "GrowthHack", 42, "claimed")
        .await;
    assert!(res.is_ok());
}

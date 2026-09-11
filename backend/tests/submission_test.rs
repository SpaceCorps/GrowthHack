use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::issues::AppContext;
use growthhack_backend::api::listings::submit_upstream;
use growthhack_backend::api::submission::{
    extract_github_repo, get_github_status, insert_listing_entry, parse_github_pr_url,
    PullRequestDetails,
};
use growthhack_backend::db::{GrowthState, Listing};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

fn create_test_context(token: Option<String>) -> Arc<AppContext> {
    let state = Arc::new(RwLock::new(GrowthState::seed_default()));
    let runner = AgentRunner::new(PathBuf::from("nonexistent_agy_binary_for_tests"));
    let task_manager = TaskManager::new(runner);
    let data_file = std::env::temp_dir().join(format!(
        "growth_data_sub_test_{}.json",
        uuid::Uuid::new_v4()
    ));
    let ivy_web_content_path =
        std::env::temp_dir().join(format!("growth_sub_ivy_web_test_{}", uuid::Uuid::new_v4()));
    let ivy_web_images_path = std::env::temp_dir().join(format!(
        "growth_sub_ivy_images_test_{}",
        uuid::Uuid::new_v4()
    ));

    let mut config = growthhack_backend::config::Config::load();
    config.github_token = token;

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

#[test]
fn test_extract_github_repo() {
    assert_eq!(
        extract_github_repo("https://github.com/spacecorps/growthhack"),
        Some(("spacecorps".to_string(), "growthhack".to_string()))
    );
    assert_eq!(
        extract_github_repo("https://github.com/spacecorps/growthhack/"),
        Some(("spacecorps".to_string(), "growthhack".to_string()))
    );
    assert_eq!(
        extract_github_repo("https://github.com/spacecorps/growthhack.git"),
        Some(("spacecorps".to_string(), "growthhack".to_string()))
    );
    assert_eq!(
        extract_github_repo("github.com/owner/repo"),
        Some(("owner".to_string(), "repo".to_string()))
    );
    assert_eq!(
        extract_github_repo("https://github.com/owner/repo/blob/main/README.md"),
        Some(("owner".to_string(), "repo".to_string()))
    );
    assert_eq!(extract_github_repo("https://gitlab.com/owner/repo"), None);
    assert_eq!(extract_github_repo("https://example.com"), None);
    assert_eq!(extract_github_repo(""), None);
}

#[test]
fn test_insert_listing_entry_alphabetical_placement() {
    let doc = r#"# Awesome AI

## AI Agents
- [AutoGPT](https://github.com/Significant-Gravitas/AutoGPT) - Autonomous GPT-4 experiment.
- [MetaGPT](https://github.com/geekan/MetaGPT) - Multi-agent framework.

## Developer Tools
- [Cursor](https://cursor.sh) - AI code editor.
"#;
    let entry = "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous multi-agent coding factory.";
    let result = insert_listing_entry(doc, entry, "Awesome Repo");

    assert!(result.contains("[Ivy-Tendril]"));
    let autogpt_pos = result.find("[AutoGPT]").unwrap();
    let tendril_pos = result.find("[Ivy-Tendril]").unwrap();
    let metagpt_pos = result.find("[MetaGPT]").unwrap();

    assert!(
        autogpt_pos < tendril_pos,
        "Ivy-Tendril should come after AutoGPT"
    );
    assert!(
        tendril_pos < metagpt_pos,
        "Ivy-Tendril should come before MetaGPT"
    );
}

#[test]
fn test_insert_listing_entry_fallback_and_no_duplication() {
    let doc = r#"# List of Cool Tools
Here is a list.

## Contributing
Submit PRs!
"#;
    let entry =
        "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent factory.";
    let res = insert_listing_entry(doc, entry, "Unknown");
    assert!(res.contains("[Ivy-Tendril]"));
    let tendril_pos = res.find("[Ivy-Tendril]").unwrap();
    let contrib_pos = res.find("## Contributing").unwrap();
    assert!(
        tendril_pos < contrib_pos,
        "Should insert before ## Contributing"
    );

    // Test duplicate prevention
    let second = insert_listing_entry(&res, entry, "Unknown");
    assert_eq!(res, second, "Should not duplicate entry if already present");
}

#[tokio::test]
async fn test_submission_endpoint_validation() {
    // 1. Context without GitHub token
    let ctx_no_token = create_test_context(None);

    // Test non-existent listing ID -> 404 Not Found
    let (code_not_found, _) = submit_upstream(
        Path("non-existent-id".to_string()),
        State(ctx_no_token.clone()),
    )
    .await;
    assert_eq!(code_not_found, StatusCode::NOT_FOUND);

    // Create a listing with non-github URL
    let non_github_listing = Listing {
        id: "list-non-gh".to_string(),
        name: "AlternativeTo".to_string(),
        category: "Dev Directory".to_string(),
        url: "https://alternativeto.net/software/cursor/".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "Blurb".to_string(),
        notes: "Notes".to_string(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    {
        let mut state = ctx_no_token.state.write().await;
        state.listings.push(non_github_listing);
    }

    // Test invalid URL (non-GitHub) -> 400 Bad Request
    let (code_bad_url, res) =
        submit_upstream(Path("list-non-gh".to_string()), State(ctx_no_token.clone())).await;
    assert_eq!(code_bad_url, StatusCode::BAD_REQUEST);
    assert!(res.message.contains("not a valid GitHub repository"));

    // Create a listing with valid GitHub URL
    let gh_listing = Listing {
        id: "list-gh-valid".to_string(),
        name: "awesome-agents".to_string(),
        category: "Awesome Repo".to_string(),
        url: "https://github.com/e2b-dev/awesome-ai-agents".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "Blurb".to_string(),
        notes: "Notes".to_string(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    {
        let mut state = ctx_no_token.state.write().await;
        state.listings.push(gh_listing);
    }

    // Test missing token -> 400 Bad Request
    let (code_no_token, res_token) = submit_upstream(
        Path("list-gh-valid".to_string()),
        State(ctx_no_token.clone()),
    )
    .await;
    assert_eq!(code_no_token, StatusCode::BAD_REQUEST);
    assert!(res_token.message.contains("GitHub token is not configured"));
}

#[tokio::test]
async fn test_get_github_status_endpoint_contract() {
    // 1. When unconfigured
    let ctx_no_token = create_test_context(None);
    let resp = get_github_status(State(ctx_no_token)).await.into_response();
    assert_eq!(resp.status(), StatusCode::OK);

    // 2. When configured in context
    let ctx_with_token = create_test_context(Some("ghp_dummy_token_for_tests".to_string()));
    assert_eq!(
        ctx_with_token.get_github_token(),
        Some("ghp_dummy_token_for_tests".to_string())
    );
}

#[test]
fn test_parse_github_pr_url() {
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo/pull/412"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo/pull/412/"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo/pull/412/files"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo/pull/412/commits"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo/pull/412?diff=unified"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo/pull/412#issuecomment-99"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("github.com/owner/repo/pull/412"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(
        parse_github_pr_url("https://github.com/owner/repo.git/pull/412"),
        Some(("owner".to_string(), "repo".to_string(), 412))
    );
    assert_eq!(parse_github_pr_url("https://gitlab.com/owner/repo/pull/412"), None);
    assert_eq!(parse_github_pr_url("https://github.com/owner/repo/issues/412"), None);
    assert_eq!(parse_github_pr_url("https://github.com/owner/repo/pull/notanumber"), None);
    assert_eq!(parse_github_pr_url("https://example.com"), None);
    assert_eq!(parse_github_pr_url(""), None);
}

#[test]
fn test_get_pull_request_details() {
    let open_json = serde_json::json!({
        "number": 42,
        "state": "open",
        "merged": false,
        "merged_at": null,
        "html_url": "https://github.com/owner/repo/pull/42"
    });
    let open_pr: PullRequestDetails = serde_json::from_value(open_json).unwrap();
    assert_eq!(open_pr.number, 42);
    assert_eq!(open_pr.state, "open");
    assert!(!open_pr.merged);
    assert!(open_pr.merged_at.is_none());

    let closed_json = serde_json::json!({
        "number": 43,
        "state": "closed",
        "merged": false,
        "merged_at": null,
        "html_url": "https://github.com/owner/repo/pull/43"
    });
    let closed_pr: PullRequestDetails = serde_json::from_value(closed_json).unwrap();
    assert_eq!(closed_pr.state, "closed");
    assert!(!closed_pr.merged);

    let merged_json = serde_json::json!({
        "number": 44,
        "state": "closed",
        "merged": true,
        "merged_at": "2026-09-11T05:00:00Z",
        "html_url": "https://github.com/owner/repo/pull/44"
    });
    let merged_pr: PullRequestDetails = serde_json::from_value(merged_json).unwrap();
    assert_eq!(merged_pr.state, "closed");
    assert!(merged_pr.merged);
    assert_eq!(merged_pr.merged_at.as_deref(), Some("2026-09-11T05:00:00Z"));
}

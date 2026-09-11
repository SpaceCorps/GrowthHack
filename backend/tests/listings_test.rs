mod common;

use axum::extract::{Path, State};
use axum::Json;
use growthhack_backend::api::listings::{
    build_pr_submission_prompt, build_tailored_prompt, check_backlink_content, create_listing,
    generate_batch_listings, list_listings, submit_listing_pr, update_listing, verify_backlink,
    CreateListingRequest, GenerateBatchRequest, UpdateListingRequest,
};
use growthhack_backend::db::{GrowthState, Listing};
use std::collections::HashSet;

#[tokio::test]
async fn test_seed_database_contains_50_plus_targets_across_5_categories() {
    let default_state = GrowthState::seed_default();
    assert!(
        default_state.listings.len() >= 50,
        "Expected at least 50 listings in seed_default, found {}",
        default_state.listings.len()
    );

    let categories: HashSet<String> = default_state
        .listings
        .iter()
        .map(|l| l.category.clone())
        .collect();

    assert!(categories.contains("Awesome Repo"), "Missing Awesome Repo category");
    assert!(categories.contains("Dev Directory"), "Missing Dev Directory category");
    assert!(categories.contains("Software Factory"), "Missing Software Factory category");
    assert!(categories.contains("Package Manager"), "Missing Package Manager category");
    assert!(categories.contains("Community"), "Missing Community category");
    assert_eq!(categories.len(), 5, "Expected exactly 5 categories");

    let awesome_count = default_state.listings.iter().filter(|l| l.category == "Awesome Repo").count();
    let directory_count = default_state.listings.iter().filter(|l| l.category == "Dev Directory").count();
    let factory_count = default_state.listings.iter().filter(|l| l.category == "Software Factory").count();
    let package_count = default_state.listings.iter().filter(|l| l.category == "Package Manager").count();
    let community_count = default_state.listings.iter().filter(|l| l.category == "Community").count();

    assert!(awesome_count >= 20, "Expected at least 20 Awesome Repos, found {}", awesome_count);
    assert!(directory_count >= 12, "Expected at least 12 Dev Directories, found {}", directory_count);
    assert!(factory_count >= 8, "Expected at least 8 Software Factories, found {}", factory_count);
    assert!(package_count >= 6, "Expected at least 6 Package Managers, found {}", package_count);
    assert!(community_count >= 6, "Expected at least 6 Community targets, found {}", community_count);
}

#[tokio::test]
async fn test_list_and_create_and_update_listing() {
    let ctx = common::create_test_context();

    // 1. List listings
    let Json(initial_listings) = list_listings(State(ctx.clone())).await;
    let initial_count = initial_listings.len();

    // 2. Create listing
    let new_req = CreateListingRequest {
        name: "test-awesome-list (testorg)".to_string(),
        category: "Awesome Repo".to_string(),
        url: "https://github.com/testorg/test-awesome-list".to_string(),
        submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Test blurb".to_string(),
        notes: "Test listing notes".to_string(),
        blurb_status: None,
    };

    let (status, Json(created)) = create_listing(State(ctx.clone()), Json(new_req)).await;
    assert_eq!(status, axum::http::StatusCode::CREATED);
    assert_eq!(created.name, "test-awesome-list (testorg)");
    assert_eq!(created.status, "Targeted");

    let created_id = created.id.clone();

    // 3. Verify listing added
    let Json(after_create) = list_listings(State(ctx.clone())).await;
    assert_eq!(after_create.len(), initial_count + 1);

    // 4. Update listing
    let update_req = UpdateListingRequest {
        status: Some("PR Submitted".to_string()),
        pr_url: Some("https://github.com/testorg/test-awesome-list/pull/1".to_string()),
        submission_blurb: Some("Updated blurb with checklist".to_string()),
        notes: Some("PR opened successfully".to_string()),
        blurb_status: None,
    };

    let (status, Json(updated_opt)) = update_listing(
        Path(created_id.clone()),
        State(ctx.clone()),
        Json(update_req),
    )
    .await;
    assert_eq!(status, axum::http::StatusCode::OK);
    let updated = updated_opt.expect("Listing should exist");
    assert_eq!(updated.status, "PR Submitted");
    assert_eq!(
        updated.pr_url,
        Some("https://github.com/testorg/test-awesome-list/pull/1".to_string())
    );
    assert_eq!(updated.submission_blurb, "Updated blurb with checklist");
    assert_eq!(updated.notes, "PR opened successfully");
}

#[test]
fn test_prompt_tailoring_across_categories() {
    let awesome_listing = Listing {
        id: "list-test-1".to_string(),
        name: "e2b-dev/awesome-ai-agents".to_string(),
        category: "Awesome Repo".to_string(),
        url: "https://github.com/e2b-dev/awesome-ai-agents".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: String::new(),
        notes: String::new(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    let awesome_prompt = build_tailored_prompt(&awesome_listing);
    assert!(awesome_prompt.contains("Markdown list entry"));
    assert!(awesome_prompt.contains("Alphabetical ordering compliance checklist"));

    let directory_listing = Listing {
        id: "list-test-2".to_string(),
        name: "AlternativeTo".to_string(),
        category: "Dev Directory".to_string(),
        url: "https://alternativeto.net/software/cursor/".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: String::new(),
        notes: String::new(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    let dir_prompt = build_tailored_prompt(&directory_listing);
    assert!(dir_prompt.contains("Alternative To"));
    assert!(dir_prompt.contains("Cursor, Devin, Cline, and CodeRabbit"));

    let factory_listing = Listing {
        id: "list-test-3".to_string(),
        name: "SWE-bench Registry".to_string(),
        category: "Software Factory".to_string(),
        url: "https://www.swebench.com/".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: String::new(),
        notes: String::new(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    let factory_prompt = build_tailored_prompt(&factory_listing);
    assert!(factory_prompt.contains("multi-agent orchestration"));
    assert!(factory_prompt.contains("Git worktree sandboxing"));

    let package_listing = Listing {
        id: "list-test-4".to_string(),
        name: "Homebrew Core".to_string(),
        category: "Package Manager".to_string(),
        url: "https://github.com/Homebrew/homebrew-core".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: String::new(),
        notes: String::new(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    let pkg_prompt = build_tailored_prompt(&package_listing);
    assert!(pkg_prompt.contains("Command-line installation snippets"));
    assert!(pkg_prompt.contains("tendril --version"));

    let community_listing = Listing {
        id: "list-test-5".to_string(),
        name: "Reddit r/LocalLLaMA".to_string(),
        category: "Community".to_string(),
        url: "https://reddit.com/r/LocalLLaMA".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: String::new(),
        notes: String::new(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    let comm_prompt = build_tailored_prompt(&community_listing);
    assert!(comm_prompt.contains("community announcement and tool showcase"));
    assert!(comm_prompt.contains("Git worktrees"));
}

#[tokio::test]
async fn test_generate_batch_listings_endpoint() {
    let ctx = common::create_test_context();

    // Filter by category
    let batch_req = GenerateBatchRequest {
        listing_ids: None,
        category: Some("Package Manager".to_string()),
        limit: Some(3),
    };

    let (status, Json(resp)) = generate_batch_listings(State(ctx.clone()), Json(batch_req)).await;
    assert_eq!(status, axum::http::StatusCode::ACCEPTED);
    assert_eq!(resp.targeted_count, 3);
    assert_eq!(resp.task_ids.len(), 3);
}

#[tokio::test]
async fn test_backlink_verification_logic_and_endpoint() {
    // 1. Content check unit test
    assert!(check_backlink_content("Here is a link to https://github.com/Ivy-Interactive/Ivy-Tendril for multi-agent coding."));
    assert!(check_backlink_content("- [Ivy-Tendril](https://tendril.dev) - Agent sandbox"));
    assert!(check_backlink_content("We recommend tendril for workflow orchestration."));
    assert!(!check_backlink_content("This page only discusses Cursor and Copilot without any references."));

    // 2. Mock web server for verify_backlink endpoint
    use axum::routing::get;
    let mock_app = axum::Router::new().route(
        "/awesome-page",
        get(|| async {
            "<html><body><h1>Awesome Agents</h1><p>Check out - [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril)</p></body></html>"
        }),
    );

    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move {
        axum::serve(listener, mock_app).await.unwrap();
    });

    let ctx = common::create_test_context();
    let test_listing = Listing {
        id: "list-verify-test".to_string(),
        name: "Mock Awesome List".to_string(),
        category: "Awesome Repo".to_string(),
        url: format!("http://127.0.0.1:{}/awesome-page", addr.port()),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "- [Ivy-Tendril](...)".to_string(),
        notes: "Verification test".to_string(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };

    {
        let mut state = ctx.state.write().await;
        state.listings.push(test_listing);
    }

    let (status, Json(resp)) = verify_backlink(Path("list-verify-test".to_string()), State(ctx.clone())).await;
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(resp.verified, "Backlink should be verified");
    assert_eq!(resp.status, "Live", "Status should transition to Live");

    // Verify persisted state
    let state = ctx.state.read().await;
    let verified_listing = state.listings.iter().find(|l| l.id == "list-verify-test").unwrap();
    assert_eq!(verified_listing.status, "Live");
}

#[tokio::test]
async fn test_submit_listing_pr_promotes_status_and_spawns_task() {
    let ctx = common::create_test_context();

    let listing_id = "list-test-pr-submit".to_string();
    let old_time = chrono::Utc::now() - chrono::Duration::hours(2);
    let test_listing = Listing {
        id: listing_id.clone(),
        name: "test-awesome-agents (e2b-dev)".to_string(),
        category: "Awesome Repo".to_string(),
        url: "https://github.com/e2b-dev/awesome-ai-agents".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Multi-agent factory.".to_string(),
        notes: "Test notes".to_string(),
        blurb_status: Some("Approved".to_string()),
        updated_at: old_time,
    };

    {
        let mut state = ctx.state.write().await;
        state.listings.push(test_listing);
    }

    let (status, Json(resp)) = submit_listing_pr(Path(listing_id.clone()), State(ctx.clone())).await;
    assert_eq!(status, axum::http::StatusCode::ACCEPTED);
    assert!(!resp.task_id.is_empty());
    assert!(resp.task_id.starts_with("task-pr-"));
    assert!(resp.message.contains("test-awesome-agents (e2b-dev)"));

    // Verify status was promoted to "PR Submitted" and updated_at was updated
    let state = ctx.state.read().await;
    let updated = state.listings.iter().find(|l| l.id == listing_id).unwrap();
    assert_eq!(updated.status, "PR Submitted");
    assert!(updated.updated_at > old_time);
}

#[tokio::test]
async fn test_pr_submission_prompt_tailoring() {
    let listing = Listing {
        id: "list-prompt-test".to_string(),
        name: "frenck/awesome-devtools".to_string(),
        category: "Awesome Repo".to_string(),
        url: "https://github.com/frenck/awesome-devtools".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Parallel dev agents.".to_string(),
        notes: "Devtools list".to_string(),
        blurb_status: Some("Approved".to_string()),
        updated_at: chrono::Utc::now(),
    };

    let prompt = build_pr_submission_prompt(&listing);
    assert!(prompt.contains("Target Repository: frenck/awesome-devtools"));
    assert!(prompt.contains("URL: https://github.com/frenck/awesome-devtools"));
    assert!(prompt.contains("Category: Awesome Repo"));
    assert!(prompt.contains("Approved Submission Blurb:"));
    assert!(prompt.contains("- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Parallel dev agents."));
    assert!(prompt.contains("gh pr create"));

    // Test with empty blurb fallback
    let empty_blurb_listing = Listing {
        id: "list-prompt-empty".to_string(),
        name: "test/empty-repo".to_string(),
        category: "Dev Directory".to_string(),
        url: "https://example.com".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "   ".to_string(),
        notes: "".to_string(),
        blurb_status: None,
        updated_at: chrono::Utc::now(),
    };
    let empty_prompt = build_pr_submission_prompt(&empty_blurb_listing);
    assert!(empty_prompt.contains("No custom blurb provided. Use standard Ivy-Tendril submission entry."));
}

#[tokio::test]
async fn test_update_listing_resets_blurb_status_on_text_change() {
    let ctx = common::create_test_context();
    let test_listing = Listing {
        id: "list-reset-test".to_string(),
        name: "Test Reset List".to_string(),
        category: "Awesome Repo".to_string(),
        url: "https://github.com/testorg/reset-test".to_string(),
        status: "Targeted".to_string(),
        pr_url: None,
        submission_blurb: "Initial blurb".to_string(),
        notes: "Initial notes".to_string(),
        blurb_status: Some("Approved".to_string()),
        updated_at: chrono::Utc::now(),
    };

    {
        let mut state = ctx.state.write().await;
        state.listings.push(test_listing);
    }

    // Case 1: Updating submission_blurb on an Approved listing without blurb_status automatically resets blurb_status to Pending
    let update_req = UpdateListingRequest {
        status: None,
        pr_url: None,
        submission_blurb: Some("Modified blurb text".to_string()),
        notes: None,
        blurb_status: None,
    };
    let (status, Json(updated_opt)) = update_listing(
        Path("list-reset-test".to_string()),
        State(ctx.clone()),
        Json(update_req),
    )
    .await;
    assert_eq!(status, axum::http::StatusCode::OK);
    let updated = updated_opt.expect("Listing should exist");
    assert_eq!(updated.submission_blurb, "Modified blurb text");
    assert_eq!(updated.blurb_status, Some("Pending".to_string()));

    // Case 2: Updating submission_blurb with explicit blurb_status (e.g. "Approved") preserves the explicit status
    let update_req_explicit = UpdateListingRequest {
        status: None,
        pr_url: None,
        submission_blurb: Some("Another modification".to_string()),
        notes: None,
        blurb_status: Some("Approved".to_string()),
    };
    let (status, Json(updated_opt)) = update_listing(
        Path("list-reset-test".to_string()),
        State(ctx.clone()),
        Json(update_req_explicit),
    )
    .await;
    assert_eq!(status, axum::http::StatusCode::OK);
    let updated = updated_opt.expect("Listing should exist");
    assert_eq!(updated.submission_blurb, "Another modification");
    assert_eq!(updated.blurb_status, Some("Approved".to_string()));

    // Case 3: Updating non-blurb fields without touching submission_blurb preserves existing blurb_status
    let update_req_non_blurb = UpdateListingRequest {
        status: Some("PR Submitted".to_string()),
        pr_url: None,
        submission_blurb: None,
        notes: Some("Updated notes only".to_string()),
        blurb_status: None,
    };
    let (status, Json(updated_opt)) = update_listing(
        Path("list-reset-test".to_string()),
        State(ctx.clone()),
        Json(update_req_non_blurb),
    )
    .await;
    assert_eq!(status, axum::http::StatusCode::OK);
    let updated = updated_opt.expect("Listing should exist");
    assert_eq!(updated.status, "PR Submitted");
    assert_eq!(updated.notes, "Updated notes only");
    assert_eq!(updated.blurb_status, Some("Approved".to_string()));

    // Case 4: Submitting identical submission_blurb without blurb_status preserves existing blurb_status
    let update_req_same_blurb = UpdateListingRequest {
        status: None,
        pr_url: None,
        submission_blurb: Some("Another modification".to_string()),
        notes: None,
        blurb_status: None,
    };
    let (status, Json(updated_opt)) = update_listing(
        Path("list-reset-test".to_string()),
        State(ctx.clone()),
        Json(update_req_same_blurb),
    )
    .await;
    assert_eq!(status, axum::http::StatusCode::OK);
    let updated = updated_opt.expect("Listing should exist");
    assert_eq!(updated.blurb_status, Some("Approved".to_string()));

    // Case 5: Empty/whitespace blurb resets blurb_status to None
    let update_req_empty = UpdateListingRequest {
        status: None,
        pr_url: None,
        submission_blurb: Some("   ".to_string()),
        notes: None,
        blurb_status: None,
    };
    let (status, Json(updated_opt)) = update_listing(
        Path("list-reset-test".to_string()),
        State(ctx.clone()),
        Json(update_req_empty),
    )
    .await;
    assert_eq!(status, axum::http::StatusCode::OK);
    let updated = updated_opt.expect("Listing should exist");
    assert_eq!(updated.blurb_status, None);
}

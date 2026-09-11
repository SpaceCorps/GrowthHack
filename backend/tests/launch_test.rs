use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::issues::AppContext;
use growthhack_backend::api::launch::{
    analyze_show_hn, evaluate_authenticity, get_launch_overview, reset_launch_campaign,
    toggle_syndication_checklist, toggle_timeline_task, update_beta_tester, AnalyzeShowHnRequest,
    ToggleChecklistRequest, ToggleTimelineTaskRequest, UpdateBetaTesterRequest,
};
use growthhack_backend::db::GrowthState;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

fn create_test_context() -> Arc<AppContext> {
    let state = Arc::new(RwLock::new(GrowthState::seed_default()));
    let runner = AgentRunner::new(PathBuf::from("nonexistent_agy_binary_for_tests"));
    let task_manager = TaskManager::new(runner);
    let data_file =
        std::env::temp_dir().join(format!("growth_data_launch_test_{}.json", uuid::Uuid::new_v4()));
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
async fn test_get_launch_overview_seeded_defaults() {
    let ctx = create_test_context();
    let Json(campaign) = get_launch_overview(State(ctx)).await;

    // Verify all 7 timeline phases
    assert_eq!(campaign.timeline.len(), 7, "Expected exactly 7 timeline phases");
    let phase_ids: Vec<&str> = campaign.timeline.iter().map(|p| p.id.as_str()).collect();
    assert!(phase_ids.contains(&"phase-t48"));
    assert!(phase_ids.contains(&"phase-t24"));
    assert!(phase_ids.contains(&"phase-t0"));
    assert!(phase_ids.contains(&"phase-tp2"));
    assert!(phase_ids.contains(&"phase-tp6"));
    assert!(phase_ids.contains(&"phase-tp24"));
    assert!(phase_ids.contains(&"phase-tp48"));

    // Verify exactly 20 beta testers
    assert_eq!(campaign.beta_testers.len(), 20, "Expected exactly 20 beta testers");
    let committed_testers = campaign
        .beta_testers
        .iter()
        .filter(|t| t.outreach_status == "Committed")
        .count();
    assert!(committed_testers > 0, "Expected at least one committed beta tester");

    // Verify syndication checklist items
    assert_eq!(campaign.syndication_checklist.len(), 5, "Expected 5 syndication checklist items");
    let platforms: Vec<&str> = campaign
        .syndication_checklist
        .iter()
        .map(|item| item.platform.as_str())
        .collect();
    assert!(platforms.contains(&"Reddit"));
    assert!(platforms.contains(&"Twitter/X"));
    assert!(platforms.contains(&"TLDR"));
    assert!(platforms.contains(&"Console.dev"));
    assert!(platforms.contains(&"Changelog"));
}

#[tokio::test]
async fn test_show_hn_authenticity_analyzer_high_score() {
    let title = "Show HN: Ivy-Tendril – Autonomous coding agents in isolated git worktrees with verification gates";
    let comment = "Hi HN! We built Ivy-Tendril because running autonomous coding agents directly in shared working copies triggers merge collisions, git index locks, and context drift.\n\nTendril provisions an ephemeral, isolated Git worktree for every agent task, runs strict verification test gates (build, clippy, unit tests) before creating pull requests, and orchestrates Claude Code, Codex, and Gemini CLI in parallel.\n\nEverything is open source Rust (Axum/Tokio) and React 19. Would love your brutal feedback on our worktree isolation architecture and benchmark reproducible results!\n\nRepo: https://github.com/Ivy-Interactive/Ivy-Tendril";

    let analysis = evaluate_authenticity(title, comment);

    assert!(
        analysis.score >= 85,
        "Expected score >= 85, received {}",
        analysis.score
    );
    assert!(
        analysis.penalty_reasons.is_empty(),
        "Expected no penalty reasons for authentic post, got: {:?}",
        analysis.penalty_reasons
    );
    assert!(
        !analysis.keyword_matches.is_empty(),
        "Expected matched technical keywords"
    );
    assert_eq!(analysis.rating, "Authentic & Technical (High HN Alignment)");

    // Test through HTTP handler as well
    let req = AnalyzeShowHnRequest {
        title: title.to_string(),
        maker_comment: comment.to_string(),
    };
    let Json(api_analysis) = analyze_show_hn(Json(req)).await;
    assert_eq!(api_analysis.score, analysis.score);
}

#[tokio::test]
async fn test_show_hn_authenticity_analyzer_penalty_buzzwords() {
    let title = "Show HN: Revolutionary world's first ultimate AI coding magic";
    let comment = "Our game-changer tool will disrupt software engineering with effortless magic!";

    let analysis = evaluate_authenticity(title, comment);

    assert!(
        !analysis.penalty_reasons.is_empty(),
        "Expected penalty reasons for hype buzzwords"
    );
    assert!(
        analysis.score < 70,
        "Expected reduced score for hype-filled post, got {}",
        analysis.score
    );

    let penalties_joined = analysis.penalty_reasons.join(" ");
    assert!(penalties_joined.contains("revolutionary"));
    assert!(penalties_joined.contains("world's first"));
    assert!(penalties_joined.contains("ultimate"));
}

#[tokio::test]
async fn test_update_beta_tester_outreach_status() {
    let ctx = create_test_context();

    // Pick tester-11 who is seeded as "Identified"
    let update_req = UpdateBetaTesterRequest {
        outreach_status: Some("Committed".to_string()),
        notes: Some("Confirmed launch day participation on Discord.".to_string()),
        handle: Some("@mayap_committed".to_string()),
        ..Default::default()
    };

    let (status, Json(updated)) = update_beta_tester(
        State(ctx.clone()),
        Path("tester-11".to_string()),
        Json(update_req),
    )
    .await
    .expect("Expected successful update");

    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated.id, "tester-11");
    assert_eq!(updated.outreach_status, "Committed");
    assert_eq!(updated.handle, "@mayap_committed");
    assert_eq!(
        updated.notes,
        "Confirmed launch day participation on Discord."
    );

    // Verify persistence in shared state
    {
        let state = ctx.state.read().await;
        let persisted_tester = state
            .launch_campaign
            .as_ref()
            .unwrap()
            .beta_testers
            .iter()
            .find(|t| t.id == "tester-11")
            .expect("tester-11 should be in state");
        assert_eq!(persisted_tester.outreach_status, "Committed");
        assert_eq!(persisted_tester.handle, "@mayap_committed");
    }

    // Verify 404 on non-existent tester
    let not_found_result = update_beta_tester(
        State(ctx.clone()),
        Path("nonexistent-tester".to_string()),
        Json(UpdateBetaTesterRequest::default()),
    )
    .await;
    assert!(not_found_result.is_err());
    let (err_status, _) = not_found_result.unwrap_err();
    assert_eq!(err_status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_toggle_syndication_checklist_item() {
    let ctx = create_test_context();

    // Initially syn-reddit is false
    let (status, Json(updated)) = toggle_syndication_checklist(
        State(ctx.clone()),
        Path("syn-reddit".to_string()),
        Some(Json(ToggleChecklistRequest {
            completed: Some(true),
        })),
    )
    .await
    .expect("Expected successful checklist toggle");

    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated.id, "syn-reddit");
    assert!(updated.completed, "Item should be completed");

    // Toggle again without payload (flip to false)
    let (status2, Json(updated2)) = toggle_syndication_checklist(
        State(ctx.clone()),
        Path("syn-reddit".to_string()),
        None,
    )
    .await
    .expect("Expected successful checklist toggle flip");

    assert_eq!(status2, StatusCode::OK);
    assert!(!updated2.completed, "Item should be flipped to false");

    // Verify state persistence
    let state = ctx.state.read().await;
    let persisted_item = state
        .launch_campaign
        .as_ref()
        .unwrap()
        .syndication_checklist
        .iter()
        .find(|i| i.id == "syn-reddit")
        .expect("syn-reddit should exist in state");
    assert!(!persisted_item.completed);
}

#[tokio::test]
async fn test_toggle_timeline_task() {
    let ctx = create_test_context();

    // Toggle task-t48-3 in phase-t48 (initially false)
    let (status, Json(updated_task)) = toggle_timeline_task(
        State(ctx.clone()),
        Path(("phase-t48".to_string(), "task-t48-3".to_string())),
        Some(Json(ToggleTimelineTaskRequest {
            completed: Some(true),
        })),
    )
    .await
    .expect("Expected successful timeline task toggle");

    assert_eq!(status, StatusCode::OK);
    assert_eq!(updated_task.id, "task-t48-3");
    assert!(updated_task.completed);

    // Verify state persistence
    {
        let state = ctx.state.read().await;
        let phase = state
            .launch_campaign
            .as_ref()
            .unwrap()
            .timeline
            .iter()
            .find(|p| p.id == "phase-t48")
            .expect("phase-t48 should exist");
        let task = phase
            .tasks
            .iter()
            .find(|t| t.id == "task-t48-3")
            .expect("task-t48-3 should exist");
        assert!(task.completed);
    }

    // Test reset campaign
    let Json(reset_campaign) = reset_launch_campaign(State(ctx.clone())).await;
    let reset_phase = reset_campaign
        .timeline
        .iter()
        .find(|p| p.id == "phase-t48")
        .unwrap();
    let reset_task = reset_phase
        .tasks
        .iter()
        .find(|t| t.id == "task-t48-3")
        .unwrap();
    assert!(!reset_task.completed, "Task should be reset to default false");
}

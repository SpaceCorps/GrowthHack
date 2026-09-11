use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::{self, AppContext};
use growthhack_backend::db::GrowthState;
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceExt;

fn create_test_context() -> (Arc<AppContext>, std::path::PathBuf) {
    let temp_dir = std::env::temp_dir();
    let file_id = uuid::Uuid::new_v4().simple().to_string();
    let data_file = temp_dir.join(format!("test_growth_data_{}.json", file_id));

    let state = GrowthState::seed_default();
    let _ = state.save(&data_file);

    let state_arc = Arc::new(RwLock::new(state));
    let runner = AgentRunner::new(std::path::PathBuf::from("agy"));
    let task_manager = TaskManager::new(runner);

    let ctx = Arc::new(AppContext {
        state: state_arc,
        task_manager,
        data_file: data_file.clone(),
        ivy_web_content_path: temp_dir.clone(),
        ivy_web_images_path: temp_dir.clone(),
        config: growthhack_backend::config::Config::load(),
    });

    (ctx, data_file)
}

#[tokio::test]
async fn test_doctor_diagnose_endpoint() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/doctor/diagnose")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let report: Value = serde_json::from_slice(&body).unwrap();

    assert!(report.get("checks").is_some());
    let checks = report["checks"].as_array().unwrap();
    assert!(checks.len() >= 8);

    // Verify summary
    assert!(report.get("summary").is_some());
    assert_eq!(
        report["summary"]["total"].as_u64().unwrap(),
        checks.len() as u64
    );

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_doctor_fix_endpoint() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/doctor/fix")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    r#"{"check_ids": ["key_anthropic", "key_gemini"]}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let report: Value = serde_json::from_slice(&body).unwrap();

    let checks = report["checks"].as_array().unwrap();
    let anthropic_check = checks.iter().find(|c| c["id"] == "key_anthropic");
    assert!(anthropic_check.is_some());
    assert_eq!(anthropic_check.unwrap()["status"], "Pass");

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_demo_scenarios_and_start() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    // 1. Verify GET /api/demo/scenarios
    let scenarios_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(scenarios_res.status(), StatusCode::OK);
    let body = to_bytes(scenarios_res.into_body(), usize::MAX)
        .await
        .unwrap();
    let scenarios: Value = serde_json::from_slice(&body).unwrap();
    assert!(scenarios.as_array().unwrap().len() >= 3);

    // 2. Start demo with high speed multiplier so background execution runs fast
    let start_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/start")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    r#"{"scenario_id": "scenario-health-check", "speed_multiplier": 100.0}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(start_res.status(), StatusCode::OK);
    let start_body = to_bytes(start_res.into_body(), usize::MAX).await.unwrap();
    let start_state: Value = serde_json::from_slice(&start_body).unwrap();
    assert_eq!(start_state["status"], "Running");
    assert_eq!(start_state["current_step"], 1);

    // Wait 100ms for fast background steps to complete
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // Verify GET /api/demo/status
    let status_res = app
        .oneshot(
            Request::builder()
                .uri("/api/demo/status")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(status_res.status(), StatusCode::OK);
    let status_body = to_bytes(status_res.into_body(), usize::MAX).await.unwrap();
    let final_state: Value = serde_json::from_slice(&status_body).unwrap();
    assert_eq!(final_state["status"], "Completed");
    assert_eq!(final_state["current_step"], 4);
    assert!(final_state["diff_preview"].as_str().is_some());

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_demo_metrics_and_persistence() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx.clone());

    // 1. Check initial metrics
    let metrics_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/metrics")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(metrics_res.status(), StatusCode::OK);

    // 2. Star click
    let star_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/star-click")
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(star_res.status(), StatusCode::OK);
    let star_body = to_bytes(star_res.into_body(), usize::MAX).await.unwrap();
    let updated_metrics: Value = serde_json::from_slice(&star_body).unwrap();
    assert_eq!(updated_metrics["github_starred"], true);

    // Verify persisted on disk
    let file_content = std::fs::read_to_string(&data_file).unwrap();
    let disk_state: Value = serde_json::from_str(&file_content).unwrap();
    assert_eq!(disk_state["onboarding_metrics"]["github_starred"], true);

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_demo_sse_streaming() {
    use futures_util::StreamExt;

    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx.clone());

    let task_id = "test-stream-123";
    let tx = ctx.task_manager.get_or_create_channel(task_id).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/demo/stream/{}", task_id))
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|h| h.to_str().ok()),
        Some("text/event-stream")
    );

    let mut stream = response.into_body().into_data_stream();

    // Broadcast a test log line
    let test_msg = "[00:12] Step 2/4 (Worktree): Creating isolated git worktree at 'Worktrees/spacecorps/growthhack'...";
    let _ = tx.send(test_msg.to_string());

    if let Some(Ok(chunk)) = stream.next().await {
        let chunk_str = String::from_utf8_lossy(&chunk);
        assert!(chunk_str.contains("data:"));
        assert!(chunk_str.contains(test_msg));
    } else {
        panic!("Expected SSE chunk from stream");
    }

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_demo_scenarios_crud() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx.clone());

    // 1. GET /api/demo/scenarios
    let list_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(list_res.status(), StatusCode::OK);
    let list_body = to_bytes(list_res.into_body(), usize::MAX).await.unwrap();
    let scenarios: Value = serde_json::from_slice(&list_body).unwrap();
    assert!(scenarios.as_array().unwrap().len() >= 3);

    // 2. POST /api/demo/scenarios (create new custom scenario)
    let create_payload = serde_json::json!({
        "id": "scenario-custom-auth",
        "title": "Add OAuth2 authentication provider",
        "description": "Custom scenario for OAuth2 integration",
        "target_branch": "master",
        "estimated_duration_sec": 25,
        "diff_preview": "diff --git a/auth.rs b/auth.rs\n+pub fn oauth() {}",
        "pr_summary": "PR summary for OAuth2"
    });

    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(create_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_res.status(), StatusCode::CREATED);
    let create_body = to_bytes(create_res.into_body(), usize::MAX).await.unwrap();
    let created_val: Value = serde_json::from_slice(&create_body).unwrap();
    assert_eq!(created_val["id"], "scenario-custom-auth");

    // Verify persisted on disk
    let disk_content = std::fs::read_to_string(&data_file).unwrap();
    let disk_state: Value = serde_json::from_str(&disk_content).unwrap();
    assert!(disk_state["demo_scenarios"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["id"] == "scenario-custom-auth"));

    // 3. GET /api/demo/scenarios/{id}
    let get_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios/scenario-custom-auth")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_res.status(), StatusCode::OK);
    let get_body = to_bytes(get_res.into_body(), usize::MAX).await.unwrap();
    let fetched: Value = serde_json::from_slice(&get_body).unwrap();
    assert_eq!(fetched["title"], "Add OAuth2 authentication provider");

    // 4. PUT /api/demo/scenarios/{id}
    let update_payload = serde_json::json!({
        "title": "Updated OAuth2 Provider",
        "estimated_duration_sec": 30
    });
    let update_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios/scenario-custom-auth")
                .method("PUT")
                .header("Content-Type", "application/json")
                .body(Body::from(update_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(update_res.status(), StatusCode::OK);
    let update_body = to_bytes(update_res.into_body(), usize::MAX).await.unwrap();
    let updated: Value = serde_json::from_slice(&update_body).unwrap();
    assert_eq!(updated["title"], "Updated OAuth2 Provider");
    assert_eq!(updated["estimated_duration_sec"], 30);

    // Verify disk updated
    let disk_content2 = std::fs::read_to_string(&data_file).unwrap();
    let disk_state2: Value = serde_json::from_str(&disk_content2).unwrap();
    let disk_sc = disk_state2["demo_scenarios"]
        .as_array()
        .unwrap()
        .iter()
        .find(|s| s["id"] == "scenario-custom-auth")
        .unwrap();
    assert_eq!(disk_sc["title"], "Updated OAuth2 Provider");

    // 5. DELETE /api/demo/scenarios/{id}
    let delete_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios/scenario-custom-auth")
                .method("DELETE")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(delete_res.status(), StatusCode::OK);

    // Verify removed from disk
    let disk_content3 = std::fs::read_to_string(&data_file).unwrap();
    let disk_state3: Value = serde_json::from_str(&disk_content3).unwrap();
    assert!(!disk_state3["demo_scenarios"]
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["id"] == "scenario-custom-auth"));

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_demo_start_with_custom_scenario() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx.clone());

    // 1. Create custom scenario
    let create_payload = serde_json::json!({
        "id": "scenario-custom-payments",
        "title": "Implement Stripe payment webhook verification",
        "description": "Simulates webhook signing secret validation",
        "target_branch": "master",
        "estimated_duration_sec": 12,
        "diff_preview": "diff --git a/payments.rs b/payments.rs\n+pub fn verify_signature() -> bool { true }",
        "pr_summary": "# PR: Stripe Webhooks\n\nVerified signature parser."
    });

    let create_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(create_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(create_res.status(), StatusCode::CREATED);

    // 2. Start demo with custom scenario
    let start_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/start")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    r#"{"scenario_id": "scenario-custom-payments", "speed_multiplier": 100.0}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(start_res.status(), StatusCode::OK);

    // Wait for fast simulation steps to finish
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;

    // 3. Verify status has custom diff and PR summary
    let status_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/status")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(status_res.status(), StatusCode::OK);
    let status_body = to_bytes(status_res.into_body(), usize::MAX).await.unwrap();
    let status_val: Value = serde_json::from_slice(&status_body).unwrap();
    assert_eq!(status_val["status"], "Completed");
    assert!(status_val["diff_preview"]
        .as_str()
        .unwrap()
        .contains("verify_signature"));
    assert!(status_val["pr_summary"]
        .as_str()
        .unwrap()
        .contains("Stripe Webhooks"));

    // 4. Verify /api/demo/diff with scenario_id query
    let diff_res = app
        .oneshot(
            Request::builder()
                .uri("/api/demo/diff?scenario_id=scenario-custom-payments")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(diff_res.status(), StatusCode::OK);
    let diff_body = to_bytes(diff_res.into_body(), usize::MAX).await.unwrap();
    let diff_val: Value = serde_json::from_slice(&diff_body).unwrap();
    assert_eq!(diff_val["scenario_id"], "scenario-custom-payments");
    assert!(diff_val["diff"]
        .as_str()
        .unwrap()
        .contains("verify_signature"));

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_demo_scenarios_reset() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx.clone());

    // 1. Add extra scenario
    let create_payload = serde_json::json!({
        "id": "scenario-to-be-reset",
        "title": "Temporary scenario",
        "description": "Temporary description",
        "target_branch": "master",
        "estimated_duration_sec": 10
    });
    let _ = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(create_payload.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();

    // Verify 4 scenarios present
    let list_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let list_body = to_bytes(list_res.into_body(), usize::MAX).await.unwrap();
    let scenarios: Value = serde_json::from_slice(&list_body).unwrap();
    assert_eq!(scenarios.as_array().unwrap().len(), 4);

    // 2. Call POST /api/demo/scenarios/reset
    let reset_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios/reset")
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reset_res.status(), StatusCode::OK);

    // Verify back to 3 seed scenarios
    let list_res2 = app
        .oneshot(
            Request::builder()
                .uri("/api/demo/scenarios")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    let list_body2 = to_bytes(list_res2.into_body(), usize::MAX).await.unwrap();
    let scenarios2: Value = serde_json::from_slice(&list_body2).unwrap();
    assert_eq!(scenarios2.as_array().unwrap().len(), 3);
    assert!(!scenarios2
        .as_array()
        .unwrap()
        .iter()
        .any(|s| s["id"] == "scenario-to-be-reset"));

    let _ = std::fs::remove_file(data_file);
}

mod common;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::api;
use serde_json::Value;
use tower::ServiceExt;


#[tokio::test]
async fn test_doctor_diagnose_endpoint() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

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

}

#[tokio::test]
async fn test_doctor_fix_endpoint() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

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
}

#[tokio::test]
async fn test_demo_scenarios_and_start() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

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
}

#[tokio::test]
async fn test_demo_metrics_and_persistence() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

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
    let file_content = std::fs::read_to_string(guard.data_file()).unwrap();
    let disk_state: Value = serde_json::from_str(&file_content).unwrap();
    assert_eq!(disk_state["onboarding_metrics"]["github_starred"], true);
}

#[tokio::test]
async fn test_demo_sse_streaming() {
    use futures_util::StreamExt;

    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let task_id = "test-stream-123";
    let tx = guard.task_manager.get_or_create_channel(task_id).await;

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
}

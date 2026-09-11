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
    let data_file = temp_dir.join(format!("test_growth_data_pg_{}.json", file_id));

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
        rate_limiter: Arc::new(
            growthhack_backend::api::middleware::rate_limit::IpRateLimiter::default(),
        ),
    });

    (ctx, data_file)
}

#[tokio::test]
async fn test_list_scenarios() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/playground/scenarios")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let scenarios: Value = serde_json::from_slice(&body).unwrap();
    let list = scenarios.as_array().unwrap();
    assert!(list.len() >= 3);

    let first = &list[0];
    assert!(first["id"].is_string());
    assert!(first["title"].is_string());
    assert!(first["file_tree"].is_array());
    assert!(first["diff"].is_string());
    assert!(first["pr_summary"].is_string());

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_import_custom_issue() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let payload = serde_json::json!({
        "issue_url": "https://github.com/Ivy-Interactive/Ivy-Tendril/issues/42",
        "title": "Add Prometheus metrics endpoint",
        "description": "Export runtime agent statistics to Prometheus scraper"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/playground/import-issue")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let scenario: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(scenario["title"], "Add Prometheus metrics endpoint");
    assert!(scenario["id"].as_str().unwrap().starts_with("custom-"));
    assert!(scenario["diff"].as_str().unwrap().contains("Add Prometheus metrics endpoint"));

    // Verify imported count in persisted metrics
    let disk_content = std::fs::read_to_string(&data_file).unwrap();
    let disk_state: Value = serde_json::from_str(&disk_content).unwrap();
    assert!(disk_state["playground_metrics"]["issues_imported"].as_u64().unwrap() >= 1);

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_worktree_tree() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/playground/tree?scenario_id=scenario-health-check")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let tree: Value = serde_json::from_slice(&body).unwrap();
    let nodes = tree.as_array().unwrap();
    assert!(!nodes.is_empty());

    // Check backend node has children and modified status
    let backend_node = nodes.iter().find(|n| n["name"] == "backend").unwrap();
    assert_eq!(backend_node["is_dir"], true);
    assert!(backend_node["children"].is_array());

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_simulation_lifecycle() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    // 1. Reset simulation
    let reset_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/playground/reset")
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(reset_res.status(), StatusCode::OK);

    // 2. Start simulation with high speed multiplier
    let start_payload = serde_json::json!({
        "scenario_id": "scenario-health-check",
        "speed_multiplier": 100.0
    });

    let start_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/playground/start")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&start_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(start_res.status(), StatusCode::OK);
    let start_body = to_bytes(start_res.into_body(), usize::MAX).await.unwrap();
    let start_state: Value = serde_json::from_slice(&start_body).unwrap();
    assert_eq!(start_state["status"], "Running");
    assert_eq!(start_state["current_step"], 1);

    // Wait 120ms for fast background simulation task to finish
    tokio::time::sleep(std::time::Duration::from_millis(120)).await;

    // 3. Check status
    let status_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/playground/status")
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
    assert_eq!(final_state["step_progress_pct"], 100);
    assert!(final_state["diff_preview"].as_str().is_some());

    // 4. Check diff endpoint
    let diff_res = app
        .oneshot(
            Request::builder()
                .uri("/api/playground/diff?scenario_id=scenario-health-check")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(diff_res.status(), StatusCode::OK);
    let diff_body = to_bytes(diff_res.into_body(), usize::MAX).await.unwrap();
    let diff_data: Value = serde_json::from_slice(&diff_body).unwrap();
    assert!(diff_data["diff"].as_str().unwrap().contains("HealthResponse"));

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_metrics_and_star_click() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    // 1. Initial metrics
    let metrics_res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/playground/metrics")
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
                .uri("/api/playground/star-click")
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(star_res.status(), StatusCode::OK);
    let star_body = to_bytes(star_res.into_body(), usize::MAX).await.unwrap();
    let updated_metrics: Value = serde_json::from_slice(&star_body).unwrap();
    assert_eq!(updated_metrics["github_stars_clicked"], 1);

    // Verify disk persistence
    let disk_content = std::fs::read_to_string(&data_file).unwrap();
    let disk_state: Value = serde_json::from_str(&disk_content).unwrap();
    assert_eq!(disk_state["playground_metrics"]["github_stars_clicked"], 1);

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_banner_embed_generator() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/playground/banner")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let banner: Value = serde_json::from_slice(&body).unwrap();

    assert!(banner["markdown_snippet"].as_str().unwrap().contains("[![Try Tendril"));
    assert!(banner["target_url"].as_str().unwrap().contains("#scenario=health-check"));
    assert!(banner["html_snippet"].as_str().unwrap().contains("<a href=\"https://tendril.run/#scenario=health-check\""));
    assert!(banner["raw_svg"].as_str().unwrap().contains("<svg"));

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_banner_embed_generator_with_scenario() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/playground/banner?scenario_id=scenario-rate-limiter")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let banner: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(
        banner["target_url"].as_str().unwrap(),
        "https://tendril.run/#scenario=rate-limiter"
    );
    assert!(banner["markdown_snippet"].as_str().unwrap().contains("#scenario=rate-limiter"));
    assert!(banner["html_snippet"].as_str().unwrap().contains("<a href=\"https://tendril.run/#scenario=rate-limiter\""));

    let _ = std::fs::remove_file(data_file);
}


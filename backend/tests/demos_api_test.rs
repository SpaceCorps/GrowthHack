use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::{self, AppContext};
use growthhack_backend::db::{GrowthState, VideoDemo};
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
        config: growthhack_backend::config::Config::load(),
    });

    (ctx, data_file)
}

#[tokio::test]
async fn test_get_demos_returns_seeded() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/demos")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let demos: Vec<VideoDemo> = serde_json::from_slice(&body).unwrap();
    assert_eq!(demos.len(), 5);
    assert_eq!(demos[0].feature, "Git Worktrees");
    assert_eq!(demos[0].status, "Pending");

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_post_demo_creates_and_persists() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let new_demo_payload = serde_json::json!({
        "feature": "Automated Verification Gates",
        "target_platform": "LinkedIn",
        "duration_seconds": 30,
        "headline": "Stop Merging Broken Code With Verification Gates",
        "body": "Here is why verification gates matter...",
        "storyboard": "00:00 - 00:05 Hook\n00:05 - 00:30 Walkthrough",
        "status": "Pending"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/demos")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&new_demo_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let created: VideoDemo = serde_json::from_slice(&body).unwrap();
    assert_eq!(created.feature, "Automated Verification Gates");
    assert_eq!(created.status, "Pending");

    // Check on-disk persistence
    let content = std::fs::read_to_string(&data_file).unwrap();
    let persisted: GrowthState = serde_json::from_str(&content).unwrap();
    assert_eq!(persisted.video_demos.len(), 6);
    assert!(persisted.video_demos.iter().any(|d| d.id == created.id));

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_put_demo_updates_status_and_persists() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let update_payload = serde_json::json!({
        "status": "Approved",
        "headline": "Updated Headline For Approved Demo"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/demos/demo-1")
                .method("PUT")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&update_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let updated: VideoDemo = serde_json::from_slice(&body).unwrap();
    assert_eq!(updated.id, "demo-1");
    assert_eq!(updated.status, "Approved");
    assert_eq!(updated.headline, "Updated Headline For Approved Demo");

    // Verify on disk
    let content = std::fs::read_to_string(&data_file).unwrap();
    let persisted: GrowthState = serde_json::from_str(&content).unwrap();
    let demo_in_db = persisted.video_demos.iter().find(|d| d.id == "demo-1").unwrap();
    assert_eq!(demo_in_db.status, "Approved");

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_delete_demo_removes_and_persists() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/demos/demo-1")
                .method("DELETE")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    // Verify on disk
    let content = std::fs::read_to_string(&data_file).unwrap();
    let persisted: GrowthState = serde_json::from_str(&content).unwrap();
    assert_eq!(persisted.video_demos.len(), 4);
    assert!(!persisted.video_demos.iter().any(|d| d.id == "demo-1"));

    let _ = std::fs::remove_file(data_file);
}

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::{self, AppContext};
use growthhack_backend::db::{GrowthState, TrendTopic};
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceExt;

fn create_test_context() -> (Arc<AppContext>, std::path::PathBuf) {
    let temp_dir = std::env::temp_dir();
    let file_id = uuid::Uuid::new_v4().simple().to_string();
    let data_file = temp_dir.join(format!("test_growth_trends_{}.json", file_id));

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
async fn test_put_trend_updates_status_and_persists() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx);

    let update_payload = serde_json::json!({
        "status": "Approved",
        "tendril_tie_in": "direct"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/trends/trend-1")
                .method("PUT")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&update_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let updated: TrendTopic = serde_json::from_slice(&body).unwrap();
    assert_eq!(updated.id, "trend-1");
    assert_eq!(updated.status, "Approved");

    // Verify on-disk persistence
    let content = std::fs::read_to_string(&data_file).unwrap();
    let persisted: GrowthState = serde_json::from_str(&content).unwrap();
    let trend_in_db = persisted.trends.iter().find(|t| t.id == "trend-1").unwrap();
    assert_eq!(trend_in_db.status, "Approved");

    let _ = std::fs::remove_file(data_file);
}

#[tokio::test]
async fn test_get_and_delete_trend() {
    let (ctx, data_file) = create_test_context();
    let app = api::router(ctx.clone());

    // GET
    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/trends/trend-2")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let trend: TrendTopic = serde_json::from_slice(&body).unwrap();
    assert_eq!(trend.id, "trend-2");

    // DELETE
    let app2 = api::router(ctx);
    let del_resp = app2
        .oneshot(
            Request::builder()
                .uri("/api/trends/trend-2")
                .method("DELETE")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(del_resp.status(), StatusCode::NO_CONTENT);

    // Verify on disk
    let content = std::fs::read_to_string(&data_file).unwrap();
    let persisted: GrowthState = serde_json::from_str(&content).unwrap();
    assert!(!persisted.trends.iter().any(|t| t.id == "trend-2"));

    let _ = std::fs::remove_file(data_file);
}

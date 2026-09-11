mod common;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::api;
use growthhack_backend::db::{GrowthState, Listing};
use tower::ServiceExt;

#[tokio::test]
async fn test_get_listings_returns_blurb_status() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/listings")
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let listings: Vec<Listing> = serde_json::from_slice(&body).unwrap();
    assert!(!listings.is_empty());

    let list_5 = listings
        .iter()
        .find(|l| l.id == "list-5")
        .expect("list-5 should exist");
    assert_eq!(list_5.blurb_status, Some("Approved".to_string()));

    let list_1 = listings
        .iter()
        .find(|l| l.id == "list-1")
        .expect("list-1 should exist");
    assert_eq!(list_1.blurb_status, Some("Pending".to_string()));
}

#[tokio::test]
async fn test_put_listing_updates_blurb_status_and_persists() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    // Update list-1 blurb_status to "Approved"
    let payload = serde_json::json!({
        "blurb_status": "Approved"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/listings/list-1")
                .method("PUT")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let updated: Option<Listing> = serde_json::from_slice(&body).unwrap();
    let updated = updated.expect("Listing should be returned");
    assert_eq!(updated.blurb_status, Some("Approved".to_string()));

    // Verify on-disk persistence
    let content = std::fs::read_to_string(guard.data_file()).unwrap();
    let state: GrowthState = serde_json::from_str(&content).unwrap();
    let persisted_1 = state.listings.iter().find(|l| l.id == "list-1").unwrap();
    assert_eq!(persisted_1.blurb_status, Some("Approved".to_string()));

    // Now update list-1 blurb_status to "Rejected"
    let app2 = api::router(guard.ctx());
    let payload2 = serde_json::json!({
        "blurb_status": "Rejected"
    });

    let response2 = app2
        .oneshot(
            Request::builder()
                .uri("/api/listings/list-1")
                .method("PUT")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload2).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::OK);

    let content2 = std::fs::read_to_string(guard.data_file()).unwrap();
    let state2: GrowthState = serde_json::from_str(&content2).unwrap();
    let persisted_rejected = state2.listings.iter().find(|l| l.id == "list-1").unwrap();
    assert_eq!(
        persisted_rejected.blurb_status,
        Some("Rejected".to_string())
    );
}

#[tokio::test]
async fn test_post_listing_initializes_blurb_status_pending_when_blurb_present() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let new_listing = serde_json::json!({
        "name": "awesome-testing-tools",
        "category": "Awesome Repo",
        "url": "https://github.com/example/awesome-testing-tools",
        "submission_blurb": "- [Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril) - Autonomous agentic software factory.",
        "notes": "PR planned for dev tools"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/listings")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&new_listing).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let created: Listing = serde_json::from_slice(&body).unwrap();
    assert_eq!(created.blurb_status, Some("Pending".to_string()));

    // Verify on-disk persistence
    let content = std::fs::read_to_string(guard.data_file()).unwrap();
    let state: GrowthState = serde_json::from_str(&content).unwrap();
    let persisted = state.listings.iter().find(|l| l.id == created.id).unwrap();
    assert_eq!(persisted.blurb_status, Some("Pending".to_string()));

    // Also test POST with empty blurb results in None
    let app2 = api::router(guard.ctx());
    let empty_blurb_listing = serde_json::json!({
        "name": "directory-without-blurb",
        "category": "Dev Directory",
        "url": "https://example.com/directory",
        "submission_blurb": "",
        "notes": "No blurb yet"
    });

    let response2 = app2
        .oneshot(
            Request::builder()
                .uri("/api/listings")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&empty_blurb_listing).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::CREATED);
    let body2 = to_bytes(response2.into_body(), usize::MAX).await.unwrap();
    let created2: Listing = serde_json::from_slice(&body2).unwrap();
    assert_eq!(created2.blurb_status, None);
}

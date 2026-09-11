mod common;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::api;
use growthhack_backend::api::middleware::webhook_auth::compute_hmac_sha256;
use growthhack_backend::api::MetricsSyncDebouncer;
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tower::ServiceExt;

#[tokio::test]
async fn test_webhook_without_secret_allows_request() {
    let (ctx, _file) = common::create_test_context_with_file();
    // Ensure no secret is set
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = None;
    }

    let app = api::router(ctx);
    let payload = serde_json::json!({
        "event": "metrics_updated",
        "platform": "devto"
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/syndication")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
    assert_eq!(json["status"], "processed");
}

#[tokio::test]
async fn test_webhook_with_valid_hmac_passes() {
    let (ctx, _file) = common::create_test_context_with_file();
    let secret = "test_webhook_signing_secret_99";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx);
    let payload_bytes = serde_json::to_vec(&serde_json::json!({
        "event": "article_viewed",
        "views": 420
    }))
    .unwrap();

    let signature = compute_hmac_sha256(secret, &payload_bytes);
    let header_val = format!("sha256={}", signature);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/syndication")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-Hub-Signature-256", header_val)
                .body(Body::from(payload_bytes))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
}

#[tokio::test]
async fn test_webhook_with_raw_hex_signature_passes() {
    let (ctx, _file) = common::create_test_context_with_file();
    let secret = "test_raw_hex_secret_77";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx);
    let payload_bytes = serde_json::to_vec(&serde_json::json!({
        "event": "comment_added",
        "comments": 15
    }))
    .unwrap();

    let raw_signature = compute_hmac_sha256(secret, &payload_bytes);

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/syndication")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-Signature-256", raw_signature)
                .body(Body::from(payload_bytes))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
}

#[tokio::test]
async fn test_webhook_with_invalid_signature_rejected() {
    let (ctx, _file) = common::create_test_context_with_file();
    let secret = "secure_production_secret";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx);
    let payload_bytes = b"{\"event\":\"tampered_payload\"}".to_vec();
    let invalid_signature =
        "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/syndication")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-Hub-Signature-256", invalid_signature)
                .body(Body::from(payload_bytes))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["success"], false);
    assert_eq!(json["error"], "Invalid HMAC signature");
}

#[tokio::test]
async fn test_webhook_missing_signature_when_secret_set_rejected() {
    let (ctx, _file) = common::create_test_context_with_file();
    let secret = "mandatory_secret_key";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx);
    let payload_bytes = b"{\"event\":\"ping\"}".to_vec();

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/syndication")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(payload_bytes))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["success"], false);
    assert_eq!(json["error"], "Invalid HMAC signature");
}

#[tokio::test]
async fn test_webhook_rate_limiting_enforcement() {
    let (ctx, _file) = common::create_test_context_with_file();
    let test_ip = "198.51.100.99";

    // Initial requests within burst capacity (10) should succeed (assuming no secret configured)
    let app = api::router(Arc::clone(&ctx));

    let mut hit_rate_limit = false;
    let mut retry_after_header_present = false;

    for _ in 0..15 {
        let app_clone = app.clone();
        let payload = serde_json::json!({ "event": "spam_ping" });
        let response = app_clone
            .oneshot(
                Request::builder()
                    .uri("/api/webhooks/syndication")
                    .method("POST")
                    .header("Content-Type", "application/json")
                    .header("X-Forwarded-For", test_ip)
                    .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();

        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            hit_rate_limit = true;
            if let Some(retry_after) = response.headers().get(axum::http::header::RETRY_AFTER) {
                if !retry_after.to_str().unwrap_or("").is_empty() {
                    retry_after_header_present = true;
                }
            }
            let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
            let json: Value = serde_json::from_slice(&body).unwrap();
            assert_eq!(json["success"], false);
            assert_eq!(
                json["error"],
                "Rate limit exceeded. Please try again later."
            );
            break;
        }
    }

    assert!(
        hit_rate_limit,
        "Rate limit should have been triggered within 15 requests"
    );
    assert!(
        retry_after_header_present,
        "Retry-After header must be present on 429 response"
    );
}

#[tokio::test]
async fn test_webhook_debouncing_coalesces_concurrent_requests() {
    let (ctx, _file) = common::create_test_context_with_file();
    let (debouncer, worker) =
        MetricsSyncDebouncer::new(Duration::from_millis(30), Duration::from_millis(60));
    let debouncer = Arc::new(debouncer);

    let mut ctx_val = (*ctx).clone();
    ctx_val.metrics_debouncer = Arc::clone(&debouncer);
    let ctx = Arc::new(ctx_val);

    worker.spawn(Arc::downgrade(&ctx));

    let app = api::router(Arc::clone(&ctx));

    // Dispatch 5 concurrent webhook POST requests
    let mut handles = Vec::new();
    for i in 0..5 {
        let app_clone = app.clone();
        handles.push(tokio::spawn(async move {
            let payload = serde_json::json!({
                "event": "article_updated",
                "batch_id": i
            });
            app_clone
                .oneshot(
                    Request::builder()
                        .uri("/api/webhooks/syndication")
                        .method("POST")
                        .header("Content-Type", "application/json")
                        .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                        .unwrap(),
                )
                .await
                .unwrap()
        }));
    }

    for handle in handles {
        let response = handle.await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let json: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["received"], true);
        assert_eq!(json["status"], "processed");
    }

    // Wait for debounce window (30ms) plus execution buffer
    tokio::time::sleep(Duration::from_millis(80)).await;
    assert_eq!(
        debouncer.sync_count(),
        1,
        "Concurrent webhook burst should be coalesced into a single sync run"
    );
}

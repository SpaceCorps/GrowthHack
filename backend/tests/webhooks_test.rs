mod common;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::api;
use growthhack_backend::api::middleware::webhook_auth::compute_hmac_sha256;
use serde_json::Value;
use std::sync::Arc;
use tower::ServiceExt;

#[tokio::test]
async fn test_webhook_without_secret_allows_request() {
    let ctx = common::create_test_context();
    // Ensure no secret is set
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = None;
    }

    let app = api::router(ctx.ctx());
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
    let ctx = common::create_test_context();
    let secret = "test_webhook_signing_secret_99";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx.ctx());
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
    let ctx = common::create_test_context();
    let secret = "test_raw_hex_secret_77";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx.ctx());
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
    let ctx = common::create_test_context();
    let secret = "secure_production_secret";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx.ctx());
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
    let ctx = common::create_test_context();
    let secret = "mandatory_secret_key";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(ctx.ctx());
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
    let ctx = common::create_test_context();
    let test_ip = "198.51.100.99";

    // Initial requests within burst capacity (10) should succeed (assuming no secret configured)
    let app = api::router(ctx.ctx());

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
async fn test_github_webhook_ping_event() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let payload = serde_json::json!({
        "zen": "Approachable is better than simple."
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "ping")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
    assert_eq!(json["action"], "ping");
    assert_eq!(json["message"], "pong");
}

#[tokio::test]
async fn test_github_webhook_unassigned_syncs_local_state() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    // Claim cf-issue-1 first
    {
        let mut state = ctx.state.write().await;
        let issue = state
            .contributor_issues
            .iter_mut()
            .find(|i| i.id == "cf-issue-1")
            .unwrap();
        issue.claimed = true;
        issue.claimed_by = Some("@contributor-dev".to_string());
        issue.claimed_at = Some(chrono::Utc::now());
    }

    let app = api::router(Arc::clone(&ctx));

    let payload = serde_json::json!({
        "action": "unassigned",
        "issue": {
            "number": 14,
            "state": "open",
            "assignees": []
        },
        "assignee": {
            "login": "contributor-dev"
        },
        "repository": {
            "full_name": "SpaceCorps/GrowthHack"
        }
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "issues")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
    assert_eq!(json["action"], "unassigned");
    assert_eq!(json["matched_issue_id"], "cf-issue-1");

    let state = ctx.state.read().await;
    let issue = state
        .contributor_issues
        .iter()
        .find(|i| i.id == "cf-issue-1")
        .unwrap();
    assert!(!issue.claimed);
    assert!(issue.claimed_by.is_none());
    assert!(issue.claimed_at.is_none());
    assert_eq!(
        issue.github_sync_status.as_deref(),
        Some("Unassigned (Webhook)")
    );
    assert!(issue
        .github_sync_message
        .as_ref()
        .unwrap()
        .contains("Contributor unassigned externally on GitHub"));
}

#[tokio::test]
async fn test_github_webhook_closed_syncs_local_state() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    let app = api::router(Arc::clone(&ctx));

    let payload = serde_json::json!({
        "action": "closed",
        "issue": {
            "number": 14,
            "state": "closed",
            "assignees": []
        },
        "repository": {
            "full_name": "SpaceCorps/GrowthHack"
        }
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "issues")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
    assert_eq!(json["action"], "closed");
    assert_eq!(json["matched_issue_id"], "cf-issue-1");

    let state = ctx.state.read().await;
    let issue = state
        .contributor_issues
        .iter()
        .find(|i| i.id == "cf-issue-1")
        .unwrap();
    assert!(issue.closed);
    assert!(issue.closed_at.is_some());
    assert_eq!(
        issue.github_sync_status.as_deref(),
        Some("Closed (Webhook)")
    );
    assert!(issue
        .github_sync_message
        .as_ref()
        .unwrap()
        .contains("closed externally on GitHub"));
}

#[tokio::test]
async fn test_github_webhook_reopened_syncs_local_state() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    // Mark issue 14 as closed first
    {
        let mut state = ctx.state.write().await;
        let issue = state
            .contributor_issues
            .iter_mut()
            .find(|i| i.id == "cf-issue-1")
            .unwrap();
        issue.closed = true;
        issue.closed_at = Some(chrono::Utc::now());
    }

    let app = api::router(Arc::clone(&ctx));

    let payload = serde_json::json!({
        "action": "reopened",
        "issue": {
            "number": 14,
            "state": "open",
            "assignees": []
        },
        "repository": {
            "full_name": "SpaceCorps/GrowthHack"
        }
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "issues")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
    assert_eq!(json["action"], "reopened");
    assert_eq!(json["matched_issue_id"], "cf-issue-1");

    let state = ctx.state.read().await;
    let issue = state
        .contributor_issues
        .iter()
        .find(|i| i.id == "cf-issue-1")
        .unwrap();
    assert!(!issue.closed);
    assert!(issue.closed_at.is_none());
    assert_eq!(
        issue.github_sync_status.as_deref(),
        Some("Reopened (Webhook)")
    );
    assert!(issue
        .github_sync_message
        .as_ref()
        .unwrap()
        .contains("reopened on GitHub"));
}

#[tokio::test]
async fn test_github_webhook_unmatched_issue_returns_ok() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    let app = api::router(ctx);

    let payload = serde_json::json!({
        "action": "closed",
        "issue": {
            "number": 999999,
            "state": "closed",
            "assignees": []
        },
        "repository": {
            "full_name": "SpaceCorps/GrowthHack"
        }
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "issues")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let json: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(json["received"], true);
    assert_eq!(json["matched_issue_id"], serde_json::Value::Null);
    assert!(json["message"].as_str().unwrap().contains("No local contributor issue matched"));
}

#[tokio::test]
async fn test_github_webhook_hmac_authentication() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();
    let secret = "github_webhook_secret_key_123";
    {
        let mut state = ctx.state.write().await;
        state.syndication_settings.webhook_secret = Some(secret.to_string());
    }

    let app = api::router(Arc::clone(&ctx));
    let payload_bytes = serde_json::to_vec(&serde_json::json!({
        "action": "closed",
        "issue": {
            "number": 14,
            "state": "closed",
            "assignees": []
        }
    }))
    .unwrap();

    // 1. Invalid signature should be rejected with 401
    let bad_signature = "sha256=0000000000000000000000000000000000000000000000000000000000000000";
    let bad_response = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "issues")
                .header("X-Hub-Signature-256", bad_signature)
                .body(Body::from(payload_bytes.clone()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(bad_response.status(), StatusCode::UNAUTHORIZED);

    // 2. Valid signature should pass with 200
    let valid_signature = format!("sha256={}", compute_hmac_sha256(secret, &payload_bytes));
    let good_response = app
        .oneshot(
            Request::builder()
                .uri("/api/webhooks/github")
                .method("POST")
                .header("Content-Type", "application/json")
                .header("X-GitHub-Event", "issues")
                .header("X-Hub-Signature-256", valid_signature)
                .body(Body::from(payload_bytes))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(good_response.status(), StatusCode::OK);
}

use crate::api::AppContext;
use axum::{
    body::{to_bytes, Body},
    extract::State,
    http::{Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;

pub fn compute_hmac_sha256(secret: &str, data: &[u8]) -> String {
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    let tag = ring::hmac::sign(&key, data);
    hex::encode(tag.as_ref())
}

pub fn verify_signature(secret: &str, data: &[u8], signature_hex: &str) -> bool {
    let clean = signature_hex
        .trim()
        .strip_prefix("sha256=")
        .unwrap_or(signature_hex.trim());
    let sig_bytes = match hex::decode(clean) {
        Ok(b) => b,
        Err(_) => return false,
    };
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes());
    ring::hmac::verify(&key, data, &sig_bytes).is_ok()
}

pub async fn verify_webhook_hmac(
    State(ctx): State<Arc<AppContext>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let (parts, body) = req.into_parts();

    let bytes = match to_bytes(body, 10 * 1024 * 1024).await {
        Ok(b) => b,
        Err(err) => {
            tracing::error!("Failed to buffer webhook payload: {}", err);
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Failed to read request body"
                })),
            )
                .into_response();
        }
    };

    let configured_secret = ctx.get_webhook_secret();
    let secret = match configured_secret {
        Some(s) if !s.trim().is_empty() => s.trim().to_string(),
        _ => {
            tracing::warn!(
                "Syndication webhook received but no secret is configured; permitting request in development mode."
            );
            let req = Request::from_parts(parts, Body::from(bytes));
            return next.run(req).await;
        }
    };

    let signature_header = parts
        .headers
        .get("x-hub-signature-256")
        .or_else(|| parts.headers.get("x-signature-256"))
        .or_else(|| parts.headers.get("x-webhook-signature"))
        .and_then(|v| v.to_str().ok());

    let sig_str = match signature_header {
        Some(s) if !s.trim().is_empty() => s.trim(),
        _ => {
            tracing::warn!(
                "Syndication webhook rejected: missing signature header while secret is configured"
            );
            return (
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Invalid HMAC signature"
                })),
            )
                .into_response();
        }
    };

    if !verify_signature(&secret, &bytes, sig_str) {
        tracing::warn!("Syndication webhook rejected: HMAC signature verification failed");
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "success": false,
                "error": "Invalid HMAC signature"
            })),
        )
            .into_response();
    }

    let req = Request::from_parts(parts, Body::from(bytes));
    next.run(req).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_compute_and_verify_signature() {
        let secret = "top_secret_key";
        let payload = b"{\"event\":\"syndication_ping\"}";
        let signature = compute_hmac_sha256(secret, payload);

        assert!(verify_signature(secret, payload, &signature));
        assert!(verify_signature(
            secret,
            payload,
            &format!("sha256={}", signature)
        ));
        assert!(!verify_signature("wrong_secret", payload, &signature));
        assert!(!verify_signature(secret, b"altered payload", &signature));
        assert!(!verify_signature(secret, payload, "invalid_hex"));
    }
}

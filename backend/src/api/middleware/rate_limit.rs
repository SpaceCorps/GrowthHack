use crate::api::AppContext;
use axum::{
    body::Body,
    extract::State,
    http::{header::HeaderValue, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
struct Bucket {
    tokens: f64,
    last_refill: Instant,
    last_seen: Instant,
}

#[derive(Debug, Clone)]
pub struct IpRateLimiter {
    pub requests_per_minute: f64,
    pub burst_capacity: f64,
    buckets: Arc<Mutex<HashMap<IpAddr, Bucket>>>,
    last_pruned: Arc<Mutex<Instant>>,
}

impl Default for IpRateLimiter {
    fn default() -> Self {
        Self::new(60.0, 10.0)
    }
}

impl IpRateLimiter {
    pub fn new(requests_per_minute: f64, burst_capacity: f64) -> Self {
        Self {
            requests_per_minute,
            burst_capacity,
            buckets: Arc::new(Mutex::new(HashMap::new())),
            last_pruned: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub fn check(&self, ip: IpAddr) -> Result<(), u64> {
        let now = Instant::now();
        let mut buckets = self.buckets.lock().unwrap();

        // Periodically prune stale entries older than 5 minutes (300 seconds)
        if let Ok(mut last_pruned) = self.last_pruned.try_lock() {
            if now.duration_since(*last_pruned) >= Duration::from_secs(60) {
                *last_pruned = now;
                buckets.retain(|_, b| now.duration_since(b.last_seen) < Duration::from_secs(300));
            }
        }

        let refill_rate = (self.requests_per_minute / 60.0).max(0.001);
        let bucket = buckets.entry(ip).or_insert_with(|| Bucket {
            tokens: self.burst_capacity,
            last_refill: now,
            last_seen: now,
        });

        let elapsed = now.duration_since(bucket.last_refill).as_secs_f64();
        bucket.tokens = (bucket.tokens + elapsed * refill_rate).min(self.burst_capacity);
        bucket.last_refill = now;
        bucket.last_seen = now;

        if bucket.tokens >= 1.0 {
            bucket.tokens -= 1.0;
            Ok(())
        } else {
            let missing = 1.0 - bucket.tokens;
            let wait_seconds = (missing / refill_rate).ceil().max(1.0) as u64;
            Err(wait_seconds)
        }
    }

    pub fn prune_stale(&self, max_age: Duration) {
        let now = Instant::now();
        let mut buckets = self.buckets.lock().unwrap();
        buckets.retain(|_, b| now.duration_since(b.last_seen) < max_age);
    }
}

pub fn extract_client_ip(headers: &axum::http::HeaderMap) -> IpAddr {
    if let Some(forwarded) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()) {
        if let Some(first) = forwarded.split(',').next() {
            if let Ok(ip) = first.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }
    if let Some(real_ip) = headers.get("x-real-ip").and_then(|v| v.to_str().ok()) {
        if let Ok(ip) = real_ip.trim().parse::<IpAddr>() {
            return ip;
        }
    }
    IpAddr::V4(std::net::Ipv4Addr::new(127, 0, 0, 1))
}

pub async fn rate_limit_middleware(
    State(ctx): State<Arc<AppContext>>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let client_ip = extract_client_ip(req.headers());
    match ctx.rate_limiter.check(client_ip) {
        Ok(()) => next.run(req).await,
        Err(retry_after) => {
            tracing::warn!(
                "Rate limit exceeded for IP {} on webhook endpoint. Retry-After: {}s",
                client_ip,
                retry_after
            );
            let mut res = (
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Rate limit exceeded. Please try again later."
                })),
            )
                .into_response();
            if let Ok(val) = HeaderValue::from_str(&retry_after.to_string()) {
                res.headers_mut()
                    .insert(axum::http::header::RETRY_AFTER, val);
            }
            res
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::Ipv4Addr;

    #[test]
    fn test_token_bucket_burst_and_rate_limit() {
        let limiter = IpRateLimiter::new(60.0, 3.0);
        let ip = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 10));

        assert!(limiter.check(ip).is_ok());
        assert!(limiter.check(ip).is_ok());
        assert!(limiter.check(ip).is_ok());

        // 4th request exceeds burst capacity of 3
        let res = limiter.check(ip);
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), 1);

        // Different IP is unaffected
        let ip2 = IpAddr::V4(Ipv4Addr::new(192, 168, 1, 20));
        assert!(limiter.check(ip2).is_ok());
    }

    #[test]
    fn test_extract_client_ip_headers() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            "x-forwarded-for",
            HeaderValue::from_static("203.0.113.195, 70.41.3.18"),
        );
        let ip = extract_client_ip(&headers);
        assert_eq!(ip, IpAddr::V4(Ipv4Addr::new(203, 0, 113, 195)));

        let mut headers_real = axum::http::HeaderMap::new();
        headers_real.insert("x-real-ip", HeaderValue::from_static("198.51.100.4"));
        let ip_real = extract_client_ip(&headers_real);
        assert_eq!(ip_real, IpAddr::V4(Ipv4Addr::new(198, 51, 100, 4)));

        let empty_headers = axum::http::HeaderMap::new();
        assert_eq!(
            extract_client_ip(&empty_headers),
            IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1))
        );
    }
}

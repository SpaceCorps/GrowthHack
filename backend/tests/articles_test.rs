mod common;

use axum::body::{to_bytes, Body};
use axum::http::{Request, StatusCode};
use growthhack_backend::api;
use serde_json::Value;
use tower::ServiceExt;

fn unique_temp_dir(label: &str) -> std::path::PathBuf {
    std::env::temp_dir().join(format!(
        "growthhack_articles_test_{}_{}",
        label,
        uuid::Uuid::new_v4().simple()
    ))
}

async fn create_draft_article(app: axum::Router, title: &str) -> String {
    let payload = serde_json::json!({
        "title": title,
        "feature": "Worktrees",
        "channel": "Website",
        "angle": "Architecture",
        "summary": "A test summary.",
        "content": "# Heading\n\nBody content.",
        "backlinks": [],
        "outbound_citations": []
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/articles")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::CREATED);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let created: Value = serde_json::from_slice(&body).unwrap();
    created["id"].as_str().unwrap().to_string()
}

#[tokio::test]
async fn test_auto_post_fresh_article_returns_200_and_publishes() {
    let guard = common::create_test_context();
    let content_dir = unique_temp_dir("fresh_content");
    let images_dir = unique_temp_dir("fresh_images");

    let id = create_draft_article(api::router(guard.ctx()), "Instant Auto-Post Fresh Article").await;

    let payload = serde_json::json!({
        "target_dir": content_dir.to_string_lossy(),
        "target_images_dir": images_dir.to_string_lossy(),
    });

    let response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();

    assert_eq!(parsed["success"], true);
    assert_eq!(parsed["article"]["status"], "Published");
    assert!(!parsed["article"]["published_at"].is_null());
    assert_eq!(parsed["record"]["channel"], "ivy-web");
    assert_eq!(parsed["record"]["status"], "Success");

    let slug = parsed["slug"].as_str().unwrap();
    let mdoc_file = content_dir.join(format!("{}.mdoc", slug));
    assert!(mdoc_file.exists());
    assert!(!std::fs::read_to_string(&mdoc_file).unwrap().is_empty());

    let _ = std::fs::remove_dir_all(&content_dir);
    let _ = std::fs::remove_dir_all(&images_dir);
}

#[tokio::test]
async fn test_auto_post_sync_hero_image_true_writes_asset_false_does_not() {
    let guard = common::create_test_context();
    let content_dir = unique_temp_dir("hero_content");
    let images_dir = unique_temp_dir("hero_images");

    let id_with_hero = create_draft_article(api::router(guard.ctx()), "Auto Post With Hero").await;
    let payload_with_hero = serde_json::json!({
        "target_dir": content_dir.to_string_lossy(),
        "target_images_dir": images_dir.to_string_lossy(),
        "sync_hero_image": true,
    });
    let response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id_with_hero))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload_with_hero).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert!(!parsed["image_path"].is_null());

    let id_without_hero = create_draft_article(api::router(guard.ctx()), "Auto Post Without Hero").await;
    let payload_without_hero = serde_json::json!({
        "target_dir": content_dir.to_string_lossy(),
        "target_images_dir": images_dir.to_string_lossy(),
        "sync_hero_image": false,
    });
    let response2 = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id_without_hero))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(
                    serde_json::to_vec(&payload_without_hero).unwrap(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response2.status(), StatusCode::OK);
    let body2 = to_bytes(response2.into_body(), usize::MAX).await.unwrap();
    let parsed2: Value = serde_json::from_slice(&body2).unwrap();
    assert!(parsed2["image_path"].is_null());

    let _ = std::fs::remove_dir_all(&content_dir);
    let _ = std::fs::remove_dir_all(&images_dir);
}

#[tokio::test]
async fn test_auto_post_unknown_id_returns_404() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/articles/does-not-exist/auto-post")
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn test_auto_post_second_call_preserves_published_at_and_appends_export_record() {
    let guard = common::create_test_context();
    let content_dir = unique_temp_dir("repeat_content");
    let images_dir = unique_temp_dir("repeat_images");

    let id = create_draft_article(api::router(guard.ctx()), "Repeat Auto Post Article").await;

    let payload = serde_json::json!({
        "target_dir": content_dir.to_string_lossy(),
        "target_images_dir": images_dir.to_string_lossy(),
    });

    let first_response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(first_response.status(), StatusCode::OK);
    let first_body = to_bytes(first_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let first_parsed: Value = serde_json::from_slice(&first_body).unwrap();
    let first_published_at = first_parsed["article"]["published_at"].clone();
    assert!(!first_published_at.is_null());

    let second_response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(second_response.status(), StatusCode::OK);
    let second_body = to_bytes(second_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let second_parsed: Value = serde_json::from_slice(&second_body).unwrap();

    assert_eq!(second_parsed["article"]["published_at"], first_published_at);
    let exports = second_parsed["article"]["exports"].as_array().unwrap();
    assert_eq!(exports.len(), 2);

    let _ = std::fs::remove_dir_all(&content_dir);
    let _ = std::fs::remove_dir_all(&images_dir);
}

#[tokio::test]
async fn test_auto_post_hero_format_svg_reflected_in_frontmatter() {
    let guard = common::create_test_context();
    let content_dir = unique_temp_dir("svg_content");
    let images_dir = unique_temp_dir("svg_images");

    let id = create_draft_article(api::router(guard.ctx()), "SVG Hero Format Article").await;

    let payload = serde_json::json!({
        "target_dir": content_dir.to_string_lossy(),
        "target_images_dir": images_dir.to_string_lossy(),
        "hero_format": "svg",
    });

    let response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    let slug = parsed["slug"].as_str().unwrap();

    let mdoc_file = content_dir.join(format!("{}.mdoc", slug));
    let content = std::fs::read_to_string(&mdoc_file).unwrap();
    assert!(content.contains(&format!("image: \"/site/images/blog/{}-hero.svg\"", slug)));
    assert!(content.contains(&format!("image_svg: \"/site/images/blog/{}-hero.svg\"", slug)));

    let _ = std::fs::remove_dir_all(&content_dir);
    let _ = std::fs::remove_dir_all(&images_dir);
}

#[tokio::test]
async fn test_auto_post_no_json_body_succeeds_with_defaults() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let id = create_draft_article(api::router(guard.ctx()), "Default Body Auto Post Article").await;

    let response = app
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id))
                .method("POST")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert_eq!(parsed["success"], true);
    assert_eq!(parsed["article"]["status"], "Published");

    let slug = parsed["slug"].as_str().unwrap();
    let default_mdoc = std::env::temp_dir().join(format!("{}.mdoc", slug));
    let _ = std::fs::remove_file(&default_mdoc);
}

#[tokio::test]
async fn test_auto_post_unwritable_target_dir_returns_500_and_stays_unpublished() {
    let guard = common::create_test_context();
    let blocker_path = unique_temp_dir("blocker_file_not_dir");
    std::fs::write(&blocker_path, b"this is a file, not a directory").unwrap();

    let id = create_draft_article(api::router(guard.ctx()), "Unwritable Target Dir Article").await;

    let payload = serde_json::json!({
        "target_dir": blocker_path.to_string_lossy(),
    });

    let response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}/auto-post", id))
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);

    let get_response = api::router(guard.ctx())
        .oneshot(
            Request::builder()
                .uri(format!("/api/articles/{}", id))
                .method("GET")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(get_response.status(), StatusCode::OK);
    let get_body = to_bytes(get_response.into_body(), usize::MAX)
        .await
        .unwrap();
    let article: Value = serde_json::from_slice(&get_body).unwrap();
    assert_eq!(article["status"], "Draft");
    assert!(article["published_at"].is_null());
    assert_eq!(article["exports"].as_array().unwrap().len(), 0);

    let _ = std::fs::remove_file(&blocker_path);
}

#[tokio::test]
async fn test_generate_article_accepts_optional_timeout_secs() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let payload = serde_json::json!({
        "feature": "Worktrees",
        "angle": "Architecture",
        "channel": "Website",
        "extra_context": "Test context",
        "timeout_secs": 180,
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/articles/generate")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::ACCEPTED);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert!(parsed["task_id"].as_str().unwrap().starts_with("task-art-"));
    assert!(parsed["article_id"].as_str().unwrap().starts_with("art-"));
}

#[tokio::test]
async fn test_generate_spotlight_accepts_optional_timeout_secs() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let payload = serde_json::json!({
        "project_name": "OpenBot",
        "repo_url": "https://github.com/openbot-ai/openbot",
        "tagline": "Autonomous desktop robotics in 50 lines of Rust",
        "key_features": ["Zero-dependency binary", "Local model inference"],
        "target_channel": "LinkedIn",
        "extra_notes": "Runs on Raspberry Pi 5",
        "timeout_secs": 240,
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/articles/generate-spotlight")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::ACCEPTED);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert!(parsed["task_id"].as_str().unwrap().starts_with("task-art-"));
    assert!(parsed["article_id"].as_str().unwrap().starts_with("art-"));
}

#[tokio::test]
async fn test_generate_article_and_spotlight_backward_compatibility_without_timeout() {
    let guard = common::create_test_context();
    let app = api::router(guard.ctx());

    let article_payload = serde_json::json!({
        "feature": "Worktrees",
        "angle": "Benchmark",
        "channel": "Dev.to",
    });

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/articles/generate")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&article_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::ACCEPTED);
    let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
    let parsed: Value = serde_json::from_slice(&body).unwrap();
    assert!(parsed["task_id"].as_str().unwrap().starts_with("task-art-"));

    let app2 = api::router(guard.ctx());
    let spotlight_payload = serde_json::json!({
        "project_name": "OpenBot",
        "repo_url": "https://github.com/openbot-ai/openbot",
        "tagline": "Autonomous desktop robotics",
        "key_features": ["Local model inference"],
        "target_channel": "XThread",
    });

    let response2 = app2
        .oneshot(
            Request::builder()
                .uri("/api/articles/generate-spotlight")
                .method("POST")
                .header("Content-Type", "application/json")
                .body(Body::from(serde_json::to_vec(&spotlight_payload).unwrap()))
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response2.status(), StatusCode::ACCEPTED);
    let body2 = to_bytes(response2.into_body(), usize::MAX).await.unwrap();
    let parsed2: Value = serde_json::from_slice(&body2).unwrap();
    assert!(parsed2["task_id"].as_str().unwrap().starts_with("task-art-"));
}

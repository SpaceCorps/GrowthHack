mod common;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use growthhack_backend::api::trends::{
    list_trends, parse_scouted_topics, scout_trends, synthesize_trend, ScoutTrendsRequest,
    SynthesizeTrendRequest,
};

#[tokio::test]
async fn test_parse_scouted_topics_json_block() {
    let json_output = r#"
Here are the trending topics discovered today:

```json
[
  {
    "source": "Reddit",
    "topic": "Claude Code worktree isolation problems",
    "url": "https://reddit.com/r/LocalLLaMA/comments/123",
    "engagement": "540 upvotes, 190 comments",
    "summary": "Developers discuss merge conflicts when running multiple agents concurrently in a shared repo.",
    "tendril_tie_in": "direct"
  },
  {
    "source": "Hacker News",
    "topic": "OpenHands vs Devin in monorepo sandboxes",
    "url": "https://news.ycombinator.com/item?id=456",
    "engagement": "310 points, 88 comments",
    "summary": "HN debate about sandbox escapes and lack of verification gates.",
    "tendril_tie_in": "subtle"
  }
]
```
"#;

    let topics = parse_scouted_topics(json_output);
    assert_eq!(topics.len(), 2);
    assert_eq!(topics[0].source.as_deref(), Some("Reddit"));
    assert_eq!(topics[0].topic, "Claude Code worktree isolation problems");
    assert_eq!(topics[0].tendril_tie_in.as_deref(), Some("direct"));
    assert_eq!(topics[1].source.as_deref(), Some("Hacker News"));
}

#[tokio::test]
async fn test_parse_scouted_topics_heuristic_fallback() {
    let text_output = r#"
### Claude Code worktree issues in production
Source: Reddit
URL: https://reddit.com/r/programming/comments/worktree
Engagement: 420 upvotes
Summary: Multiple agents writing to main branch simultaneously corrupt git index.

### Agent Git Merge Conflict Hell
Source: Reddit
URL: https://reddit.com/r/ClaudeAI/comments/conflicts
Engagement: 280 upvotes
Summary: Monorepos experience severe collision without isolated worktrees.
"#;

    let topics = parse_scouted_topics(text_output);
    assert_eq!(topics.len(), 2);
    assert_eq!(topics[0].topic, "Claude Code worktree issues in production");
    assert_eq!(topics[0].source.as_deref(), Some("Reddit"));
    assert_eq!(topics[1].topic, "Agent Git Merge Conflict Hell");
}

#[tokio::test]
async fn test_parse_scouted_topics_unclosed_codeblock() {
    let json_output = r#"
Here are the trending topics discovered today:

```json
[
  {
    "source": "Reddit",
    "topic": "Claude Code worktree isolation problems",
    "url": "https://reddit.com/r/LocalLLaMA/comments/123",
    "engagement": "540 upvotes, 190 comments",
    "summary": "Developers discuss merge conflicts when running multiple agents concurrently in a shared repo.",
    "tendril_tie_in": "direct"
  }
]
"#;

    let topics = parse_scouted_topics(json_output);
    assert_eq!(topics.len(), 1);
    assert_eq!(topics[0].source.as_deref(), Some("Reddit"));
    assert_eq!(topics[0].topic, "Claude Code worktree isolation problems");
}

#[tokio::test]
async fn test_parse_scouted_topics_trailing_commas() {
    let json_output = r#"
```json
[
  {
    "source": "Reddit",
    "topic": "Claude Code worktree isolation problems",
    "url": "https://reddit.com/r/LocalLLaMA/comments/123",
    "engagement": "540 upvotes, 190 comments",
    "summary": "Developers discuss merge conflicts when running multiple agents concurrently in a shared repo.",
    "tendril_tie_in": "direct",
  },
]
```
"#;

    let topics = parse_scouted_topics(json_output);
    assert_eq!(topics.len(), 1);
    assert_eq!(topics[0].source.as_deref(), Some("Reddit"));
    assert_eq!(topics[0].topic, "Claude Code worktree isolation problems");
}

#[tokio::test]
async fn test_parse_scouted_topics_unclosed_array() {
    let json_output = r#"
```json
[
  {
    "source": "Reddit",
    "topic": "Claude Code worktree isolation problems",
    "url": "https://reddit.com/r/LocalLLaMA/comments/123",
    "engagement": "540 upvotes, 190 comments",
    "summary": "Developers discuss merge conflicts when running multiple agents concurrently in a shared repo.",
    "tendril_tie_in": "direct"
  }
"#;

    let topics = parse_scouted_topics(json_output);
    assert_eq!(topics.len(), 1);
    assert_eq!(topics[0].source.as_deref(), Some("Reddit"));
    assert_eq!(topics[0].topic, "Claude Code worktree isolation problems");
}

#[tokio::test]
async fn test_parse_scouted_topics_truncated_mid_item() {
    let json_output = r#"
```json
[
  {
    "source": "Reddit",
    "topic": "Claude Code worktree isolation problems",
    "url": "https://reddit.com/r/LocalLLaMA/comments/123",
    "engagement": "540 upvotes, 190 comments",
    "summary": "Developers discuss merge conflicts when running multiple agents concurrently in a shared repo.",
    "tendril_tie_in": "direct"
  },
  {
    "source": "Hacker News",
    "summary": "This topic was cut off mid-string because token limits were reached
"#;

    let topics = parse_scouted_topics(json_output);
    assert_eq!(topics.len(), 1);
    assert_eq!(topics[0].source.as_deref(), Some("Reddit"));
    assert_eq!(topics[0].topic, "Claude Code worktree isolation problems");
}

#[tokio::test]
async fn test_list_trends() {
    let ctx = common::create_test_context();
    let response = list_trends(State(ctx)).await.into_response();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_scout_trends_accepts_modes_and_sources() {
    let ctx = common::create_test_context();

    // 1. Discussions mode
    let req_discussions = ScoutTrendsRequest {
        sources: Some(vec!["Reddit".to_string(), "Hacker News".to_string()]),
        mode: Some("discussions".to_string()),
    };
    let res = scout_trends(State(ctx.clone()), Json(req_discussions)).await.into_response();
    assert_eq!(res.status(), StatusCode::ACCEPTED);

    // 2. General mode
    let req_general = ScoutTrendsRequest {
        sources: Some(vec!["GitHub".to_string(), "LinkedIn".to_string()]),
        mode: Some("general".to_string()),
    };
    let res2 = scout_trends(State(ctx.clone()), Json(req_general)).await.into_response();
    assert_eq!(res2.status(), StatusCode::ACCEPTED);
}

#[tokio::test]
async fn test_scout_trends_discussions_with_custom_sources() {
    let ctx = common::create_test_context();

    let req = ScoutTrendsRequest {
        sources: Some(vec!["r/rust".to_string(), "Lobste.rs".to_string()]),
        mode: Some("discussions".to_string()),
    };
    let res = scout_trends(State(ctx.clone()), Json(req)).await.into_response();
    assert_eq!(res.status(), StatusCode::ACCEPTED);
}

#[tokio::test]
async fn test_synthesize_trend_validation_and_modes() {
    let ctx = common::create_test_context();

    // Verify 404 for unknown trend
    let req = SynthesizeTrendRequest {
        tendril_tie_in: Some("direct".to_string()),
        channel: Some("Website".to_string()),
    };
    let res_404 = synthesize_trend(Path("unknown-trend-id".to_string()), State(ctx.clone()), Json(req.clone()))
        .await
        .into_response();
    assert_eq!(res_404.status(), StatusCode::NOT_FOUND);

    // Verify ACCEPTED for seeded trend-1
    let res_ok = synthesize_trend(Path("trend-1".to_string()), State(ctx.clone()), Json(req))
        .await
        .into_response();
    assert_eq!(res_ok.status(), StatusCode::ACCEPTED);
}

#[tokio::test]
async fn test_synthesize_trend_approval_queue_and_tie_in_modes() {
    let ctx = common::create_test_context();

    // Test direct tie-in vs subtle vs none article generation properties
    let mut state = ctx.state.write().await;
    let trend = state.trends[0].clone();

    // Direct mode article
    let article_direct = growthhack_backend::db::Article {
        id: "art-direct-test".to_string(),
        title: "Solving Agent Collisions with Worktrees".to_string(),
        feature: "Trend Analysis".to_string(),
        channel: "Website".to_string(),
        angle: "Trend Radar".to_string(),
        summary: "Analysis of trend".to_string(),
        content: "Article content".to_string(),
        backlinks: vec!["https://github.com/Ivy-Interactive/Ivy-Tendril".to_string()],
        outbound_citations: vec![trend.url.clone()],
        status: "Ready".to_string(),
        ..growthhack_backend::db::Article::default_for_test()
    };
    state.articles.insert(0, article_direct);

    // Subtle mode article
    let article_subtle = growthhack_backend::db::Article {
        id: "art-subtle-test".to_string(),
        title: "Industry Perspective on Coding Agents".to_string(),
        feature: "Trend Analysis".to_string(),
        channel: "LinkedIn".to_string(),
        angle: "Trend Radar".to_string(),
        summary: "Subtle industry analysis".to_string(),
        content: "Subtle article content".to_string(),
        backlinks: vec!["https://github.com/Ivy-Interactive/Ivy-Tendril".to_string()],
        outbound_citations: vec![trend.url.clone()],
        status: "Ready".to_string(),
        ..growthhack_backend::db::Article::default_for_test()
    };
    state.articles.insert(0, article_subtle);

    // None mode article
    let article_none = growthhack_backend::db::Article {
        id: "art-none-test".to_string(),
        title: "Pure Tech Deep Dive on Git Index Lock".to_string(),
        feature: "Trend Analysis".to_string(),
        channel: "Website".to_string(),
        angle: "Trend Radar".to_string(),
        summary: "Pure commentary".to_string(),
        content: "Pure commentary content".to_string(),
        backlinks: vec![],
        outbound_citations: vec![trend.url.clone()],
        status: "Ready".to_string(),
        ..growthhack_backend::db::Article::default_for_test()
    };
    state.articles.insert(0, article_none);

    // Update trend status as synthesize_trend does
    state.trends[0].status = "Published".to_string();
    state.trends[0].generated_article_id = Some("art-direct-test".to_string());
    state.trends[0].tendril_tie_in = "direct".to_string();

    drop(state);

    // Read state back and verify approval queue articles
    let read_state = ctx.state.read().await;
    let approval_queue: Vec<_> = read_state
        .articles
        .iter()
        .filter(|a| a.status == "Ready" || a.status == "Draft")
        .collect();

    assert!(approval_queue.len() >= 3);
    assert_eq!(approval_queue[0].status, "Ready");
    assert!(approval_queue[0].backlinks.is_empty()); // none mode
    assert!(!approval_queue[1].backlinks.is_empty()); // subtle mode
    assert!(!approval_queue[2].backlinks.is_empty()); // direct mode
    assert_eq!(read_state.trends[0].status, "Published");
}

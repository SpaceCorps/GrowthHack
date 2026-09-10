use crate::api::articles::slugify;
use crate::api::issues::AppContext;
use crate::db::Article;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Deserialize)]
pub struct ScoutTrendsRequest {
    #[allow(dead_code)]
    pub sources: Option<Vec<String>>, // ["GitHub", "Reddit", "LinkedIn"]
}

#[derive(Deserialize)]
pub struct SynthesizeTrendRequest {
    pub tendril_tie_in: Option<String>, // "direct", "subtle", "none"
    pub channel: Option<String>,        // "Website", "LinkedIn", "Reddit"
}

#[derive(Deserialize, Default)]
pub struct UpdateTrendRequest {
    pub status: Option<String>,
    pub topic: Option<String>,
    pub summary: Option<String>,
    pub tendril_tie_in: Option<String>,
    pub source: Option<String>,
    pub url: Option<String>,
    pub engagement: Option<String>,
}

#[derive(Serialize)]
pub struct TrendActionResponse {
    pub task_id: String,
    pub message: String,
}

pub async fn list_trends(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.trends.clone())
}

pub async fn get_trend(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> Result<Json<crate::db::TrendTopic>, StatusCode> {
    let state = ctx.state.read().await;
    match state.trends.iter().find(|t| t.id == id) {
        Some(trend) => Ok(Json(trend.clone())),
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn update_trend(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateTrendRequest>,
) -> Result<Json<crate::db::TrendTopic>, StatusCode> {
    let mut state = ctx.state.write().await;
    match state.trends.iter_mut().find(|t| t.id == id) {
        Some(trend) => {
            if let Some(status) = payload.status {
                trend.status = status;
            }
            if let Some(topic) = payload.topic {
                trend.topic = topic;
            }
            if let Some(summary) = payload.summary {
                trend.summary = summary;
            }
            if let Some(tie_in) = payload.tendril_tie_in {
                trend.tendril_tie_in = tie_in;
            }
            if let Some(source) = payload.source {
                trend.source = source;
            }
            if let Some(url) = payload.url {
                trend.url = url;
            }
            if let Some(engagement) = payload.engagement {
                trend.engagement = engagement;
            }
            let updated = trend.clone();
            let _ = state.save(&ctx.data_file);
            Ok(Json(updated))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

pub async fn delete_trend(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> Result<StatusCode, StatusCode> {
    let mut state = ctx.state.write().await;
    let initial_len = state.trends.len();
    state.trends.retain(|t| t.id != id);
    if state.trends.len() < initial_len {
        let _ = state.save(&ctx.data_file);
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

pub async fn scout_trends(
    State(ctx): State<Arc<AppContext>>,
    Json(_payload): Json<ScoutTrendsRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-scout-{}", Uuid::new_v4().simple());
    let prompt = r#"You are an AI developer relations radar scout.
Research what is currently trending today in AI engineering, coding agents, and developer tools across:
1. GitHub Trending repositories (e.g. CLI agents, LLM harnesses, coding assistants)
2. Reddit discussions (r/LocalLLaMA, r/programming, r/ClaudeAI)
3. Tech LinkedIn / Twitter discussions regarding software engineering automation.

Identify 3 high-impact trending topics. For each topic provide:
- Source (GitHub, Reddit, or LinkedIn)
- Topic headline
- URL or reference thread
- Current engagement signal (e.g. stars today, comment volume)
- Brief summary of the core engineering bottleneck or excitement.
"#.to_string();

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();

    tokio::spawn(async move {
        let _ = runner.execute(&prompt, tx).await;
    });

    (
        StatusCode::ACCEPTED,
        Json(TrendActionResponse {
            task_id,
            message: "Trend scout started with Antigravity".to_string(),
        }),
    )
}

pub async fn synthesize_trend(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<SynthesizeTrendRequest>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    let trend = match state.trends.iter().find(|t| t.id == id) {
        Some(t) => t.clone(),
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(TrendActionResponse {
                    task_id: String::new(),
                    message: "Trend topic not found".to_string(),
                }),
            )
        }
    };
    drop(state);

    let tie_in = payload
        .tendril_tie_in
        .unwrap_or_else(|| trend.tendril_tie_in.clone());
    let channel = payload
        .channel
        .unwrap_or_else(|| "Website".to_string());

    let task_id = format!("task-syn-{}", Uuid::new_v4().simple());
    let article_id = format!("art-trend-{}", Uuid::new_v4().simple());

    let tie_in_instruction = match tie_in.as_str() {
        "direct" => "Directly link this trend to Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril). Explain specifically how Tendril's architecture (Git worktrees, multi-agent orchestration, verification gates) solves or capitalizes on this bottleneck.",
        "subtle" => "Offer high-level industry analysis. Mention Tendril naturally as an emerging open-source reference for worktree-based agent execution, without overly promotional tone.",
        _ => "Provide 100% pure technical commentary and architectural insight. Do NOT hard-sell Tendril; focus on high domain authority, code examples, and ecosystem education. Include natural references to open devtool patterns.",
    };

    let prompt = format!(
        r#"You are a seasoned principal tech analyst writing for an engineering blog and tech website.

A major topic is trending right now:
Source: {}
Headline: {}
Context: {}
Engagement: {}

Goal:
Write a viral, technically rigorous website article analyzing this phenomenon.
Target Channel: {}
Tie-in Mode: {} ({})

Requirements:
1. Catchy yet professional engineering title.
2. Technical root-cause breakdown of why this topic is blowing up right now.
3. Code snippets or architecture diagrams (using ASCII or Mermaid) where appropriate.
4. Cite authoritative primary sources and link to the original repository/thread.
5. Provide a bonus section at the bottom with ready-to-use social posts for LinkedIn and Reddit to promote this article.
6. Format in clean GitHub-flavored Markdown with YAML frontmatter."#,
        trend.source, trend.topic, trend.summary, trend.engagement, channel, tie_in, tie_in_instruction
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let art_id_clone = article_id.clone();
    let trend_id_clone = id.clone();
    let topic_title = trend.topic.clone();

    tokio::spawn(async move {
        match runner.execute(&prompt, tx.clone()).await {
            Ok(content) => {
                let mut state = state_arc.write().await;
                let title = content
                    .lines()
                    .find(|l| l.starts_with("# "))
                    .map(|l| l.trim_start_matches("# ").trim().to_string())
                    .unwrap_or_else(|| format!("Trend Analysis: {}", topic_title));

                let slug = slugify(&title);
                let article = Article {
                    id: art_id_clone.clone(),
                    title,
                    feature: "Trend Analysis".to_string(),
                    channel: channel.clone(),
                    angle: "Trend Radar".to_string(),
                    summary: format!("Real-time synthesis of trending topic: {}", topic_title),
                    content,
                    backlinks: if tie_in != "none" {
                        vec!["https://github.com/Ivy-Interactive/Ivy-Tendril".to_string()]
                    } else {
                        vec![]
                    },
                    outbound_citations: vec![trend.url.clone()],
                    status: "Ready".to_string(),
                    created_at: Utc::now(),
                    published_at: None,
                    slug: Some(slug),
                    exports: Vec::new(),
                };
                state.articles.insert(0, article);

                if let Some(t) = state.trends.iter_mut().find(|t| t.id == trend_id_clone) {
                    t.status = "Published".to_string();
                    t.generated_article_id = Some(art_id_clone);
                }
                let _ = state.save(&data_file);
                let _ = tx.send("[SYSTEM] Trend article synthesized and saved to website drafts!".to_string());
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Synthesis failed: {}", e));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(TrendActionResponse {
            task_id,
            message: "Trend synthesis started with Antigravity".to_string(),
        }),
    )
}

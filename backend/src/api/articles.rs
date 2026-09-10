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
pub struct CreateArticleRequest {
    pub title: String,
    pub feature: String,
    pub channel: String,
    pub angle: String,
    pub summary: String,
    pub content: String,
    pub backlinks: Vec<String>,
    pub outbound_citations: Vec<String>,
}

#[derive(Deserialize)]
pub struct UpdateArticleRequest {
    pub title: Option<String>,
    pub channel: Option<String>,
    pub summary: Option<String>,
    pub content: Option<String>,
    pub status: Option<String>,
    pub backlinks: Option<Vec<String>>,
    pub outbound_citations: Option<Vec<String>>,
}

#[derive(Deserialize)]
pub struct GenerateArticleRequest {
    pub feature: String, // "Worktrees", "Multi-Agent Orchestration", "Issue-to-PR", "Verification Gates", "Voice Control", "Tunneling", "Review & Diffs"
    pub angle: String,   // "Benchmark", "Architecture", "Comparison", "Tutorial", "Postmortem", "Ecosystem"
    pub channel: String, // "Website", "Dev.to", "Hashnode", "Medium", "Substack", "XThread", "Reddit"
    pub extra_context: Option<String>,
}

#[derive(Serialize)]
pub struct GenerateArticleResponse {
    pub task_id: String,
    pub article_id: String,
    pub message: String,
}

pub async fn list_articles(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    Json(state.articles.clone())
}

pub async fn get_article(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(article) = state.articles.iter().find(|a| a.id == id) {
        (StatusCode::OK, Json(Some(article.clone())))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub async fn create_article(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<CreateArticleRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let now = Utc::now();
    let new_article = Article {
        id: format!("art-{}", Uuid::new_v4().simple()),
        title: payload.title,
        feature: payload.feature,
        channel: payload.channel,
        angle: payload.angle,
        summary: payload.summary,
        content: payload.content,
        backlinks: payload.backlinks,
        outbound_citations: payload.outbound_citations,
        status: "Draft".to_string(),
        created_at: now,
        published_at: None,
    };
    state.articles.push(new_article.clone());
    let _ = state.save(&ctx.data_file);
    (StatusCode::CREATED, Json(new_article))
}

pub async fn update_article(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateArticleRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    if let Some(article) = state.articles.iter_mut().find(|a| a.id == id) {
        if let Some(title) = payload.title {
            article.title = title;
        }
        if let Some(channel) = payload.channel {
            article.channel = channel;
        }
        if let Some(summary) = payload.summary {
            article.summary = summary;
        }
        if let Some(content) = payload.content {
            article.content = content;
        }
        if let Some(status) = payload.status {
            if status == "Published" && article.published_at.is_none() {
                article.published_at = Some(Utc::now());
            }
            article.status = status;
        }
        if let Some(backlinks) = payload.backlinks {
            article.backlinks = backlinks;
        }
        if let Some(citations) = payload.outbound_citations {
            article.outbound_citations = citations;
        }
        let cloned = article.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(Some(cloned)))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub async fn delete_article(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let initial_len = state.articles.len();
    state.articles.retain(|a| a.id != id);
    if state.articles.len() < initial_len {
        let _ = state.save(&ctx.data_file);
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn generate_article(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateArticleRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-art-{}", Uuid::new_v4().simple());
    let article_id = format!("art-{}", Uuid::new_v4().simple());

    let prompt = format!(
        r#"You are a world-class principal software engineer and technical DevRel writer.
Write a comprehensive, engineering-grade 10x article for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).

Target Feature: {}
Content Angle: {}
Target Channel: {}
Additional Context: {}

Requirements:
1. Provide an authoritative title, executive summary, and deep technical breakdown with runnable code/terminal examples.
2. Must cite at least 3 authoritative external primary sources (e.g. Git documentation, official Anthropic/OpenAI CLI docs, SWE-bench benchmarks, Linux namespaces, etc.).
3. Must include natural backlinks to the Ivy-Tendril repository (https://github.com/Ivy-Interactive/Ivy-Tendril) and explain how Tendril solves this problem.
4. Conclude with a clear, non-pushy developer call-to-action (e.g., trying the workflow with `tendril run` or exploring the repo).
5. Output the article in clean GitHub-flavored Markdown with YAML frontmatter at the top (title, description, tags, canonical_url)."#,
        payload.feature,
        payload.angle,
        payload.channel,
        payload.extra_context.as_deref().unwrap_or("None")
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let art_id_clone = article_id.clone();
    let feature = payload.feature.clone();
    let channel = payload.channel.clone();
    let angle = payload.angle.clone();

    tokio::spawn(async move {
        match runner.execute(&prompt, tx.clone()).await {
            Ok(content) => {
                let mut state = state_arc.write().await;
                let title = content
                    .lines()
                    .find(|l| l.starts_with("# "))
                    .map(|l| l.trim_start_matches("# ").trim().to_string())
                    .unwrap_or_else(|| format!("Deep Dive: {} ({})", feature, angle));

                let summary = format!(
                    "Deep-dive article exploring {} with a {} perspective for {}.",
                    feature, angle, channel
                );

                let article = Article {
                    id: art_id_clone,
                    title,
                    feature,
                    channel,
                    angle,
                    summary,
                    content,
                    backlinks: vec![
                        "https://github.com/Ivy-Interactive/Ivy-Tendril".to_string(),
                    ],
                    outbound_citations: vec![
                        "https://git-scm.com/docs/git-worktree".to_string(),
                        "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code".to_string(),
                    ],
                    status: "Ready".to_string(),
                    created_at: Utc::now(),
                    published_at: None,
                };
                state.articles.insert(0, article);
                let _ = state.save(&data_file);
                let _ = tx.send("[SYSTEM] Article saved to drafts library.".to_string());
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Generation failed: {}", e));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(GenerateArticleResponse {
            task_id,
            article_id,
            message: "Article generation initiated with Antigravity".to_string(),
        }),
    )
}

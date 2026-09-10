use crate::api::issues::AppContext;
use crate::db::{Article, ExportRecord};
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
    let slug = slugify(&payload.title);
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
        slug: Some(slug),
        exports: Vec::new(),
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

                let slug = slugify(&title);
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
                    slug: Some(slug),
                    exports: Vec::new(),
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

// ---------------------------------------------------------------------------
// Export Pipeline & Multi-Channel Formatters
// ---------------------------------------------------------------------------

pub fn slugify(title: &str) -> String {
    let mut slug = String::with_capacity(title.len());
    let mut last_was_dash = false;

    for c in title.chars() {
        if c.is_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
            last_was_dash = false;
        } else if !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }
    }

    if slug.ends_with('-') {
        slug.pop();
    }

    if slug.is_empty() {
        "article".to_string()
    } else {
        slug
    }
}

pub fn clean_markdown_body(content: &str) -> String {
    let trimmed = content.trim();
    if let Some(stripped) = trimmed.strip_prefix("---") {
        if let Some((_fm, rest)) = stripped.split_once("\n---") {
            return rest.trim_start_matches(['\n', '\r']).trim().to_string();
        }
    }
    trimmed.to_string()
}

pub fn generate_ivy_web_frontmatter(article: &Article, slug: &str) -> String {
    let date_str = article
        .published_at
        .unwrap_or(article.created_at)
        .format("%Y-%m-%d")
        .to_string();

    let clean_title = article.title.replace('"', "\\\"");
    let clean_desc = article.summary.replace('"', "\\\"");

    format!(
        r#"---
title: "{}"
slug: "{}"
description: "{}"
publishedAt: "{}"
type: "blog"
status: "published"
categories:
  - "{}"
tags:
  - "{}"
  - "Ivy"
  - "DevTools"
image: "/site/images/blog/{}-hero.png"
canonical_url: "https://ivy.interactive/blog/{}"
---"#,
        clean_title,
        slug,
        clean_desc,
        date_str,
        article.angle,
        article.feature,
        slug,
        slug
    )
}

pub fn generate_ivy_web_post(article: &Article, slug: &str) -> String {
    let frontmatter = generate_ivy_web_frontmatter(article, slug);
    let body = clean_markdown_body(&article.content);
    format!("{}\n\n{}\n", frontmatter, body)
}

pub fn format_for_channel(article: &Article, channel: &str, slug: &str) -> (String, String) {
    let clean_body = clean_markdown_body(&article.content);
    let ch = channel.to_lowercase();

    match ch.as_str() {
        "dev.to" | "devto" => {
            let fm = format!(
                r#"---
title: {}
published: false
description: {}
tags: ivy, devtools, ai, programming
canonical_url: https://ivy.interactive/blog/{}
cover_image: https://ivy.interactive/site/images/blog/{}-hero.png
---

{}"#,
                article.title, article.summary, slug, slug, clean_body
            );
            (fm, "markdown".to_string())
        }
        "hashnode" => {
            let fm = format!(
                r#"---
title: {}
slug: {}
subtitle: {}
tags: ivy, devtools, ai-coding, software-engineering
canonicalUrl: https://ivy.interactive/blog/{}
coverImage: https://ivy.interactive/site/images/blog/{}-hero.png
---

{}"#,
                article.title, slug, article.summary, slug, slug, clean_body
            );
            (fm, "markdown".to_string())
        }
        "medium" => {
            let text = format!(
                r#"# {}

*{}*

{}

---
*Originally published at https://ivy.interactive/blog/{}*"#,
                article.title, article.summary, clean_body, slug
            );
            (text, "markdown".to_string())
        }
        "substack" => {
            let text = format!(
                r#"# {}

### {}

{}

---
> **Engineering Note:** Ivy-Tendril enables multi-agent coding in isolated Git worktrees. Try it locally at [github.com/Ivy-Interactive/Ivy-Tendril](https://github.com/Ivy-Interactive/Ivy-Tendril)."#,
                article.title, article.summary, clean_body
            );
            (text, "markdown".to_string())
        }
        "linkedin" => {
            let text = format!(
                r#"🚀 Why concurrent AI coding agents break without worktrees — and how to fix it:

{}

Key Engineering Takeaways:
• Isolated Worktrees: Zero dirty-index collisions across parallel agents
• Automated Verification Gates: Self-correcting unit tests before PR creation
• Authority Workflows: Moving from chat prompts to verified pull requests

Read the full technical breakdown: https://ivy.interactive/blog/{}
Explore the open-source repo: https://github.com/Ivy-Interactive/Ivy-Tendril

#SoftwareEngineering #AICoding #DevOps #Git #OpenSource #TechArchitecture"#,
                article.summary, slug
            );
            (text, "social".to_string())
        }
        "xthread" | "x" | "twitter" => {
            let text = format!(
                r#"1/5 🧵 {}

Most teams running AI coding agents hit a wall: workspace collisions and broken branches. Here's how we solved it with Git worktree isolation 👇

2/5 The Problem:
{}

3/5 The Solution:
Instead of sharing a working directory, each agent operates in its own isolated worktree with independent build artifacts and verification gates.

4/5 Why it matters for engineering teams:
• Parallel execution with zero lock contention
• Automated test self-correction before human review
• Clean, verified PRs ready for merge

5/5 Read the full deep-dive: https://ivy.interactive/blog/{}
Star the repo on GitHub: https://github.com/Ivy-Interactive/Ivy-Tendril ⚡"#,
                article.title, article.summary, slug
            );
            (text, "social".to_string())
        }
        _ => (clean_body, "markdown".to_string()),
    }
}

#[derive(Deserialize, Default)]
pub struct ExportIvyWebRequest {
    pub target_dir: Option<String>,
}

#[derive(Serialize)]
pub struct ExportIvyWebResponse {
    pub success: bool,
    pub file_path: String,
    pub slug: String,
    pub post_content: String,
    pub record: ExportRecord,
}

#[derive(Serialize)]
pub struct FormattedArticleResponse {
    pub channel: String,
    pub title: String,
    pub slug: String,
    pub formatted_content: String,
    pub preview_type: String,
}

#[derive(Deserialize)]
pub struct RecordExportRequest {
    pub channel: String,
    pub status: Option<String>,
    pub target_path: Option<String>,
}

pub async fn export_ivy_web(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<ExportIvyWebRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    if let Some(article) = state.articles.iter_mut().find(|a| a.id == id) {
        let slug = article
            .slug
            .clone()
            .unwrap_or_else(|| slugify(&article.title));
        article.slug = Some(slug.clone());

        let target_dir = payload
            .target_dir
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| ctx.ivy_web_content_path.clone());

        if let Err(e) = std::fs::create_dir_all(&target_dir) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to create directory: {}", e) })),
            );
        }

        let file_path = target_dir.join(format!("{}.mdoc", slug));
        let post_content = generate_ivy_web_post(article, &slug);

        if let Err(e) = std::fs::write(&file_path, &post_content) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to write file: {}", e) })),
            );
        }

        let now = Utc::now();
        let record = ExportRecord {
            channel: "ivy-web".to_string(),
            exported_at: now,
            target_path: Some(file_path.to_string_lossy().to_string()),
            status: "Success".to_string(),
        };

        article.exports.push(record.clone());
        let _ = state.save(&ctx.data_file);

        (
            StatusCode::OK,
            Json(serde_json::to_value(ExportIvyWebResponse {
                success: true,
                file_path: file_path.to_string_lossy().to_string(),
                slug,
                post_content,
                record,
            }).unwrap()),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found" })),
        )
    }
}

pub async fn format_article_channel(
    Path((id, channel)): Path<(String, String)>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(article) = state.articles.iter().find(|a| a.id == id) {
        let slug = article
            .slug
            .clone()
            .unwrap_or_else(|| slugify(&article.title));
        let (formatted_content, preview_type) = format_for_channel(article, &channel, &slug);

        (
            StatusCode::OK,
            Json(Some(FormattedArticleResponse {
                channel,
                title: article.title.clone(),
                slug,
                formatted_content,
                preview_type,
            })),
        )
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub async fn record_export(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<RecordExportRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    if let Some(article) = state.articles.iter_mut().find(|a| a.id == id) {
        let record = ExportRecord {
            channel: payload.channel,
            exported_at: Utc::now(),
            target_path: payload.target_path,
            status: payload.status.unwrap_or_else(|| "Copied".to_string()),
        };
        article.exports.push(record);
        let cloned = article.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(Some(cloned)))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Article;
    use chrono::Utc;

    #[test]
    fn test_slug_generation() {
        assert_eq!(
            slugify("How Git Worktrees Solve Agent Hallucination!"),
            "how-git-worktrees-solve-agent-hallucination"
        );
        assert_eq!(
            slugify("   Testing: Multiple --- Spaces & Punctuation!   "),
            "testing-multiple-spaces-punctuation"
        );
        assert_eq!(
            slugify("From Issue-to-PR: 15-Minute Autonomous Loop"),
            "from-issue-to-pr-15-minute-autonomous-loop"
        );
        assert_eq!(slugify(""), "article");
    }

    #[test]
    fn test_ivy_web_frontmatter_generation() {
        let now = Utc::now();
        let article = Article {
            id: "art-test".to_string(),
            title: "Test Article".to_string(),
            feature: "Worktrees".to_string(),
            channel: "Website".to_string(),
            angle: "Architecture".to_string(),
            summary: "Test summary of the article.".to_string(),
            content: "# Test\n\nSome body.".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Draft".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("test-article".to_string()),
            exports: vec![],
        };

        let fm = generate_ivy_web_frontmatter(&article, "test-article");
        assert!(fm.contains("title: \"Test Article\""));
        assert!(fm.contains("slug: \"test-article\""));
        assert!(fm.contains("description: \"Test summary of the article.\""));
        assert!(fm.contains("type: \"blog\""));
        assert!(fm.contains("status: \"published\""));
        assert!(fm.contains("- \"Architecture\""));
        assert!(fm.contains("- \"Worktrees\""));
        assert!(fm.contains("- \"Ivy\""));
        assert!(fm.contains("canonical_url: \"https://ivy.interactive/blog/test-article\""));
    }

    #[test]
    fn test_channel_formatters() {
        let now = Utc::now();
        let article = Article {
            id: "art-test".to_string(),
            title: "Test Article".to_string(),
            feature: "Worktrees".to_string(),
            channel: "Website".to_string(),
            angle: "Architecture".to_string(),
            summary: "Test summary.".to_string(),
            content: "Body content.".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Draft".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("test-article".to_string()),
            exports: vec![],
        };

        let (devto, t1) = format_for_channel(&article, "Dev.to", "test-article");
        assert_eq!(t1, "markdown");
        assert!(devto.contains("title: Test Article"));
        assert!(devto.contains("canonical_url: https://ivy.interactive/blog/test-article"));

        let (hashnode, t2) = format_for_channel(&article, "Hashnode", "test-article");
        assert_eq!(t2, "markdown");
        assert!(hashnode.contains("title: Test Article"));
        assert!(hashnode.contains("subtitle: Test summary."));

        let (medium, t3) = format_for_channel(&article, "Medium", "test-article");
        assert_eq!(t3, "markdown");
        assert!(medium.contains("# Test Article"));
        assert!(medium.contains("*Originally published at https://ivy.interactive/blog/test-article*"));

        let (substack, t4) = format_for_channel(&article, "Substack", "test-article");
        assert_eq!(t4, "markdown");
        assert!(substack.contains("# Test Article"));
        assert!(substack.contains("Engineering Note:"));

        let (linkedin, t5) = format_for_channel(&article, "LinkedIn", "test-article");
        assert_eq!(t5, "social");
        assert!(linkedin.contains("#SoftwareEngineering"));
        assert!(linkedin.contains("https://ivy.interactive/blog/test-article"));

        let (xthread, t6) = format_for_channel(&article, "XThread", "test-article");
        assert_eq!(t6, "social");
        assert!(xthread.contains("1/5"));
        assert!(xthread.contains("5/5"));
    }

    #[test]
    fn test_export_ivy_web_file_write() {
        let temp_dir = std::env::temp_dir().join(format!("growthhack_test_{}", uuid::Uuid::new_v4().simple()));
        let now = Utc::now();
        let article = Article {
            id: "art-test".to_string(),
            title: "Temp Export Test".to_string(),
            feature: "Worktrees".to_string(),
            channel: "Website".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing file write.".to_string(),
            content: "# Header\n\nContent here.".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Draft".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("temp-export-test".to_string()),
            exports: vec![],
        };

        std::fs::create_dir_all(&temp_dir).unwrap();
        let post = generate_ivy_web_post(&article, "temp-export-test");
        let target_file = temp_dir.join("temp-export-test.mdoc");
        std::fs::write(&target_file, post).unwrap();

        assert!(target_file.exists());
        let read_back = std::fs::read_to_string(&target_file).unwrap();
        assert!(read_back.contains("title: \"Temp Export Test\""));
        assert!(read_back.contains("# Header"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_record_export() {
        let now = Utc::now();
        let mut article = Article {
            id: "art-test".to_string(),
            title: "Record Export Test".to_string(),
            feature: "Worktrees".to_string(),
            channel: "Website".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing export record.".to_string(),
            content: "Content".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Draft".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("record-export-test".to_string()),
            exports: vec![],
        };

        let rec = ExportRecord {
            channel: "Dev.to".to_string(),
            exported_at: now,
            target_path: None,
            status: "Copied".to_string(),
        };
        article.exports.push(rec);

        assert_eq!(article.exports.len(), 1);
        assert_eq!(article.exports[0].channel, "Dev.to");
        assert_eq!(article.exports[0].status, "Copied");
    }
}

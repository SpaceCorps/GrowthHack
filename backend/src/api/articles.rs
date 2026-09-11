use crate::api::issues::AppContext;
use crate::db::{
    Article, ChannelMetrics, EngagementMetrics, EngagementMilestoneAlert, EngagementSnapshot,
    ExportRecord,
};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

pub use super::banner::*;

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
    pub angle: String, // "Benchmark", "Architecture", "Comparison", "Tutorial", "Postmortem", "Ecosystem"
    pub channel: String, // "Website", "Dev.to", "Hashnode", "Medium", "Substack", "XThread", "Reddit"
    pub extra_context: Option<String>,
}

#[derive(Serialize)]
pub struct GenerateArticleResponse {
    pub task_id: String,
    pub article_id: String,
    pub message: String,
}

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct GenerateSpotlightRequest {
    pub project_name: String,
    pub repo_url: String,
    pub tagline: String,
    pub key_features: Vec<String>,
    pub target_channel: String, // "LinkedIn", "XThread", "Reddit", "Dev.to"
    pub extra_notes: Option<String>,
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
        engagement: None,
        engagement_snapshots: Vec::new(),
        engagement_badges: Vec::new(),
        milestone_alerts: Vec::new(),
    };
    state.articles.push(new_article.clone());
    let _ = state.save(&ctx.data_file);
    (StatusCode::CREATED, Json(new_article))
}

pub async fn update_article(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateArticleRequest>,
) -> (StatusCode, Json<Option<Article>>) {
    let mut state = ctx.state.write().await;
    if let Some(article) = state.articles.iter_mut().find(|a| a.id == id) {
        let content_modified = payload
            .content
            .as_ref()
            .is_some_and(|c| c != &article.content)
            || payload.title.as_ref().is_some_and(|t| t != &article.title)
            || payload
                .summary
                .as_ref()
                .is_some_and(|s| s != &article.summary);

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
            } else if status != "Published" {
                article.published_at = None;
            }
            article.status = status;
        } else if content_modified {
            article.status = "Pending".to_string();
            article.published_at = None;
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

pub fn get_feature_details(feature: &str) -> (&'static str, &'static str, Vec<String>) {
    match feature {
        "Worktrees" => (
            "Git Worktree Isolation: Zero-Cost Sandboxes for Parallel Agents",
            r#"Git worktree isolation eliminates filesystem lock contention and `.git/index.lock` collisions when multiple autonomous agents run in parallel. By checking out branches into separate directories backed by a single git repository (`git worktree add <path> <branch>`), Tendril provides sub-second clean isolation, zero network clone overhead, and seamless worktree prune cleanup without corrupting developer working trees."#,
            vec![
                "https://git-scm.com/docs/git-worktree".to_string(),
                "https://git-scm.com/docs/git-checkout".to_string(),
                "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code".to_string(),
            ],
        ),
        "Multi-Agent Orchestration" => (
            "Autonomous Multi-Agent Swarms: Concurrency Across Claude Code, Codex, and Gemini",
            r#"Tendril orchestrates heterogeneous autonomous coding agents across multiple foundation models. Planning agents author concrete revisions, execution agents implement code inside dedicated worktrees, and verification agents enforce strict compilation and test policies before changes reach human review."#,
            vec![
                "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code".to_string(),
                "https://www.swebench.com/".to_string(),
                "https://docs.github.com/en/actions".to_string(),
            ],
        ),
        "Issue-to-PR" => (
            "Autonomous GitHub Issue to Verified Pull Request Pipeline",
            r#"Tendril automates the complete developer lifecycle from issue intake to mergeable PR: parsing requirements, drafting structured execution plans, spinning up isolated git worktrees, executing agentic coding runs, executing verification suites, and committing and pushing formatted PRs with comprehensive execution logs."#,
            vec![
                "https://docs.github.com/en/rest/issues".to_string(),
                "https://docs.github.com/en/pull-requests".to_string(),
                "https://www.swebench.com/".to_string(),
            ],
        ),
        "Verification Gates" => (
            "Deterministic Verification Gates: Self-Correction Loops Over Raw LLM Generation",
            r#"Rather than trusting unverified LLM output, Tendril surrounds agent execution with strict verification gates (Rust Clippy, Vitest, NpmBuild, RustBuild, and custom check results). When a verification gate fails, the agent receives diagnostic compiler output and iteratively self-corrects inside the worktree before committing."#,
            vec![
                "https://doc.rust-lang.org/clippy/".to_string(),
                "https://vitest.dev/guide/".to_string(),
                "https://man7.org/linux/man-pages/man7/namespaces.7.html".to_string(),
            ],
        ),
        "Voice Control" => (
            "Hands-Free Voice-Driven Engineering: Conversational Steering for Background Agents",
            r#"Tendril integrates hands-free voice coding interfaces with real-time speech transcription, enabling developers to prompt, steer, pause, and inspect running agent swarms verbally while reviewing diffs or attending to other development tasks."#,
            vec![
                "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API".to_string(),
                "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code".to_string(),
                "https://w3c.github.io/mediacapture-main/".to_string(),
            ],
        ),
        "Tunneling" => (
            "Instant Remote Web Previews & Secure Reverse Tunneling",
            r#"Tendril provides instant remote preview URLs through secure reverse tunneling. Stakeholders and distributed team members can interact with running applications directly from an agent's worktree without manual deployment, firewall changes, or local port forwarding."#,
            vec![
                "https://datatracker.ietf.org/doc/html/rfc7230".to_string(),
                "https://man7.org/linux/man-pages/man7/namespaces.7.html".to_string(),
                "https://docs.github.com/en/actions".to_string(),
            ],
        ),
        "Review & Diffs" => (
            "Visual Diff Inspection & Verification Audit Trails",
            r#"Tendril provides interactive visual diff reviews, syntax-highlighted side-by-side worktree inspections, and step-by-step verification audit logs, guaranteeing human oversight before any agent-generated code merges into production."#,
            vec![
                "https://git-scm.com/docs/git-diff".to_string(),
                "https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/reviewing-changes-in-pull-requests".to_string(),
                "https://www.swebench.com/".to_string(),
            ],
        ),
        _ => (
            "Core Tendril Capabilities",
            r#"Tendril delivers end-to-end autonomous multi-agent orchestration within isolated git worktrees, protected by automated verification gates and full visual review audits."#,
            vec![
                "https://git-scm.com/docs/git-worktree".to_string(),
                "https://docs.anthropic.com/en/docs/agents-and-tools/claude-code".to_string(),
                "https://www.swebench.com/".to_string(),
            ],
        ),
    }
}

pub fn get_archetype_details(archetype: &str) -> (&'static str, &'static str) {
    match archetype {
        "Architecture" => (
            "Deep Architectural Breakdown",
            "Focus on deep architectural internals, process lifecycle, filesystem isolation boundaries, and deterministic state transitions. Provide ASCII/system diagrams and detailed component interaction flows.",
        ),
        "Benchmark" => (
            "Empirical Benchmark & Cost Study",
            "Focus on quantitative evaluation: token cost per resolved task, SWE-bench verified solve rates, time to merged PR, and cache hit efficiency compared to traditional workflows.",
        ),
        "Comparison" => (
            "Head-to-Head Comparison vs Cline/OpenHands",
            "Provide an objective, feature-by-feature comparison against Cline, OpenHands, Aider, and standalone Claude Code CLI. Contrast workspace containment, multi-repo support, and verification gates.",
        ),
        "Tutorial" => (
            "15-Minute Golden Path Tutorial",
            "Structure as a step-by-step hands-on tutorial with copy-paste terminal commands, initialization scripts, and immediate milestone validations for rapid developer onboarding.",
        ),
        "Postmortem" => (
            "Production Failure Postmortem",
            "Analyze a real-world multi-agent failure (e.g. branch collisions, index.lock conflicts, hallucinated untested code), demonstrate the root cause, and explain how Tendril's architecture prevents it.",
        ),
        "Ecosystem" => (
            "Open Source Ecosystem Commentary",
            "Analyze macro trends in autonomous software factories, open-source agent tooling, and the paradigm shift from autocomplete Copilots to autonomous background agent swarms.",
        ),
        "Migration" => (
            "Migration Guide: Copilot to Multi-Agent",
            "Provide a practical step-by-step transition roadmap moving teams from single-agent inline IDE completions to asynchronous, parallel background agent pipelines.",
        ),
        "Security" => (
            "Security & Sandboxing Deep Dive",
            "Analyze blast radius containment, secret protection, credential masking, worktree filesystem isolation, and automated verification gates that prevent malicious or buggy payloads.",
        ),
        "TokenEconomics" => (
            "ROI & Token Economics Analysis",
            "Deep dive into the financial and operational economics of AI software development: cost per resolved PR, prompt caching savings, and decoupling planning models from execution workers.",
        ),
        "Manifesto" => (
            "Developer Manifesto",
            "A passionate, opinionated manifesto arguing why deterministic verification gates, compiler guarantees, and isolated worktrees fundamentally beat prompt engineering and raw LLM trust.",
        ),
        _ => (
            "In-Depth Technical Analysis",
            "Provide an engineering-grade technical analysis exploring trade-offs, architecture, and practical implementations.",
        ),
    }
}

pub fn build_feature_article_prompt(
    feature: &str,
    archetype: &str,
    channel: &str,
    extra_context: Option<&str>,
) -> (String, Vec<String>, Vec<String>) {
    let (feature_title, feature_bg, citations) = get_feature_details(feature);
    let (archetype_title, archetype_instructions) = get_archetype_details(archetype);
    let backlinks = vec![
        "https://github.com/Ivy-Interactive/Ivy-Tendril".to_string(),
        "https://github.com/Ivy-Interactive/Ivy-Tendril/blob/main/README.md".to_string(),
    ];

    let citations_list = citations
        .iter()
        .map(|c| format!("- {}", c))
        .collect::<Vec<_>>()
        .join("\n");
    let backlinks_list = backlinks
        .iter()
        .map(|b| format!("- {}", b))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        r#"You are a world-class principal software engineer and technical DevRel writer.
Write a comprehensive, engineering-grade 10x technical article for Ivy-Tendril (https://github.com/Ivy-Interactive/Ivy-Tendril).

## Topic & Framing
- **Target Feature**: {feature} ({feature_title})
- **Content Archetype**: {archetype} ({archetype_title})
- **Target Publishing Channel**: {channel}
- **Additional Context**: {extra_context}

## Feature Domain Context
{feature_bg}

## Archetype Guidelines ({archetype})
{archetype_instructions}

## Authority Citations & Tendril Backlinks Requirements
1. **Mandatory Citations**: You MUST cite and integrate at least these 3 authoritative primary sources:
{citations_list}
2. **Mandatory Tendril Backlinks**: You MUST include natural backlinks with informative anchor text to:
{backlinks_list}
Explain specifically how Ivy-Tendril incorporates these principles.

## Structure & Output Format
1. Include clean YAML frontmatter at the top:
```yaml
title: "<Authoritative, High-CTR Engineering Title>"
description: "<Engaging 150-character meta description>"
tags: ["developers", "devops", "ai-agents", "software-engineering", "git"]
canonical_url: "https://ivy-tendril.dev/blog/{feature_slug}-{archetype_slug}"
author: "SpaceCorps Engineering"
```
2. Executive summary with problem statement and quantifiable stakes.
3. Deep technical breakdown with runnable terminal or code examples.
4. Conclude with a clear, non-pushy developer call-to-action (e.g. exploring https://github.com/Ivy-Interactive/Ivy-Tendril or cloning the repo).
5. Output clean GitHub-flavored Markdown."#,
        feature = feature,
        feature_title = feature_title,
        archetype = archetype,
        archetype_title = archetype_title,
        channel = channel,
        extra_context = extra_context.unwrap_or("None"),
        feature_bg = feature_bg,
        archetype_instructions = archetype_instructions,
        citations_list = citations_list,
        backlinks_list = backlinks_list,
        feature_slug = feature.to_lowercase().replace(' ', "-"),
        archetype_slug = archetype.to_lowercase().replace(' ', "-")
    );

    (prompt, backlinks, citations)
}

pub fn build_project_spotlight_prompt(payload: &GenerateSpotlightRequest) -> String {
    let hook_options = r#"Choose one of these hook styles:
- "Someone built an open-source alternative to [X] that runs on your own machine 🔥"
- "This open-source repo solves [Y] in 50 lines of code 🚀"
- "Most developers don't know this open-source tool exists, but it replaces a $500/mo SaaS 🔥""#;

    let tendril_note = r#"--
P.S. We are building Ivy-Tendril, an autonomous multi-agent coding factory that plans tasks, orchestrates agents in isolated Git worktrees, and produces verified PRs. Try it locally or explore the repo -> https://github.com/Ivy-Interactive/Ivy-Tendril"#;

    format!(
        r#"You are Stanislav Beliaev, a viral technical open-source curator and software engineer.
Write a punchy, viral developer post spotlighting an exciting open-source project.

Project Name: {project_name}
Repository URL: {repo_url}
Tagline / Differentiator: {tagline}
Key Technical Capabilities:
{key_features}
Target Channel: {channel}
Additional Context: {extra_notes}

Structure and Tone Requirements (Stanislav Beliaev Style):
1. **Opening Hook**: Begin immediately with an irresistible opening line celebrating the tool (e.g. 🔥 or 🚀):
{hook_options}
2. **Identity**: Clearly state: "It's called {project_name}."
3. **Core Value Prop**: "You clone it, connect your own model, and get [key capabilities]..."
4. **Crisp Technical Bullets**: Short 1-2 sentence paragraphs on architecture, sandboxing, policy engines, and configuration. Highlight self-hosting and zero vendor lock-in.
5. **Licensing & Self-Hosting**: Emphasize: "MIT licensed, self-hosted, your Postgres, your model key."
6. **Engagement Bridge / Repo Link**: "Link in the comments." / Call out {repo_url}.
7. **Mandatory Tendril Signature Note**:
The post MUST end with this EXACT signature note verbatim:
{tendril_note}

Produce the final post ready for publishing on {channel}."#,
        project_name = payload.project_name,
        repo_url = payload.repo_url,
        tagline = payload.tagline,
        key_features = payload
            .key_features
            .iter()
            .map(|f| format!("- {}", f))
            .collect::<Vec<_>>()
            .join("\n"),
        channel = payload.target_channel,
        extra_notes = payload.extra_notes.as_deref().unwrap_or("None"),
        hook_options = hook_options,
        tendril_note = tendril_note
    )
}

pub async fn generate_article(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateArticleRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-art-{}", Uuid::new_v4().simple());
    let article_id = format!("art-{}", Uuid::new_v4().simple());

    let (prompt, backlinks, outbound_citations) = build_feature_article_prompt(
        &payload.feature,
        &payload.angle,
        &payload.channel,
        payload.extra_context.as_deref(),
    );

    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let art_id_clone = article_id.clone();
    let feature = payload.feature.clone();
    let channel = payload.channel.clone();
    let angle = payload.angle.clone();

    ctx.task_manager
        .spawn_task_with_callback(&task_id, prompt, move |content, tx| async move {
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
                backlinks,
                outbound_citations,
                status: "Draft".to_string(),
                created_at: Utc::now(),
                published_at: None,
                slug: Some(slug),
                exports: Vec::new(),
                engagement: None,
                engagement_snapshots: Vec::new(),
                engagement_badges: Vec::new(),
                milestone_alerts: Vec::new(),
            };
            state.articles.insert(0, article);
            let _ = state.save(&data_file);
            let _ = tx.send("[SYSTEM] Article saved to drafts library.".to_string());
        })
        .await;

    (
        StatusCode::ACCEPTED,
        Json(GenerateArticleResponse {
            task_id,
            article_id,
            message: "Article generation initiated with Antigravity".to_string(),
        }),
    )
}

pub async fn generate_spotlight(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateSpotlightRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-art-{}", Uuid::new_v4().simple());
    let article_id = format!("art-{}", Uuid::new_v4().simple());

    let prompt = build_project_spotlight_prompt(&payload);

    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let art_id_clone = article_id.clone();
    let project_name = payload.project_name.clone();
    let repo_url = payload.repo_url.clone();
    let channel = payload.target_channel.clone();
    let tagline = payload.tagline.clone();

    ctx.task_manager
        .spawn_task_with_callback(&task_id, prompt, move |content, tx| async move {
            let mut state = state_arc.write().await;
            let title = content
                .lines()
                .find(|l| l.starts_with("# "))
                .map(|l| l.trim_start_matches("# ").trim().to_string())
                .unwrap_or_else(|| format!("Project Spotlight: {}", project_name));

            let summary = format!(
                "Stanislav Beliaev style open-source project spotlight on {} ({}).",
                project_name, tagline
            );

            let article = Article {
                id: art_id_clone,
                title,
                feature: "Open Source Spotlight".to_string(),
                channel,
                angle: "Project Spotlight".to_string(),
                summary,
                content,
                backlinks: vec![
                    "https://github.com/Ivy-Interactive/Ivy-Tendril".to_string(),
                    repo_url.clone(),
                ],
                outbound_citations: vec![repo_url],
                status: "Draft".to_string(),
                created_at: Utc::now(),
                published_at: None,
                slug: None,
                exports: Vec::new(),
                engagement: None,
                engagement_snapshots: Vec::new(),
                engagement_badges: Vec::new(),
                milestone_alerts: Vec::new(),
            };
            state.articles.insert(0, article);
            let _ = state.save(&data_file);
            let _ = tx.send("[SYSTEM] Project spotlight saved to drafts library.".to_string());
        })
        .await;

    (
        StatusCode::ACCEPTED,
        Json(GenerateArticleResponse {
            task_id,
            article_id,
            message: "Project spotlight generation initiated with Antigravity".to_string(),
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

pub fn generate_ivy_web_frontmatter_with_options(
    article: &Article,
    slug: &str,
    hero_format: Option<&str>,
) -> String {
    let date_str = article
        .published_at
        .unwrap_or(article.created_at)
        .format("%Y-%m-%d")
        .to_string();

    let clean_title = article.title.replace('"', "\\\"");
    let clean_desc = article.summary.replace('"', "\\\"");

    let format_choice = hero_format.unwrap_or("dual").to_lowercase();
    let image_lines = match format_choice.as_str() {
        "svg" => format!(
            "image: \"/site/images/blog/{}-hero.svg\"\nimage_svg: \"/site/images/blog/{}-hero.svg\"",
            slug, slug
        ),
        "png" => format!("image: \"/site/images/blog/{}-hero.png\"", slug),
        _ => format!(
            "image: \"/site/images/blog/{}-hero.png\"\nimage_svg: \"/site/images/blog/{}-hero.svg\"",
            slug, slug
        ),
    };

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
{}
canonical_url: "https://ivy.interactive/blog/{}"
---"#,
        clean_title, slug, clean_desc, date_str, article.angle, article.feature, image_lines, slug
    )
}

pub fn generate_ivy_web_frontmatter(article: &Article, slug: &str) -> String {
    generate_ivy_web_frontmatter_with_options(article, slug, None)
}

pub fn generate_ivy_web_post_with_options(
    article: &Article,
    slug: &str,
    hero_format: Option<&str>,
) -> String {
    let frontmatter = generate_ivy_web_frontmatter_with_options(article, slug, hero_format);
    let body = clean_markdown_body(&article.content);
    format!("{}\n\n{}\n", frontmatter, body)
}

pub fn generate_ivy_web_post(article: &Article, slug: &str) -> String {
    generate_ivy_web_post_with_options(article, slug, None)
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

pub const DEFAULT_HERO_IMAGE: &[u8] = include_bytes!("../../../frontend/src/assets/hero.png");

pub fn sync_hero_asset(
    slug: &str,
    target_images_dir: &std::path::Path,
    title: &str,
    category: &str,
) -> Result<std::path::PathBuf, std::io::Error> {
    tracing::info!(
        "Syncing hero asset for article '{}' (slug: '{}', category: '{}')",
        title,
        slug,
        category
    );

    let blog_dir = if target_images_dir.file_name().and_then(|f| f.to_str()) == Some("blog") {
        target_images_dir.to_path_buf()
    } else {
        target_images_dir.join("blog")
    };

    std::fs::create_dir_all(&blog_dir)?;
    let dest_file = blog_dir.join(format!("{}-hero.png", slug));
    std::fs::write(&dest_file, DEFAULT_HERO_IMAGE)?;

    // Also write dynamic SVG hero banner
    let svg_content = generate_hero_banner_svg(title, category, "", None);
    let svg_dest_file = blog_dir.join(format!("{}-hero.svg", slug));
    std::fs::write(&svg_dest_file, svg_content)?;

    Ok(dest_file)
}

#[derive(Deserialize, Default)]
pub struct ExportIvyWebRequest {
    pub target_dir: Option<String>,
    pub target_images_dir: Option<String>,
    pub sync_hero_image: Option<bool>,
    pub hero_format: Option<String>,
}

#[derive(Serialize)]
pub struct ExportIvyWebResponse {
    pub success: bool,
    pub file_path: String,
    pub slug: String,
    pub post_content: String,
    pub record: ExportRecord,
    pub image_path: Option<String>,
}

#[derive(Deserialize, Default)]
pub struct SyncAssetsRequest {
    pub target_images_dir: Option<String>,
}

#[derive(Serialize)]
pub struct SyncAssetsResponse {
    pub success: bool,
    pub image_path: String,
    pub slug: String,
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
        let post_content =
            generate_ivy_web_post_with_options(article, &slug, payload.hero_format.as_deref());

        if let Err(e) = std::fs::write(&file_path, &post_content) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to write file: {}", e) })),
            );
        }

        let sync_hero = payload.sync_hero_image.unwrap_or(true);
        let mut image_path_str = None;

        if sync_hero {
            let images_dir = payload
                .target_images_dir
                .map(std::path::PathBuf::from)
                .unwrap_or_else(|| ctx.ivy_web_images_path.clone());

            match sync_hero_asset(&slug, &images_dir, &article.title, &article.angle) {
                Ok(img_path) => {
                    image_path_str = Some(img_path.to_string_lossy().to_string());
                }
                Err(e) => {
                    return (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(
                            serde_json::json!({ "error": format!("Failed to sync hero asset: {}", e) }),
                        ),
                    );
                }
            }
        }

        let now = Utc::now();
        let record = ExportRecord {
            channel: "ivy-web".to_string(),
            exported_at: now,
            target_path: Some(file_path.to_string_lossy().to_string()),
            status: "Success".to_string(),
            external_id: None,
            engagement: None,
        };

        article.exports.push(record.clone());
        let _ = state.save(&ctx.data_file);

        (
            StatusCode::OK,
            Json(
                serde_json::to_value(ExportIvyWebResponse {
                    success: true,
                    file_path: file_path.to_string_lossy().to_string(),
                    slug,
                    post_content,
                    record,
                    image_path: image_path_str,
                })
                .unwrap(),
            ),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found" })),
        )
    }
}

#[derive(Deserialize, Default)]
pub struct AutoPostRequest {
    pub target_dir: Option<String>,
    pub target_images_dir: Option<String>,
    pub sync_hero_image: Option<bool>,
    pub hero_format: Option<String>,
}

#[derive(Serialize)]
pub struct AutoPostResponse {
    pub success: bool,
    pub article: Article,
    pub file_path: String,
    pub slug: String,
    pub image_path: Option<String>,
    pub record: ExportRecord,
}

pub async fn auto_post_article(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    payload: Option<Json<AutoPostRequest>>,
) -> impl IntoResponse {
    let payload = payload.map(|Json(p)| p).unwrap_or_default();
    let mut state = ctx.state.write().await;

    let Some(article) = state.articles.iter().find(|a| a.id == id) else {
        return (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found" })),
        );
    };

    let slug = article
        .slug
        .clone()
        .unwrap_or_else(|| slugify(&article.title));
    let post_content =
        generate_ivy_web_post_with_options(article, &slug, payload.hero_format.as_deref());

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
    if let Err(e) = std::fs::write(&file_path, &post_content) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to write file: {}", e) })),
        );
    }

    let sync_hero = payload.sync_hero_image.unwrap_or(true);
    let mut image_path_str = None;

    if sync_hero {
        let images_dir = payload
            .target_images_dir
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| ctx.ivy_web_images_path.clone());

        match sync_hero_asset(&slug, &images_dir, &article.title, &article.angle) {
            Ok(img_path) => {
                image_path_str = Some(img_path.to_string_lossy().to_string());
            }
            Err(e) => {
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(
                        serde_json::json!({ "error": format!("Failed to sync hero asset: {}", e) }),
                    ),
                );
            }
        }
    }

    let article = state
        .articles
        .iter_mut()
        .find(|a| a.id == id)
        .expect("article existed above and state lock has been held continuously");

    article.slug = Some(slug.clone());
    article.status = "Published".to_string();
    if article.published_at.is_none() {
        article.published_at = Some(Utc::now());
    }

    let record = ExportRecord {
        channel: "ivy-web".to_string(),
        exported_at: Utc::now(),
        target_path: Some(file_path.to_string_lossy().to_string()),
        status: "Success".to_string(),
        external_id: None,
        engagement: None,
    };
    article.exports.push(record.clone());

    let cloned = article.clone();
    let _ = state.save(&ctx.data_file);

    (
        StatusCode::OK,
        Json(
            serde_json::to_value(AutoPostResponse {
                success: true,
                article: cloned,
                file_path: file_path.to_string_lossy().to_string(),
                slug,
                image_path: image_path_str,
                record,
            })
            .unwrap(),
        ),
    )
}

pub async fn sync_assets(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    payload: Option<Json<SyncAssetsRequest>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(article) = state.articles.iter().find(|a| a.id == id) {
        let slug = article
            .slug
            .clone()
            .unwrap_or_else(|| slugify(&article.title));

        let images_dir = payload
            .and_then(|p| p.0.target_images_dir)
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| ctx.ivy_web_images_path.clone());

        match sync_hero_asset(&slug, &images_dir, &article.title, &article.angle) {
            Ok(img_path) => (
                StatusCode::OK,
                Json(
                    serde_json::to_value(SyncAssetsResponse {
                        success: true,
                        image_path: img_path.to_string_lossy().to_string(),
                        slug,
                    })
                    .unwrap(),
                ),
            ),
            Err(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to sync hero asset: {}", e) })),
            ),
        }
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found" })),
        )
    }
}

#[derive(Deserialize, Default)]
pub struct HeroBannerQuery {
    pub theme: Option<String>,
    pub title: Option<String>,
    pub category: Option<String>,
    pub summary: Option<String>,
}

pub async fn get_hero_banner_svg(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Query(query): Query<HeroBannerQuery>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(article) = state.articles.iter().find(|a| a.id == id) {
        let title = query.title.as_deref().unwrap_or(&article.title);
        let category = query.category.as_deref().unwrap_or(&article.angle);
        let summary = query.summary.as_deref().unwrap_or(&article.summary);
        let svg = generate_hero_banner_svg(title, category, summary, query.theme.as_deref());

        (
            StatusCode::OK,
            [(
                axum::http::header::CONTENT_TYPE,
                "image/svg+xml; charset=utf-8",
            )],
            svg,
        )
            .into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found" })),
        )
            .into_response()
    }
}

#[derive(Deserialize)]
pub struct UploadHeroImageRequest {
    pub image_data: String,
    pub target_images_dir: Option<String>,
}

#[derive(Serialize)]
pub struct UploadHeroImageResponse {
    pub success: bool,
    pub image_path: String,
    pub slug: String,
    pub bytes_written: usize,
}

pub async fn upload_hero_image(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UploadHeroImageRequest>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(article) = state.articles.iter().find(|a| a.id == id) {
        let slug = article
            .slug
            .clone()
            .unwrap_or_else(|| slugify(&article.title));

        let images_dir = payload
            .target_images_dir
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| ctx.ivy_web_images_path.clone());

        let blog_dir = if images_dir.file_name().and_then(|f| f.to_str()) == Some("blog") {
            images_dir
        } else {
            images_dir.join("blog")
        };

        if let Err(e) = std::fs::create_dir_all(&blog_dir) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to create directory: {}", e) })),
            )
                .into_response();
        }

        use base64::prelude::*;
        let raw_base64 = if let Some(idx) = payload.image_data.find(";base64,") {
            &payload.image_data[idx + 8..]
        } else {
            payload.image_data.trim()
        };

        let image_bytes = match BASE64_STANDARD.decode(raw_base64) {
            Ok(bytes) => bytes,
            Err(e) => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({ "error": format!("Invalid base64 payload: {}", e) })),
                )
                    .into_response();
            }
        };

        let dest_png = blog_dir.join(format!("{}-hero.png", slug));
        if let Err(e) = std::fs::write(&dest_png, &image_bytes) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to write PNG: {}", e) })),
            )
                .into_response();
        }

        let svg_path = blog_dir.join(format!("{}-hero.svg", slug));
        let svg_content =
            generate_hero_banner_svg(&article.title, &article.angle, &article.summary, None);
        let _ = std::fs::write(&svg_path, svg_content);

        (
            StatusCode::OK,
            Json(
                serde_json::to_value(UploadHeroImageResponse {
                    success: true,
                    image_path: dest_png.to_string_lossy().to_string(),
                    slug,
                    bytes_written: image_bytes.len(),
                })
                .unwrap(),
            ),
        )
            .into_response()
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found" })),
        )
            .into_response()
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
            external_id: None,
            engagement: None,
        };
        article.exports.push(record);
        let cloned = article.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(Some(cloned)))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SyndicationSettingsResponse {
    pub devto_configured: bool,
    pub devto_key_preview: Option<String>,
    pub hashnode_configured: bool,
    pub hashnode_key_preview: Option<String>,
    pub hashnode_publication_id: Option<String>,
    pub publish_as_draft: bool,
    pub webhook_secret_configured: bool,
    pub webhook_secret_preview: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Default)]
pub struct UpdateSyndicationSettingsRequest {
    pub devto_api_key: Option<String>,
    pub hashnode_api_key: Option<String>,
    pub hashnode_publication_id: Option<String>,
    pub publish_as_draft: Option<bool>,
    pub webhook_secret: Option<String>,
}

fn mask_api_key(key: Option<&str>) -> (bool, Option<String>) {
    match key {
        Some(k) if !k.trim().is_empty() => {
            let trimmed = k.trim();
            let preview = if trimmed.len() <= 4 {
                "****".to_string()
            } else {
                format!("...{}", &trimmed[trimmed.len() - 4..])
            };
            (true, Some(preview))
        }
        _ => (false, None),
    }
}

pub async fn get_syndication_settings(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    let devto_key = state
        .syndication_settings
        .devto_api_key
        .as_deref()
        .or(ctx.config.devto_api_key.as_deref());
    let hashnode_key = state
        .syndication_settings
        .hashnode_api_key
        .as_deref()
        .or(ctx.config.hashnode_api_key.as_deref());
    let hashnode_pub_id = state
        .syndication_settings
        .hashnode_publication_id
        .as_deref()
        .or(ctx.config.hashnode_publication_id.as_deref())
        .map(|s| s.to_string());
    let webhook_sec = state
        .syndication_settings
        .webhook_secret
        .as_deref()
        .or(ctx.config.syndication_webhook_secret.as_deref());

    let (devto_configured, devto_key_preview) = mask_api_key(devto_key);
    let (hashnode_configured, hashnode_key_preview) = mask_api_key(hashnode_key);
    let (webhook_secret_configured, webhook_secret_preview) = mask_api_key(webhook_sec);

    let res = SyndicationSettingsResponse {
        devto_configured,
        devto_key_preview,
        hashnode_configured,
        hashnode_key_preview,
        hashnode_publication_id: hashnode_pub_id,
        publish_as_draft: state.syndication_settings.publish_as_draft,
        webhook_secret_configured,
        webhook_secret_preview,
    };

    (StatusCode::OK, Json(res))
}

pub async fn update_syndication_settings(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateSyndicationSettingsRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    if let Some(ref k) = payload.devto_api_key {
        state.syndication_settings.devto_api_key = if k.trim().is_empty() {
            None
        } else {
            Some(k.trim().to_string())
        };
    }
    if let Some(ref k) = payload.hashnode_api_key {
        state.syndication_settings.hashnode_api_key = if k.trim().is_empty() {
            None
        } else {
            Some(k.trim().to_string())
        };
    }
    if let Some(ref pid) = payload.hashnode_publication_id {
        state.syndication_settings.hashnode_publication_id = if pid.trim().is_empty() {
            None
        } else {
            Some(pid.trim().to_string())
        };
    }
    if let Some(pad) = payload.publish_as_draft {
        state.syndication_settings.publish_as_draft = pad;
    }
    if let Some(ref sec) = payload.webhook_secret {
        state.syndication_settings.webhook_secret = if sec.trim().is_empty() {
            None
        } else {
            Some(sec.trim().to_string())
        };
    }

    let _ = state.save(&ctx.data_file);

    let devto_key = state
        .syndication_settings
        .devto_api_key
        .as_deref()
        .or(ctx.config.devto_api_key.as_deref());
    let hashnode_key = state
        .syndication_settings
        .hashnode_api_key
        .as_deref()
        .or(ctx.config.hashnode_api_key.as_deref());
    let hashnode_pub_id = state
        .syndication_settings
        .hashnode_publication_id
        .as_deref()
        .or(ctx.config.hashnode_publication_id.as_deref())
        .map(|s| s.to_string());
    let webhook_sec = state
        .syndication_settings
        .webhook_secret
        .as_deref()
        .or(ctx.config.syndication_webhook_secret.as_deref());

    let (devto_configured, devto_key_preview) = mask_api_key(devto_key);
    let (hashnode_configured, hashnode_key_preview) = mask_api_key(hashnode_key);
    let (webhook_secret_configured, webhook_secret_preview) = mask_api_key(webhook_sec);

    let res = SyndicationSettingsResponse {
        devto_configured,
        devto_key_preview,
        hashnode_configured,
        hashnode_key_preview,
        hashnode_publication_id: hashnode_pub_id,
        publish_as_draft: state.syndication_settings.publish_as_draft,
        webhook_secret_configured,
        webhook_secret_preview,
    };

    (StatusCode::OK, Json(res))
}

pub fn format_devto_payload(article: &Article, slug: &str, published: bool) -> serde_json::Value {
    let body = clean_markdown_body(&article.content);
    serde_json::json!({
        "article": {
            "title": article.title,
            "body_markdown": body,
            "published": published,
            "description": article.summary,
            "tags": ["ivy", "devtools", "ai", "programming"],
            "canonical_url": format!("https://ivy.interactive/blog/{}", slug),
            "main_image": format!("https://ivy.interactive/site/images/blog/{}-hero.png", slug)
        }
    })
}

pub fn format_hashnode_publish_mutation(
    article: &Article,
    slug: &str,
    publication_id: &str,
    original_url: &str,
) -> serde_json::Value {
    let body = clean_markdown_body(&article.content);
    serde_json::json!({
        "query": "mutation PublishPost($input: PublishPostInput!) {\n  publishPost(input: $input) {\n    post {\n      id\n      title\n      slug\n      url\n    }\n  }\n}",
        "variables": {
            "input": {
                "publicationId": publication_id,
                "title": article.title,
                "subtitle": article.summary,
                "contentMarkdown": body,
                "slug": slug,
                "tags": [
                    { "name": "Ivy", "slug": "ivy" },
                    { "name": "Developer Tools", "slug": "devtools" },
                    { "name": "AI Coding", "slug": "ai-coding" },
                    { "name": "Software Engineering", "slug": "software-engineering" }
                ],
                "originalArticleURL": original_url,
                "coverImageOptions": {
                    "coverImageURL": format!("https://ivy.interactive/site/images/blog/{}-hero.png", slug)
                }
            }
        }
    })
}

pub async fn publish_devto(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let (article, devto_key, publish_as_draft) = {
        let state = ctx.state.read().await;
        let art = state.articles.iter().find(|a| a.id == id).cloned();
        let key = state
            .syndication_settings
            .devto_api_key
            .clone()
            .or_else(|| ctx.config.devto_api_key.clone());
        let draft = state.syndication_settings.publish_as_draft;
        (art, key, draft)
    };

    let article = match article {
        Some(a) => a,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Article not found" })),
            )
        }
    };

    let devto_key = match devto_key {
        Some(k) if !k.trim().is_empty() => k.trim().to_string(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Dev.to API key is not configured. Please configure your API key in Syndication Settings."
                })),
            )
        }
    };

    let slug = article
        .slug
        .clone()
        .unwrap_or_else(|| slugify(&article.title));
    let payload = format_devto_payload(&article, &slug, !publish_as_draft);

    let client = match reqwest::Client::builder()
        .user_agent("IvyTendrilGrowthHack/1.0")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("HTTP client error: {}", e) })),
            )
        }
    };

    let res = match client
        .post("https://dev.to/api/articles")
        .header("api-key", &devto_key)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(serde_json::json!({ "error": format!("Failed to connect to Dev.to: {}", e) })),
            )
        }
    };

    let status = res.status();
    if !status.is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Dev.to API returned error ({}): {}", status, err_body)
            })),
        );
    }

    let res_json: serde_json::Value = match res.json().await {
        Ok(j) => j,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(
                    serde_json::json!({ "error": format!("Failed to parse Dev.to response: {}", e) }),
                ),
            )
        }
    };

    let published_url = res_json["url"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| {
            if let Some(num) = res_json["id"].as_i64() {
                format!("https://dev.to/article/{}", num)
            } else {
                format!("https://dev.to/{}/{}", slug, id)
            }
        });

    let mut state = ctx.state.write().await;
    if let Some(art) = state.articles.iter_mut().find(|a| a.id == id) {
        if art.slug.is_none() {
            art.slug = Some(slug.clone());
        }
        let external_id = res_json["id"].as_i64().map(|n| n.to_string());
        let record = ExportRecord {
            channel: "Dev.to".to_string(),
            exported_at: Utc::now(),
            target_path: Some(published_url.clone()),
            status: "Published".to_string(),
            external_id,
            engagement: None,
        };
        art.exports.push(record.clone());
        let _ = state.save(&ctx.data_file);

        (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "url": published_url,
                "record": record
            })),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found during state update" })),
        )
    }
}

pub async fn publish_hashnode(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let (article, hashnode_key, hashnode_pub_id) = {
        let state = ctx.state.read().await;
        let art = state.articles.iter().find(|a| a.id == id).cloned();
        let key = state
            .syndication_settings
            .hashnode_api_key
            .clone()
            .or_else(|| ctx.config.hashnode_api_key.clone());
        let pub_id = state
            .syndication_settings
            .hashnode_publication_id
            .clone()
            .or_else(|| ctx.config.hashnode_publication_id.clone());
        (art, key, pub_id)
    };

    let article = match article {
        Some(a) => a,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "Article not found" })),
            )
        }
    };

    let hashnode_key = match hashnode_key {
        Some(k) if !k.trim().is_empty() => k.trim().to_string(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Hashnode API key is not configured. Please configure your Personal Access Token in Syndication Settings."
                })),
            )
        }
    };

    let client = match reqwest::Client::builder()
        .user_agent("IvyTendrilGrowthHack/1.0")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("HTTP client error: {}", e) })),
            )
        }
    };

    // Auto-discover publication ID if not configured
    let publication_id = match hashnode_pub_id {
        Some(ref pid) if !pid.trim().is_empty() => pid.trim().to_string(),
        _ => {
            let disc_query = serde_json::json!({
                "query": "query { me { publications(first: 1) { edges { node { id title } } } } }"
            });

            let disc_res = match client
                .post("https://gql.hashnode.com")
                .header("Authorization", &hashnode_key)
                .header("Content-Type", "application/json")
                .json(&disc_query)
                .send()
                .await
            {
                Ok(r) => r,
                Err(e) => {
                    return (
                        StatusCode::BAD_GATEWAY,
                        Json(
                            serde_json::json!({ "error": format!("Failed to connect to Hashnode for publication discovery: {}", e) }),
                        ),
                    )
                }
            };

            let disc_json: serde_json::Value = match disc_res.json().await {
                Ok(j) => j,
                Err(e) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(
                            serde_json::json!({ "error": format!("Failed to parse Hashnode discovery response: {}", e) }),
                        ),
                    )
                }
            };

            if let Some(pub_id) = disc_json["data"]["me"]["publications"]["edges"]
                .as_array()
                .and_then(|edges| edges.first())
                .and_then(|edge| edge["node"]["id"].as_str())
            {
                let found_id = pub_id.to_string();
                // Cache discovered publication ID in state
                {
                    let mut state = ctx.state.write().await;
                    state.syndication_settings.hashnode_publication_id = Some(found_id.clone());
                    let _ = state.save(&ctx.data_file);
                }
                found_id
            } else {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({
                        "error": "No Hashnode publication found for this account. Please specify your publication ID in Syndication Settings."
                    })),
                );
            }
        }
    };

    let slug = article
        .slug
        .clone()
        .unwrap_or_else(|| slugify(&article.title));
    let canonical_url = format!("https://ivy.interactive/blog/{}", slug);
    let payload =
        format_hashnode_publish_mutation(&article, &slug, &publication_id, &canonical_url);

    let res = match client
        .post("https://gql.hashnode.com")
        .header("Authorization", &hashnode_key)
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(
                    serde_json::json!({ "error": format!("Failed to connect to Hashnode: {}", e) }),
                ),
            )
        }
    };

    let status = res.status();
    if !status.is_success() {
        let err_body = res.text().await.unwrap_or_default();
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": format!("Hashnode GraphQL HTTP error ({}): {}", status, err_body)
            })),
        );
    }

    let res_json: serde_json::Value = match res.json().await {
        Ok(j) => j,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(
                    serde_json::json!({ "error": format!("Failed to parse Hashnode GraphQL response: {}", e) }),
                ),
            )
        }
    };

    if let Some(errs) = res_json["errors"].as_array() {
        if !errs.is_empty() {
            let msg = errs[0]["message"]
                .as_str()
                .unwrap_or("Unknown GraphQL error");
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": format!("Hashnode GraphQL error: {}", msg)
                })),
            );
        }
    }

    let published_url = res_json["data"]["publishPost"]["post"]["url"]
        .as_str()
        .map(|s| s.to_string())
        .unwrap_or_else(|| format!("https://hashnode.com/@ivy/{}", slug));

    let mut state = ctx.state.write().await;
    if let Some(art) = state.articles.iter_mut().find(|a| a.id == id) {
        if art.slug.is_none() {
            art.slug = Some(slug.clone());
        }
        let external_id = res_json["data"]["publishPost"]["post"]["id"]
            .as_str()
            .map(|s| s.to_string());
        let record = ExportRecord {
            channel: "Hashnode".to_string(),
            exported_at: Utc::now(),
            target_path: Some(published_url.clone()),
            status: "Published".to_string(),
            external_id,
            engagement: None,
        };
        art.exports.push(record.clone());
        let _ = state.save(&ctx.data_file);

        (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "url": published_url,
                "record": record
            })),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "Article not found during state update" })),
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedPlatformMetric {
    pub id: String,
    pub url: Option<String>,
    pub slug: Option<String>,
    pub reactions: u32,
    pub comments: u32,
    pub views: u32,
}

pub fn parse_devto_metrics(val: &serde_json::Value) -> Vec<ParsedPlatformMetric> {
    let mut metrics = Vec::new();
    if let Some(arr) = val.as_array() {
        for item in arr {
            let id = if let Some(n) = item["id"].as_i64() {
                n.to_string()
            } else if let Some(s) = item["id"].as_str() {
                s.to_string()
            } else {
                continue;
            };
            let url = item["url"].as_str().map(|s| s.to_string());
            let slug = item["slug"].as_str().map(|s| s.to_string());
            let reactions = item["public_reactions_count"]
                .as_u64()
                .or_else(|| item["reactions_count"].as_u64())
                .unwrap_or(0) as u32;
            let comments = item["comments_count"].as_u64().unwrap_or(0) as u32;
            let views = item["page_views_count"].as_u64().unwrap_or(0) as u32;
            metrics.push(ParsedPlatformMetric {
                id,
                url,
                slug,
                reactions,
                comments,
                views,
            });
        }
    }
    metrics
}

pub fn parse_hashnode_metrics(val: &serde_json::Value) -> Vec<ParsedPlatformMetric> {
    let mut metrics = Vec::new();
    let edges = val["data"]["publication"]["posts"]["edges"]
        .as_array()
        .or_else(|| val["publication"]["posts"]["edges"].as_array());
    if let Some(arr) = edges {
        for edge in arr {
            let node = &edge["node"];
            let id = if let Some(s) = node["id"].as_str() {
                s.to_string()
            } else {
                continue;
            };
            let url = node["url"].as_str().map(|s| s.to_string());
            let slug = node["slug"].as_str().map(|s| s.to_string());
            let reactions = node["reactionCount"].as_u64().unwrap_or(0) as u32;
            let comments = node["responseCount"].as_u64().unwrap_or(0) as u32;
            let views = node["views"].as_u64().unwrap_or(0) as u32;
            metrics.push(ParsedPlatformMetric {
                id,
                url,
                slug,
                reactions,
                comments,
                views,
            });
        }
    }
    metrics
}

pub fn calculate_aggregate_engagement(exports: &[ExportRecord]) -> EngagementMetrics {
    let mut total_reactions = 0;
    let mut total_comments = 0;
    let mut total_views = 0;
    let mut latest_sync: Option<chrono::DateTime<Utc>> = None;

    for exp in exports {
        if let Some(ref eng) = exp.engagement {
            total_reactions += eng.reactions;
            total_comments += eng.comments;
            total_views += eng.views;
            if let Some(ts) = eng.last_synced_at {
                latest_sync = match latest_sync {
                    Some(curr) if curr > ts => Some(curr),
                    _ => Some(ts),
                };
            }
        }
    }

    EngagementMetrics {
        reactions: total_reactions,
        comments: total_comments,
        views: total_views,
        last_synced_at: latest_sync,
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncMetricsSummary {
    pub success: bool,
    pub synced_count: usize,
    pub total_reactions: u32,
    pub total_comments: u32,
    pub total_views: u32,
    #[serde(default)]
    pub new_alerts_count: usize,
}

pub async fn sync_all_metrics_internal(
    ctx: &Arc<AppContext>,
) -> Result<SyncMetricsSummary, String> {
    let (devto_key, hashnode_key, hashnode_pub_id) = {
        let state = ctx.state.read().await;
        let d_key = state
            .syndication_settings
            .devto_api_key
            .clone()
            .or_else(|| ctx.config.devto_api_key.clone());
        let h_key = state
            .syndication_settings
            .hashnode_api_key
            .clone()
            .or_else(|| ctx.config.hashnode_api_key.clone());
        let h_pub = state
            .syndication_settings
            .hashnode_publication_id
            .clone()
            .or_else(|| ctx.config.hashnode_publication_id.clone());
        (d_key, h_key, h_pub)
    };

    let client = reqwest::Client::builder()
        .user_agent("IvyTendrilGrowthHack/1.0")
        .build()
        .map_err(|e| format!("HTTP client error: {}", e))?;

    let devto_metrics = if let Some(ref key) = devto_key {
        if !key.trim().is_empty() {
            match client
                .get("https://dev.to/api/articles/me/all")
                .header("api-key", key.trim())
                .send()
                .await
            {
                Ok(res) if res.status().is_success() => {
                    match res.json::<serde_json::Value>().await {
                        Ok(val) => parse_devto_metrics(&val),
                        Err(e) => {
                            tracing::warn!("Failed to parse Dev.to articles JSON: {}", e);
                            Vec::new()
                        }
                    }
                }
                Ok(res) => {
                    tracing::warn!("Dev.to API returned status: {}", res.status());
                    Vec::new()
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch Dev.to articles: {}", e);
                    Vec::new()
                }
            }
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    let hashnode_metrics = if let Some(ref key) = hashnode_key {
        if !key.trim().is_empty() {
            let pub_id = match hashnode_pub_id {
                Some(ref pid) if !pid.trim().is_empty() => Some(pid.trim().to_string()),
                _ => {
                    let disc_query = serde_json::json!({
                        "query": "query { me { publications(first: 1) { edges { node { id title } } } } }"
                    });
                    match client
                        .post("https://gql.hashnode.com")
                        .header("Authorization", key.trim())
                        .header("Content-Type", "application/json")
                        .json(&disc_query)
                        .send()
                        .await
                    {
                        Ok(r) => match r.json::<serde_json::Value>().await {
                            Ok(json) => json["data"]["me"]["publications"]["edges"][0]["node"]
                                ["id"]
                                .as_str()
                                .map(|s| s.to_string()),
                            Err(_) => None,
                        },
                        Err(_) => None,
                    }
                }
            };

            if let Some(pid) = pub_id {
                let query = serde_json::json!({
                    "query": "query GetPublicationPosts($id: ObjectId!) { publication(id: $id) { posts(first: 50) { edges { node { id url reactionCount responseCount views } } } } }",
                    "variables": { "id": pid }
                });
                match client
                    .post("https://gql.hashnode.com")
                    .header("Authorization", key.trim())
                    .header("Content-Type", "application/json")
                    .json(&query)
                    .send()
                    .await
                {
                    Ok(r) if r.status().is_success() => match r.json::<serde_json::Value>().await {
                        Ok(val) => parse_hashnode_metrics(&val),
                        Err(e) => {
                            tracing::warn!("Failed to parse Hashnode GraphQL response: {}", e);
                            Vec::new()
                        }
                    },
                    Ok(r) => {
                        tracing::warn!("Hashnode GraphQL returned status: {}", r.status());
                        Vec::new()
                    }
                    Err(e) => {
                        tracing::warn!("Failed to query Hashnode GraphQL: {}", e);
                        Vec::new()
                    }
                }
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    let now = Utc::now();
    let mut state = ctx.state.write().await;
    let mut total_reactions = 0;
    let mut total_comments = 0;
    let mut total_views = 0;
    let mut synced_count = 0;
    let mut all_new_alerts = Vec::new();
    let mut global_channels: std::collections::HashMap<String, ChannelMetrics> =
        std::collections::HashMap::new();

    for article in state.articles.iter_mut() {
        let mut article_had_sync = false;
        for export in article.exports.iter_mut() {
            if export.channel.eq_ignore_ascii_case("dev.to") {
                let matched = devto_metrics.iter().find(|m| {
                    if let Some(ref ext_id) = export.external_id {
                        if ext_id == &m.id {
                            return true;
                        }
                    }
                    if let Some(ref path) = export.target_path {
                        if path.contains(&m.id) {
                            return true;
                        }
                        if let Some(ref u) = m.url {
                            if path == u {
                                return true;
                            }
                        }
                    }
                    if let (Some(ref art_slug), Some(ref m_slug)) = (&article.slug, &m.slug) {
                        if art_slug == m_slug {
                            return true;
                        }
                    }
                    false
                });

                if let Some(m) = matched {
                    export.external_id = Some(m.id.clone());
                    export.engagement = Some(EngagementMetrics {
                        reactions: m.reactions,
                        comments: m.comments,
                        views: m.views,
                        last_synced_at: Some(now),
                    });
                    article_had_sync = true;
                }
            } else if export.channel.eq_ignore_ascii_case("hashnode") {
                let matched = hashnode_metrics.iter().find(|m| {
                    if let Some(ref ext_id) = export.external_id {
                        if ext_id == &m.id {
                            return true;
                        }
                    }
                    if let Some(ref path) = export.target_path {
                        if path.contains(&m.id) {
                            return true;
                        }
                        if let Some(ref u) = m.url {
                            if path == u {
                                return true;
                            }
                        }
                    }
                    if let (Some(ref art_slug), Some(ref m_slug)) = (&article.slug, &m.slug) {
                        if art_slug == m_slug {
                            return true;
                        }
                    }
                    false
                });

                if let Some(m) = matched {
                    export.external_id = Some(m.id.clone());
                    export.engagement = Some(EngagementMetrics {
                        reactions: m.reactions,
                        comments: m.comments,
                        views: m.views,
                        last_synced_at: Some(now),
                    });
                    article_had_sync = true;
                }
            }
        }

        let has_any_engagement = article.exports.iter().any(|e| e.engagement.is_some());
        if has_any_engagement {
            let agg = calculate_aggregate_engagement(&article.exports);
            article.engagement = Some(EngagementMetrics {
                reactions: agg.reactions,
                comments: agg.comments,
                views: agg.views,
                last_synced_at: if article_had_sync {
                    Some(now)
                } else {
                    agg.last_synced_at.or(Some(now))
                },
            });
        }

        let mut article_channels: std::collections::HashMap<String, ChannelMetrics> =
            std::collections::HashMap::new();
        for export in &article.exports {
            if let Some(ref eng) = export.engagement {
                let ch_name = if export.channel.eq_ignore_ascii_case("dev.to")
                    || export.channel.eq_ignore_ascii_case("devto")
                {
                    "Dev.to".to_string()
                } else if export.channel.eq_ignore_ascii_case("hashnode") {
                    "Hashnode".to_string()
                } else if export.channel.eq_ignore_ascii_case("medium") {
                    "Medium".to_string()
                } else {
                    export.channel.clone()
                };

                let entry = article_channels.entry(ch_name).or_default();
                entry.views += eng.views;
                entry.reactions += eng.reactions;
                entry.comments += eng.comments;
            }
        }

        if let Some(ref eng) = article.engagement {
            total_reactions += eng.reactions;
            total_comments += eng.comments;
            total_views += eng.views;
            synced_count += 1;

            for (ch, m) in &article_channels {
                let g = global_channels.entry(ch.clone()).or_default();
                g.views += m.views;
                g.reactions += m.reactions;
                g.comments += m.comments;
            }

            record_engagement_snapshot(
                &mut article.engagement_snapshots,
                now,
                eng.views,
                eng.reactions,
                eng.comments,
                article_channels,
                MAX_ARTICLE_SNAPSHOTS,
            );
        }

        let article_alerts = evaluate_article_milestones(article, now);
        all_new_alerts.extend(article_alerts);
    }

    if synced_count > 0 || !state.articles.is_empty() {
        record_engagement_snapshot(
            &mut state.global_engagement_snapshots,
            now,
            total_views,
            total_reactions,
            total_comments,
            global_channels,
            MAX_GLOBAL_SNAPSHOTS,
        );
    }

    let new_alerts_count = all_new_alerts.len();
    if !all_new_alerts.is_empty() {
        let mut combined = all_new_alerts;
        combined.append(&mut state.engagement_alerts);
        combined.truncate(200);
        state.engagement_alerts = combined;
    }

    let _ = state.save(&ctx.data_file);

    Ok(SyncMetricsSummary {
        success: true,
        synced_count,
        total_reactions,
        total_comments,
        total_views,
        new_alerts_count,
    })
}

pub fn evaluate_article_milestones(
    article: &mut Article,
    now: DateTime<Utc>,
) -> Vec<EngagementMilestoneAlert> {
    let mut new_alerts = Vec::new();
    let eng = match &article.engagement {
        Some(e) => e.clone(),
        None => return new_alerts,
    };

    let view_thresholds: &[(u32, &str)] = &[
        (100, "100+ Views"),
        (500, "500+ Views"),
        (1000, "1K+ Views"),
        (5000, "5K+ Views"),
        (10000, "10K+ Views"),
    ];

    let reaction_thresholds: &[(u32, &str)] = &[
        (25, "25+ Reactions"),
        (50, "50+ Reactions"),
        (100, "100+ Reactions"),
        (250, "250+ Reactions"),
    ];

    let comment_thresholds: &[(u32, &str)] = &[
        (10, "10+ Comments"),
        (25, "25+ Comments"),
        (50, "50+ Comments"),
    ];

    for &(threshold, badge) in view_thresholds {
        if eng.views >= threshold && !article.engagement_badges.iter().any(|b| b == badge) {
            article.engagement_badges.push(badge.to_string());
            let alert = EngagementMilestoneAlert {
                id: format!("alert-{}", Uuid::new_v4().simple()),
                article_id: article.id.clone(),
                article_title: article.title.clone(),
                milestone_type: "views".to_string(),
                threshold,
                message: format!("'{}' reached {}!", article.title, badge),
                badge_awarded: badge.to_string(),
                triggered_at: now,
                acknowledged: false,
            };
            article.milestone_alerts.push(alert.clone());
            new_alerts.push(alert);
        }
    }

    for &(threshold, badge) in reaction_thresholds {
        if eng.reactions >= threshold && !article.engagement_badges.iter().any(|b| b == badge) {
            article.engagement_badges.push(badge.to_string());
            let alert = EngagementMilestoneAlert {
                id: format!("alert-{}", Uuid::new_v4().simple()),
                article_id: article.id.clone(),
                article_title: article.title.clone(),
                milestone_type: "reactions".to_string(),
                threshold,
                message: format!("'{}' reached {}!", article.title, badge),
                badge_awarded: badge.to_string(),
                triggered_at: now,
                acknowledged: false,
            };
            article.milestone_alerts.push(alert.clone());
            new_alerts.push(alert);
        }
    }

    for &(threshold, badge) in comment_thresholds {
        if eng.comments >= threshold && !article.engagement_badges.iter().any(|b| b == badge) {
            article.engagement_badges.push(badge.to_string());
            let alert = EngagementMilestoneAlert {
                id: format!("alert-{}", Uuid::new_v4().simple()),
                article_id: article.id.clone(),
                article_title: article.title.clone(),
                milestone_type: "comments".to_string(),
                threshold,
                message: format!("'{}' reached {}!", article.title, badge),
                badge_awarded: badge.to_string(),
                triggered_at: now,
                acknowledged: false,
            };
            article.milestone_alerts.push(alert.clone());
            new_alerts.push(alert);
        }
    }

    new_alerts
}

pub const MAX_ARTICLE_SNAPSHOTS: usize = 500;
pub const MAX_GLOBAL_SNAPSHOTS: usize = 1000;

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct ChannelVelocity {
    pub views_per_day: f64,
    pub reactions_per_day: f64,
    pub comments_per_day: f64,
    pub views_delta_24h: i64,
    pub reactions_delta_24h: i64,
    pub comments_delta_24h: i64,
    pub trend: String,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct EngagementVelocity {
    pub views_per_day: f64,
    pub reactions_per_day: f64,
    pub comments_per_day: f64,
    pub views_delta_24h: i64,
    pub reactions_delta_24h: i64,
    pub comments_delta_24h: i64,
    pub trend: String, // "Accelerating", "Steady", "Decelerating", "Flat"
    #[serde(default)]
    pub channels: std::collections::HashMap<String, ChannelVelocity>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize, PartialEq)]
pub struct EngagementHistoryResponse {
    pub snapshots: Vec<EngagementSnapshot>,
    pub velocity: EngagementVelocity,
}

pub fn record_engagement_snapshot(
    snapshots: &mut Vec<EngagementSnapshot>,
    timestamp: DateTime<Utc>,
    views: u32,
    reactions: u32,
    comments: u32,
    channels: std::collections::HashMap<String, ChannelMetrics>,
    max_capacity: usize,
) -> bool {
    let should_record = match snapshots.last() {
        Some(last) => {
            let metrics_changed = last.views != views
                || last.reactions != reactions
                || last.comments != comments
                || last.channels != channels;
            let elapsed_secs = (timestamp - last.timestamp).num_seconds();
            metrics_changed || elapsed_secs >= 3600
        }
        None => true,
    };

    if should_record {
        snapshots.push(EngagementSnapshot {
            timestamp,
            views,
            reactions,
            comments,
            channels,
        });
        if snapshots.len() > max_capacity {
            let overflow = snapshots.len() - max_capacity;
            snapshots.drain(0..overflow);
        }
        true
    } else {
        false
    }
}

fn compute_velocity_from_series(
    points: &[(DateTime<Utc>, u32, u32, u32)],
) -> (f64, f64, f64, i64, i64, i64, String) {
    if points.len() <= 1 {
        return (0.0, 0.0, 0.0, 0, 0, 0, "Flat".to_string());
    }

    let latest = &points[points.len() - 1];
    let cutoff_24h = latest.0 - chrono::Duration::hours(24);
    let baseline_idx = points.iter().rposition(|p| p.0 <= cutoff_24h).unwrap_or(0);
    let baseline_24h = &points[baseline_idx];

    let views_delta_24h = latest.1 as i64 - baseline_24h.1 as i64;
    let reactions_delta_24h = latest.2 as i64 - baseline_24h.2 as i64;
    let comments_delta_24h = latest.3 as i64 - baseline_24h.3 as i64;

    let dt_secs = (latest.0 - baseline_24h.0).num_seconds() as f64;
    let (views_per_day, reactions_per_day, comments_per_day) = if dt_secs >= 60.0 {
        let days = dt_secs / 86400.0;
        (
            ((latest.1 as f64 - baseline_24h.1 as f64) / days * 10.0).round() / 10.0,
            ((latest.2 as f64 - baseline_24h.2 as f64) / days * 10.0).round() / 10.0,
            ((latest.3 as f64 - baseline_24h.3 as f64) / days * 10.0).round() / 10.0,
        )
    } else {
        (0.0, 0.0, 0.0)
    };

    let trend = if views_delta_24h <= 0 && reactions_delta_24h <= 0 && comments_delta_24h <= 0 {
        "Flat".to_string()
    } else if points.len() >= 3 {
        let mid_idx = baseline_idx + (points.len() - 1 - baseline_idx) / 2;
        let midpoint = &points[mid_idx];
        let dt_prior = (midpoint.0 - baseline_24h.0).num_seconds() as f64;
        let dt_recent = (latest.0 - midpoint.0).num_seconds() as f64;

        if dt_prior >= 60.0 && dt_recent >= 60.0 {
            let rate_prior = (midpoint.1 as f64 - baseline_24h.1 as f64) / dt_prior;
            let rate_recent = (latest.1 as f64 - midpoint.1 as f64) / dt_recent;

            if rate_prior > 0.0 {
                let ratio = rate_recent / rate_prior;
                if ratio > 1.15 {
                    "Accelerating".to_string()
                } else if ratio < 0.85 {
                    "Decelerating".to_string()
                } else {
                    "Steady".to_string()
                }
            } else if rate_recent > 0.0 {
                "Accelerating".to_string()
            } else {
                "Steady".to_string()
            }
        } else {
            "Steady".to_string()
        }
    } else {
        "Steady".to_string()
    };

    (
        views_per_day,
        reactions_per_day,
        comments_per_day,
        views_delta_24h,
        reactions_delta_24h,
        comments_delta_24h,
        trend,
    )
}

pub fn calculate_engagement_velocity(
    snapshots: &[EngagementSnapshot],
    _now: DateTime<Utc>,
) -> EngagementVelocity {
    if snapshots.is_empty() {
        return EngagementVelocity {
            views_per_day: 0.0,
            reactions_per_day: 0.0,
            comments_per_day: 0.0,
            views_delta_24h: 0,
            reactions_delta_24h: 0,
            comments_delta_24h: 0,
            trend: "Flat".to_string(),
            channels: std::collections::HashMap::new(),
        };
    }

    let mut sorted = snapshots.to_vec();
    sorted.sort_by_key(|s| s.timestamp);

    let global_points: Vec<(DateTime<Utc>, u32, u32, u32)> = sorted
        .iter()
        .map(|s| (s.timestamp, s.views, s.reactions, s.comments))
        .collect();

    let (
        views_per_day,
        reactions_per_day,
        comments_per_day,
        views_delta_24h,
        reactions_delta_24h,
        comments_delta_24h,
        trend,
    ) = compute_velocity_from_series(&global_points);

    let mut channel_names: std::collections::BTreeSet<String> = ["Dev.to", "Hashnode", "Medium"]
        .iter()
        .map(|s| s.to_string())
        .collect();
    for s in &sorted {
        for k in s.channels.keys() {
            channel_names.insert(k.clone());
        }
    }

    let mut channels: std::collections::HashMap<String, ChannelVelocity> =
        std::collections::HashMap::new();

    for ch in channel_names {
        let ch_points: Vec<(DateTime<Utc>, u32, u32, u32)> = sorted
            .iter()
            .map(|s| {
                if let Some(m) = s.channels.get(&ch) {
                    (s.timestamp, m.views, m.reactions, m.comments)
                } else {
                    (s.timestamp, 0, 0, 0)
                }
            })
            .collect();

        let (
            ch_vpd,
            ch_rpd,
            ch_cpd,
            ch_vd24,
            ch_rd24,
            ch_cd24,
            ch_trend,
        ) = compute_velocity_from_series(&ch_points);

        channels.insert(
            ch,
            ChannelVelocity {
                views_per_day: ch_vpd,
                reactions_per_day: ch_rpd,
                comments_per_day: ch_cpd,
                views_delta_24h: ch_vd24,
                reactions_delta_24h: ch_rd24,
                comments_delta_24h: ch_cd24,
                trend: ch_trend,
            },
        );
    }

    EngagementVelocity {
        views_per_day,
        reactions_per_day,
        comments_per_day,
        views_delta_24h,
        reactions_delta_24h,
        comments_delta_24h,
        trend,
        channels,
    }
}

pub async fn get_global_engagement_history(
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    let now = Utc::now();
    let velocity = calculate_engagement_velocity(&state.global_engagement_snapshots, now);
    (
        StatusCode::OK,
        Json(EngagementHistoryResponse {
            snapshots: state.global_engagement_snapshots.clone(),
            velocity,
        }),
    )
}

pub async fn get_article_engagement_history(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(art) = state.articles.iter().find(|a| a.id == id) {
        let now = Utc::now();
        let velocity = calculate_engagement_velocity(&art.engagement_snapshots, now);
        (
            StatusCode::OK,
            Json(
                serde_json::to_value(EngagementHistoryResponse {
                    snapshots: art.engagement_snapshots.clone(),
                    velocity,
                })
                .unwrap(),
            ),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Article not found"
            })),
        )
    }
}

pub async fn sync_metrics(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    match sync_all_metrics_internal(&ctx).await {
        Ok(summary) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "synced_count": summary.synced_count,
                "total_reactions": summary.total_reactions,
                "total_comments": summary.total_comments,
                "total_views": summary.total_views
            })),
        ),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({
                "success": false,
                "error": e
            })),
        ),
    }
}

pub async fn sync_article_metrics(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let _ = sync_all_metrics_internal(&ctx).await;
    let state = ctx.state.read().await;
    if let Some(art) = state.articles.iter().find(|a| a.id == id) {
        (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "article": art
            })),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "success": false,
                "error": "Article not found"
            })),
        )
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, Default)]
pub struct SeedEngagementRequest {
    #[serde(default)]
    pub views: Option<u32>,
    #[serde(default)]
    pub reactions: Option<u32>,
    #[serde(default)]
    pub comments: Option<u32>,
    #[serde(default)]
    pub channels: Option<std::collections::HashMap<String, ChannelMetrics>>,
    #[serde(default)]
    pub generate_history_days: Option<u32>,
    #[serde(default)]
    pub reset_badges: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SeedEngagementResponse {
    pub success: bool,
    pub article: Article,
    pub new_alerts: Vec<EngagementMilestoneAlert>,
    pub new_alerts_count: usize,
    pub velocity: EngagementVelocity,
}

pub fn is_dev_endpoints_enabled() -> bool {
    if let Ok(val) = std::env::var("ENABLE_DEV_ENDPOINTS") {
        if val == "0" || val.eq_ignore_ascii_case("false") {
            return false;
        }
        if val == "1" || val.eq_ignore_ascii_case("true") {
            return true;
        }
    }
    cfg!(debug_assertions)
}

pub fn seed_article_metrics(
    article: &mut Article,
    req: &SeedEngagementRequest,
    now: DateTime<Utc>,
) -> (Vec<EngagementMilestoneAlert>, EngagementVelocity) {
    if req.reset_badges.unwrap_or(false) {
        article.engagement_badges.clear();
        article.milestone_alerts.clear();
        article.engagement_snapshots.clear();
    }

    let default_channels = {
        let mut m = std::collections::HashMap::new();
        m.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 750,
                reactions: 40,
                comments: 10,
            },
        );
        m.insert(
            "Hashnode".to_string(),
            ChannelMetrics {
                views: 500,
                reactions: 25,
                comments: 8,
            },
        );
        m
    };

    let channels = req.channels.clone().unwrap_or(default_channels);
    let views = req.views.unwrap_or_else(|| {
        if req.channels.is_some() {
            channels.values().map(|c| c.views).sum()
        } else {
            1250
        }
    });
    let reactions = req.reactions.unwrap_or_else(|| {
        if req.channels.is_some() {
            channels.values().map(|c| c.reactions).sum()
        } else {
            65
        }
    });
    let comments = req.comments.unwrap_or_else(|| {
        if req.channels.is_some() {
            channels.values().map(|c| c.comments).sum()
        } else {
            18
        }
    });

    article.engagement = Some(EngagementMetrics {
        views,
        reactions,
        comments,
        last_synced_at: Some(now),
    });

    if req.reset_badges.unwrap_or(false) && views == 0 && reactions == 0 && comments == 0 {
        for export in &mut article.exports {
            export.engagement = None;
        }
    } else {
        for export in &mut article.exports {
            if let Some(ch_metrics) = channels.get(&export.channel) {
                export.engagement = Some(EngagementMetrics {
                    reactions: ch_metrics.reactions,
                    comments: ch_metrics.comments,
                    views: ch_metrics.views,
                    last_synced_at: Some(now),
                });
            }
        }
    }

    let skip_snapshot = views == 0
        && reactions == 0
        && comments == 0
        && req.generate_history_days.unwrap_or(0) == 0;

    if !skip_snapshot {
        let history_days = req.generate_history_days.unwrap_or(7);
        if history_days > 0 {
            let steps: Vec<(chrono::Duration, f64)> = if history_days >= 7 {
                vec![
                    (chrono::Duration::days(history_days as i64), 0.10),
                    (chrono::Duration::days((history_days as i64 * 4) / 7), 0.25),
                    (chrono::Duration::days((history_days as i64 * 2) / 7), 0.50),
                    (chrono::Duration::hours(26), 0.65),
                    (chrono::Duration::hours(6), 0.85),
                    (chrono::Duration::zero(), 1.0),
                ]
            } else if history_days >= 2 {
                vec![
                    (chrono::Duration::days(history_days as i64), 0.25),
                    (chrono::Duration::hours(26), 0.65),
                    (chrono::Duration::hours(6), 0.85),
                    (chrono::Duration::zero(), 1.0),
                ]
            } else {
                vec![
                    (chrono::Duration::hours(26), 0.65),
                    (chrono::Duration::hours(6), 0.85),
                    (chrono::Duration::zero(), 1.0),
                ]
            };

            for (offset, frac) in steps {
                let ts = now - offset;
                let v = (views as f64 * frac).round() as u32;
                let r = (reactions as f64 * frac).round() as u32;
                let c = (comments as f64 * frac).round() as u32;
                let mut step_channels = std::collections::HashMap::new();
                for (ch_name, ch_m) in &channels {
                    step_channels.insert(
                        ch_name.clone(),
                        ChannelMetrics {
                            views: (ch_m.views as f64 * frac).round() as u32,
                            reactions: (ch_m.reactions as f64 * frac).round() as u32,
                            comments: (ch_m.comments as f64 * frac).round() as u32,
                        },
                    );
                }
                record_engagement_snapshot(
                    &mut article.engagement_snapshots,
                    ts,
                    v,
                    r,
                    c,
                    step_channels,
                    MAX_ARTICLE_SNAPSHOTS,
                );
            }
            article.engagement_snapshots.sort_by_key(|s| s.timestamp);
        } else {
            record_engagement_snapshot(
                &mut article.engagement_snapshots,
                now,
                views,
                reactions,
                comments,
                channels.clone(),
                MAX_ARTICLE_SNAPSHOTS,
            );
        }
    }

    let new_alerts = evaluate_article_milestones(article, now);
    let velocity = calculate_engagement_velocity(&article.engagement_snapshots, now);
    (new_alerts, velocity)
}

pub async fn seed_article_engagement(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    body: Option<Json<SeedEngagementRequest>>,
) -> impl IntoResponse {
    if !is_dev_endpoints_enabled() {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "success": false,
                "error": "Dev seed endpoints are only available in debug builds or when ENABLE_DEV_ENDPOINTS=1"
            })),
        );
    }

    let req = body.map(|b| b.0).unwrap_or_default();
    let now = Utc::now();
    let mut state = ctx.state.write().await;

    let article = match state.articles.iter_mut().find(|a| a.id == id) {
        Some(a) => a,
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({
                    "success": false,
                    "error": "Article not found"
                })),
            );
        }
    };

    let (new_alerts, velocity) = seed_article_metrics(article, &req, now);
    let cloned_article = article.clone();

    if !new_alerts.is_empty() {
        let mut combined = new_alerts.clone();
        combined.append(&mut state.engagement_alerts);
        combined.truncate(200);
        state.engagement_alerts = combined;
    }

    let total_views: u32 = state
        .articles
        .iter()
        .filter_map(|a| a.engagement.as_ref().map(|e| e.views))
        .sum();
    let total_reactions: u32 = state
        .articles
        .iter()
        .filter_map(|a| a.engagement.as_ref().map(|e| e.reactions))
        .sum();
    let total_comments: u32 = state
        .articles
        .iter()
        .filter_map(|a| a.engagement.as_ref().map(|e| e.comments))
        .sum();

    let mut global_channels: std::collections::HashMap<String, ChannelMetrics> =
        std::collections::HashMap::new();
    for art in &state.articles {
        for export in &art.exports {
            if let Some(ref eng) = export.engagement {
                let g = global_channels.entry(export.channel.clone()).or_default();
                g.views += eng.views;
                g.reactions += eng.reactions;
                g.comments += eng.comments;
            }
        }
        if let Some(last_snap) = art.engagement_snapshots.last() {
            for (ch, m) in &last_snap.channels {
                let g = global_channels.entry(ch.clone()).or_default();
                if art.exports.iter().all(|e| &e.channel != ch) {
                    g.views += m.views;
                    g.reactions += m.reactions;
                    g.comments += m.comments;
                }
            }
        }
    }

    record_engagement_snapshot(
        &mut state.global_engagement_snapshots,
        now,
        total_views,
        total_reactions,
        total_comments,
        global_channels,
        MAX_GLOBAL_SNAPSHOTS,
    );

    let _ = state.save(&ctx.data_file);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "article": cloned_article,
            "new_alerts": new_alerts,
            "new_alerts_count": new_alerts.len(),
            "velocity": velocity
        })),
    )
}

pub async fn seed_engagement_batch(
    State(ctx): State<Arc<AppContext>>,
    body: Option<Json<SeedEngagementRequest>>,
) -> impl IntoResponse {
    if !is_dev_endpoints_enabled() {
        return (
            StatusCode::FORBIDDEN,
            Json(serde_json::json!({
                "success": false,
                "error": "Dev seed endpoints are only available in debug builds or when ENABLE_DEV_ENDPOINTS=1"
            })),
        );
    }

    let req = body.map(|b| b.0).unwrap_or_default();
    let now = Utc::now();
    let mut state = ctx.state.write().await;

    let mut all_new_alerts = Vec::new();
    let seeded_count = state.articles.len();

    for article in &mut state.articles {
        let (alerts, _) = seed_article_metrics(article, &req, now);
        all_new_alerts.extend(alerts);
    }

    if !all_new_alerts.is_empty() {
        let mut combined = all_new_alerts.clone();
        combined.append(&mut state.engagement_alerts);
        combined.truncate(200);
        state.engagement_alerts = combined;
    }

    let total_views: u32 = state
        .articles
        .iter()
        .filter_map(|a| a.engagement.as_ref().map(|e| e.views))
        .sum();
    let total_reactions: u32 = state
        .articles
        .iter()
        .filter_map(|a| a.engagement.as_ref().map(|e| e.reactions))
        .sum();
    let total_comments: u32 = state
        .articles
        .iter()
        .filter_map(|a| a.engagement.as_ref().map(|e| e.comments))
        .sum();

    let mut global_channels: std::collections::HashMap<String, ChannelMetrics> =
        std::collections::HashMap::new();
    for art in &state.articles {
        for export in &art.exports {
            if let Some(ref eng) = export.engagement {
                let g = global_channels.entry(export.channel.clone()).or_default();
                g.views += eng.views;
                g.reactions += eng.reactions;
                g.comments += eng.comments;
            }
        }
        if let Some(last_snap) = art.engagement_snapshots.last() {
            for (ch, m) in &last_snap.channels {
                let g = global_channels.entry(ch.clone()).or_default();
                if art.exports.iter().all(|e| &e.channel != ch) {
                    g.views += m.views;
                    g.reactions += m.reactions;
                    g.comments += m.comments;
                }
            }
        }
    }

    record_engagement_snapshot(
        &mut state.global_engagement_snapshots,
        now,
        total_views,
        total_reactions,
        total_comments,
        global_channels,
        MAX_GLOBAL_SNAPSHOTS,
    );

    let _ = state.save(&ctx.data_file);

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "seeded_count": seeded_count,
            "new_alerts": all_new_alerts,
            "new_alerts_count": all_new_alerts.len()
        })),
    )
}

pub async fn handle_syndication_webhook(
    State(ctx): State<Arc<AppContext>>,
    body: Option<Json<serde_json::Value>>,
) -> impl IntoResponse {
    tracing::info!(
        "Received syndication webhook event: {:?}",
        body.as_ref().map(|b| &b.0)
    );
    ctx.metrics_debouncer.trigger();

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "received": true,
            "status": "processed"
        })),
    )
}

#[derive(Debug, Deserialize, Default)]
pub struct GetAlertsQuery {
    pub unacknowledged: Option<bool>,
}

pub async fn get_engagement_alerts(
    State(ctx): State<Arc<AppContext>>,
    Query(query): Query<GetAlertsQuery>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    let alerts = if query.unacknowledged.unwrap_or(false) {
        state
            .engagement_alerts
            .iter()
            .filter(|a| !a.acknowledged)
            .cloned()
            .collect::<Vec<_>>()
    } else {
        state.engagement_alerts.clone()
    };
    Json(alerts)
}

pub async fn acknowledge_engagement_alert(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut state = ctx.state.write().await;
    let mut found = false;

    for alert in state.engagement_alerts.iter_mut() {
        if alert.id == id {
            alert.acknowledged = true;
            found = true;
        }
    }

    for article in state.articles.iter_mut() {
        for alert in article.milestone_alerts.iter_mut() {
            if alert.id == id {
                alert.acknowledged = true;
                found = true;
            }
        }
    }

    if found {
        let _ = state.save(&ctx.data_file);
        (
            StatusCode::OK,
            Json(serde_json::json!({
                "success": true,
                "id": id,
            })),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({
                "error": "Alert not found",
                "id": id,
            })),
        )
    }
}

pub async fn acknowledge_all_engagement_alerts(
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<serde_json::Value>) {
    let mut state = ctx.state.write().await;
    let count = state.engagement_alerts.len();

    for alert in state.engagement_alerts.iter_mut() {
        alert.acknowledged = true;
    }

    for article in state.articles.iter_mut() {
        for alert in article.milestone_alerts.iter_mut() {
            alert.acknowledged = true;
        }
    }

    let _ = state.save(&ctx.data_file);
    (
        StatusCode::OK,
        Json(serde_json::json!({
            "success": true,
            "count": count,
        })),
    )
}

pub async fn get_article_alerts(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<Vec<EngagementMilestoneAlert>>) {
    let state = ctx.state.read().await;
    if let Some(article) = state.articles.iter().find(|a| a.id == id) {
        (StatusCode::OK, Json(article.milestone_alerts.clone()))
    } else {
        (StatusCode::NOT_FOUND, Json(Vec::new()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Article;
    use chrono::Utc;
    use tower::ServiceExt;

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
        let article = Article::default_for_test();

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
    fn test_generate_ivy_web_frontmatter_dual() {
        let article = Article::default_for_test();

        let fm_default = generate_ivy_web_frontmatter(&article, "test-article");
        assert!(fm_default.contains("image: \"/site/images/blog/test-article-hero.png\""));
        assert!(fm_default.contains("image_svg: \"/site/images/blog/test-article-hero.svg\""));

        let fm_explicit_dual =
            generate_ivy_web_frontmatter_with_options(&article, "test-article", Some("dual"));
        assert!(fm_explicit_dual.contains("image: \"/site/images/blog/test-article-hero.png\""));
        assert!(fm_explicit_dual.contains("image_svg: \"/site/images/blog/test-article-hero.svg\""));
    }

    #[test]
    fn test_generate_ivy_web_frontmatter_svg_only() {
        let article = Article::default_for_test();

        let fm_svg =
            generate_ivy_web_frontmatter_with_options(&article, "test-article", Some("svg"));
        assert!(fm_svg.contains("image: \"/site/images/blog/test-article-hero.svg\""));
        assert!(fm_svg.contains("image_svg: \"/site/images/blog/test-article-hero.svg\""));
    }

    #[test]
    fn test_generate_ivy_web_frontmatter_png_only() {
        let article = Article::default_for_test();

        let fm_png =
            generate_ivy_web_frontmatter_with_options(&article, "test-article", Some("png"));
        assert!(fm_png.contains("image: \"/site/images/blog/test-article-hero.png\""));
        assert!(!fm_png.contains("image_svg:"));
    }

    #[tokio::test]
    async fn test_export_ivy_web_endpoint_with_hero_format() {
        let temp_dir = std::env::temp_dir().join("test_export_ivy_web_hero_format");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let content_dir = temp_dir.join("content");
        let images_dir = temp_dir.join("public/site/images");
        let data_file = temp_dir.join("data.json");

        let mut growth_state = crate::db::GrowthState::seed_default();
        let article = Article {
            id: "art-test-fmt".to_string(),
            title: "Test Format Article".to_string(),
            summary: "Testing hero format export".to_string(),
            content: "## Body Content".to_string(),
            published_at: None,
            slug: Some("test-format-article".to_string()),
            ..Article::default_for_test()
        };
        growth_state.articles.push(article);

        let runner = crate::agent::AgentRunner::new(std::path::PathBuf::from("agy"));
        let task_manager = crate::agent::TaskManager::new(runner);
        let ctx = std::sync::Arc::new(AppContext {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(growth_state)),
            task_manager,
            data_file,
            ivy_web_content_path: content_dir.clone(),
            ivy_web_images_path: images_dir.clone(),
            config: crate::config::Config::load(),
            rate_limiter: std::sync::Arc::new(
                crate::api::middleware::rate_limit::IpRateLimiter::default(),
            ),
            metrics_debouncer: std::sync::Arc::new(
                crate::api::metrics_debouncer::MetricsSyncDebouncer::default(),
            ),
        });

        let req = ExportIvyWebRequest {
            target_dir: Some(content_dir.to_string_lossy().to_string()),
            target_images_dir: Some(images_dir.to_string_lossy().to_string()),
            sync_hero_image: Some(true),
            hero_format: Some("dual".to_string()),
        };

        let resp = export_ivy_web(
            axum::extract::Path("art-test-fmt".to_string()),
            axum::extract::State(ctx),
            axum::extract::Json(req),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), axum::http::StatusCode::OK);
        let mdoc_file = content_dir.join("test-format-article.mdoc");
        assert!(mdoc_file.exists());
        let content = std::fs::read_to_string(&mdoc_file).unwrap();
        assert!(content.contains("image: \"/site/images/blog/test-format-article-hero.png\""));
        assert!(content.contains("image_svg: \"/site/images/blog/test-format-article-hero.svg\""));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_channel_formatters() {
        let article = Article {
            summary: "Test summary.".to_string(),
            content: "Body content.".to_string(),
            ..Article::default_for_test()
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
        assert!(
            medium.contains("*Originally published at https://ivy.interactive/blog/test-article*")
        );

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
        let temp_dir =
            std::env::temp_dir().join(format!("growthhack_test_{}", uuid::Uuid::new_v4().simple()));
        let article = Article {
            title: "Temp Export Test".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing file write.".to_string(),
            content: "# Header\n\nContent here.".to_string(),
            slug: Some("temp-export-test".to_string()),
            ..Article::default_for_test()
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
            title: "Record Export Test".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing export record.".to_string(),
            content: "Content".to_string(),
            slug: Some("record-export-test".to_string()),
            ..Article::default_for_test()
        };

        let rec = ExportRecord {
            channel: "Dev.to".to_string(),
            exported_at: now,
            target_path: None,
            status: "Copied".to_string(),
            external_id: None,
            engagement: None,
        };
        article.exports.push(rec);

        assert_eq!(article.exports.len(), 1);
        assert_eq!(article.exports[0].channel, "Dev.to");
        assert_eq!(article.exports[0].status, "Copied");
    }

    #[test]
    fn test_feature_article_prompt_contains_citations_and_backlinks() {
        let features = [
            "Worktrees",
            "Multi-Agent Orchestration",
            "Issue-to-PR",
            "Verification Gates",
            "Voice Control",
            "Tunneling",
        ];
        let archetypes = [
            "Architecture",
            "Benchmark",
            "Comparison",
            "Tutorial",
            "Postmortem",
            "Ecosystem",
            "Migration",
            "Security",
            "TokenEconomics",
            "Manifesto",
        ];

        for feature in &features {
            for archetype in &archetypes {
                let (prompt, backlinks, citations) = build_feature_article_prompt(
                    feature,
                    archetype,
                    "Dev.to",
                    Some("extra-test-context"),
                );

                assert!(
                    backlinks.len() >= 2,
                    "Feature {} should have at least 2 backlinks",
                    feature
                );
                assert!(
                    citations.len() >= 3,
                    "Feature {} should have at least 3 citations",
                    feature
                );

                for link in &backlinks {
                    assert!(
                        prompt.contains(link),
                        "Prompt should contain backlink {}",
                        link
                    );
                }
                for citation in &citations {
                    assert!(
                        prompt.contains(citation),
                        "Prompt should contain citation {}",
                        citation
                    );
                }

                assert!(
                    prompt.contains("YAML frontmatter"),
                    "Prompt should mention YAML frontmatter"
                );
                assert!(
                    prompt.contains("SpaceCorps Engineering"),
                    "Prompt should specify author"
                );
                assert!(
                    prompt.contains(feature),
                    "Prompt should contain feature name"
                );
                assert!(
                    prompt.contains(archetype),
                    "Prompt should contain archetype name"
                );
            }
        }
    }

    #[test]
    fn test_project_spotlight_prompt_contains_stanislav_style_and_tendril_note() {
        let req = GenerateSpotlightRequest {
            project_name: "OpenBot".to_string(),
            repo_url: "https://github.com/openbot-ai/openbot".to_string(),
            tagline: "Autonomous desktop robotics in 50 lines of Rust".to_string(),
            key_features: vec![
                "Zero-dependency binary".to_string(),
                "Local model inference".to_string(),
                "MIT licensed".to_string(),
            ],
            target_channel: "LinkedIn".to_string(),
            extra_notes: Some("Runs on Raspberry Pi 5".to_string()),
        };

        let prompt = build_project_spotlight_prompt(&req);

        assert!(
            prompt.contains('🔥') || prompt.contains('🚀'),
            "Prompt must include hook emoji"
        );
        assert!(
            prompt.contains("OpenBot"),
            "Prompt must include project name"
        );
        assert!(
            prompt.contains("https://github.com/openbot-ai/openbot"),
            "Prompt must include repo URL"
        );
        assert!(
            prompt.contains("MIT licensed, self-hosted, your Postgres, your model key."),
            "Prompt must emphasize licensing and self-hosting"
        );
        assert!(
            prompt.contains("P.S. We are building Ivy-Tendril, an autonomous multi-agent coding factory that plans tasks, orchestrates agents in isolated Git worktrees, and produces verified PRs. Try it locally or explore the repo -> https://github.com/Ivy-Interactive/Ivy-Tendril"),
            "Prompt must include exact Tendril P.S. signature note"
        );
    }

    #[test]
    fn test_all_10_archetypes_and_6_features_supported() {
        let features = [
            "Worktrees",
            "Multi-Agent Orchestration",
            "Issue-to-PR",
            "Verification Gates",
            "Voice Control",
            "Tunneling",
        ];
        let archetypes = [
            "Architecture",
            "Benchmark",
            "Comparison",
            "Tutorial",
            "Postmortem",
            "Ecosystem",
            "Migration",
            "Security",
            "TokenEconomics",
            "Manifesto",
        ];

        for f in &features {
            let (title, bg, citations) = get_feature_details(f);
            assert!(
                !title.is_empty(),
                "Feature title should not be empty for {}",
                f
            );
            assert!(!bg.is_empty(), "Feature bg should not be empty for {}", f);
            assert!(
                citations.len() >= 3,
                "Feature should have >= 3 citations for {}",
                f
            );
        }

        for a in &archetypes {
            let (title, guide) = get_archetype_details(a);
            assert!(
                !title.is_empty(),
                "Archetype title should not be empty for {}",
                a
            );
            assert!(
                !guide.is_empty(),
                "Archetype guide should not be empty for {}",
                a
            );
        }
    }

    #[test]
    fn test_devto_payload_formatting() {
        let article = Article {
            id: "art-devto".to_string(),
            title: "Scaling Autonomous Agents With Worktrees".to_string(),
            feature: "Worktrees".to_string(),
            channel: "Dev.to".to_string(),
            angle: "Architecture".to_string(),
            summary: "Worktrees eliminate git dirty-index collisions.".to_string(),
            content: "---\nfrontmatter: true\n---\n# Real Content Here".to_string(),
            slug: Some("scaling-autonomous-agents-with-worktrees".to_string()),
            ..Article::default_for_test()
        };

        let payload =
            format_devto_payload(&article, "scaling-autonomous-agents-with-worktrees", false);
        let art = &payload["article"];
        assert_eq!(art["title"], "Scaling Autonomous Agents With Worktrees");
        assert_eq!(art["body_markdown"], "# Real Content Here");
        assert_eq!(art["published"], false);
        assert_eq!(
            art["description"],
            "Worktrees eliminate git dirty-index collisions."
        );
        assert_eq!(
            art["tags"],
            serde_json::json!(["ivy", "devtools", "ai", "programming"])
        );
        assert_eq!(
            art["canonical_url"],
            "https://ivy.interactive/blog/scaling-autonomous-agents-with-worktrees"
        );
        assert_eq!(art["main_image"], "https://ivy.interactive/site/images/blog/scaling-autonomous-agents-with-worktrees-hero.png");
    }

    #[test]
    fn test_hashnode_graphql_query_formatting() {
        let article = Article {
            id: "art-hashnode".to_string(),
            title: "15-Minute Issue to PR Autonomous Loop".to_string(),
            feature: "Issue-to-PR".to_string(),
            channel: "Hashnode".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Automate routine engineering tasks safely.".to_string(),
            content: "Markdown body for Hashnode.".to_string(),
            slug: Some("15-minute-issue-to-pr-autonomous-loop".to_string()),
            ..Article::default_for_test()
        };

        let payload = format_hashnode_publish_mutation(
            &article,
            "15-minute-issue-to-pr-autonomous-loop",
            "pub-12345",
            "https://ivy.interactive/blog/15-minute-issue-to-pr-autonomous-loop",
        );

        assert!(payload["query"]
            .as_str()
            .unwrap()
            .contains("mutation PublishPost"));
        let input = &payload["variables"]["input"];
        assert_eq!(input["publicationId"], "pub-12345");
        assert_eq!(input["title"], "15-Minute Issue to PR Autonomous Loop");
        assert_eq!(
            input["subtitle"],
            "Automate routine engineering tasks safely."
        );
        assert_eq!(input["contentMarkdown"], "Markdown body for Hashnode.");
        assert_eq!(input["slug"], "15-minute-issue-to-pr-autonomous-loop");
        assert_eq!(
            input["originalArticleURL"],
            "https://ivy.interactive/blog/15-minute-issue-to-pr-autonomous-loop"
        );
        assert_eq!(
            input["coverImageOptions"]["coverImageURL"],
            "https://ivy.interactive/site/images/blog/15-minute-issue-to-pr-autonomous-loop-hero.png"
        );
        let tags = input["tags"].as_array().unwrap();
        assert_eq!(tags.len(), 4);
        assert_eq!(tags[0]["slug"], "ivy");
    }

    #[test]
    fn test_syndication_settings_serialization() {
        use crate::db::SyndicationSettings;

        // Verify default fallback values
        let default_json = "{}";
        let parsed: SyndicationSettings =
            serde_json::from_str(default_json).expect("deserialize default");
        assert_eq!(parsed.devto_api_key, None);
        assert_eq!(parsed.hashnode_api_key, None);
        assert_eq!(parsed.hashnode_publication_id, None);
        assert_eq!(parsed.webhook_secret, None);
        assert!(parsed.publish_as_draft);

        // Verify round-trip persistence
        let populated = SyndicationSettings {
            devto_api_key: Some("devto_secret_key_123".to_string()),
            hashnode_api_key: Some("hashnode_pat_456".to_string()),
            hashnode_publication_id: Some("pub_789".to_string()),
            github_token: Some("ghp_roundtrip_test_999".to_string()),
            webhook_secret: Some("whsec_roundtrip_test_123".to_string()),
            publish_as_draft: false,
        };
        let serialized = serde_json::to_string(&populated).expect("serialize");
        let deserialized: SyndicationSettings =
            serde_json::from_str(&serialized).expect("deserialize");
        assert_eq!(populated, deserialized);
    }

    #[test]
    fn test_sync_hero_asset_writes_png() {
        let temp_dir = std::env::temp_dir().join("test_sync_hero_asset");
        let _ = std::fs::remove_dir_all(&temp_dir);

        let slug = "test-article-slug";
        let res = sync_hero_asset(slug, &temp_dir, "Test Title", "Architecture");
        assert!(
            res.is_ok(),
            "sync_hero_asset should succeed: {:?}",
            res.err()
        );

        let created_path = res.unwrap();
        assert!(created_path.exists(), "Synced file must exist");
        assert!(created_path.ends_with("test-article-slug-hero.png"));
        let bytes = std::fs::read(&created_path).expect("Read created hero image");
        assert_eq!(bytes, DEFAULT_HERO_IMAGE);

        // Also test when target_images_dir already ends with 'blog'
        let blog_dir = temp_dir.join("blog");
        let res2 = sync_hero_asset("test-2", &blog_dir, "Title 2", "Tutorial");
        assert!(res2.is_ok());
        let created_path2 = res2.unwrap();
        assert!(created_path2.exists());
        assert_eq!(created_path2, blog_dir.join("test-2-hero.png"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_export_ivy_web_syncs_hero_image() {
        let temp_dir = std::env::temp_dir().join("test_export_ivy_web");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let content_dir = temp_dir.join("content");
        let images_dir = temp_dir.join("public/site/images");
        let data_file = temp_dir.join("data.json");

        let mut growth_state = crate::db::GrowthState::seed_default();
        let article = Article {
            id: "art-test-1".to_string(),
            title: "Test Syncing Article".to_string(),
            summary: "Testing hero sync".to_string(),
            content: "## Body Content".to_string(),
            slug: Some("test-syncing-article".to_string()),
            ..Article::default_for_test()
        };
        growth_state.articles.push(article);

        let ctx = std::sync::Arc::new(AppContext {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(growth_state)),
            data_file,
            ivy_web_content_path: content_dir.clone(),
            ivy_web_images_path: images_dir.clone(),
            ..AppContext::new_test()
        });

        let req = ExportIvyWebRequest {
            target_dir: Some(content_dir.to_string_lossy().to_string()),
            target_images_dir: Some(images_dir.to_string_lossy().to_string()),
            sync_hero_image: Some(true),
            hero_format: None,
        };

        let resp = export_ivy_web(
            axum::extract::Path("art-test-1".to_string()),
            axum::extract::State(ctx),
            axum::extract::Json(req),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), axum::http::StatusCode::OK);
        assert!(content_dir.join("test-syncing-article.mdoc").exists());
        assert!(images_dir
            .join("blog/test-syncing-article-hero.png")
            .exists());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_sync_assets_endpoint() {
        let temp_dir = std::env::temp_dir().join("test_sync_assets_endpoint");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let images_dir = temp_dir.join("public/site/images");
        let data_file = temp_dir.join("data.json");

        let mut growth_state = crate::db::GrowthState::seed_default();
        let article = Article {
            id: "art-test-2".to_string(),
            title: "Test Sync Assets Endpoint".to_string(),
            summary: "Testing sync assets endpoint".to_string(),
            content: "## Content".to_string(),
            slug: Some("test-sync-assets-endpoint".to_string()),
            ..Article::default_for_test()
        };
        growth_state.articles.push(article);

        let ctx = std::sync::Arc::new(AppContext {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(growth_state)),
            data_file,
            ivy_web_content_path: temp_dir.join("content"),
            ivy_web_images_path: images_dir.clone(),
            ..AppContext::new_test()
        });

        let req = SyncAssetsRequest {
            target_images_dir: Some(images_dir.to_string_lossy().to_string()),
        };

        let resp = sync_assets(
            axum::extract::Path("art-test-2".to_string()),
            axum::extract::State(ctx),
            Some(axum::extract::Json(req)),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), axum::http::StatusCode::OK);
        assert!(images_dir
            .join("blog/test-sync-assets-endpoint-hero.png")
            .exists());

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_generate_hero_banner_svg() {
        let title =
            "Building Resilient AI Workflows with Autonomous Git Worktrees and Verification Gates";
        let category = "Architecture & Design";
        let summary = "A comprehensive deep dive into isolated git checkouts, automated verification steps, and human approval gates.";
        let svg = generate_hero_banner_svg(title, category, summary, Some("dark-cyan"));

        assert!(svg.contains("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"));
        assert!(svg.contains(r#"width="1200""#));
        assert!(svg.contains(r#"height="630""#));
        assert!(svg.contains("viewBox=\"0 0 1200 630\""));
        // XML escaping check
        assert!(svg.contains("ARCHITECTURE &amp; DESIGN"));
        assert!(!svg.contains("ARCHITECTURE & DESIGN"));
        // Check wrapping - lines should appear
        assert!(svg.contains("Building Resilient AI Workflows"));
        // Check branding and footer
        assert!(svg.contains("ivy.interactive/blog"));
        assert!(svg.contains("IVY"));
    }

    #[test]
    fn test_sync_hero_asset_writes_svg_and_png() {
        let temp_dir = std::env::temp_dir().join("test_sync_hero_asset_svg_png");
        let _ = std::fs::remove_dir_all(&temp_dir);

        let slug = "dual-asset-article";
        let res = sync_hero_asset(slug, &temp_dir, "Dual Asset Article Title", "Benchmark");
        assert!(
            res.is_ok(),
            "sync_hero_asset should succeed: {:?}",
            res.err()
        );

        let png_path = temp_dir.join("blog/dual-asset-article-hero.png");
        let svg_path = temp_dir.join("blog/dual-asset-article-hero.svg");

        assert!(png_path.exists(), "PNG asset must exist");
        assert!(svg_path.exists(), "SVG asset must exist");

        let svg_content = std::fs::read_to_string(&svg_path).expect("Read SVG content");
        assert!(svg_content.contains("Dual Asset Article Title"));
        assert!(svg_content.contains("BENCHMARK"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_hero_banner_svg_endpoint() {
        let temp_dir = std::env::temp_dir().join("test_hero_banner_svg_endpoint");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let images_dir = temp_dir.join("public/site/images");
        let data_file = temp_dir.join("data.json");

        let mut growth_state = crate::db::GrowthState::seed_default();
        let article = Article {
            id: "art-banner-1".to_string(),
            title: "Dynamic Banner Test Article".to_string(),
            feature: "Social Sharing".to_string(),
            angle: "Benchmark".to_string(),
            summary: "Validating dynamic banner SVG endpoint output".to_string(),
            content: "## Content".to_string(),
            slug: Some("dynamic-banner-test-article".to_string()),
            ..Article::default_for_test()
        };
        growth_state.articles.push(article);

        let ctx = std::sync::Arc::new(AppContext {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(growth_state)),
            data_file,
            ivy_web_content_path: temp_dir.join("content"),
            ivy_web_images_path: images_dir,
            ..AppContext::new_test()
        });

        let resp = get_hero_banner_svg(
            axum::extract::Path("art-banner-1".to_string()),
            axum::extract::State(ctx),
            axum::extract::Query(HeroBannerQuery {
                theme: Some("midnight-emerald".to_string()),
                ..Default::default()
            }),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), axum::http::StatusCode::OK);
        let content_type = resp
            .headers()
            .get(axum::http::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok());
        assert_eq!(content_type, Some("image/svg+xml; charset=utf-8"));

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_upload_hero_image_endpoint() {
        let temp_dir = std::env::temp_dir().join("test_upload_hero_image_endpoint");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let images_dir = temp_dir.join("public/site/images");
        let data_file = temp_dir.join("data.json");

        let mut growth_state = crate::db::GrowthState::seed_default();
        let article = Article {
            id: "art-upload-1".to_string(),
            title: "Upload Custom Banner Article".to_string(),
            feature: "Canvas Rendering".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing upload endpoint with base64 data".to_string(),
            content: "## Content".to_string(),
            slug: Some("upload-custom-banner-article".to_string()),
            ..Article::default_for_test()
        };
        growth_state.articles.push(article);

        let ctx = std::sync::Arc::new(AppContext {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(growth_state)),
            data_file,
            ivy_web_content_path: temp_dir.join("content"),
            ivy_web_images_path: images_dir.clone(),
            ..AppContext::new_test()
        });

        // 1x1 transparent PNG base64 payload
        let sample_png_base64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
        let req = UploadHeroImageRequest {
            image_data: sample_png_base64.to_string(),
            target_images_dir: Some(images_dir.to_string_lossy().to_string()),
        };

        let resp = upload_hero_image(
            axum::extract::Path("art-upload-1".to_string()),
            axum::extract::State(ctx),
            axum::extract::Json(req),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), axum::http::StatusCode::OK);
        let dest_png = images_dir.join("blog/upload-custom-banner-article-hero.png");
        let dest_svg = images_dir.join("blog/upload-custom-banner-article-hero.svg");
        assert!(dest_png.exists(), "Uploaded PNG file must exist on disk");
        assert!(dest_svg.exists(), "Generated SVG file must exist on disk");

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_engagement_metrics_serialization() {
        let default_metrics = EngagementMetrics::default();
        assert_eq!(default_metrics.reactions, 0);
        assert_eq!(default_metrics.comments, 0);
        assert_eq!(default_metrics.views, 0);
        assert!(default_metrics.last_synced_at.is_none());

        let json_str = r#"{"reactions":15,"comments":3,"views":250}"#;
        let deserialized: EngagementMetrics =
            serde_json::from_str(json_str).expect("Deserialize EngagementMetrics");
        assert_eq!(deserialized.reactions, 15);
        assert_eq!(deserialized.comments, 3);
        assert_eq!(deserialized.views, 250);
        assert!(deserialized.last_synced_at.is_none());

        let serialized = serde_json::to_string(&deserialized).expect("Serialize EngagementMetrics");
        assert!(serialized.contains("\"reactions\":15"));
        assert!(serialized.contains("\"comments\":3"));
        assert!(serialized.contains("\"views\":250"));
    }

    #[test]
    fn test_aggregate_engagement_calculation() {
        let now = Utc::now();
        let exports = vec![
            ExportRecord {
                channel: "Dev.to".to_string(),
                exported_at: now,
                target_path: Some("https://dev.to/article/1".to_string()),
                status: "Published".to_string(),
                external_id: Some("1".to_string()),
                engagement: Some(EngagementMetrics {
                    reactions: 42,
                    comments: 7,
                    views: 500,
                    last_synced_at: Some(now),
                }),
            },
            ExportRecord {
                channel: "Hashnode".to_string(),
                exported_at: now,
                target_path: Some("https://hashnode.com/post/2".to_string()),
                status: "Published".to_string(),
                external_id: Some("2".to_string()),
                engagement: Some(EngagementMetrics {
                    reactions: 18,
                    comments: 3,
                    views: 250,
                    last_synced_at: Some(now),
                }),
            },
            ExportRecord {
                channel: "ivy-web".to_string(),
                exported_at: now,
                target_path: Some("/content/post.mdoc".to_string()),
                status: "Success".to_string(),
                external_id: None,
                engagement: None,
            },
        ];

        let agg = calculate_aggregate_engagement(&exports);
        assert_eq!(agg.reactions, 60);
        assert_eq!(agg.comments, 10);
        assert_eq!(agg.views, 750);
        assert_eq!(agg.last_synced_at, Some(now));
    }

    #[test]
    fn test_devto_metrics_response_parsing() {
        let mock_payload = serde_json::json!([
            {
                "id": 12345,
                "title": "Autonomous Worktrees",
                "url": "https://dev.to/ivy/autonomous-worktrees-12345",
                "slug": "autonomous-worktrees-12345",
                "public_reactions_count": 88,
                "comments_count": 12,
                "page_views_count": 1420
            },
            {
                "id": 67890,
                "title": "Verification Gates",
                "url": "https://dev.to/ivy/verification-gates-67890",
                "slug": "verification-gates-67890",
                "public_reactions_count": 35,
                "comments_count": 4,
                "page_views_count": 610
            }
        ]);

        let parsed = parse_devto_metrics(&mock_payload);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].id, "12345");
        assert_eq!(parsed[0].reactions, 88);
        assert_eq!(parsed[0].comments, 12);
        assert_eq!(parsed[0].views, 1420);
        assert_eq!(
            parsed[0].url.as_deref(),
            Some("https://dev.to/ivy/autonomous-worktrees-12345")
        );

        assert_eq!(parsed[1].id, "67890");
        assert_eq!(parsed[1].reactions, 35);
        assert_eq!(parsed[1].comments, 4);
        assert_eq!(parsed[1].views, 610);
    }

    #[test]
    fn test_hashnode_metrics_graphql_response_parsing() {
        let mock_payload = serde_json::json!({
            "data": {
                "publication": {
                    "posts": {
                        "edges": [
                            {
                                "node": {
                                    "id": "post-hash-1",
                                    "url": "https://blog.ivy.interactive/post-hash-1",
                                    "reactionCount": 47,
                                    "responseCount": 9,
                                    "views": 890
                                }
                            },
                            {
                                "node": {
                                    "id": "post-hash-2",
                                    "url": "https://blog.ivy.interactive/post-hash-2",
                                    "reactionCount": 21,
                                    "responseCount": 2,
                                    "views": 310
                                }
                            }
                        ]
                    }
                }
            }
        });

        let parsed = parse_hashnode_metrics(&mock_payload);
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].id, "post-hash-1");
        assert_eq!(parsed[0].reactions, 47);
        assert_eq!(parsed[0].comments, 9);
        assert_eq!(parsed[0].views, 890);
        assert_eq!(
            parsed[0].url.as_deref(),
            Some("https://blog.ivy.interactive/post-hash-1")
        );

        assert_eq!(parsed[1].id, "post-hash-2");
        assert_eq!(parsed[1].reactions, 21);
        assert_eq!(parsed[1].comments, 2);
        assert_eq!(parsed[1].views, 310);
    }

    #[test]
    fn test_engagement_snapshot_serialization() {
        let now = Utc::now();
        let snapshot = EngagementSnapshot {
            timestamp: now,
            views: 1250,
            reactions: 84,
            comments: 16,
            channels: std::collections::HashMap::new(),
        };

        let json = serde_json::to_string(&snapshot).expect("serialize snapshot");
        assert!(json.contains("\"views\":1250"));
        assert!(json.contains("\"reactions\":84"));
        assert!(json.contains("\"comments\":16"));

        let deserialized: EngagementSnapshot =
            serde_json::from_str(&json).expect("deserialize snapshot");
        assert_eq!(snapshot, deserialized);

        // Default handling
        let default_json = format!("{{\"timestamp\":\"{}\"}}", now.to_rfc3339());
        let default_parsed: EngagementSnapshot =
            serde_json::from_str(&default_json).expect("deserialize default");
        assert_eq!(default_parsed.views, 0);
        assert_eq!(default_parsed.reactions, 0);
        assert_eq!(default_parsed.comments, 0);
        assert!(default_parsed.channels.is_empty());
    }

    #[test]
    fn test_engagement_snapshot_with_channels_serialization() {
        let now = Utc::now();
        let mut channels = std::collections::HashMap::new();
        channels.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 500,
                reactions: 35,
                comments: 8,
            },
        );
        channels.insert(
            "Hashnode".to_string(),
            ChannelMetrics {
                views: 400,
                reactions: 25,
                comments: 5,
            },
        );
        channels.insert(
            "Medium".to_string(),
            ChannelMetrics {
                views: 350,
                reactions: 24,
                comments: 3,
            },
        );

        let snapshot = EngagementSnapshot {
            timestamp: now,
            views: 1250,
            reactions: 84,
            comments: 16,
            channels: channels.clone(),
        };

        let json = serde_json::to_string(&snapshot).expect("serialize snapshot");
        assert!(json.contains("\"Dev.to\""));
        assert!(json.contains("\"Hashnode\""));
        assert!(json.contains("\"Medium\""));

        let deserialized: EngagementSnapshot =
            serde_json::from_str(&json).expect("deserialize snapshot");
        assert_eq!(snapshot, deserialized);
        assert_eq!(deserialized.channels.len(), 3);
        assert_eq!(deserialized.channels["Dev.to"].views, 500);
    }

    #[test]
    fn test_record_engagement_snapshot_and_cap() {
        let mut snapshots = Vec::new();
        let base_time = Utc::now();

        // 1. Initial snapshot is recorded
        let added1 = record_engagement_snapshot(
            &mut snapshots,
            base_time,
            100,
            10,
            2,
            Default::default(),
            5,
        );
        assert!(added1);
        assert_eq!(snapshots.len(), 1);

        // 2. Duplicate snapshot within 1 hour with unchanged metrics is skipped
        let soon = base_time + chrono::Duration::minutes(15);
        let added_dup =
            record_engagement_snapshot(&mut snapshots, soon, 100, 10, 2, Default::default(), 5);
        assert!(!added_dup);
        assert_eq!(snapshots.len(), 1);

        // 3. Snapshot with changed metrics within 1 hour is recorded
        let added_changed =
            record_engagement_snapshot(&mut snapshots, soon, 105, 10, 2, Default::default(), 5);
        assert!(added_changed);
        assert_eq!(snapshots.len(), 2);

        // 4. Fill up to cap and verify FIFO eviction
        for i in 3..=7 {
            let t = base_time + chrono::Duration::hours(i);
            let ok = record_engagement_snapshot(
                &mut snapshots,
                t,
                100 + i as u32 * 10,
                10,
                2,
                Default::default(),
                5,
            );
            assert!(ok);
        }

        // Cap was 5
        assert_eq!(snapshots.len(), 5);
        // Oldest elements should have been drained, newest retained
        assert_eq!(snapshots[4].views, 170);
    }

    #[test]
    fn test_record_engagement_snapshot_with_channel_breakdown() {
        let mut snapshots = Vec::new();
        let base_time = Utc::now();

        let mut ch1 = std::collections::HashMap::new();
        ch1.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 100,
                reactions: 10,
                comments: 2,
            },
        );
        let added1 =
            record_engagement_snapshot(&mut snapshots, base_time, 100, 10, 2, ch1.clone(), 3);
        assert!(added1);
        assert_eq!(snapshots.len(), 1);

        // Same metrics and channels within 1h is skipped
        let soon = base_time + chrono::Duration::minutes(15);
        let added_dup =
            record_engagement_snapshot(&mut snapshots, soon, 100, 10, 2, ch1.clone(), 3);
        assert!(!added_dup);
        assert_eq!(snapshots.len(), 1);

        // Changed channel metric within 1h is recorded
        let mut ch2 = std::collections::HashMap::new();
        ch2.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 105,
                reactions: 10,
                comments: 2,
            },
        );
        let added_ch = record_engagement_snapshot(&mut snapshots, soon, 105, 10, 2, ch2, 3);
        assert!(added_ch);
        assert_eq!(snapshots.len(), 2);

        // Cap eviction test
        for i in 3..=5 {
            let t = base_time + chrono::Duration::hours(i);
            let mut ch = std::collections::HashMap::new();
            ch.insert(
                "Dev.to".to_string(),
                ChannelMetrics {
                    views: 100 + i as u32 * 10,
                    reactions: 10,
                    comments: 2,
                },
            );
            let ok =
                record_engagement_snapshot(&mut snapshots, t, 100 + i as u32 * 10, 10, 2, ch, 3);
            assert!(ok);
        }

        assert_eq!(snapshots.len(), 3);
        assert_eq!(snapshots.last().unwrap().channels["Dev.to"].views, 150);
    }

    #[test]
    fn test_engagement_velocity_calculation() {
        let now = Utc::now();

        // Empty snapshots
        let empty_vel = calculate_engagement_velocity(&[], now);
        assert_eq!(empty_vel.views_delta_24h, 0);
        assert_eq!(empty_vel.trend, "Flat");

        // Accelerating trend:
        // t0: 0h, views=100
        // t1: 12h, views=150 (gain=50)
        // t2: 24h, views=250 (gain=100)
        let t0 = now - chrono::Duration::hours(24);
        let t1 = now - chrono::Duration::hours(12);
        let t2 = now;

        let accelerating_snapshots = vec![
            EngagementSnapshot {
                timestamp: t0,
                views: 100,
                reactions: 10,
                comments: 2,
                channels: Default::default(),
            },
            EngagementSnapshot {
                timestamp: t1,
                views: 150,
                reactions: 15,
                comments: 3,
                channels: Default::default(),
            },
            EngagementSnapshot {
                timestamp: t2,
                views: 250,
                reactions: 25,
                comments: 5,
                channels: Default::default(),
            },
        ];

        let vel = calculate_engagement_velocity(&accelerating_snapshots, now);
        assert_eq!(vel.views_delta_24h, 150);
        assert_eq!(vel.views_per_day, 150.0);
        assert_eq!(vel.trend, "Accelerating");

        // Decelerating trend:
        // t3: 36h, views=280 (gain=30 in 12h compared to gain of 100 earlier)
        let t3 = now + chrono::Duration::hours(12);
        let decelerating_snapshots = vec![
            EngagementSnapshot {
                timestamp: t1,
                views: 150,
                reactions: 15,
                comments: 3,
                channels: Default::default(),
            },
            EngagementSnapshot {
                timestamp: t2,
                views: 250,
                reactions: 25,
                comments: 5,
                channels: Default::default(),
            },
            EngagementSnapshot {
                timestamp: t3,
                views: 280,
                reactions: 27,
                comments: 6,
                channels: Default::default(),
            },
        ];

        let dec_vel = calculate_engagement_velocity(&decelerating_snapshots, t3);
        assert_eq!(dec_vel.trend, "Decelerating");

        // Flat trend (no change)
        let flat_snapshots = vec![
            EngagementSnapshot {
                timestamp: t0,
                views: 100,
                reactions: 10,
                comments: 2,
                channels: Default::default(),
            },
            EngagementSnapshot {
                timestamp: t2,
                views: 100,
                reactions: 10,
                comments: 2,
                channels: Default::default(),
            },
        ];
        let flat_vel = calculate_engagement_velocity(&flat_snapshots, now);
        assert_eq!(flat_vel.trend, "Flat");
        assert_eq!(flat_vel.views_delta_24h, 0);
    }

    #[test]
    fn test_per_channel_velocity_calculation() {
        let now = Utc::now();
        let t0 = now - chrono::Duration::hours(24);
        let t1 = now - chrono::Duration::hours(12);
        let t2 = now;

        // Construct synthetic trajectory where:
        // Dev.to accelerates: 100 -> 150 -> 250 (gain 50 then 100)
        // Hashnode is decelerating: 150 -> 250 -> 280 (gain 100 then 30)
        // Medium is flat: 50 -> 50 -> 50 (gain 0)
        let mut ch0 = std::collections::HashMap::new();
        ch0.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 100,
                reactions: 10,
                comments: 2,
            },
        );
        ch0.insert(
            "Hashnode".to_string(),
            ChannelMetrics {
                views: 150,
                reactions: 15,
                comments: 3,
            },
        );
        ch0.insert(
            "Medium".to_string(),
            ChannelMetrics {
                views: 50,
                reactions: 5,
                comments: 1,
            },
        );

        let mut ch1 = std::collections::HashMap::new();
        ch1.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 150,
                reactions: 15,
                comments: 3,
            },
        );
        ch1.insert(
            "Hashnode".to_string(),
            ChannelMetrics {
                views: 250,
                reactions: 25,
                comments: 5,
            },
        );
        ch1.insert(
            "Medium".to_string(),
            ChannelMetrics {
                views: 50,
                reactions: 5,
                comments: 1,
            },
        );

        let mut ch2 = std::collections::HashMap::new();
        ch2.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 250,
                reactions: 25,
                comments: 5,
            },
        );
        ch2.insert(
            "Hashnode".to_string(),
            ChannelMetrics {
                views: 280,
                reactions: 27,
                comments: 6,
            },
        );
        ch2.insert(
            "Medium".to_string(),
            ChannelMetrics {
                views: 50,
                reactions: 5,
                comments: 1,
            },
        );

        let snapshots = vec![
            EngagementSnapshot {
                timestamp: t0,
                views: 300,
                reactions: 30,
                comments: 6,
                channels: ch0,
            },
            EngagementSnapshot {
                timestamp: t1,
                views: 450,
                reactions: 45,
                comments: 9,
                channels: ch1,
            },
            EngagementSnapshot {
                timestamp: t2,
                views: 580,
                reactions: 57,
                comments: 12,
                channels: ch2,
            },
        ];

        let vel = calculate_engagement_velocity(&snapshots, now);
        assert!(vel.channels.contains_key("Dev.to"));
        assert!(vel.channels.contains_key("Hashnode"));
        assert!(vel.channels.contains_key("Medium"));

        let devto = &vel.channels["Dev.to"];
        assert_eq!(devto.views_delta_24h, 150);
        assert_eq!(devto.trend, "Accelerating");

        let hashnode = &vel.channels["Hashnode"];
        assert_eq!(hashnode.views_delta_24h, 130);
        assert_eq!(hashnode.trend, "Decelerating");

        let medium = &vel.channels["Medium"];
        assert_eq!(medium.views_delta_24h, 0);
        assert_eq!(medium.trend, "Flat");
    }

    #[tokio::test]
    async fn test_engagement_history_endpoint() {
        let temp_dir = std::env::temp_dir().join("test_engagement_history_endpoint");
        let _ = std::fs::remove_dir_all(&temp_dir);
        let data_file = temp_dir.join("data.json");

        let mut growth_state = crate::db::GrowthState::seed_default();
        let now = Utc::now();
        growth_state.global_engagement_snapshots = vec![
            EngagementSnapshot {
                timestamp: now - chrono::Duration::hours(24),
                views: 500,
                reactions: 50,
                comments: 10,
                channels: Default::default(),
            },
            EngagementSnapshot {
                timestamp: now,
                views: 850,
                reactions: 85,
                comments: 18,
                channels: Default::default(),
            },
        ];

        let ctx = std::sync::Arc::new(AppContext {
            state: std::sync::Arc::new(tokio::sync::RwLock::new(growth_state)),
            data_file,
            ..AppContext::new_test()
        });

        let resp = get_global_engagement_history(axum::extract::State(ctx))
            .await
            .into_response();

        assert_eq!(resp.status(), axum::http::StatusCode::OK);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX)
            .await
            .unwrap();
        let parsed: EngagementHistoryResponse =
            serde_json::from_slice(&body_bytes).expect("parse EngagementHistoryResponse");

        assert_eq!(parsed.snapshots.len(), 2);
        assert_eq!(parsed.velocity.views_delta_24h, 350);
        assert_eq!(parsed.velocity.views_per_day, 350.0);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[tokio::test]
    async fn test_update_article_resets_status_to_pending_on_content_change() {
        let ctx = Arc::new(AppContext::default());
        let now = Utc::now();
        let article = Article {
            id: "art-reset-test".to_string(),
            title: "Original Title".to_string(),
            summary: "Original summary.".to_string(),
            content: "Original content.".to_string(),
            status: "Approved".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("original-title".to_string()),
            ..Article::default_for_test()
        };

        {
            let mut state = ctx.state.write().await;
            state.articles.push(article);
        }

        // 1. Modifying content without explicit status resets status to Pending and clears published_at
        let update_content_req = UpdateArticleRequest {
            title: None,
            channel: None,
            summary: None,
            content: Some("Modified content text.".to_string()),
            status: None,
            backlinks: None,
            outbound_citations: None,
        };

        let (status, Json(updated_opt)) = update_article(
            Path("art-reset-test".to_string()),
            State(ctx.clone()),
            Json(update_content_req),
        )
        .await;

        assert_eq!(status, StatusCode::OK);
        let updated = updated_opt.expect("Article should exist");
        assert_eq!(updated.content, "Modified content text.");
        assert_eq!(updated.status, "Pending");
        assert!(updated.published_at.is_none());

        // Re-set to Published
        {
            let mut state = ctx.state.write().await;
            if let Some(art) = state.articles.iter_mut().find(|a| a.id == "art-reset-test") {
                art.status = "Published".to_string();
                art.published_at = Some(now);
            }
        }

        // 2. Modifying title without explicit status resets status to Pending and clears published_at
        let update_title_req = UpdateArticleRequest {
            title: Some("Modified Article Title".to_string()),
            channel: None,
            summary: None,
            content: None,
            status: None,
            backlinks: None,
            outbound_citations: None,
        };

        let (status2, Json(updated_opt2)) = update_article(
            Path("art-reset-test".to_string()),
            State(ctx.clone()),
            Json(update_title_req),
        )
        .await;

        assert_eq!(status2, StatusCode::OK);
        let updated2 = updated_opt2.expect("Article should exist");
        assert_eq!(updated2.title, "Modified Article Title");
        assert_eq!(updated2.status, "Pending");
        assert!(updated2.published_at.is_none());

        // 3. Modifying with explicit status preserves the provided status
        let update_explicit_req = UpdateArticleRequest {
            title: Some("Preserved Status Title".to_string()),
            channel: None,
            summary: None,
            content: None,
            status: Some("Published".to_string()),
            backlinks: None,
            outbound_citations: None,
        };

        let (status3, Json(updated_opt3)) = update_article(
            Path("art-reset-test".to_string()),
            State(ctx.clone()),
            Json(update_explicit_req),
        )
        .await;

        assert_eq!(status3, StatusCode::OK);
        let updated3 = updated_opt3.expect("Article should exist");
        assert_eq!(updated3.title, "Preserved Status Title");
        assert_eq!(updated3.status, "Published");
        assert!(updated3.published_at.is_some());

        let _ = std::fs::remove_file(&ctx.data_file);
    }

    #[test]
    fn test_evaluate_article_milestones_views_and_reactions() {
        let now = Utc::now();
        let mut article = Article {
            id: "art-milestone-test".to_string(),
            title: "Testing Milestone Alerts".to_string(),
            feature: "Multi-Agent Orchestration".to_string(),
            channel: "Dev.to".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing milestones".to_string(),
            content: "Content".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Published".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("testing-milestone-alerts".to_string()),
            exports: vec![],
            engagement: Some(EngagementMetrics {
                views: 120,
                reactions: 30,
                comments: 5,
                last_synced_at: Some(now),
            }),
            engagement_snapshots: Vec::new(),
            engagement_badges: Vec::new(),
            milestone_alerts: Vec::new(),
        };

        let alerts = evaluate_article_milestones(&mut article, now);
        assert_eq!(alerts.len(), 2);
        assert_eq!(article.milestone_alerts.len(), 2);
        assert!(article.engagement_badges.contains(&"100+ Views".to_string()));
        assert!(article.engagement_badges.contains(&"25+ Reactions".to_string()));
        assert!(!article.engagement_badges.contains(&"10+ Comments".to_string()));

        let view_alert = alerts.iter().find(|a| a.milestone_type == "views").unwrap();
        assert_eq!(view_alert.threshold, 100);
        assert_eq!(view_alert.badge_awarded, "100+ Views");
        assert!(!view_alert.acknowledged);

        let reaction_alert = alerts.iter().find(|a| a.milestone_type == "reactions").unwrap();
        assert_eq!(reaction_alert.threshold, 25);
        assert_eq!(reaction_alert.badge_awarded, "25+ Reactions");
        assert!(!reaction_alert.acknowledged);
    }

    #[test]
    fn test_evaluate_article_milestones_deduplication() {
        let now = Utc::now();
        let mut article = Article {
            id: "art-dedup-test".to_string(),
            title: "Testing Deduplication".to_string(),
            feature: "Multi-Agent Orchestration".to_string(),
            channel: "Dev.to".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing dedup".to_string(),
            content: "Content".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Published".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("testing-deduplication".to_string()),
            exports: vec![],
            engagement: Some(EngagementMetrics {
                views: 150,
                reactions: 35,
                comments: 12,
                last_synced_at: Some(now),
            }),
            engagement_snapshots: Vec::new(),
            engagement_badges: Vec::new(),
            milestone_alerts: Vec::new(),
        };

        let first_alerts = evaluate_article_milestones(&mut article, now);
        assert_eq!(first_alerts.len(), 3);
        assert_eq!(article.engagement_badges.len(), 3);
        assert_eq!(article.milestone_alerts.len(), 3);

        // Re-evaluating with identical metrics should yield no duplicate badges or alerts
        let second_alerts = evaluate_article_milestones(&mut article, now);
        assert!(second_alerts.is_empty());
        assert_eq!(article.engagement_badges.len(), 3);
        assert_eq!(article.milestone_alerts.len(), 3);
    }

    #[test]
    fn test_evaluate_article_milestones_progressive_tiers() {
        let now = Utc::now();
        let mut article = Article {
            id: "art-progressive-test".to_string(),
            title: "Testing Progressive Tiers".to_string(),
            feature: "Multi-Agent Orchestration".to_string(),
            channel: "Dev.to".to_string(),
            angle: "Tutorial".to_string(),
            summary: "Testing tiers".to_string(),
            content: "Content".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Published".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("testing-progressive-tiers".to_string()),
            exports: vec![],
            engagement: Some(EngagementMetrics {
                views: 120,
                reactions: 10,
                comments: 2,
                last_synced_at: Some(now),
            }),
            engagement_snapshots: Vec::new(),
            engagement_badges: Vec::new(),
            milestone_alerts: Vec::new(),
        };

        let initial_alerts = evaluate_article_milestones(&mut article, now);
        assert_eq!(initial_alerts.len(), 1);
        assert_eq!(initial_alerts[0].badge_awarded, "100+ Views");

        // Advancing from 120 to 600 views triggers 500+ Views while retaining 100+ Views
        article.engagement.as_mut().unwrap().views = 600;
        let next_alerts = evaluate_article_milestones(&mut article, now);
        assert_eq!(next_alerts.len(), 1);
        assert_eq!(next_alerts[0].badge_awarded, "500+ Views");
        assert_eq!(next_alerts[0].threshold, 500);

        assert!(article.engagement_badges.contains(&"100+ Views".to_string()));
        assert!(article.engagement_badges.contains(&"500+ Views".to_string()));
        assert_eq!(article.milestone_alerts.len(), 2);
    }

    #[tokio::test]
    async fn test_engagement_alerts_endpoints() {
        let guard = crate::api::issues::AppContext::new_test_context();
        let ctx = guard.ctx();
        let now = Utc::now();

        let alert1 = EngagementMilestoneAlert {
            id: "alert-101".to_string(),
            article_id: "art-api-test".to_string(),
            article_title: "API Test Article".to_string(),
            milestone_type: "views".to_string(),
            threshold: 100,
            message: "Reached 100+ Views!".to_string(),
            badge_awarded: "100+ Views".to_string(),
            triggered_at: now,
            acknowledged: false,
        };
        let alert2 = EngagementMilestoneAlert {
            id: "alert-102".to_string(),
            article_id: "art-api-test".to_string(),
            article_title: "API Test Article".to_string(),
            milestone_type: "reactions".to_string(),
            threshold: 25,
            message: "Reached 25+ Reactions!".to_string(),
            badge_awarded: "25+ Reactions".to_string(),
            triggered_at: now,
            acknowledged: false,
        };

        let article = Article {
            id: "art-api-test".to_string(),
            title: "API Test Article".to_string(),
            feature: "Multi-Agent Orchestration".to_string(),
            channel: "Dev.to".to_string(),
            angle: "Tutorial".to_string(),
            summary: "API test article summary".to_string(),
            content: "Content".to_string(),
            backlinks: vec![],
            outbound_citations: vec![],
            status: "Published".to_string(),
            created_at: now,
            published_at: Some(now),
            slug: Some("api-test-article".to_string()),
            exports: vec![],
            engagement: None,
            engagement_snapshots: Vec::new(),
            engagement_badges: vec!["100+ Views".to_string(), "25+ Reactions".to_string()],
            milestone_alerts: vec![alert1.clone(), alert2.clone()],
        };

        {
            let mut state = ctx.state.write().await;
            state.articles.push(article);
            state.engagement_alerts.push(alert1.clone());
            state.engagement_alerts.push(alert2.clone());
        }

        // Test GET /api/articles/alerts (all alerts)
        let app = crate::api::router(ctx.clone());
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/articles/alerts")
                    .method("GET")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let alerts: Vec<EngagementMilestoneAlert> = serde_json::from_slice(&body).unwrap();
        assert_eq!(alerts.len(), 2);

        // Test GET /api/articles/{id}/alerts
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/articles/art-api-test/alerts")
                    .method("GET")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let art_alerts: Vec<EngagementMilestoneAlert> = serde_json::from_slice(&body).unwrap();
        assert_eq!(art_alerts.len(), 2);

        // Test POST /api/articles/alerts/{id}/acknowledge
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/articles/alerts/alert-101/acknowledge")
                    .method("POST")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // Test GET /api/articles/alerts?unacknowledged=true (should now only return alert-102)
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/articles/alerts?unacknowledged=true")
                    .method("GET")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let unack_alerts: Vec<EngagementMilestoneAlert> = serde_json::from_slice(&body).unwrap();
        assert_eq!(unack_alerts.len(), 1);
        assert_eq!(unack_alerts[0].id, "alert-102");

        // Test POST /api/articles/alerts/acknowledge-all
        let res = app
            .clone()
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/articles/alerts/acknowledge-all")
                    .method("POST")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);

        // Now unacknowledged query returns empty list
        let res = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/articles/alerts?unacknowledged=true")
                    .method("GET")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = axum::body::to_bytes(res.into_body(), usize::MAX).await.unwrap();
        let remaining_unack: Vec<EngagementMilestoneAlert> = serde_json::from_slice(&body).unwrap();
        assert!(remaining_unack.is_empty());
    }

    static SEED_ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[tokio::test]
    async fn test_seed_engagement_default_preset() {
        let _lock = SEED_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let ctx = Arc::new(AppContext::default());
        let now = Utc::now();
        let article = Article {
            id: "art-seed-default".to_string(),
            title: "Test Default Seed".to_string(),
            created_at: now,
            ..Article::default_for_test()
        };
        {
            let mut state = ctx.state.write().await;
            state.articles.push(article);
        }

        let resp = seed_article_engagement(
            Path("art-seed-default".to_string()),
            State(ctx.clone()),
            None,
        )
        .await
        .into_response();

        assert_eq!(resp.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["success"], true);
        assert_eq!(json["article"]["engagement"]["views"], 1250);
        assert_eq!(json["article"]["engagement"]["reactions"], 65);
        assert_eq!(json["article"]["engagement"]["comments"], 18);

        // Verify milestone badges are awarded
        let badges: Vec<String> =
            serde_json::from_value(json["article"]["engagement_badges"].clone()).unwrap();
        assert!(badges.contains(&"100+ Views".to_string()));
        assert!(badges.contains(&"500+ Views".to_string()));
        assert!(badges.contains(&"1K+ Views".to_string()));
        assert!(badges.contains(&"25+ Reactions".to_string()));
        assert!(badges.contains(&"50+ Reactions".to_string()));
        assert!(badges.contains(&"10+ Comments".to_string()));

        // Verify alerts are added to article and global alert list
        assert_eq!(json["new_alerts_count"], 6);
        let state = ctx.state.read().await;
        let global_has_alert = state
            .engagement_alerts
            .iter()
            .any(|a| a.article_id == "art-seed-default");
        assert!(global_has_alert);

        // Verify historical snapshots are generated
        let art = state
            .articles
            .iter()
            .find(|a| a.id == "art-seed-default")
            .unwrap();
        assert!(art.engagement_snapshots.len() >= 5);
        assert_eq!(json["velocity"]["trend"], "Accelerating");
    }

    #[tokio::test]
    async fn test_seed_engagement_custom_payload() {
        let _lock = SEED_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let ctx = Arc::new(AppContext::default());
        let now = Utc::now();
        let mut custom_channels = std::collections::HashMap::new();
        custom_channels.insert(
            "Dev.to".to_string(),
            ChannelMetrics {
                views: 3000,
                reactions: 60,
                comments: 10,
            },
        );
        custom_channels.insert(
            "Hashnode".to_string(),
            ChannelMetrics {
                views: 2000,
                reactions: 40,
                comments: 5,
            },
        );

        let article = Article {
            id: "art-seed-custom".to_string(),
            title: "Test Custom Seed".to_string(),
            created_at: now,
            exports: vec![ExportRecord {
                channel: "Dev.to".to_string(),
                exported_at: now,
                target_path: None,
                status: "Success".to_string(),
                external_id: None,
                engagement: None,
            }],
            ..Article::default_for_test()
        };
        {
            let mut state = ctx.state.write().await;
            state.articles.push(article);
        }

        let req = SeedEngagementRequest {
            views: Some(5000),
            reactions: Some(100),
            comments: Some(15),
            channels: Some(custom_channels),
            generate_history_days: Some(7),
            reset_badges: Some(false),
        };

        let resp = seed_article_engagement(
            Path("art-seed-custom".to_string()),
            State(ctx.clone()),
            Some(Json(req)),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["success"], true);
        assert_eq!(json["article"]["engagement"]["views"], 5000);
        assert_eq!(json["article"]["engagement"]["reactions"], 100);
        assert_eq!(json["article"]["engagement"]["comments"], 15);

        // Verify channel breakdown in export
        let state = ctx.state.read().await;
        let art = state
            .articles
            .iter()
            .find(|a| a.id == "art-seed-custom")
            .unwrap();
        let devto_export = art.exports.iter().find(|e| e.channel == "Dev.to").unwrap();
        assert_eq!(devto_export.engagement.as_ref().unwrap().views, 3000);
        assert_eq!(devto_export.engagement.as_ref().unwrap().reactions, 60);

        // Verify 5K+ views threshold triggered
        assert!(art.engagement_badges.contains(&"5K+ Views".to_string()));
        assert!(art.engagement_badges.contains(&"100+ Reactions".to_string()));
    }

    #[tokio::test]
    async fn test_seed_engagement_article_not_found() {
        let _lock = SEED_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let ctx = Arc::new(AppContext::default());
        let resp = seed_article_engagement(
            Path("non-existent-art-id".to_string()),
            State(ctx),
            None,
        )
        .await
        .into_response();

        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["success"], false);
        assert_eq!(json["error"], "Article not found");
    }

    #[tokio::test]
    async fn test_seed_engagement_gating() {
        let _lock = SEED_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let ctx = Arc::new(AppContext::default());
        std::env::set_var("ENABLE_DEV_ENDPOINTS", "0");

        let resp = seed_article_engagement(
            Path("art-gating-test".to_string()),
            State(ctx),
            None,
        )
        .await
        .into_response();

        std::env::remove_var("ENABLE_DEV_ENDPOINTS");

        assert_eq!(resp.status(), StatusCode::FORBIDDEN);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["success"], false);
        assert_eq!(
            json["error"],
            "Dev seed endpoints are only available in debug builds or when ENABLE_DEV_ENDPOINTS=1"
        );
    }

    #[tokio::test]
    async fn test_seed_engagement_batch() {
        let _lock = SEED_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let ctx = Arc::new(AppContext::default());
        let now = Utc::now();
        let art1 = Article {
            id: "art-batch-1".to_string(),
            title: "Article Batch 1".to_string(),
            created_at: now,
            ..Article::default_for_test()
        };
        let art2 = Article {
            id: "art-batch-2".to_string(),
            title: "Article Batch 2".to_string(),
            created_at: now,
            ..Article::default_for_test()
        };
        {
            let mut state = ctx.state.write().await;
            state.articles.clear();
            state.articles.push(art1);
            state.articles.push(art2);
        }

        let resp = seed_engagement_batch(State(ctx.clone()), None)
            .await
            .into_response();

        assert_eq!(resp.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["success"], true);
        assert_eq!(json["seeded_count"], 2);
        assert!(json["new_alerts_count"].as_u64().unwrap() >= 12);
    }

    #[tokio::test]
    async fn test_seed_engagement_reset_to_zero() {
        let _lock = SEED_ENV_LOCK.lock().unwrap_or_else(|p| p.into_inner());
        let ctx = Arc::new(AppContext::default());
        let now = Utc::now();

        let article = Article {
            id: "art-seed-reset".to_string(),
            title: "Test Reset Seed".to_string(),
            created_at: now,
            exports: vec![ExportRecord {
                channel: "Dev.to".to_string(),
                exported_at: now,
                target_path: None,
                status: "Success".to_string(),
                external_id: None,
                engagement: Some(EngagementMetrics {
                    views: 500,
                    reactions: 30,
                    comments: 5,
                    last_synced_at: Some(now),
                }),
            }],
            engagement: Some(EngagementMetrics {
                views: 1200,
                reactions: 60,
                comments: 15,
                last_synced_at: Some(now),
            }),
            engagement_badges: vec!["100+ Views".to_string(), "25+ Reactions".to_string()],
            milestone_alerts: vec![EngagementMilestoneAlert {
                id: "alert-prev-1".to_string(),
                article_id: "art-seed-reset".to_string(),
                article_title: "Test Reset Seed".to_string(),
                milestone_type: "views".to_string(),
                threshold: 100,
                message: "Reached 100 views".to_string(),
                badge_awarded: "100+ Views".to_string(),
                triggered_at: now,
                acknowledged: false,
            }],
            engagement_snapshots: vec![EngagementSnapshot {
                timestamp: now,
                views: 1200,
                reactions: 60,
                comments: 15,
                channels: std::collections::HashMap::new(),
            }],
            ..Article::default_for_test()
        };
        {
            let mut state = ctx.state.write().await;
            state.articles.push(article);
        }

        let req = SeedEngagementRequest {
            views: Some(0),
            reactions: Some(0),
            comments: Some(0),
            channels: Some(std::collections::HashMap::new()),
            generate_history_days: Some(0),
            reset_badges: Some(true),
        };

        let resp = seed_article_engagement(
            Path("art-seed-reset".to_string()),
            State(ctx.clone()),
            Some(Json(req)),
        )
        .await
        .into_response();

        assert_eq!(resp.status(), StatusCode::OK);
        let body_bytes = axum::body::to_bytes(resp.into_body(), usize::MAX).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap();
        assert_eq!(json["success"], true);
        assert_eq!(json["article"]["engagement"]["views"], 0);
        assert_eq!(json["article"]["engagement"]["reactions"], 0);
        assert_eq!(json["article"]["engagement"]["comments"], 0);

        let badges: Vec<String> =
            serde_json::from_value(json["article"]["engagement_badges"].clone()).unwrap();
        assert!(badges.is_empty());

        let alerts: Vec<serde_json::Value> =
            serde_json::from_value(json["article"]["milestone_alerts"].clone()).unwrap();
        assert!(alerts.is_empty());

        let snapshots: Vec<serde_json::Value> =
            serde_json::from_value(json["article"]["engagement_snapshots"].clone()).unwrap();
        assert!(snapshots.is_empty());

        assert_eq!(json["velocity"]["views_per_day"], 0.0);
        assert_eq!(json["velocity"]["reactions_per_day"], 0.0);
        assert_eq!(json["velocity"]["comments_per_day"], 0.0);
        assert_eq!(json["velocity"]["views_delta_24h"], 0);
        assert_eq!(json["velocity"]["reactions_delta_24h"], 0);
        assert_eq!(json["velocity"]["comments_delta_24h"], 0);
        assert_eq!(json["velocity"]["trend"], "Flat");

        let state = ctx.state.read().await;
        let saved_art = state.articles.iter().find(|a| a.id == "art-seed-reset").unwrap();
        assert!(saved_art.engagement_badges.is_empty());
        assert!(saved_art.milestone_alerts.is_empty());
        assert!(saved_art.engagement_snapshots.is_empty());
        assert!(saved_art.exports[0].engagement.is_none());
    }
}

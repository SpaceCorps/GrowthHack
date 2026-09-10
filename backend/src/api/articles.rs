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
            } else if status != "Published" {
                article.published_at = None;
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
                    backlinks,
                    outbound_citations,
                    status: "Draft".to_string(),
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

pub async fn generate_spotlight(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<GenerateSpotlightRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-art-{}", Uuid::new_v4().simple());
    let article_id = format!("art-{}", Uuid::new_v4().simple());

    let prompt = build_project_spotlight_prompt(&payload);

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let art_id_clone = article_id.clone();
    let project_name = payload.project_name.clone();
    let repo_url = payload.repo_url.clone();
    let channel = payload.target_channel.clone();
    let tagline = payload.tagline.clone();

    tokio::spawn(async move {
        match runner.execute(&prompt, tx.clone()).await {
            Ok(content) => {
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
                };
                state.articles.insert(0, article);
                let _ = state.save(&data_file);
                let _ = tx.send("[SYSTEM] Project spotlight saved to drafts library.".to_string());
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
            message: "Project spotlight generation initiated with Antigravity".to_string(),
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

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
                assert!(prompt.contains(feature), "Prompt should contain feature name");
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
            assert!(!title.is_empty(), "Feature title should not be empty for {}", f);
            assert!(!bg.is_empty(), "Feature bg should not be empty for {}", f);
            assert!(citations.len() >= 3, "Feature should have >= 3 citations for {}", f);
        }

        for a in &archetypes {
            let (title, guide) = get_archetype_details(a);
            assert!(!title.is_empty(), "Archetype title should not be empty for {}", a);
            assert!(!guide.is_empty(), "Archetype guide should not be empty for {}", a);
        }
    }
}

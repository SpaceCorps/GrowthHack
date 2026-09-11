use crate::api::articles::slugify;
use crate::api::issues::AppContext;
use crate::db::{Article, TrendTopic};
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

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ScoutTrendsRequest {
    pub sources: Option<Vec<String>>, // ["GitHub", "Reddit", "LinkedIn", "Hacker News"]
    pub mode: Option<String>,         // "general" vs "discussions"
}

#[derive(Clone, Debug, Deserialize, Serialize)]
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

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ScoutedItem {
    pub source: Option<String>,
    pub topic: String,
    pub url: Option<String>,
    pub engagement: Option<String>,
    pub summary: Option<String>,
    pub tendril_tie_in: Option<String>,
}

fn extract_object_slices(slice: &str) -> Vec<&str> {
    let mut objects = Vec::new();
    let mut depth = 0;
    let mut start_idx = None;
    let mut in_string = false;
    let mut escape = false;

    for (idx, ch) in slice.char_indices() {
        if in_string {
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_string = false;
            } else if ch == '\n' {
                escape = false;
            }
        } else {
            match ch {
                '"' => in_string = true,
                '{' => {
                    if depth == 0 {
                        start_idx = Some(idx);
                    }
                    depth += 1;
                }
                '}' if depth > 0 => {
                    depth -= 1;
                    if depth == 0 {
                        if let Some(start) = start_idx.take() {
                            objects.push(&slice[start..=idx]);
                        }
                    }
                }
                _ => {}
            }
        }
    }
    objects
}

fn clean_trailing_commas(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_string = false;
    let mut escape = false;
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        let ch = chars[i];
        if in_string {
            out.push(ch);
            if escape {
                escape = false;
            } else if ch == '\\' {
                escape = true;
            } else if ch == '"' {
                in_string = false;
            }
        } else {
            if ch == '"' {
                in_string = true;
                out.push(ch);
            } else if ch == ',' {
                let mut j = i + 1;
                while j < chars.len() && chars[j].is_whitespace() {
                    j += 1;
                }
                if j < chars.len() && (chars[j] == '}' || chars[j] == ']') {
                    // Skip trailing comma before } or ]
                } else {
                    out.push(ch);
                }
            } else {
                out.push(ch);
            }
        }
        i += 1;
    }
    out
}

fn recover_individual_items(slice: &str) -> Vec<ScoutedItem> {
    let mut items = Vec::new();
    let objects = extract_object_slices(slice);
    for obj_slice in objects {
        let trimmed = obj_slice.trim();
        if trimmed.is_empty() {
            continue;
        }
        if let Ok(item) = serde_json::from_str::<ScoutedItem>(trimmed) {
            items.push(item);
            continue;
        }
        let cleaned = clean_trailing_commas(trimmed);
        if let Ok(item) = serde_json::from_str::<ScoutedItem>(&cleaned) {
            items.push(item);
            continue;
        }
        if let Ok(repaired) = jsonrepair::repair_json(&cleaned, &jsonrepair::Options::default()) {
            if let Ok(item) = serde_json::from_str::<ScoutedItem>(&repaired) {
                items.push(item);
                continue;
            }
        }
        if let Ok(repaired) = jsonrepair::repair_json(trimmed, &jsonrepair::Options::default()) {
            if let Ok(item) = serde_json::from_str::<ScoutedItem>(&repaired) {
                items.push(item);
            }
        }
    }
    items
}

fn try_parse_candidate_json(slice: &str) -> Option<Vec<ScoutedItem>> {
    let trimmed = slice.trim();
    if trimmed.is_empty() {
        return None;
    }

    // Locate array brackets if present
    let candidate = if let Some(start) = trimmed.find('[') {
        if let Some(end) = trimmed.rfind(']') {
            if start < end {
                &trimmed[start..=end]
            } else {
                &trimmed[start..]
            }
        } else {
            &trimmed[start..]
        }
    } else {
        trimmed
    };

    // 1. Direct parse
    if let Ok(items) = serde_json::from_str::<Vec<ScoutedItem>>(candidate) {
        if !items.is_empty() {
            return Some(items);
        }
    }

    // 1b. Cleaned trailing commas
    let cleaned = clean_trailing_commas(candidate);
    if let Ok(items) = serde_json::from_str::<Vec<ScoutedItem>>(&cleaned) {
        if !items.is_empty() {
            return Some(items);
        }
    }

    // 2. Repair and parse array
    if let Ok(repaired) = jsonrepair::repair_json(&cleaned, &jsonrepair::Options::default()) {
        if let Ok(items) = serde_json::from_str::<Vec<ScoutedItem>>(&repaired) {
            if !items.is_empty() {
                return Some(items);
            }
        }
    }
    if let Ok(repaired) = jsonrepair::repair_json(candidate, &jsonrepair::Options::default()) {
        if let Ok(items) = serde_json::from_str::<Vec<ScoutedItem>>(&repaired) {
            if !items.is_empty() {
                return Some(items);
            }
        }
    }

    // 3. Truncated item recovery: scan for individual { ... } blocks
    let recovered = recover_individual_items(&cleaned);
    if !recovered.is_empty() {
        return Some(recovered);
    }
    let recovered_raw = recover_individual_items(candidate);
    if !recovered_raw.is_empty() {
        return Some(recovered_raw);
    }

    None
}

pub fn parse_scouted_topics(raw: &str) -> Vec<ScoutedItem> {
    // 1. Try finding json inside ```json ... ``` (or unclosed)
    if let Some(start) = raw.find("```json") {
        let after_start = &raw[start + 7..];
        let candidate = if let Some(end) = after_start.find("```") {
            &after_start[..end]
        } else {
            after_start
        };
        if let Some(items) = try_parse_candidate_json(candidate) {
            return items;
        }
    }

    // 2. Try finding json inside ``` ... ``` (or unclosed)
    if let Some(start) = raw.find("```") {
        let after_start = &raw[start + 3..];
        let candidate = if let Some(end) = after_start.find("```") {
            &after_start[..end]
        } else {
            after_start
        };
        if let Some(items) = try_parse_candidate_json(candidate) {
            return items;
        }
    }

    // 3. Try finding JSON in raw text (e.g. bracketed or unclosed array)
    if let Some(items) = try_parse_candidate_json(raw) {
        return items;
    }

    // 4. Fallback heuristic parsing: line by line
    let mut fallback_items = Vec::new();
    let mut current_topic: Option<String> = None;
    let mut current_source: Option<String> = None;
    let mut current_url: Option<String> = None;
    let mut current_engagement: Option<String> = None;
    let mut current_summary: Option<String> = None;

    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("### ")
            || trimmed.starts_with("## ")
            || trimmed.starts_with("Topic:")
            || trimmed.starts_with("- Topic:")
            || trimmed.starts_with("Headline:")
            || trimmed.starts_with("- Headline:")
        {
            if let Some(topic) = current_topic.take() {
                fallback_items.push(ScoutedItem {
                    topic,
                    source: current_source.take(),
                    url: current_url.take(),
                    engagement: current_engagement.take(),
                    summary: current_summary.take(),
                    tendril_tie_in: Some("direct".to_string()),
                });
            }
            let topic_val = trimmed
                .trim_start_matches('#')
                .trim()
                .trim_start_matches('-')
                .trim()
                .trim_start_matches("Topic:")
                .trim_start_matches("Headline:")
                .trim()
                .to_string();
            if !topic_val.is_empty() {
                current_topic = Some(topic_val);
            }
        } else if trimmed.to_lowercase().starts_with("source:")
            || trimmed.to_lowercase().starts_with("- source:")
        {
            current_source = Some(
                trimmed
                    .trim_start_matches('-')
                    .trim()
                    .split_once(':')
                    .map(|x| x.1.trim().to_string())
                    .unwrap_or_else(|| "Reddit".to_string()),
            );
        } else if trimmed.to_lowercase().starts_with("url:")
            || trimmed.to_lowercase().starts_with("- url:")
        {
            current_url = Some(
                trimmed
                    .trim_start_matches('-')
                    .trim()
                    .split_once(':')
                    .map(|x| x.1.trim().to_string())
                    .unwrap_or_else(|| "https://reddit.com".to_string()),
            );
        } else if trimmed.to_lowercase().starts_with("engagement:")
            || trimmed.to_lowercase().starts_with("- engagement:")
        {
            current_engagement = Some(
                trimmed
                    .trim_start_matches('-')
                    .trim()
                    .split_once(':')
                    .map(|x| x.1.trim().to_string())
                    .unwrap_or_default(),
            );
        } else if trimmed.to_lowercase().starts_with("summary:")
            || trimmed.to_lowercase().starts_with("- summary:")
        {
            current_summary = Some(
                trimmed
                    .trim_start_matches('-')
                    .trim()
                    .split_once(':')
                    .map(|x| x.1.trim().to_string())
                    .unwrap_or_default(),
            );
        }
    }

    if let Some(topic) = current_topic {
        fallback_items.push(ScoutedItem {
            topic,
            source: current_source,
            url: current_url,
            engagement: current_engagement,
            summary: current_summary,
            tendril_tie_in: Some("direct".to_string()),
        });
    }

    fallback_items
}

pub fn build_scout_prompt(sources: Option<&[String]>) -> String {
    let source_descriptions: Vec<(String, String)> = match sources {
        Some(list) if !list.is_empty() => list
            .iter()
            .map(|s| {
                let s_trim = s.trim();
                let desc = match s_trim.to_lowercase().as_str() {
                    "github" => "GitHub Trending repositories (e.g. CLI agents, LLM harnesses, coding assistants)".to_string(),
                    "reddit" => "Reddit discussions (r/LocalLLaMA, r/programming, r/ClaudeAI)".to_string(),
                    "linkedin" => "Tech LinkedIn / Twitter discussions regarding software engineering automation".to_string(),
                    _ => format!("{} discussions and trending topics", s_trim),
                };
                (s_trim.to_string(), desc)
            })
            .collect(),
        _ => vec![
            ("GitHub".to_string(), "GitHub Trending repositories (e.g. CLI agents, LLM harnesses, coding assistants)".to_string()),
            ("Reddit".to_string(), "Reddit discussions (r/LocalLLaMA, r/programming, r/ClaudeAI)".to_string()),
            ("LinkedIn".to_string(), "Tech LinkedIn / Twitter discussions regarding software engineering automation".to_string()),
        ],
    };

    let sources_list = source_descriptions
        .iter()
        .enumerate()
        .map(|(idx, (_, desc))| format!("{}. {}", idx + 1, desc))
        .collect::<Vec<_>>()
        .join("\n");

    let source_names = source_descriptions
        .iter()
        .map(|(name, _)| name.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    let primary_source = source_descriptions
        .first()
        .map(|(name, _)| name.as_str())
        .unwrap_or("GitHub");

    format!(
        r#"You are an AI developer relations radar scout.
Research what is currently trending today in AI engineering, coding agents, and developer tools across:
{}

Identify 3 high-impact trending topics. For each topic provide:
- source: ({})
- topic: headline
- url: thread or repository URL
- engagement: stars today, reactions, or comment volume
- summary: core engineering bottleneck, breakthrough, or excitement
- tendril_tie_in: "direct", "subtle", or "none"

Respond with a JSON array wrapped in ```json ... ```:
[
  {{
    "source": "{}",
    "topic": "Trending topic headline",
    "url": "https://example.com/topic",
    "engagement": "High signal",
    "summary": "Core engineering breakdown",
    "tendril_tie_in": "direct"
  }}
]"#,
        sources_list, source_names, primary_source
    )
}

pub fn build_discussions_prompt(sources: Option<&[String]>) -> String {
    let clean_sources: Vec<String> = sources
        .map(|s| {
            s.iter()
                .map(|item| item.trim().to_string())
                .filter(|item| !item.is_empty())
                .collect()
        })
        .unwrap_or_default();

    if clean_sources.is_empty() {
        let default_targets = "Reddit (r/LocalLLaMA, r/programming, r/ClaudeAI), Hacker News";
        return format!(
            r#"You are an AI developer relations radar scout specializing in real-time social discussion harvesting.
Investigate developer discussions, complaints, and pain points across {default_targets} (focusing on r/LocalLLaMA, r/programming, r/ClaudeAI, Hacker News).
Specifically target discussions around:
- "Claude Code worktree"
- "OpenHands vs"
- "coding agent sandbox"
- "agent git merge conflict"

Identify 3 high-impact developer discussions. For each topic provide:
- source: e.g. "Reddit" or "Hacker News"
- topic: clear, engaging title of the debate or complaint
- url: direct link or reference thread
- engagement: engagement metrics (upvotes, comment count, sentiment)
- summary: root cause technical analysis of why developers are struggling with agent workspace collisions or lack of verification
- tendril_tie_in: "direct", "subtle", or "none"

Respond with a JSON array wrapped in ```json ... ```:
[
  {{
    "source": "Reddit",
    "topic": "Developers hitting git lock collisions running concurrent Claude Code instances",
    "url": "https://reddit.com/r/LocalLLaMA/comments/agent_workspace_collision",
    "engagement": "450 upvotes, 120 comments",
    "summary": "Engineers are complaining about dirty index corruption when multiple agent loops share one checked-out repo.",
    "tendril_tie_in": "direct"
  }}
]"#
        );
    }

    let mut subreddits = Vec::new();
    let mut forums = Vec::new();

    for s in &clean_sources {
        let lower = s.to_lowercase();
        if lower.starts_with("r/") || lower == "reddit" || lower.contains("reddit.com") {
            subreddits.push(s.as_str());
        } else {
            forums.push(s.as_str());
        }
    }

    let mut target_sections = Vec::new();
    if !subreddits.is_empty() {
        target_sections.push(format!("subreddits ({})", subreddits.join(", ")));
    }
    if !forums.is_empty() {
        target_sections.push(format!("developer forums & platforms ({})", forums.join(", ")));
    }
    let targets_desc = target_sections.join(" and ");
    let sources_str = clean_sources.join(", ");

    let example_source = clean_sources.first().map(|s| s.as_str()).unwrap_or("Reddit");
    let example_url = if example_source.to_lowercase().starts_with("r/") {
        format!("https://reddit.com/{}/comments/example_thread", example_source)
    } else if example_source.to_lowercase().contains("lobste.rs") {
        "https://lobste.rs/s/example_topic".to_string()
    } else if example_source.to_lowercase().contains("hacker news") {
        "https://news.ycombinator.com/item?id=example".to_string()
    } else {
        format!("https://{}/example_thread", example_source.to_lowercase().replace(' ', ""))
    };

    format!(
        r#"You are an AI developer relations radar scout specializing in real-time social discussion harvesting.
Investigate developer discussions, complaints, and pain points across {sources_str} specifically targeting {targets_desc}.
Specifically target discussions around:
- "Claude Code worktree"
- "OpenHands vs"
- "coding agent sandbox"
- "agent git merge conflict"

Focus your search specifically on discussions, complaints, and bottlenecks reported by developers on {sources_str}.

Identify 3 high-impact developer discussions. For each topic provide:
- source: ({sources_str})
- topic: clear, engaging title of the debate or complaint
- url: direct link or reference thread
- engagement: engagement metrics (upvotes, comment count, sentiment)
- summary: root cause technical analysis of why developers are struggling with agent workspace collisions or lack of verification
- tendril_tie_in: "direct", "subtle", or "none"

Respond with a JSON array wrapped in ```json ... ```:
[
  {{
    "source": "{example_source}",
    "topic": "Developers discussing agent workspace collisions and tool bottlenecks",
    "url": "{example_url}",
    "engagement": "Active debate, high sentiment",
    "summary": "Engineers discussing challenges with agent isolation and lack of verification gates.",
    "tendril_tie_in": "direct"
  }}
]"#
    )
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
    Json(payload): Json<ScoutTrendsRequest>,
) -> impl IntoResponse {
    let task_id = format!("task-scout-{}", Uuid::new_v4().simple());
    let mode = payload.mode.as_deref().unwrap_or("general");

    let message = match &payload.sources {
        Some(sources) if !sources.is_empty() => {
            if mode == "discussions" {
                format!(
                    "Discussions harvester started for {} with Antigravity",
                    sources.join(", ")
                )
            } else {
                format!(
                    "Trend scout started for {} with Antigravity",
                    sources.join(", ")
                )
            }
        }
        _ => {
            if mode == "discussions" {
                "Discussions harvester started with Antigravity".to_string()
            } else {
                "Trend scout started with Antigravity".to_string()
            }
        }
    };

    let prompt = if mode == "discussions" {
        build_discussions_prompt(payload.sources.as_deref())
    } else {
        build_scout_prompt(payload.sources.as_deref())
    };

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();

    tokio::spawn(async move {
        match runner.execute(&prompt, tx.clone()).await {
            Ok(content) => {
                let parsed_items = parse_scouted_topics(&content);
                if parsed_items.is_empty() {
                    let _ = tx.send(
                        "[WARN] No structured topics could be parsed from scout output."
                            .to_string(),
                    );
                } else {
                    let mut state = state_arc.write().await;
                    let mut added_count = 0;

                    for item in parsed_items {
                        let topic_clean = item.topic.trim().to_string();
                        let url_clean = item.url.as_deref().unwrap_or("").trim().to_string();

                        let is_dup = state.trends.iter().any(|t| {
                            t.topic.trim().eq_ignore_ascii_case(&topic_clean)
                                || (!url_clean.is_empty()
                                    && t.url.trim().eq_ignore_ascii_case(&url_clean))
                        });

                        if !is_dup && !topic_clean.is_empty() {
                            let source = item.source.unwrap_or_else(|| "Reddit".to_string());
                            let url = if url_clean.is_empty() {
                                "https://github.com/trending".to_string()
                            } else {
                                url_clean
                            };
                            let engagement = item
                                .engagement
                                .unwrap_or_else(|| "Active trending".to_string());
                            let summary = item.summary.unwrap_or_default();
                            let tie_in = match item.tendril_tie_in.as_deref() {
                                Some("subtle") => "subtle",
                                Some("none") => "none",
                                _ => "direct",
                            };

                            let new_trend = TrendTopic {
                                id: format!("trend-{}", Uuid::new_v4().simple()),
                                source,
                                topic: topic_clean,
                                url,
                                engagement,
                                summary,
                                tendril_tie_in: tie_in.to_string(),
                                status: "Scouted".to_string(),
                                generated_article_id: None,
                                created_at: Utc::now(),
                            };
                            state.trends.insert(0, new_trend);
                            added_count += 1;
                        }
                    }

                    if added_count > 0 {
                        let _ = state.save(&data_file);
                        let _ = tx.send(format!(
                            "[SYSTEM] Successfully scouted and persisted {} new trend topics to Radar.",
                            added_count
                        ));
                    } else {
                        let _ = tx.send(
                            "[SYSTEM] Scouted topics were already present in Radar (deduplicated)."
                                .to_string(),
                        );
                    }
                }
            }
            Err(e) => {
                let _ = tx.send(format!("[ERROR] Scout execution failed: {}", e));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(TrendActionResponse {
            task_id,
            message,
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
    let channel = payload.channel.unwrap_or_else(|| "Website".to_string());

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
        trend.source,
        trend.topic,
        trend.summary,
        trend.engagement,
        channel,
        tie_in,
        tie_in_instruction
    );

    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();
    let state_arc = ctx.state.clone();
    let data_file = ctx.data_file.clone();
    let art_id_clone = article_id.clone();
    let trend_id_clone = id.clone();
    let topic_title = trend.topic.clone();
    let tie_in_clone = tie_in.clone();

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
                    backlinks: if tie_in_clone != "none" {
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
                    engagement: None,
                    engagement_snapshots: Vec::new(),
                };
                state.articles.insert(0, article);

                if let Some(t) = state.trends.iter_mut().find(|t| t.id == trend_id_clone) {
                    t.status = "Published".to_string();
                    t.generated_article_id = Some(art_id_clone);
                    t.tendril_tie_in = tie_in_clone;
                }
                let _ = state.save(&data_file);
                let _ = tx.send(
                    "[SYSTEM] Trend article synthesized and saved to website drafts!".to_string(),
                );
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_scout_prompt_default() {
        let prompt_none = build_scout_prompt(None);
        assert!(prompt_none.contains("GitHub"));
        assert!(prompt_none.contains("Reddit"));
        assert!(prompt_none.contains("LinkedIn"));

        let empty: Vec<String> = vec![];
        let prompt_empty = build_scout_prompt(Some(&empty));
        assert!(prompt_empty.contains("GitHub"));
        assert!(prompt_empty.contains("Reddit"));
        assert!(prompt_empty.contains("LinkedIn"));
    }

    #[test]
    fn test_build_scout_prompt_single_source() {
        let sources = vec!["GitHub".to_string()];
        let prompt = build_scout_prompt(Some(&sources));
        assert!(prompt.contains("GitHub"));
        assert!(!prompt.contains("Reddit"));
        assert!(!prompt.contains("LinkedIn"));
    }

    #[test]
    fn test_build_scout_prompt_multiple_sources() {
        let sources = vec!["Reddit".to_string(), "LinkedIn".to_string()];
        let prompt = build_scout_prompt(Some(&sources));
        assert!(!prompt.contains("GitHub"));
        assert!(prompt.contains("Reddit"));
        assert!(prompt.contains("LinkedIn"));
    }

    #[test]
    fn test_build_discussions_prompt_default() {
        let prompt_none = build_discussions_prompt(None);
        assert!(prompt_none.contains("r/LocalLLaMA"));
        assert!(prompt_none.contains("r/programming"));
        assert!(prompt_none.contains("r/ClaudeAI"));
        assert!(prompt_none.contains("Hacker News"));

        let empty: Vec<String> = vec![];
        let prompt_empty = build_discussions_prompt(Some(&empty));
        assert!(prompt_empty.contains("r/LocalLLaMA"));
        assert!(prompt_empty.contains("r/programming"));
        assert!(prompt_empty.contains("r/ClaudeAI"));
        assert!(prompt_empty.contains("Hacker News"));
    }

    #[test]
    fn test_build_discussions_prompt_custom_subreddits() {
        let sources = vec!["r/rust".to_string(), "r/ChatGPTCoding".to_string()];
        let prompt = build_discussions_prompt(Some(&sources));
        assert!(prompt.contains("r/rust"));
        assert!(prompt.contains("r/ChatGPTCoding"));
        assert!(prompt.contains("subreddits (r/rust, r/ChatGPTCoding)"));
    }

    #[test]
    fn test_build_discussions_prompt_developer_forums() {
        let sources = vec!["Lobste.rs".to_string(), "forum.cursor.com".to_string()];
        let prompt = build_discussions_prompt(Some(&sources));
        assert!(prompt.contains("Lobste.rs"));
        assert!(prompt.contains("forum.cursor.com"));
        assert!(prompt.contains("developer forums & platforms (Lobste.rs, forum.cursor.com)"));
    }
}

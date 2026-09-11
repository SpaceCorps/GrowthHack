use crate::api::issues::AppContext;
use crate::db::{
    AuthenticityAnalysis, BetaTester, GrowthState, LaunchCampaignState, ShowHnState,
    SyndicationChecklistItem, TimelineTask,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Arc;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct AnalyzeShowHnRequest {
    pub title: String,
    pub maker_comment: String,
}

#[derive(Clone, Debug, Deserialize, Default)]
pub struct UpdateBetaTesterRequest {
    pub outreach_status: Option<String>,
    pub handle: Option<String>,
    pub notes: Option<String>,
    pub name: Option<String>,
    pub platform: Option<String>,
    pub specialty: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Default)]
pub struct ToggleChecklistRequest {
    pub completed: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Default)]
pub struct ToggleTimelineTaskRequest {
    pub completed: Option<bool>,
}

#[derive(Clone, Debug, Deserialize, Default)]
pub struct UpdateShowHnRequest {
    pub title: Option<String>,
    pub maker_comment: Option<String>,
    pub url: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub fn evaluate_authenticity(title: &str, maker_comment: &str) -> AuthenticityAnalysis {
    let mut score: i32 = 50;
    let mut suggestions = Vec::new();
    let mut penalty_reasons = Vec::new();
    let mut matched_keywords_set = HashSet::new();

    let combined_lower = format!("{} {}", title, maker_comment).to_lowercase();

    // Reward technical keywords
    let technical_keywords = [
        ("isolated git worktrees", "isolated git worktrees"),
        ("git worktree", "git worktrees"),
        ("verification gates", "verification gates"),
        ("rust", "Rust"),
        ("axum", "Axum"),
        ("tokio", "Tokio"),
        ("cli", "CLI"),
        ("open source", "open source"),
        ("architecture", "architecture"),
        ("reproducible", "reproducible"),
        ("benchmarks", "benchmarks"),
        ("benchmark", "benchmarks"),
    ];

    for (needle, label) in technical_keywords {
        if combined_lower.contains(needle) {
            matched_keywords_set.insert(label.to_string());
        }
    }

    let keyword_count = matched_keywords_set.len();
    score += (keyword_count as i32 * 6).min(36);

    // Penalize hype & marketing jargon
    let buzzwords = [
        "revolutionary",
        "disrupt",
        "game-changer",
        "world's first",
        "ultimate",
        "magic",
        "effortless",
        "synergy",
        "next-gen",
    ];

    for word in buzzwords {
        if combined_lower.contains(word) {
            score -= 15;
            penalty_reasons.push(format!(
                "Contains marketing buzzword '{}' – HN readers typically penalize promotional hype",
                word
            ));
        }
    }

    // Structural checks
    let title_trimmed = title.trim();
    if title_trimmed.to_lowercase().starts_with("show hn:") {
        score += 10;
    } else {
        suggestions.push("Start title with 'Show HN:' for proper Hacker News recognition".to_string());
    }

    let title_len = title_trimmed.chars().count();
    if (30..=100).contains(&title_len) {
        score += 5;
    } else if title_len > 100 {
        suggestions.push(format!(
            "Title is long ({} chars); keep under 100 characters for optimal HN readability",
            title_len
        ));
    } else if title_len < 30 {
        suggestions.push("Title is very brief; specify the core technology and value proposition".to_string());
    }

    let comment_len = maker_comment.trim().chars().count();
    if comment_len >= 200 {
        score += 10;
    } else {
        score -= 10;
        suggestions.push(format!(
            "Maker comment is too brief ({} chars); expand to at least 200 characters explaining context and motivation",
            comment_len
        ));
    }

    let has_problem_or_tradeoffs = [
        "because",
        "why",
        "trade-off",
        "tradeoff",
        "problem",
        "failure",
        "instead",
        "bottleneck",
        "collision",
    ]
    .iter()
    .any(|k| combined_lower.contains(k));

    if has_problem_or_tradeoffs {
        score += 10;
    } else {
        suggestions.push("Explain the problem that led you to build this and technical trade-offs considered".to_string());
    }

    let has_link = maker_comment.contains("http://")
        || maker_comment.contains("https://")
        || maker_comment.contains("github.com");

    if has_link {
        score += 10;
    } else {
        suggestions.push("Include a direct link to the GitHub repository or live demonstration".to_string());
    }

    let clamped_score = score.clamp(0, 100) as u32;

    let rating = match clamped_score {
        85..=100 => "Authentic & Technical (High HN Alignment)",
        70..=84 => "Good Technical Substance",
        50..=69 => "Needs More Technical Depth",
        _ => "High Risk of Community Rejection",
    }
    .to_string();

    let mut keyword_matches: Vec<String> = matched_keywords_set.into_iter().collect();
    keyword_matches.sort();

    if suggestions.is_empty() {
        suggestions.push("Excellent Show HN formulation with strong technical grounding.".to_string());
    }

    AuthenticityAnalysis {
        score: clamped_score,
        rating,
        suggestions,
        keyword_matches,
        penalty_reasons,
    }
}

pub async fn get_launch_overview(State(ctx): State<Arc<AppContext>>) -> Json<LaunchCampaignState> {
    let mut state = ctx.state.write().await;
    if state.launch_campaign.is_none() {
        let seeded = GrowthState::seed_launch_campaign(Utc::now());
        state.launch_campaign = Some(seeded.clone());
        let _ = state.save(&ctx.data_file);
        return Json(seeded);
    }
    Json(state.launch_campaign.clone().unwrap())
}

pub async fn analyze_show_hn(
    Json(payload): Json<AnalyzeShowHnRequest>,
) -> Json<AuthenticityAnalysis> {
    let analysis = evaluate_authenticity(&payload.title, &payload.maker_comment);
    Json(analysis)
}

pub async fn update_beta_tester(
    State(ctx): State<Arc<AppContext>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateBetaTesterRequest>,
) -> Result<(StatusCode, Json<BetaTester>), (StatusCode, Json<ErrorResponse>)> {
    let mut state = ctx.state.write().await;

    if state.launch_campaign.is_none() {
        state.launch_campaign = Some(GrowthState::seed_launch_campaign(Utc::now()));
    }

    let campaign = state.launch_campaign.as_mut().unwrap();
    let tester = campaign.beta_testers.iter_mut().find(|t| t.id == id);

    let tester = match tester {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Beta tester with id '{}' not found", id),
                }),
            ));
        }
    };

    if let Some(status) = payload.outreach_status {
        tester.outreach_status = status;
    }
    if let Some(handle) = payload.handle {
        tester.handle = handle;
    }
    if let Some(notes) = payload.notes {
        tester.notes = notes;
    }
    if let Some(name) = payload.name {
        tester.name = name;
    }
    if let Some(platform) = payload.platform {
        tester.platform = platform;
    }
    if let Some(specialty) = payload.specialty {
        tester.specialty = specialty;
    }
    tester.updated_at = Utc::now();

    let updated_tester = tester.clone();
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::OK, Json(updated_tester)))
}

pub async fn toggle_syndication_checklist(
    State(ctx): State<Arc<AppContext>>,
    Path(id): Path<String>,
    payload: Option<Json<ToggleChecklistRequest>>,
) -> Result<(StatusCode, Json<SyndicationChecklistItem>), (StatusCode, Json<ErrorResponse>)> {
    let mut state = ctx.state.write().await;

    if state.launch_campaign.is_none() {
        state.launch_campaign = Some(GrowthState::seed_launch_campaign(Utc::now()));
    }

    let campaign = state.launch_campaign.as_mut().unwrap();
    let item = campaign.syndication_checklist.iter_mut().find(|i| i.id == id);

    let item = match item {
        Some(i) => i,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Syndication checklist item with id '{}' not found", id),
                }),
            ));
        }
    };

    if let Some(Json(req)) = payload {
        item.completed = req.completed.unwrap_or(!item.completed);
    } else {
        item.completed = !item.completed;
    }

    let updated_item = item.clone();
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::OK, Json(updated_item)))
}

pub async fn toggle_timeline_task(
    State(ctx): State<Arc<AppContext>>,
    Path((phase_id, task_id)): Path<(String, String)>,
    payload: Option<Json<ToggleTimelineTaskRequest>>,
) -> Result<(StatusCode, Json<TimelineTask>), (StatusCode, Json<ErrorResponse>)> {
    let mut state = ctx.state.write().await;

    if state.launch_campaign.is_none() {
        state.launch_campaign = Some(GrowthState::seed_launch_campaign(Utc::now()));
    }

    let campaign = state.launch_campaign.as_mut().unwrap();
    let phase = campaign.timeline.iter_mut().find(|p| p.id == phase_id);

    let phase = match phase {
        Some(p) => p,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!("Timeline phase with id '{}' not found", phase_id),
                }),
            ));
        }
    };

    let task = phase.tasks.iter_mut().find(|t| t.id == task_id);
    let task = match task {
        Some(t) => t,
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: format!(
                        "Timeline task with id '{}' not found in phase '{}'",
                        task_id, phase_id
                    ),
                }),
            ));
        }
    };

    if let Some(Json(req)) = payload {
        task.completed = req.completed.unwrap_or(!task.completed);
    } else {
        task.completed = !task.completed;
    }

    let updated_task = task.clone();
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::OK, Json(updated_task)))
}

pub async fn reset_launch_campaign(
    State(ctx): State<Arc<AppContext>>,
) -> Json<LaunchCampaignState> {
    let mut state = ctx.state.write().await;
    let seeded = GrowthState::seed_launch_campaign(Utc::now());
    state.launch_campaign = Some(seeded.clone());
    let _ = state.save(&ctx.data_file);
    Json(seeded)
}

pub async fn update_show_hn(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdateShowHnRequest>,
) -> Result<(StatusCode, Json<ShowHnState>), (StatusCode, Json<ErrorResponse>)> {
    let mut state = ctx.state.write().await;

    if state.launch_campaign.is_none() {
        state.launch_campaign = Some(GrowthState::seed_launch_campaign(Utc::now()));
    }

    let campaign = state.launch_campaign.as_mut().unwrap();
    if let Some(t) = payload.title {
        campaign.show_hn.title = t;
    }
    if let Some(c) = payload.maker_comment {
        campaign.show_hn.maker_comment = c;
    }
    if let Some(u) = payload.url {
        campaign.show_hn.url = u;
    }

    let analysis = evaluate_authenticity(&campaign.show_hn.title, &campaign.show_hn.maker_comment);
    campaign.show_hn.authenticity_score = analysis.score;
    campaign.show_hn.score_breakdown = Some(analysis);

    let updated = campaign.show_hn.clone();
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::OK, Json(updated)))
}

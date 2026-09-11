use crate::api::issues::AppContext;
use crate::db::{AgentTask, Recipe, RecipeParameter};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Debug, Deserialize, Default)]
pub struct ListRecipesQuery {
    pub category: Option<String>,
    pub search: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RunRecipeRequest {
    #[serde(default)]
    pub parameters: HashMap<String, String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct RunRecipeResponse {
    pub task_id: String,
    pub recipe_id: String,
    pub cli_command: String,
    pub message: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SubmitRecipeRequest {
    pub name: String,
    pub slug: String,
    pub description: String,
    pub category: String,
    pub author: Option<String>,
    pub author_avatar: Option<String>,
    pub version: Option<String>,
    pub tags: Option<Vec<String>>,
    pub promptware_template: String,
    #[serde(default)]
    pub parameters: Vec<RecipeParameter>,
    pub cli_snippet: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
pub struct ErrorResponse {
    pub error: String,
}

pub fn resolve_cli_snippet(recipe: &Recipe, overrides: &HashMap<String, String>) -> String {
    let mut snippet = recipe.cli_snippet.clone();
    if snippet.trim().is_empty() {
        snippet = format!("curl -s -X POST http://localhost:4200/api/recipes/{}/run", recipe.slug);
    }

    let mut applied_keys = Vec::new();

    for param in &recipe.parameters {
        let val = overrides
            .get(&param.name)
            .cloned()
            .unwrap_or_else(|| param.default_value.clone());

        let placeholder = format!("<{}>", param.name);
        if snippet.contains(&placeholder) {
            snippet = snippet.replace(&placeholder, &val);
            applied_keys.push(param.name.clone());
        }
    }

    let unapplied: Vec<(&String, &String)> = overrides
        .iter()
        .filter(|(k, _)| !applied_keys.contains(k))
        .collect();

    if !unapplied.is_empty() {
        if let Some(start) = snippet.find("-d '") {
            let json_start = start + 4;
            if let Some(end) = snippet[json_start..].rfind('\'') {
                let json_str = &snippet[json_start..json_start + end];
                if let Ok(mut val) = serde_json::from_str::<serde_json::Value>(json_str) {
                    if let Some(params) = val.get_mut("parameters").and_then(|p| p.as_object_mut()) {
                        for (k, v) in &unapplied {
                            params.insert((*k).clone(), serde_json::Value::String((*v).clone()));
                        }
                        if let Ok(new_json) = serde_json::to_string(&val) {
                            snippet = format!("{}'{}'{}", &snippet[..start + 3], new_json, &snippet[json_start + end + 1..]);
                            return snippet;
                        }
                    }
                }
            }
        }

        let mut params = serde_json::Map::new();
        for (k, v) in unapplied {
            params.insert(k.clone(), serde_json::Value::String(v.clone()));
        }
        let body = serde_json::json!({ "parameters": params });
        if !snippet.contains("-H \"Content-Type: application/json\"") {
            snippet.push_str(" -H \"Content-Type: application/json\"");
        }
        snippet.push_str(&format!(" -d '{}'", body));
    }

    snippet
}

pub async fn list_recipes(
    State(ctx): State<Arc<AppContext>>,
    Query(query): Query<ListRecipesQuery>,
) -> Json<Vec<Recipe>> {
    let state = ctx.state.read().await;
    let mut recipes = state.recipes.clone();

    if let Some(cat) = &query.category {
        let cat_trimmed = cat.trim();
        if !cat_trimmed.is_empty() && !cat_trimmed.eq_ignore_ascii_case("all") {
            recipes.retain(|r| r.category.eq_ignore_ascii_case(cat_trimmed));
        }
    }

    if let Some(search) = &query.search {
        let q = search.trim().to_lowercase();
        if !q.is_empty() {
            recipes.retain(|r| {
                r.name.to_lowercase().contains(&q)
                    || r.slug.to_lowercase().contains(&q)
                    || r.description.to_lowercase().contains(&q)
                    || r.tags.iter().any(|t| t.to_lowercase().contains(&q))
            });
        }
    }

    Json(recipes)
}

pub async fn get_recipe(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> impl IntoResponse {
    let state = ctx.state.read().await;
    if let Some(recipe) = state.recipes.iter().find(|r| r.id == id || r.slug == id) {
        (StatusCode::OK, Json(Some(recipe.clone())))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub async fn create_or_update_recipe(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<Recipe>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let now = Utc::now();

    if let Some(existing) = state.recipes.iter_mut().find(|r| r.id == payload.id) {
        *existing = payload;
        existing.updated_at = now;
        let updated = existing.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(updated))
    } else {
        let mut new_recipe = payload;
        new_recipe.created_at = now;
        new_recipe.updated_at = now;
        state.recipes.push(new_recipe.clone());
        let _ = state.save(&ctx.data_file);
        (StatusCode::CREATED, Json(new_recipe))
    }
}

pub async fn run_recipe(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<RunRecipeRequest>,
) -> impl IntoResponse {
    let mut state = ctx.state.write().await;
    let recipe_opt = state.recipes.iter().find(|r| r.id == id || r.slug == id).cloned();

    if recipe_opt.is_none() {
        return (
            StatusCode::NOT_FOUND,
            Json(RunRecipeResponse {
                task_id: String::new(),
                recipe_id: id,
                cli_command: String::new(),
                message: "Recipe not found".to_string(),
            }),
        );
    }

    let recipe = recipe_opt.unwrap();
    let cli_command = resolve_cli_snippet(&recipe, &payload.parameters);
    let task_id = format!("task-{}", Uuid::new_v4().simple());

    let prompt = format!(
        "Execute Tendril Recipe '{}' ({})\nCLI Command: {}\nCategory: {}\nParameters: {:?}\nPromptware Template:\n{}",
        recipe.name, recipe.slug, cli_command, recipe.category, payload.parameters, recipe.promptware_template
    );

    let task = AgentTask {
        id: task_id.clone(),
        task_type: "RecipeRun".to_string(),
        target_id: Some(recipe.id.clone()),
        prompt: prompt.clone(),
        status: "Running".to_string(),
        logs: vec![format!("Starting recipe {} ({})", recipe.name, cli_command)],
        result: None,
        started_at: Utc::now(),
        completed_at: None,
    };
    state.tasks.push(task);
    let _ = state.save(&ctx.data_file);
    drop(state);

    ctx.task_manager.spawn_task(&task_id, prompt).await;

    (
        StatusCode::ACCEPTED,
        Json(RunRecipeResponse {
            task_id,
            recipe_id: recipe.id.clone(),
            cli_command,
            message: "Recipe execution dispatched".to_string(),
        }),
    )
}

pub async fn submit_recipe(
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<SubmitRecipeRequest>,
) -> Result<(StatusCode, Json<Recipe>), (StatusCode, Json<ErrorResponse>)> {
    if payload.name.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Recipe name is required and cannot be empty".to_string(),
            }),
        ));
    }

    if payload.slug.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Recipe slug is required and cannot be empty".to_string(),
            }),
        ));
    }

    let slug_trimmed = payload.slug.trim();
    if !slug_trimmed.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Recipe slug must contain only alphanumeric characters and hyphens".to_string(),
            }),
        ));
    }

    if payload.description.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Recipe description is required and cannot be empty".to_string(),
            }),
        ));
    }

    if payload.category.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Recipe category is required and cannot be empty".to_string(),
            }),
        ));
    }

    if payload.promptware_template.trim().is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Recipe promptware template is required and cannot be empty".to_string(),
            }),
        ));
    }

    for param in &payload.parameters {
        if param.name.trim().is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Recipe parameter name cannot be empty".to_string(),
                }),
            ));
        }
    }

    let mut state = ctx.state.write().await;
    if state.recipes.iter().any(|r| r.slug.eq_ignore_ascii_case(slug_trimmed)) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Recipe with slug '{}' already exists", slug_trimmed),
            }),
        ));
    }

    let now = Utc::now();
    let author_name = payload
        .author
        .filter(|a| !a.trim().is_empty())
        .unwrap_or_else(|| "Community Contributor".to_string());

    let cli_snippet = payload.cli_snippet.unwrap_or_else(|| {
        format!("curl -s -X POST http://localhost:4200/api/recipes/{}/run", slug_trimmed)
    });

    let new_recipe = Recipe {
        id: format!("recipe-{}", slug_trimmed),
        slug: slug_trimmed.to_string(),
        name: payload.name.trim().to_string(),
        description: payload.description.trim().to_string(),
        category: payload.category.trim().to_string(),
        author: author_name,
        author_avatar: payload.author_avatar,
        version: payload.version.unwrap_or_else(|| "1.0.0".to_string()),
        tags: payload.tags.unwrap_or_default(),
        promptware_template: payload.promptware_template,
        parameters: payload.parameters,
        cli_snippet,
        forks_count: 0,
        stars_count: 1,
        is_official: false,
        badge: Some("Community Pioneer".to_string()),
        created_at: now,
        updated_at: now,
    };

    state.recipes.push(new_recipe.clone());
    let _ = state.save(&ctx.data_file);

    Ok((StatusCode::CREATED, Json(new_recipe)))
}

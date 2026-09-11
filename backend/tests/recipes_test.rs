mod common;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::api::recipes::{
    get_recipe, list_recipes, resolve_cli_snippet, run_recipe, submit_recipe, ListRecipesQuery,
    RunRecipeRequest, SubmitRecipeRequest,
};
use growthhack_backend::db::RecipeParameter;
use std::collections::HashMap;

#[tokio::test]
async fn test_list_recipes_returns_5_seeded_gold_standard_recipes() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();
    let Json(recipes) = list_recipes(State(ctx.clone()), Query(ListRecipesQuery::default())).await;

    assert_eq!(recipes.len(), 5);

    let names: Vec<String> = recipes.iter().map(|r| r.name.clone()).collect();
    assert!(names.contains(&"Bugfixer".to_string()));
    assert!(names.contains(&"Security Patcher".to_string()));
    assert!(names.contains(&"Test Generator".to_string()));
    assert!(names.contains(&"PR Reviewer".to_string()));
    assert!(names.contains(&"DB Migrator".to_string()));

    let categories: Vec<String> = recipes.iter().map(|r| r.category.clone()).collect();
    assert!(categories.contains(&"Maintenance".to_string()));
    assert!(categories.contains(&"Security".to_string()));
    assert!(categories.contains(&"Testing".to_string()));
    assert!(categories.contains(&"Code Quality".to_string()));
    assert!(categories.contains(&"Database".to_string()));

    for r in &recipes {
        assert!(r.is_official);
        assert_eq!(r.badge.as_deref(), Some("Core Team"));
        assert!(!r.parameters.is_empty());
        assert!(!r.promptware_template.is_empty());
        assert!(!r.cli_snippet.is_empty());
    }

    // Verify lookup by id/slug
    let resp = get_recipe(Path("bugfixer".to_string()), State(ctx.clone())).await;
    let (parts, _) = axum::response::IntoResponse::into_response(resp).into_parts();
    assert_eq!(parts.status, StatusCode::OK);
}

#[tokio::test]
async fn test_recipe_parameters_and_cli_snippet_generation() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();
    let Json(recipes) = list_recipes(State(ctx), Query(ListRecipesQuery::default())).await;

    let bugfixer = recipes
        .iter()
        .find(|r| r.slug == "bugfixer")
        .expect("bugfixer missing");
    assert!(bugfixer
        .parameters
        .iter()
        .any(|p| p.name == "issue_id" && p.required));
    assert!(bugfixer
        .parameters
        .iter()
        .any(|p| p.name == "test_first" && !p.required));

    // Default parameters
    let default_cmd = resolve_cli_snippet(bugfixer, &HashMap::new());
    assert_eq!(
        default_cmd,
        "curl -s -X POST http://localhost:4200/api/recipes/bugfixer/run -H \"Content-Type: application/json\" -d '{\"parameters\":{\"issue_id\":\"42\"}}'"
    );

    // Overridden parameters
    let mut overrides = HashMap::new();
    overrides.insert("issue_id".to_string(), "104".to_string());
    overrides.insert("worktree_name".to_string(), "hotfix-auth".to_string());
    let custom_cmd = resolve_cli_snippet(bugfixer, &overrides);
    assert!(custom_cmd.contains("curl -s -X POST http://localhost:4200/api/recipes/bugfixer/run"));
    assert!(custom_cmd.contains("\"issue_id\":\"104\""));
    assert!(custom_cmd.contains("\"worktree_name\":\"hotfix-auth\""));
}

#[tokio::test]
async fn test_run_recipe_endpoint_dispatches_task() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    let mut overrides = HashMap::new();
    overrides.insert("issue_id".to_string(), "88".to_string());

    let resp = run_recipe(
        Path("recipe-bugfixer".to_string()),
        State(ctx.clone()),
        Json(RunRecipeRequest {
            parameters: overrides,
        }),
    )
    .await;

    let (parts, body) = axum::response::IntoResponse::into_response(resp).into_parts();
    assert_eq!(parts.status, StatusCode::ACCEPTED);

    let bytes = axum::body::to_bytes(body, usize::MAX).await.unwrap();
    let response_data: growthhack_backend::api::recipes::RunRecipeResponse =
        serde_json::from_slice(&bytes).unwrap();

    assert!(response_data.task_id.starts_with("task-"));
    assert_eq!(response_data.recipe_id, "recipe-bugfixer");
    assert_eq!(
        response_data.cli_command,
        "curl -s -X POST http://localhost:4200/api/recipes/bugfixer/run -H \"Content-Type: application/json\" -d '{\"parameters\":{\"issue_id\":\"88\"}}'"
    );

    // Check task recorded in state
    let state = ctx.state.read().await;
    let task = state.tasks.iter().find(|t| t.id == response_data.task_id);
    assert!(task.is_some());
    let t = task.unwrap();
    assert_eq!(t.task_type, "RecipeRun");
    assert_eq!(t.target_id.as_deref(), Some("recipe-bugfixer"));
}

#[tokio::test]
async fn test_submit_community_recipe_success() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    let payload = SubmitRecipeRequest {
        name: "Docstring Generator".to_string(),
        slug: "docstring-generator".to_string(),
        description: "Autonomous generation of Google-style docstrings and OpenAPI specs"
            .to_string(),
        category: "Code Quality".to_string(),
        author: Some("alex_dev".to_string()),
        author_avatar: None,
        version: Some("1.0.0".to_string()),
        tags: Some(vec!["docs".to_string(), "docstrings".to_string()]),
        promptware_template:
            "name: Docstring Generator\nsteps:\n  - id: analyze\n    action: Parse AST".to_string(),
        parameters: vec![RecipeParameter {
            name: "target_path".to_string(),
            description: "Directory or file path".to_string(),
            default_value: "src/".to_string(),
            required: true,
            param_type: "string".to_string(),
            options: None,
        }],
        cli_snippet: Some("curl -s -X POST http://localhost:4200/api/recipes/docstring-generator/run -H \"Content-Type: application/json\" -d '{\"parameters\":{\"target_path\":\"<target_path>\"}}'".to_string()),
    };

    let result = submit_recipe(State(ctx.clone()), Json(payload)).await;
    assert!(result.is_ok());
    let (status, Json(new_recipe)) = result.unwrap();
    assert_eq!(status, StatusCode::CREATED);
    assert_eq!(new_recipe.slug, "docstring-generator");
    assert_eq!(new_recipe.badge.as_deref(), Some("Community Pioneer"));
    assert!(!new_recipe.is_official);
    assert_eq!(new_recipe.author, "alex_dev");

    // Verify persisted in state
    let state = ctx.state.read().await;
    let found = state
        .recipes
        .iter()
        .find(|r| r.slug == "docstring-generator");
    assert!(found.is_some());
}

#[tokio::test]
async fn test_submit_community_recipe_validation_failure() {
    let guard = common::create_test_context();
    let ctx = guard.ctx();

    // 1. Missing name
    let empty_name_payload = SubmitRecipeRequest {
        name: "   ".to_string(),
        slug: "test-slug".to_string(),
        description: "desc".to_string(),
        category: "Maintenance".to_string(),
        author: None,
        author_avatar: None,
        version: None,
        tags: None,
        promptware_template: "steps: []".to_string(),
        parameters: vec![],
        cli_snippet: None,
    };
    let res = submit_recipe(State(ctx.clone()), Json(empty_name_payload)).await;
    assert!(res.is_err());
    let (status, Json(err)) = res.unwrap_err();
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(err.error.contains("name is required"));

    // 2. Invalid slug format (spaces and uppercase or special chars)
    let invalid_slug_payload = SubmitRecipeRequest {
        name: "Test Recipe".to_string(),
        slug: "invalid slug!".to_string(),
        description: "desc".to_string(),
        category: "Maintenance".to_string(),
        author: None,
        author_avatar: None,
        version: None,
        tags: None,
        promptware_template: "steps: []".to_string(),
        parameters: vec![],
        cli_snippet: None,
    };
    let res = submit_recipe(State(ctx.clone()), Json(invalid_slug_payload)).await;
    assert!(res.is_err());
    let (status, Json(err)) = res.unwrap_err();
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(err.error.contains("alphanumeric characters and hyphens"));

    // 3. Duplicate slug (already seeded "bugfixer")
    let duplicate_slug_payload = SubmitRecipeRequest {
        name: "My Bugfixer Copy".to_string(),
        slug: "bugfixer".to_string(),
        description: "duplicate".to_string(),
        category: "Maintenance".to_string(),
        author: None,
        author_avatar: None,
        version: None,
        tags: None,
        promptware_template: "steps: []".to_string(),
        parameters: vec![],
        cli_snippet: None,
    };
    let res = submit_recipe(State(ctx.clone()), Json(duplicate_slug_payload)).await;
    assert!(res.is_err());
    let (status, Json(err)) = res.unwrap_err();
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert!(err.error.contains("already exists"));
}

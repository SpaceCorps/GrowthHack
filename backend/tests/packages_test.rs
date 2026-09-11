use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::issues::AppContext;
use growthhack_backend::api::packages::{
    build_upstream_pr_commands, dispatch_package_pr, extract_pr_url, generate_manifest_content,
    get_manifest, list_packages, update_package_status, DispatchPackagePrRequest,
    UpdatePackageStatusRequest,
};
use growthhack_backend::db::GrowthState;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

fn create_test_context() -> Arc<AppContext> {
    let state = Arc::new(RwLock::new(GrowthState::seed_default()));
    let runner = AgentRunner::new(PathBuf::from("nonexistent_agy_binary_for_tests"));
    let task_manager = TaskManager::new(runner);
    let data_file = std::env::temp_dir().join(format!("growth_data_test_{}.json", uuid::Uuid::new_v4()));
    let ivy_web_content_path = std::env::temp_dir().join(format!("growth_ivy_web_test_{}", uuid::Uuid::new_v4()));
    let ivy_web_images_path = std::env::temp_dir().join(format!("growth_ivy_images_test_{}", uuid::Uuid::new_v4()));
    let config = growthhack_backend::config::Config::load();

    Arc::new(AppContext {
        state,
        task_manager,
        data_file,
        ivy_web_content_path,
        ivy_web_images_path,
        config,
    })
}

#[tokio::test]
async fn test_list_packages_returns_seeded_targets() {
    let ctx = create_test_context();
    let Json(packages) = match list_packages(State(ctx)).await {
        resp => resp,
    };

    assert_eq!(packages.len(), 4);

    let keys: Vec<String> = packages.iter().map(|p| p.target_key.clone()).collect();
    assert!(keys.contains(&"homebrew".to_string()));
    assert!(keys.contains(&"winget".to_string()));
    assert!(keys.contains(&"scoop".to_string()));
    assert!(keys.contains(&"npx".to_string()));

    let homebrew = packages.iter().find(|p| p.target_key == "homebrew").unwrap();
    assert_eq!(homebrew.manifest_filename, "tendril.rb");
    assert_eq!(homebrew.install_command, "brew install ivy-interactive/tap/tendril");

    let winget = packages.iter().find(|p| p.target_key == "winget").unwrap();
    assert_eq!(winget.package_id, "Ivy.Tendril");
    assert_eq!(winget.manifest_filename, "Ivy.Tendril.yaml");

    let scoop = packages.iter().find(|p| p.target_key == "scoop").unwrap();
    assert_eq!(scoop.manifest_filename, "tendril.json");

    let npx = packages.iter().find(|p| p.target_key == "npx").unwrap();
    assert_eq!(npx.package_id, "@ivy-interactive/tendril");
    assert_eq!(npx.status, "Live");
}

#[tokio::test]
async fn test_manifest_generators_syntax_markers() {
    // 1. Homebrew Formula
    let brew = generate_manifest_content("homebrew").expect("homebrew manifest missing");
    assert_eq!(brew.filename, "tendril.rb");
    assert_eq!(brew.language, "ruby");
    assert!(
        brew.content.contains("class Tendril < Formula"),
        "Homebrew formula missing 'class Tendril < Formula'"
    );
    assert!(brew.content.contains("generate_completions_from_executable"));
    assert!(brew.content.contains("on_macos"));
    assert!(brew.content.contains("on_linux"));

    // 2. Winget Singleton Manifest
    let winget = generate_manifest_content("winget").expect("winget manifest missing");
    assert_eq!(winget.filename, "Ivy.Tendril.yaml");
    assert_eq!(winget.language, "yaml");
    assert!(
        winget.content.contains("PackageIdentifier: Ivy.Tendril"),
        "Winget manifest missing 'PackageIdentifier: Ivy.Tendril'"
    );
    assert!(winget.content.contains("ManifestType: singleton"));
    assert!(winget.content.contains("ManifestVersion: 1.6.0"));

    // 3. Scoop Extras Manifest
    let scoop = generate_manifest_content("scoop").expect("scoop manifest missing");
    assert_eq!(scoop.filename, "tendril.json");
    assert_eq!(scoop.language, "json");
    assert!(
        scoop.content.contains("\"checkver\""),
        "Scoop manifest missing 'checkver'"
    );
    assert!(scoop.content.contains("\"autoupdate\""));
    assert!(scoop.content.contains("tendril.exe"));

    // 4. npx Zero-Install Launcher
    let npx = generate_manifest_content("npx").expect("npx manifest missing");
    assert_eq!(npx.filename, "package.json");
    assert_eq!(npx.language, "json");
    assert!(
        npx.content.to_lowercase().contains("npx") && npx.content.to_lowercase().contains("launcher"),
        "npx manifest missing 'npx' and 'launcher' markers"
    );
    assert!(npx.content.contains("@ivy-interactive/tendril"));
    assert!(npx.content.contains("./bin/tendril.js"));
}

#[tokio::test]
async fn test_get_manifest_endpoint() {
    let ctx = create_test_context();

    // Valid target
    let (status, Json(manifest)) = get_manifest(Path("homebrew".to_string()), State(ctx.clone())).await;
    assert_eq!(status, StatusCode::OK);
    assert!(manifest.is_some());
    assert_eq!(manifest.unwrap().target_key, "homebrew");

    // Invalid target
    let (status_invalid, Json(manifest_invalid)) = get_manifest(Path("invalid_key".to_string()), State(ctx)).await;
    assert_eq!(status_invalid, StatusCode::NOT_FOUND);
    assert!(manifest_invalid.is_none());
}

#[tokio::test]
async fn test_update_package_status_and_persistence() {
    let ctx = create_test_context();

    let payload = UpdatePackageStatusRequest {
        status: Some("Merged".to_string()),
        pr_url: Some("https://github.com/microsoft/winget-pkgs/pull/189204".to_string()),
        notes: Some("PR merged into winget-pkgs master!".to_string()),
    };

    let (status, Json(updated)) = update_package_status(
        Path("pkg-winget".to_string()),
        State(ctx.clone()),
        Json(payload),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let updated_pkg = updated.expect("Expected updated package target");
    assert_eq!(updated_pkg.status, "Merged");
    assert_eq!(
        updated_pkg.pr_url.as_deref(),
        Some("https://github.com/microsoft/winget-pkgs/pull/189204")
    );
    assert_eq!(updated_pkg.notes, "PR merged into winget-pkgs master!");

    // Verify in-memory state reflection
    let state = ctx.state.read().await;
    let winget_in_state = state.packages.iter().find(|p| p.id == "pkg-winget").unwrap();
    assert_eq!(winget_in_state.status, "Merged");
    assert_eq!(winget_in_state.notes, "PR merged into winget-pkgs master!");

    // Verify persistence to data_file
    let saved_content = std::fs::read_to_string(&ctx.data_file).expect("Expected data file to be written");
    let persisted_state: GrowthState = serde_json::from_str(&saved_content).expect("Valid JSON state");
    let persisted_winget = persisted_state.packages.iter().find(|p| p.id == "pkg-winget").unwrap();
    assert_eq!(persisted_winget.status, "Merged");
}

#[tokio::test]
async fn test_build_upstream_pr_commands_syntax() {
    let ctx = create_test_context();
    let state = ctx.state.read().await;
    let winget = state.packages.iter().find(|p| p.target_key == "winget").unwrap();
    let scoop = state.packages.iter().find(|p| p.target_key == "scoop").unwrap();
    let homebrew = state.packages.iter().find(|p| p.target_key == "homebrew").unwrap();

    let winget_manifest = generate_manifest_content("winget").unwrap();
    let scoop_manifest = generate_manifest_content("scoop").unwrap();
    let homebrew_manifest = generate_manifest_content("homebrew").unwrap();

    // 1. Winget
    let winget_cmds = build_upstream_pr_commands(winget, &winget_manifest, "0.8.4");
    assert!(winget_cmds.iter().any(|c| c.contains("gh repo fork microsoft/winget-pkgs --clone=false")));
    assert!(winget_cmds.iter().any(|c| c.contains("git checkout -b ivy-tendril-v0.8.4")));
    assert!(winget_cmds.iter().any(|c| c.contains("manifests/i/Ivy/Tendril/0.8.4/Ivy.Tendril.yaml")));
    assert!(winget_cmds.iter().any(|c| c.contains("New version: Ivy.Tendril version 0.8.4")));
    assert!(winget_cmds.iter().any(|c| c.contains("gh pr create --repo microsoft/winget-pkgs")));

    // 2. Scoop
    let scoop_cmds = build_upstream_pr_commands(scoop, &scoop_manifest, "0.8.4");
    assert!(scoop_cmds.iter().any(|c| c.contains("gh repo fork ScoopInstaller/Extras --clone=false")));
    assert!(scoop_cmds.iter().any(|c| c.contains("git checkout -b tendril-v0.8.4")));
    assert!(scoop_cmds.iter().any(|c| c.contains("bucket/tendril.json")));
    assert!(scoop_cmds.iter().any(|c| c.contains("tendril: Update to version 0.8.4")));
    assert!(scoop_cmds.iter().any(|c| c.contains("gh pr create --repo ScoopInstaller/Extras")));

    // 3. Homebrew
    let homebrew_cmds = build_upstream_pr_commands(homebrew, &homebrew_manifest, "0.8.4");
    assert!(homebrew_cmds.iter().any(|c| c.contains("gh repo fork ivy-interactive/homebrew-tap --clone=false")));
    assert!(homebrew_cmds.iter().any(|c| c.contains("git checkout -b tendril-v0.8.4")));
    assert!(homebrew_cmds.iter().any(|c| c.contains("Formula/tendril.rb")));
    assert!(homebrew_cmds.iter().any(|c| c.contains("tendril 0.8.4")));
    assert!(homebrew_cmds.iter().any(|c| c.contains("gh pr create --repo ivy-interactive/homebrew-tap")));
}

#[tokio::test]
async fn test_dispatch_package_pr_endpoint_spawns_task() {
    let ctx = create_test_context();

    let payload = DispatchPackagePrRequest {
        version: Some("0.8.5".to_string()),
        notes: Some("Dispatching test PR for scoop".to_string()),
    };

    let (status, Json(response)) = dispatch_package_pr(
        Path("pkg-scoop".to_string()),
        State(ctx.clone()),
        Json(payload),
    )
    .await;

    assert_eq!(status, StatusCode::ACCEPTED);
    let resp = response.expect("Expected DispatchPackagePrResponse");
    assert!(resp.task_id.starts_with("task-pkg-pr-"));
    assert_eq!(resp.target_key, "scoop");
    assert_eq!(resp.upstream_repo, "ScoopInstaller/Extras");
    assert!(!resp.commands.is_empty());
    assert!(resp.commands.iter().any(|c| c.contains("gh repo fork ScoopInstaller/Extras")));
    assert!(resp.commands.iter().any(|c| c.contains("0.8.5")));
}

#[tokio::test]
async fn test_pr_url_extraction_updates_state() {
    let ctx = create_test_context();

    // 1. Verify extract_pr_url with [PR_URL] marker
    let output_with_marker = "Some agent log...\nCreating PR...\n[PR_URL] https://github.com/microsoft/winget-pkgs/pull/189204\nDone.";
    let extracted = extract_pr_url(output_with_marker);
    assert_eq!(
        extracted,
        Some("https://github.com/microsoft/winget-pkgs/pull/189204".to_string())
    );

    // 2. Verify extract_pr_url with inline link
    let output_with_link = "Command finished: https://github.com/ScoopInstaller/Extras/pull/14522 created successfully.";
    let extracted_link = extract_pr_url(output_with_link);
    assert_eq!(
        extracted_link,
        Some("https://github.com/ScoopInstaller/Extras/pull/14522".to_string())
    );

    // 3. Test state update and persistence with extracted URL
    let found_url = extracted.unwrap();
    {
        let mut state = ctx.state.write().await;
        let pkg = state.packages.iter_mut().find(|p| p.id == "pkg-winget").unwrap();
        pkg.status = "PR Submitted".to_string();
        pkg.pr_url = Some(found_url.clone());
        pkg.updated_at = chrono::Utc::now();
        let _ = state.save(&ctx.data_file);
    }

    // Verify in-memory state
    let state = ctx.state.read().await;
    let winget = state.packages.iter().find(|p| p.id == "pkg-winget").unwrap();
    assert_eq!(winget.status, "PR Submitted");
    assert_eq!(winget.pr_url.as_deref(), Some("https://github.com/microsoft/winget-pkgs/pull/189204"));

    // Verify persisted file
    let saved_content = std::fs::read_to_string(&ctx.data_file).expect("File exists");
    let persisted_state: GrowthState = serde_json::from_str(&saved_content).expect("Valid JSON");
    let persisted_pkg = persisted_state.packages.iter().find(|p| p.id == "pkg-winget").unwrap();
    assert_eq!(persisted_pkg.status, "PR Submitted");
    assert_eq!(persisted_pkg.pr_url.as_deref(), Some("https://github.com/microsoft/winget-pkgs/pull/189204"));
}

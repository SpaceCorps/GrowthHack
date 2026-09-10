mod common;

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::api::packages::{
    generate_manifest_content, get_manifest, list_packages, update_package_status,
    UpdatePackageStatusRequest,
};
use growthhack_backend::db::GrowthState;

#[tokio::test]
async fn test_list_packages_returns_seeded_targets() {
    let ctx = common::create_test_context();
    let Json(packages) = list_packages(State(ctx)).await;

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
    let ctx = common::create_test_context();

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
    let ctx = common::create_test_context();

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

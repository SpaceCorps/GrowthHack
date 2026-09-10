use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::issues::AppContext;
use growthhack_backend::api::packages::{
    generate_manifest_content, get_manifest, list_packages, update_package_status,
    ManifestQuery, ReleaseAsset, ReleaseInfo, UpdatePackageStatusRequest,
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
    let release = ReleaseInfo::default_fallback();

    // 1. Homebrew Formula
    let brew = generate_manifest_content("homebrew", &release).expect("homebrew manifest missing");
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
    let winget = generate_manifest_content("winget", &release).expect("winget manifest missing");
    assert_eq!(winget.filename, "Ivy.Tendril.yaml");
    assert_eq!(winget.language, "yaml");
    assert!(
        winget.content.contains("PackageIdentifier: Ivy.Tendril"),
        "Winget manifest missing 'PackageIdentifier: Ivy.Tendril'"
    );
    assert!(winget.content.contains("ManifestType: singleton"));
    assert!(winget.content.contains("ManifestVersion: 1.6.0"));

    // 3. Scoop Extras Manifest
    let scoop = generate_manifest_content("scoop", &release).expect("scoop manifest missing");
    assert_eq!(scoop.filename, "tendril.json");
    assert_eq!(scoop.language, "json");
    assert!(
        scoop.content.contains("\"checkver\""),
        "Scoop manifest missing 'checkver'"
    );
    assert!(scoop.content.contains("\"autoupdate\""));
    assert!(scoop.content.contains("tendril.exe"));

    // 4. npx Zero-Install Launcher
    let npx = generate_manifest_content("npx", &release).expect("npx manifest missing");
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
    let (status, Json(manifest)) = get_manifest(
        Path("homebrew".to_string()),
        Query(ManifestQuery { refresh: None }),
        State(ctx.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(manifest.is_some());
    assert_eq!(manifest.unwrap().target_key, "homebrew");

    // Invalid target
    let (status_invalid, Json(manifest_invalid)) = get_manifest(
        Path("invalid_key".to_string()),
        Query(ManifestQuery { refresh: None }),
        State(ctx),
    )
    .await;
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
async fn test_release_info_parser_and_checksum_extraction() {
    let mock_json = r####"{
        "tag_name": "v1.2.3",
        "published_at": "2026-09-10T12:00:00Z",
        "body": "Release Checksums:\ntendril-v1.2.3-darwin-arm64.tar.gz: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855\n",
        "assets": [
            {
                "name": "tendril-v1.2.3-darwin-arm64.tar.gz",
                "browser_download_url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.2.3/tendril-v1.2.3-darwin-arm64.tar.gz",
                "digest": null
            },
            {
                "name": "tendril-v1.2.3-windows-x64.zip",
                "browser_download_url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.2.3/tendril-v1.2.3-windows-x64.zip",
                "digest": "sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
            }
        ]
    }"####;

    let release = ReleaseInfo::from_github_json(mock_json).expect("Failed to parse GitHub release JSON");
    assert_eq!(release.tag_name, "v1.2.3");
    assert_eq!(release.version, "1.2.3");
    assert_eq!(release.assets.len(), 2);

    let darwin_asset = release.assets.iter().find(|a| a.name.contains("darwin-arm64")).unwrap();
    assert_eq!(
        darwin_asset.sha256.as_deref(),
        Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    );

    let win_asset = release.assets.iter().find(|a| a.name.contains("windows-x64")).unwrap();
    assert_eq!(
        win_asset.sha256.as_deref(),
        Some("2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae")
    );
}

#[tokio::test]
async fn test_dynamic_manifest_generation_homebrew() {
    let release = ReleaseInfo {
        tag_name: "v1.4.2".to_string(),
        version: "1.4.2".to_string(),
        assets: vec![
            ReleaseAsset {
                name: "tendril-v1.4.2-darwin-arm64.tar.gz".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.4.2/tendril-v1.4.2-darwin-arm64.tar.gz".to_string(),
                digest: Some("sha256:1111111111111111111111111111111111111111111111111111111111111111".to_string()),
                sha256: Some("1111111111111111111111111111111111111111111111111111111111111111".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v1.4.2-darwin-x64.tar.gz".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.4.2/tendril-v1.4.2-darwin-x64.tar.gz".to_string(),
                digest: Some("sha256:2222222222222222222222222222222222222222222222222222222222222222".to_string()),
                sha256: Some("2222222222222222222222222222222222222222222222222222222222222222".to_string()),
            },
        ],
        published_at: None,
        fetched_at: chrono::Utc::now(),
    };

    let brew = generate_manifest_content("homebrew", &release).expect("Manifest missing");
    assert!(brew.content.contains("version \"1.4.2\""));
    assert!(brew.content.contains("1111111111111111111111111111111111111111111111111111111111111111"));
    assert!(brew.content.contains("2222222222222222222222222222222222222222222222222222222222222222"));
    assert!(brew.content.contains("v1.4.2"));
    assert_eq!(brew.release_tag, Some("v1.4.2".to_string()));
}

#[tokio::test]
async fn test_dynamic_manifest_generation_winget() {
    let release = ReleaseInfo {
        tag_name: "v1.5.0".to_string(),
        version: "1.5.0".to_string(),
        assets: vec![
            ReleaseAsset {
                name: "tendril-v1.5.0-windows-x64.zip".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.5.0/tendril-v1.5.0-windows-x64.zip".to_string(),
                digest: Some("sha256:3333333333333333333333333333333333333333333333333333333333333333".to_string()),
                sha256: Some("3333333333333333333333333333333333333333333333333333333333333333".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v1.5.0-windows-arm64.zip".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.5.0/tendril-v1.5.0-windows-arm64.zip".to_string(),
                digest: Some("sha256:4444444444444444444444444444444444444444444444444444444444444444".to_string()),
                sha256: Some("4444444444444444444444444444444444444444444444444444444444444444".to_string()),
            },
        ],
        published_at: None,
        fetched_at: chrono::Utc::now(),
    };

    let winget = generate_manifest_content("winget", &release).expect("Manifest missing");
    assert!(winget.content.contains("PackageVersion: 1.5.0"));
    assert!(winget.content.contains("InstallerSha256: 3333333333333333333333333333333333333333333333333333333333333333"));
    assert!(winget.content.contains("InstallerSha256: 4444444444444444444444444444444444444444444444444444444444444444"));
    assert!(winget.instructions.contains("1.5.0"));
}

#[tokio::test]
async fn test_dynamic_manifest_generation_scoop() {
    let release = ReleaseInfo {
        tag_name: "v1.5.0".to_string(),
        version: "1.5.0".to_string(),
        assets: vec![
            ReleaseAsset {
                name: "tendril-v1.5.0-windows-x64.zip".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.5.0/tendril-v1.5.0-windows-x64.zip".to_string(),
                digest: Some("sha256:5555555555555555555555555555555555555555555555555555555555555555".to_string()),
                sha256: Some("5555555555555555555555555555555555555555555555555555555555555555".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v1.5.0-windows-arm64.zip".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v1.5.0/tendril-v1.5.0-windows-arm64.zip".to_string(),
                digest: Some("sha256:6666666666666666666666666666666666666666666666666666666666666666".to_string()),
                sha256: Some("6666666666666666666666666666666666666666666666666666666666666666".to_string()),
            },
        ],
        published_at: None,
        fetched_at: chrono::Utc::now(),
    };

    let scoop = generate_manifest_content("scoop", &release).expect("Manifest missing");
    assert!(scoop.content.contains("\"version\": \"1.5.0\""));
    assert!(scoop.content.contains("\"hash\": \"5555555555555555555555555555555555555555555555555555555555555555\""));
    assert!(scoop.content.contains("\"hash\": \"6666666666666666666666666666666666666666666666666666666666666666\""));
}

#[tokio::test]
async fn test_dynamic_manifest_generation_npx() {
    let release = ReleaseInfo {
        tag_name: "v2.0.0".to_string(),
        version: "2.0.0".to_string(),
        assets: vec![],
        published_at: None,
        fetched_at: chrono::Utc::now(),
    };

    let npx = generate_manifest_content("npx", &release).expect("Manifest missing");
    assert!(npx.content.contains("\"version\": \"2.0.0\""));
}

#[tokio::test]
async fn test_manifest_endpoint_with_refresh_query() {
    let ctx = create_test_context();

    let (status, Json(manifest)) = get_manifest(
        Path("homebrew".to_string()),
        Query(ManifestQuery { refresh: Some(true) }),
        State(ctx.clone()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(manifest.is_some());
    let m = manifest.unwrap();
    assert_eq!(m.target_key, "homebrew");
    assert!(m.release_tag.is_some());
}

#[tokio::test]
async fn test_release_cache_fallback_on_network_error() {
    let ctx = create_test_context();

    // Even if external network fails or repo is invalid, fallback to cached or default
    let (status, Json(manifest)) = get_manifest(
        Path("winget".to_string()),
        Query(ManifestQuery { refresh: Some(true) }),
        State(ctx.clone()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(manifest.is_some());
    let m = manifest.unwrap();
    assert_eq!(m.target_key, "winget");
    assert!(m.content.contains("PackageIdentifier: Ivy.Tendril"));
}

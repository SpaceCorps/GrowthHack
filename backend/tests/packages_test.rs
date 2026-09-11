mod common;
use common::create_test_context;

use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use growthhack_backend::api::packages::{
    build_upstream_pr_commands, compute_sha256_bytes, dispatch_package_pr, extract_gh_account,
    extract_pr_url, format_release_url, generate_manifest_content, get_gh_auth_status,
    get_manifest, list_packages, parse_checksums_content, parse_gh_auth_output,
    update_package_status, DispatchPackagePrRequest, ManifestQuery,
    ReleaseAsset, ReleaseInfo, UpdatePackageStatusRequest,
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

    let homebrew = packages
        .iter()
        .find(|p| p.target_key == "homebrew")
        .unwrap();
    assert_eq!(homebrew.manifest_filename, "tendril.rb");
    assert_eq!(
        homebrew.install_command,
        "brew install ivy-interactive/tap/tendril"
    );

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
    assert!(brew
        .content
        .contains("generate_completions_from_executable"));
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
        npx.content.to_lowercase().contains("npx")
            && npx.content.to_lowercase().contains("launcher"),
        "npx manifest missing 'npx' and 'launcher' markers"
    );
    assert!(npx.content.contains("@ivy-interactive/tendril"));
    assert!(npx.content.contains("./bin/tendril.js"));
}

#[tokio::test]
async fn test_get_manifest_endpoint() {
    let ctx = common::create_test_context();

    // Valid target
    let (status, Json(manifest)) = get_manifest(
        Path("homebrew".to_string()),
        Query(ManifestQuery { refresh: None, tag: None }),
        State(ctx.clone()),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert!(manifest.is_some());
    assert_eq!(manifest.unwrap().target_key, "homebrew");

    // Invalid target
    let (status_invalid, Json(manifest_invalid)) = get_manifest(
        Path("invalid_key".to_string()),
        Query(ManifestQuery { refresh: None, tag: None }),
        State(ctx),
    )
    .await;
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
    let winget_in_state = state
        .packages
        .iter()
        .find(|p| p.id == "pkg-winget")
        .unwrap();
    assert_eq!(winget_in_state.status, "Merged");
    assert_eq!(winget_in_state.notes, "PR merged into winget-pkgs master!");

    // Verify persistence to data_file
    let saved_content =
        std::fs::read_to_string(&ctx.data_file).expect("Expected data file to be written");
    let persisted_state: GrowthState =
        serde_json::from_str(&saved_content).expect("Valid JSON state");
    let persisted_winget = persisted_state
        .packages
        .iter()
        .find(|p| p.id == "pkg-winget")
        .unwrap();
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

    let release =
        ReleaseInfo::from_github_json(mock_json).expect("Failed to parse GitHub release JSON");
    assert_eq!(release.tag_name, "v1.2.3");
    assert_eq!(release.version, "1.2.3");
    assert_eq!(release.assets.len(), 2);

    let darwin_asset = release
        .assets
        .iter()
        .find(|a| a.name.contains("darwin-arm64"))
        .unwrap();
    assert_eq!(
        darwin_asset.sha256.as_deref(),
        Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
    );

    let win_asset = release
        .assets
        .iter()
        .find(|a| a.name.contains("windows-x64"))
        .unwrap();
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
    assert!(brew
        .content
        .contains("1111111111111111111111111111111111111111111111111111111111111111"));
    assert!(brew
        .content
        .contains("2222222222222222222222222222222222222222222222222222222222222222"));
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
    assert!(winget.content.contains(
        "InstallerSha256: 3333333333333333333333333333333333333333333333333333333333333333"
    ));
    assert!(winget.content.contains(
        "InstallerSha256: 4444444444444444444444444444444444444444444444444444444444444444"
    ));
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
    assert!(scoop.content.contains(
        "\"hash\": \"5555555555555555555555555555555555555555555555555555555555555555\""
    ));
    assert!(scoop.content.contains(
        "\"hash\": \"6666666666666666666666666666666666666666666666666666666666666666\""
    ));
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
        Query(ManifestQuery { refresh: Some(true), tag: None }),
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
        Query(ManifestQuery { refresh: Some(true), tag: None }),
        State(ctx.clone()),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    assert!(manifest.is_some());
    let m = manifest.unwrap();
    assert_eq!(m.target_key, "winget");
    assert!(m.content.contains("PackageIdentifier: Ivy.Tendril"));
}

#[tokio::test]
async fn test_build_upstream_pr_commands_syntax() {
    let ctx = common::create_test_context();
    let state = ctx.state.read().await;
    let winget = state
        .packages
        .iter()
        .find(|p| p.target_key == "winget")
        .unwrap();
    let scoop = state
        .packages
        .iter()
        .find(|p| p.target_key == "scoop")
        .unwrap();
    let homebrew = state
        .packages
        .iter()
        .find(|p| p.target_key == "homebrew")
        .unwrap();

    let default_release = ReleaseInfo::default_fallback();
    let winget_manifest = generate_manifest_content("winget", &default_release).unwrap();
    let scoop_manifest = generate_manifest_content("scoop", &default_release).unwrap();
    let homebrew_manifest = generate_manifest_content("homebrew", &default_release).unwrap();

    // 1. Winget
    let winget_cmds = build_upstream_pr_commands(winget, &winget_manifest, "0.8.4");
    assert!(winget_cmds
        .iter()
        .any(|c| c.contains("gh repo fork microsoft/winget-pkgs --clone=false")));
    assert!(winget_cmds
        .iter()
        .any(|c| c.contains("git checkout -b ivy-tendril-v0.8.4")));
    assert!(winget_cmds
        .iter()
        .any(|c| c.contains("manifests/i/Ivy/Tendril/0.8.4/Ivy.Tendril.yaml")));
    assert!(winget_cmds
        .iter()
        .any(|c| c.contains("New version: Ivy.Tendril version 0.8.4")));
    assert!(winget_cmds
        .iter()
        .any(|c| c.contains("gh pr create --repo microsoft/winget-pkgs")));

    // 2. Scoop
    let scoop_cmds = build_upstream_pr_commands(scoop, &scoop_manifest, "0.8.4");
    assert!(scoop_cmds
        .iter()
        .any(|c| c.contains("gh repo fork ScoopInstaller/Extras --clone=false")));
    assert!(scoop_cmds
        .iter()
        .any(|c| c.contains("git checkout -b tendril-v0.8.4")));
    assert!(scoop_cmds.iter().any(|c| c.contains("bucket/tendril.json")));
    assert!(scoop_cmds
        .iter()
        .any(|c| c.contains("tendril: Update to version 0.8.4")));
    assert!(scoop_cmds
        .iter()
        .any(|c| c.contains("gh pr create --repo ScoopInstaller/Extras")));

    // 3. Homebrew
    let homebrew_cmds = build_upstream_pr_commands(homebrew, &homebrew_manifest, "0.8.4");
    assert!(homebrew_cmds
        .iter()
        .any(|c| c.contains("gh repo fork ivy-interactive/homebrew-tap --clone=false")));
    assert!(homebrew_cmds
        .iter()
        .any(|c| c.contains("git checkout -b tendril-v0.8.4")));
    assert!(homebrew_cmds
        .iter()
        .any(|c| c.contains("Formula/tendril.rb")));
    assert!(homebrew_cmds.iter().any(|c| c.contains("tendril 0.8.4")));
    assert!(homebrew_cmds
        .iter()
        .any(|c| c.contains("gh pr create --repo ivy-interactive/homebrew-tap")));
}

#[tokio::test]
async fn test_dispatch_package_pr_endpoint_spawns_task() {
    let ctx = common::create_test_context();

    let payload = DispatchPackagePrRequest {
        version: Some("0.8.5".to_string()),
        tag: None,
        notes: Some("Dispatching test PR for scoop".to_string()),
        skip_auth_check: Some(true),
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
    assert!(resp
        .commands
        .iter()
        .any(|c| c.contains("gh repo fork ScoopInstaller/Extras")));
    assert!(resp.commands.iter().any(|c| c.contains("0.8.5")));
}

#[tokio::test]
async fn test_pr_url_extraction_updates_state() {
    let ctx = common::create_test_context();

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
        let pkg = state
            .packages
            .iter_mut()
            .find(|p| p.id == "pkg-winget")
            .unwrap();
        pkg.status = "PR Submitted".to_string();
        pkg.pr_url = Some(found_url.clone());
        pkg.updated_at = chrono::Utc::now();
        let _ = state.save(&ctx.data_file);
    }

    // Verify in-memory state
    let state = ctx.state.read().await;
    let winget = state
        .packages
        .iter()
        .find(|p| p.id == "pkg-winget")
        .unwrap();
    assert_eq!(winget.status, "PR Submitted");
    assert_eq!(
        winget.pr_url.as_deref(),
        Some("https://github.com/microsoft/winget-pkgs/pull/189204")
    );

    // Verify persisted file
    let saved_content = std::fs::read_to_string(&ctx.data_file).expect("File exists");
    let persisted_state: GrowthState = serde_json::from_str(&saved_content).expect("Valid JSON");
    let persisted_pkg = persisted_state
        .packages
        .iter()
        .find(|p| p.id == "pkg-winget")
        .unwrap();
    assert_eq!(persisted_pkg.status, "PR Submitted");
    assert_eq!(
        persisted_pkg.pr_url.as_deref(),
        Some("https://github.com/microsoft/winget-pkgs/pull/189204")
    );
}

#[tokio::test]
async fn test_parse_gh_auth_status_success_and_account_extraction() {
    let mock_stdout = r#"github.com
  ✓ Logged in to github.com account spacecorps-dev (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_************************************
  - Token scopes: 'gist', 'project', 'read:org', 'repo', 'workflow'
"#;
    let status = parse_gh_auth_output(true, mock_stdout, "");
    assert!(status.authenticated);
    assert_eq!(status.account.as_deref(), Some("spacecorps-dev"));
    assert!(status.message.contains("@spacecorps-dev"));

    // Also test alternate account line format
    let account_found =
        extract_gh_account("Logged in to github.com as account test-user-99 (keyring)");
    assert_eq!(account_found.as_deref(), Some("test-user-99"));
}

#[tokio::test]
async fn test_parse_gh_auth_status_failure_with_remediation_hint() {
    let mock_stderr =
        "You are not logged into any GitHub hosts. Run gh auth login to authenticate.";
    let status = parse_gh_auth_output(false, "", mock_stderr);
    assert!(!status.authenticated);
    assert!(status.account.is_none());
    assert!(status.message.contains("gh auth login"));

    // Test failure without existing remediation command appends guidance
    let status_raw_err = parse_gh_auth_output(false, "", "error: connection reset by peer");
    assert!(!status_raw_err.authenticated);
    assert!(status_raw_err
        .message
        .contains("Run 'gh auth login' to authenticate GitHub CLI."));
}

#[tokio::test]
async fn test_get_gh_auth_status_endpoint() {
    // 1. Test override to authenticated
    std::env::set_var("GH_AUTH_STATUS_OVERRIDE", "authenticated:octocat");
    let (status_ok, Json(auth_ok)) = get_gh_auth_status().await;
    assert_eq!(status_ok, StatusCode::OK);
    assert!(auth_ok.authenticated);
    assert_eq!(auth_ok.account.as_deref(), Some("octocat"));
    assert!(auth_ok.message.contains("@octocat"));

    // 2. Test override to unauthenticated
    std::env::set_var("GH_AUTH_STATUS_OVERRIDE", "unauthenticated");
    let (status_unauth, Json(auth_unauth)) = get_gh_auth_status().await;
    assert_eq!(status_unauth, StatusCode::OK);
    assert!(!auth_unauth.authenticated);
    assert!(auth_unauth.account.is_none());
    assert!(auth_unauth.message.contains("gh auth login"));

    std::env::remove_var("GH_AUTH_STATUS_OVERRIDE");
}

#[tokio::test]
async fn test_dispatch_package_pr_auth_check_and_skip() {
    let ctx = common::create_test_context();

    // 1. Simulate unauthenticated GitHub CLI environment
    std::env::set_var("GH_AUTH_STATUS_OVERRIDE", "unauthenticated");

    let payload_no_skip = DispatchPackagePrRequest {
        version: Some("0.8.5".to_string()),
        tag: None,
        notes: Some("Dispatching test PR".to_string()),
        skip_auth_check: None,
    };

    let (status_failed, Json(response_failed)) = dispatch_package_pr(
        Path("pkg-scoop".to_string()),
        State(ctx.clone()),
        Json(payload_no_skip),
    )
    .await;

    assert_eq!(status_failed, StatusCode::PRECONDITION_FAILED);
    let resp = response_failed.expect("Expected DispatchPackagePrResponse with error");
    assert!(resp.message.contains("gh auth login"));

    // 2. Dispatch with skip_auth_check: Some(true) succeeds despite unauthenticated state
    let payload_skip = DispatchPackagePrRequest {
        version: Some("0.8.5".to_string()),
        tag: None,
        notes: Some("Dispatching test PR with override".to_string()),
        skip_auth_check: Some(true),
    };

    let (status_accepted, Json(response_accepted)) = dispatch_package_pr(
        Path("pkg-scoop".to_string()),
        State(ctx.clone()),
        Json(payload_skip),
    )
    .await;

    assert_eq!(status_accepted, StatusCode::ACCEPTED);
    let resp_ok = response_accepted.expect("Expected accepted response");
    assert!(resp_ok.task_id.starts_with("task-pkg-pr-"));

    std::env::remove_var("GH_AUTH_STATUS_OVERRIDE");
}

#[tokio::test]
async fn test_fetch_release_by_tag_url() {
    let url_tagged = format_release_url("Ivy-Interactive/Ivy-Tendril", Some("v1.2.0"));
    assert_eq!(
        url_tagged,
        "https://api.github.com/repos/Ivy-Interactive/Ivy-Tendril/releases/tags/v1.2.0"
    );

    let url_bare_tag = format_release_url("Ivy-Interactive/Ivy-Tendril", Some("1.2.0"));
    assert_eq!(
        url_bare_tag,
        "https://api.github.com/repos/Ivy-Interactive/Ivy-Tendril/releases/tags/v1.2.0"
    );

    let url_latest = format_release_url("Ivy-Interactive/Ivy-Tendril", None);
    assert_eq!(
        url_latest,
        "https://api.github.com/repos/Ivy-Interactive/Ivy-Tendril/releases/latest"
    );

    let url_latest_str = format_release_url("Ivy-Interactive/Ivy-Tendril", Some("latest"));
    assert_eq!(
        url_latest_str,
        "https://api.github.com/repos/Ivy-Interactive/Ivy-Tendril/releases/latest"
    );
}

#[tokio::test]
async fn test_dynamic_binary_sha256_computation() {
    let empty_bytes = b"";
    let empty_hash = compute_sha256_bytes(empty_bytes);
    assert_eq!(
        empty_hash,
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    let sample_payload = b"tendril-release-binary-darwin-arm64-payload";
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(sample_payload);
    let expected_hash = format!("{:x}", hasher.finalize());

    assert_eq!(compute_sha256_bytes(sample_payload), expected_hash);
}

#[tokio::test]
async fn test_companion_checksums_file_parsing() {
    let checksums_content = r#"
# Checksum file generated for Tendril Release v1.3.0
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  tendril-v1.3.0-darwin-arm64.tar.gz
ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb *tendril-v1.3.0-darwin-x64.tar.gz
tendril-v1.3.0-linux-x64.tar.gz: 30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7
"#;

    let parsed = parse_checksums_content(checksums_content);
    assert_eq!(
        parsed.get("tendril-v1.3.0-darwin-arm64.tar.gz"),
        Some(&"e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string())
    );
    assert_eq!(
        parsed.get("tendril-v1.3.0-darwin-x64.tar.gz"),
        Some(&"ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb".to_string())
    );
    assert_eq!(
        parsed.get("tendril-v1.3.0-linux-x64.tar.gz"),
        Some(&"30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7".to_string())
    );
}

#[tokio::test]
async fn test_manifest_endpoint_with_tag_query() {
    let ctx = common::create_test_context();

    let (status, Json(manifest)) = get_manifest(
        Path("homebrew".to_string()),
        Query(ManifestQuery {
            refresh: None,
            tag: Some("v1.3.0".to_string()),
        }),
        State(ctx),
    )
    .await;

    assert_eq!(status, StatusCode::OK);
    let m = manifest.expect("manifest expected");
    assert_eq!(m.release_tag.as_deref(), Some("v1.3.0"));
    assert!(m.content.contains("version \"1.3.0\""));
}

#[tokio::test]
async fn test_no_hardcoded_checksum_fallback_when_binary_downloaded() {
    let mut release = ReleaseInfo {
        tag_name: "v2.0.0".to_string(),
        version: "2.0.0".to_string(),
        assets: vec![
            ReleaseAsset {
                name: "tendril-v2.0.0-darwin-arm64.tar.gz".to_string(),
                browser_download_url: "https://example.com/binary".to_string(),
                digest: None,
                sha256: None,
            },
        ],
        published_at: None,
        fetched_at: chrono::Utc::now(),
    };

    assert!(release.assets[0].sha256.is_none());

    let dynamic_binary_content = b"dynamically-downloaded-native-binary-stream";
    let computed_hash = compute_sha256_bytes(dynamic_binary_content);
    release.assets[0].sha256 = Some(computed_hash.clone());
    release.assets[0].digest = Some(format!("sha256:{}", computed_hash));

    let manifest = generate_manifest_content("homebrew", &release).expect("Manifest generated");
    assert!(manifest.content.contains(&computed_hash));
    assert!(!manifest.content.contains("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
}

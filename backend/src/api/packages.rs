use crate::api::issues::AppContext;
use crate::db::PackageManagerTarget;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackageManifestResponse {
    pub target_key: String,
    pub filename: String,
    pub language: String,
    pub content: String,
    pub install_command: String,
    pub instructions: String,
}

#[derive(Deserialize)]
pub struct UpdatePackageStatusRequest {
    pub status: Option<String>,
    pub pr_url: Option<String>,
    pub notes: Option<String>,
}

pub async fn list_packages(State(ctx): State<Arc<AppContext>>) -> Json<Vec<PackageManagerTarget>> {
    let state = ctx.state.read().await;
    Json(state.packages.clone())
}

pub fn generate_manifest_content(target_key: &str) -> Option<PackageManifestResponse> {
    match target_key {
        "homebrew" => Some(PackageManifestResponse {
            target_key: "homebrew".to_string(),
            filename: "tendril.rb".to_string(),
            language: "ruby".to_string(),
            install_command: "brew install ivy-interactive/tap/tendril".to_string(),
            instructions: "Add tap with 'brew tap ivy-interactive/tap' or install directly. Formula supports dual arm64 and x86_64 binaries with automated completions.".to_string(),
            content: r##"# typed: false
# frozen_string_literal: true

class Tendril < Formula
  desc "Autonomous multi-agent software factory and plan orchestration system"
  homepage "https://github.com/Ivy-Interactive/Ivy-Tendril"
  version "0.8.4"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-darwin-arm64.tar.gz"
      sha256 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    else
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-darwin-x64.tar.gz"
      sha256 "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-linux-arm64.tar.gz"
      sha256 "4e1243bd22c66e76c2ba9eddc1f91394e57f9f8352e8964d4b294e1e86973e8e"
    else
      url "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-linux-x64.tar.gz"
      sha256 "30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7"
    end
  end

  def install
    bin.install "tendril"
    generate_completions_from_executable(bin/"tendril", "completion")
  end

  test do
    assert_match "tendril", shell_output("#{bin}/tendril version")
  end
end
"##.to_string(),
        }),
        "winget" => Some(PackageManifestResponse {
            target_key: "winget".to_string(),
            filename: "Ivy.Tendril.yaml".to_string(),
            language: "yaml".to_string(),
            install_command: "winget install Ivy.Tendril".to_string(),
            instructions: "Submit singleton manifest to microsoft/winget-pkgs repository under manifests/i/Ivy/Tendril/0.8.4/Ivy.Tendril.yaml.".to_string(),
            content: r#"PackageIdentifier: Ivy.Tendril
PackageVersion: 0.8.4
PackageName: Ivy Tendril
Publisher: Ivy Interactive
PublisherUrl: https://github.com/Ivy-Interactive
PublisherSupportUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/issues
Author: Ivy Interactive
ShortDescription: Autonomous multi-agent software factory with isolated git worktrees
Description: Ivy-Tendril turns tasks and issues into verified pull requests using autonomous AI coding agents in isolated git worktrees.
Moniker: tendril
PackageUrl: https://github.com/Ivy-Interactive/Ivy-Tendril
License: MIT
LicenseUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/blob/main/LICENSE
Copyright: Copyright (c) 2026 Ivy Interactive
Tags:
  - ai
  - agents
  - coding
  - worktree
  - git
DefaultLocale: en-US
ManifestType: singleton
ManifestVersion: 1.6.0
Installers:
  - Architecture: x64
    InstallerType: portable
    InstallerUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-x64.zip
    InstallerSha256: 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae
    Commands:
      - tendril
  - Architecture: arm64
    InstallerType: portable
    InstallerUrl: https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-arm64.zip
    InstallerSha256: fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9
    Commands:
      - tendril
"#.to_string(),
        }),
        "scoop" => Some(PackageManifestResponse {
            target_key: "scoop".to_string(),
            filename: "tendril.json".to_string(),
            language: "json".to_string(),
            install_command: "scoop bucket add extras && scoop install tendril".to_string(),
            instructions: "Submit manifest to ScoopInstaller/Extras bucket repository under bucket/tendril.json.".to_string(),
            content: r#"{
  "version": "0.8.4",
  "description": "Autonomous multi-agent software factory with isolated git worktrees",
  "homepage": "https://github.com/Ivy-Interactive/Ivy-Tendril",
  "license": "MIT",
  "architecture": {
    "64bit": {
      "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-x64.zip",
      "hash": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae"
    },
    "arm64": {
      "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-arm64.zip",
      "hash": "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9"
    }
  },
  "bin": "tendril.exe",
  "checkver": "github",
  "autoupdate": {
    "architecture": {
      "64bit": {
        "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v$version/tendril-v$version-windows-x64.zip"
      },
      "arm64": {
        "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v$version/tendril-v$version-windows-arm64.zip"
      }
    }
  }
}
"#.to_string(),
        }),
        "npx" => Some(PackageManifestResponse {
            target_key: "npx".to_string(),
            filename: "package.json".to_string(),
            language: "json".to_string(),
            install_command: "npx @ivy-interactive/tendril".to_string(),
            instructions: "Publish package to npm registry as @ivy-interactive/tendril. The zero-install launcher bootstraps the native binary in seconds.".to_string(),
            content: r#"{
  "name": "@ivy-interactive/tendril",
  "version": "0.8.4",
  "description": "Zero-install npx launcher for Tendril autonomous multi-agent software factory",
  "bin": {
    "tendril": "./bin/tendril.js"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/Ivy-Interactive/Ivy-Tendril.git"
  },
  "scripts": {
    "start": "node ./bin/tendril.js"
  },
  "keywords": [
    "tendril",
    "npx",
    "zero-install",
    "launcher",
    "ai",
    "coding-agent",
    "worktree"
  ],
  "author": "Ivy Interactive",
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "publishConfig": {
    "access": "public"
  }
}
"#.to_string(),
        }),
        _ => None,
    }
}

pub async fn get_manifest(
    Path(target_key): Path<String>,
    _ctx: State<Arc<AppContext>>,
) -> (StatusCode, Json<Option<PackageManifestResponse>>) {
    match generate_manifest_content(&target_key) {
        Some(manifest) => (StatusCode::OK, Json(Some(manifest))),
        None => (StatusCode::NOT_FOUND, Json(None)),
    }
}

pub async fn update_package_status(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<UpdatePackageStatusRequest>,
) -> (StatusCode, Json<Option<crate::db::PackageManagerTarget>>) {
    let mut state = ctx.state.write().await;
    if let Some(target) = state.packages.iter_mut().find(|p| p.id == id || p.target_key == id) {
        if let Some(status) = payload.status {
            target.status = status;
        }
        if let Some(pr_url) = payload.pr_url {
            target.pr_url = Some(pr_url);
        }
        if let Some(notes) = payload.notes {
            target.notes = notes;
        }
        target.updated_at = Utc::now();
        let cloned = target.clone();
        let _ = state.save(&ctx.data_file);
        (StatusCode::OK, Json(Some(cloned)))
    } else {
        (StatusCode::NOT_FOUND, Json(None))
    }
}

pub fn build_upstream_pr_commands(
    target: &PackageManagerTarget,
    _manifest: &PackageManifestResponse,
    version: &str,
) -> Vec<String> {
    match target.target_key.as_str() {
        "winget" => vec![
            "gh repo fork microsoft/winget-pkgs --clone=false".to_string(),
            format!("git checkout -b ivy-tendril-v{}", version),
            format!("mkdir -p manifests/i/Ivy/Tendril/{}", version),
            format!("git add manifests/i/Ivy/Tendril/{}/Ivy.Tendril.yaml", version),
            format!("git commit -m \"New version: Ivy.Tendril version {}\"", version),
            format!("git push origin ivy-tendril-v{}", version),
            format!(
                "gh pr create --repo microsoft/winget-pkgs --title \"New version: Ivy.Tendril version {}\" --body \"Automated update of Ivy-Tendril v{} with portable x64/arm64 binaries.\"",
                version, version
            ),
        ],
        "scoop" => vec![
            "gh repo fork ScoopInstaller/Extras --clone=false".to_string(),
            format!("git checkout -b tendril-v{}", version),
            "mkdir -p bucket".to_string(),
            "git add bucket/tendril.json".to_string(),
            format!("git commit -m \"tendril: Update to version {}\"", version),
            format!("git push origin tendril-v{}", version),
            format!(
                "gh pr create --repo ScoopInstaller/Extras --title \"tendril: Update to version {}\" --body \"Automated manifest update for Tendril v{}.\"",
                version, version
            ),
        ],
        "homebrew" => vec![
            "gh repo fork ivy-interactive/homebrew-tap --clone=false".to_string(),
            format!("git checkout -b tendril-v{}", version),
            "mkdir -p Formula".to_string(),
            "git add Formula/tendril.rb".to_string(),
            format!("git commit -m \"tendril {}\"", version),
            format!("git push origin tendril-v{}", version),
            format!(
                "gh pr create --repo ivy-interactive/homebrew-tap --title \"tendril {}\" --body \"Update tendril formula to v{} with dual macOS/Linux bottles.\"",
                version, version
            ),
        ],
        _ => vec![],
    }
}

pub fn build_upstream_pr_agent_prompt(
    target: &PackageManagerTarget,
    manifest: &PackageManifestResponse,
    version: &str,
) -> String {
    let commands = build_upstream_pr_commands(target, manifest, version);
    let commands_str = commands.join("\n");
    format!(
        r#"You are an autonomous release engineer dispatching an upstream formula update.
Target Registry: {}
Upstream Repository: {}
Package Identifier: {}
Target Version: {}
Manifest Filename: {}

Instructions:
1. Fork upstream repository `{}` if not already forked.
2. Create a feature branch and stage the package manifest:
```{}
{}
```
3. Execute the following Git and GitHub CLI workflow commands:
{}

4. IMPORTANT: Once the Pull Request is created, output the final PR URL on a single line starting with:
[PR_URL] <pr_url>
"#,
        target.name,
        target.registry_repo,
        target.package_id,
        version,
        manifest.filename,
        target.registry_repo,
        manifest.language,
        manifest.content,
        commands_str
    )
}

pub fn extract_pr_url(output: &str) -> Option<String> {
    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("[PR_URL]") {
            let url = trimmed.trim_start_matches("[PR_URL]").trim();
            if !url.is_empty() {
                return Some(url.to_string());
            }
        }
        if let Some(idx) = line.find("https://github.com/") {
            let sub = &line[idx..];
            let end = sub
                .find(|c: char| c.is_whitespace() || c == '"' || c == '\'' || c == ')' || c == ']' || c == '>')
                .unwrap_or(sub.len());
            let candidate = &sub[..end];
            let parts: Vec<&str> = candidate.split('/').collect();
            if parts.len() >= 7
                && parts[0] == "https:"
                && parts[2] == "github.com"
                && parts[5] == "pull"
                && parts[6].chars().all(|c| c.is_ascii_digit())
            {
                return Some(candidate.to_string());
            }
        }
    }
    None
}

#[derive(Clone, Debug, Deserialize)]
pub struct DispatchPackagePrRequest {
    pub version: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DispatchPackagePrResponse {
    pub task_id: String,
    pub message: String,
    pub target_key: String,
    pub upstream_repo: String,
    pub commands: Vec<String>,
}

pub async fn dispatch_package_pr(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
    Json(payload): Json<DispatchPackagePrRequest>,
) -> (StatusCode, Json<Option<DispatchPackagePrResponse>>) {
    let state = ctx.state.read().await;
    let target = match state.packages.iter().find(|p| p.id == id || p.target_key == id) {
        Some(t) => t.clone(),
        None => return (StatusCode::NOT_FOUND, Json(None)),
    };
    drop(state);

    let manifest = match generate_manifest_content(&target.target_key) {
        Some(m) => m,
        None => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let version = payload.version.as_deref().unwrap_or("0.8.4");
    let commands = build_upstream_pr_commands(&target, &manifest, version);
    let prompt = build_upstream_pr_agent_prompt(&target, &manifest, version);

    let task_id = format!("task-pkg-pr-{}", Uuid::new_v4().simple());
    let tx = ctx.task_manager.get_or_create_channel(&task_id).await;
    let runner = ctx.task_manager.runner().clone();

    let target_id = target.id.clone();
    let target_key = target.target_key.clone();
    let ctx_clone = ctx.clone();
    let tx_clone = tx.clone();

    tokio::spawn(async move {
        let exec_result = runner.execute(&prompt, tx_clone.clone()).await;
        if let Ok(output) = exec_result {
            if let Some(found_url) = extract_pr_url(&output) {
                let mut state = ctx_clone.state.write().await;
                if let Some(pkg) = state.packages.iter_mut().find(|p| p.id == target_id || p.target_key == target_key) {
                    pkg.status = "PR Submitted".to_string();
                    pkg.pr_url = Some(found_url.clone());
                    pkg.updated_at = Utc::now();
                    let _ = state.save(&ctx_clone.data_file);
                }
                let _ = tx_clone.send(format!("[SYSTEM] Upstream PR registered: {}", found_url));
            }
        }
    });

    (
        StatusCode::ACCEPTED,
        Json(Some(DispatchPackagePrResponse {
            task_id,
            message: format!("Dispatched upstream PR runner for {}", target.name),
            target_key: target.target_key,
            upstream_repo: target.registry_repo,
            commands,
        })),
    )
}

pub async fn get_package_dispatch_commands(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<Option<DispatchPackagePrResponse>>) {
    let state = ctx.state.read().await;
    let target = match state.packages.iter().find(|p| p.id == id || p.target_key == id) {
        Some(t) => t.clone(),
        None => return (StatusCode::NOT_FOUND, Json(None)),
    };
    drop(state);

    let manifest = match generate_manifest_content(&target.target_key) {
        Some(m) => m,
        None => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let commands = build_upstream_pr_commands(&target, &manifest, "0.8.4");

    (
        StatusCode::OK,
        Json(Some(DispatchPackagePrResponse {
            task_id: format!("preview-{}", target.id),
            message: format!("Generated upstream PR commands for {}", target.name),
            target_key: target.target_key,
            upstream_repo: target.registry_repo,
            commands,
        })),
    )
}


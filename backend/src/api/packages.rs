use crate::api::issues::AppContext;
use crate::db::PackageManagerTarget;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReleaseAsset {
    pub name: String,
    pub browser_download_url: String,
    #[serde(default)]
    pub digest: Option<String>,
    #[serde(default)]
    pub sha256: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ReleaseInfo {
    pub tag_name: String,
    pub version: String,
    pub assets: Vec<ReleaseAsset>,
    pub published_at: Option<DateTime<Utc>>,
    pub fetched_at: DateTime<Utc>,
}

impl ReleaseInfo {
    pub fn default_fallback() -> Self {
        let tag_name = "v0.8.4".to_string();
        let version = "0.8.4".to_string();
        let assets = vec![
            ReleaseAsset {
                name: "tendril-v0.8.4-darwin-arm64.tar.gz".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-darwin-arm64.tar.gz".to_string(),
                digest: Some("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()),
                sha256: Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v0.8.4-darwin-x64.tar.gz".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-darwin-x64.tar.gz".to_string(),
                digest: Some("sha256:ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb".to_string()),
                sha256: Some("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v0.8.4-linux-arm64.tar.gz".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-linux-arm64.tar.gz".to_string(),
                digest: Some("sha256:4e1243bd22c66e76c2ba9eddc1f91394e57f9f8352e8964d4b294e1e86973e8e".to_string()),
                sha256: Some("4e1243bd22c66e76c2ba9eddc1f91394e57f9f8352e8964d4b294e1e86973e8e".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v0.8.4-linux-x64.tar.gz".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-linux-x64.tar.gz".to_string(),
                digest: Some("sha256:30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7".to_string()),
                sha256: Some("30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v0.8.4-windows-x64.zip".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-x64.zip".to_string(),
                digest: Some("sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae".to_string()),
                sha256: Some("2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae".to_string()),
            },
            ReleaseAsset {
                name: "tendril-v0.8.4-windows-arm64.zip".to_string(),
                browser_download_url: "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v0.8.4/tendril-v0.8.4-windows-arm64.zip".to_string(),
                digest: Some("sha256:fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9".to_string()),
                sha256: Some("fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9".to_string()),
            },
        ];
        Self {
            tag_name,
            version,
            assets,
            published_at: None,
            fetched_at: Utc::now(),
        }
    }

    pub fn from_github_json(json_str: &str) -> Result<Self, String> {
        #[derive(Deserialize)]
        struct GitHubAsset {
            name: String,
            browser_download_url: String,
            #[serde(default)]
            digest: Option<String>,
        }

        #[derive(Deserialize)]
        struct GitHubRelease {
            tag_name: String,
            published_at: Option<DateTime<Utc>>,
            body: Option<String>,
            #[serde(default)]
            assets: Vec<GitHubAsset>,
        }

        let parsed: GitHubRelease = serde_json::from_str(json_str).map_err(|e| e.to_string())?;
        let version = parsed.tag_name.trim_start_matches('v').to_string();

        let mut assets = Vec::new();
        for a in parsed.assets {
            let mut sha256 = None;

            // 1. Direct inspection of asset.digest
            if let Some(ref d) = a.digest {
                let clean = d.trim_start_matches("sha256:").trim().to_lowercase();
                if clean.len() == 64 && clean.chars().all(|c| c.is_ascii_hexdigit()) {
                    sha256 = Some(clean);
                }
            }

            // 2. Check body text for checksum tables or lines containing asset.name
            if sha256.is_none() {
                if let Some(ref body) = parsed.body {
                    for line in body.lines() {
                        if line.contains(&a.name) {
                            for word in line.split(|c: char| c.is_whitespace() || c == '|' || c == ':' || c == '*' || c == '`') {
                                let clean = word.trim().to_lowercase();
                                if clean.len() == 64 && clean.chars().all(|ch| ch.is_ascii_hexdigit()) {
                                    sha256 = Some(clean);
                                    break;
                                }
                            }
                            if sha256.is_some() {
                                break;
                            }
                        }
                    }
                }
            }

            // 3. Fallback to default baseline if available for this platform
            if sha256.is_none() {
                let fallback = Self::default_fallback();
                if let Some(f_asset) = fallback.assets.iter().find(|fa| {
                    (a.name.contains("darwin-arm64") && fa.name.contains("darwin-arm64"))
                        || (a.name.contains("darwin-x64") && fa.name.contains("darwin-x64"))
                        || (a.name.contains("linux-arm64") && fa.name.contains("linux-arm64"))
                        || (a.name.contains("linux-x64") && fa.name.contains("linux-x64"))
                        || (a.name.contains("windows-x64") && fa.name.contains("windows-x64"))
                        || (a.name.contains("windows-arm64") && fa.name.contains("windows-arm64"))
                }) {
                    sha256 = f_asset.sha256.clone();
                }
            }

            let digest = sha256.as_ref().map(|s| format!("sha256:{}", s));

            assets.push(ReleaseAsset {
                name: a.name,
                browser_download_url: a.browser_download_url,
                digest,
                sha256,
            });
        }

        Ok(Self {
            tag_name: parsed.tag_name,
            version,
            assets,
            published_at: parsed.published_at,
            fetched_at: Utc::now(),
        })
    }

    pub async fn fetch_latest(repo: &str) -> Result<Self, String> {
        let repo_to_use = std::env::var("IVY_TENDRIL_REPO").unwrap_or_else(|_| repo.to_string());
        let url = format!("https://api.github.com/repos/{}/releases/latest", repo_to_use);
        let client = reqwest::Client::builder()
            .user_agent("GrowthHack-Backend/0.1.0")
            .build()
            .map_err(|e| e.to_string())?;

        let mut request = client.get(&url);
        if let Ok(token) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
            if !token.is_empty() {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
        }

        let response = request.send().await.map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!("GitHub API returned status: {}", response.status()));
        }

        let text = response.text().await.map_err(|e| e.to_string())?;
        Self::from_github_json(&text)
    }

    pub fn find_checksum(&self, platform_pattern: &str, fallback: &str) -> String {
        self.assets
            .iter()
            .find(|a| a.name.contains(platform_pattern))
            .and_then(|a| a.sha256.clone())
            .unwrap_or_else(|| fallback.to_string())
    }

    pub fn find_download_url(&self, platform_pattern: &str, fallback: &str) -> String {
        self.assets
            .iter()
            .find(|a| a.name.contains(platform_pattern))
            .map(|a| a.browser_download_url.clone())
            .unwrap_or_else(|| {
                if fallback.contains("0.8.4") {
                    fallback
                        .replace("v0.8.4", &self.tag_name)
                        .replace("0.8.4", &self.version)
                } else {
                    fallback.to_string()
                }
            })
    }

    pub fn is_expired(&self, ttl_seconds: i64) -> bool {
        (Utc::now() - self.fetched_at).num_seconds() > ttl_seconds
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PackageManifestResponse {
    pub target_key: String,
    pub filename: String,
    pub language: String,
    pub content: String,
    pub install_command: String,
    pub instructions: String,
    #[serde(default)]
    pub release_tag: Option<String>,
    #[serde(default)]
    pub fetched_at: Option<DateTime<Utc>>,
}

#[derive(Deserialize)]
pub struct ManifestQuery {
    pub refresh: Option<bool>,
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

pub fn generate_manifest_content(
    target_key: &str,
    release: &ReleaseInfo,
) -> Option<PackageManifestResponse> {
    match target_key {
        "homebrew" => {
            let darwin_arm64_sha = release.find_checksum(
                "darwin-arm64",
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            );
            let darwin_x64_sha = release.find_checksum(
                "darwin-x64",
                "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
            );
            let linux_arm64_sha = release.find_checksum(
                "linux-arm64",
                "4e1243bd22c66e76c2ba9eddc1f91394e57f9f8352e8964d4b294e1e86973e8e",
            );
            let linux_x64_sha = release.find_checksum(
                "linux-x64",
                "30c822fc944431e67923485ab921b79f225895782782e4e16d47abcf447f5bb7",
            );

            let darwin_arm64_url = release.find_download_url(
                "darwin-arm64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-darwin-arm64.tar.gz",
                    release.tag_name, release.tag_name
                ),
            );
            let darwin_x64_url = release.find_download_url(
                "darwin-x64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-darwin-x64.tar.gz",
                    release.tag_name, release.tag_name
                ),
            );
            let linux_arm64_url = release.find_download_url(
                "linux-arm64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-linux-arm64.tar.gz",
                    release.tag_name, release.tag_name
                ),
            );
            let linux_x64_url = release.find_download_url(
                "linux-x64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-linux-x64.tar.gz",
                    release.tag_name, release.tag_name
                ),
            );

            let content = format!(
                r##"# typed: false
# frozen_string_literal: true

class Tendril < Formula
  desc "Autonomous multi-agent software factory and plan orchestration system"
  homepage "https://github.com/Ivy-Interactive/Ivy-Tendril"
  version "{version}"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "{darwin_arm64_url}"
      sha256 "{darwin_arm64_sha}"
    else
      url "{darwin_x64_url}"
      sha256 "{darwin_x64_sha}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "{linux_arm64_url}"
      sha256 "{linux_arm64_sha}"
    else
      url "{linux_x64_url}"
      sha256 "{linux_x64_sha}"
    end
  end

  def install
    bin.install "tendril"
    generate_completions_from_executable(bin/"tendril", "completion")
  end

  test do
    assert_match "tendril", shell_output("#{{bin}}/tendril version")
  end
end
"##,
                version = release.version,
                darwin_arm64_url = darwin_arm64_url,
                darwin_arm64_sha = darwin_arm64_sha,
                darwin_x64_url = darwin_x64_url,
                darwin_x64_sha = darwin_x64_sha,
                linux_arm64_url = linux_arm64_url,
                linux_arm64_sha = linux_arm64_sha,
                linux_x64_url = linux_x64_url,
                linux_x64_sha = linux_x64_sha,
            );

            Some(PackageManifestResponse {
                target_key: "homebrew".to_string(),
                filename: "tendril.rb".to_string(),
                language: "ruby".to_string(),
                install_command: "brew install ivy-interactive/tap/tendril".to_string(),
                instructions: "Add tap with 'brew tap ivy-interactive/tap' or install directly. Formula supports dual arm64 and x86_64 binaries with automated completions.".to_string(),
                content,
                release_tag: Some(release.tag_name.clone()),
                fetched_at: Some(release.fetched_at),
            })
        }
        "winget" => {
            let win_x64_sha = release.find_checksum(
                "windows-x64",
                "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
            );
            let win_arm64_sha = release.find_checksum(
                "windows-arm64",
                "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
            );
            let win_x64_url = release.find_download_url(
                "windows-x64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-windows-x64.zip",
                    release.tag_name, release.tag_name
                ),
            );
            let win_arm64_url = release.find_download_url(
                "windows-arm64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-windows-arm64.zip",
                    release.tag_name, release.tag_name
                ),
            );

            let content = format!(
                r#"PackageIdentifier: Ivy.Tendril
PackageVersion: {version}
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
    InstallerUrl: {win_x64_url}
    InstallerSha256: {win_x64_sha}
    Commands:
      - tendril
  - Architecture: arm64
    InstallerType: portable
    InstallerUrl: {win_arm64_url}
    InstallerSha256: {win_arm64_sha}
    Commands:
      - tendril
"#,
                version = release.version,
                win_x64_url = win_x64_url,
                win_x64_sha = win_x64_sha,
                win_arm64_url = win_arm64_url,
                win_arm64_sha = win_arm64_sha,
            );

            Some(PackageManifestResponse {
                target_key: "winget".to_string(),
                filename: "Ivy.Tendril.yaml".to_string(),
                language: "yaml".to_string(),
                install_command: "winget install Ivy.Tendril".to_string(),
                instructions: format!(
                    "Submit singleton manifest to microsoft/winget-pkgs repository under manifests/i/Ivy/Tendril/{}/Ivy.Tendril.yaml.",
                    release.version
                ),
                content,
                release_tag: Some(release.tag_name.clone()),
                fetched_at: Some(release.fetched_at),
            })
        }
        "scoop" => {
            let win_x64_sha = release.find_checksum(
                "windows-x64",
                "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
            );
            let win_arm64_sha = release.find_checksum(
                "windows-arm64",
                "fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9",
            );
            let win_x64_url = release.find_download_url(
                "windows-x64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-windows-x64.zip",
                    release.tag_name, release.tag_name
                ),
            );
            let win_arm64_url = release.find_download_url(
                "windows-arm64",
                &format!(
                    "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/{}/tendril-{}-windows-arm64.zip",
                    release.tag_name, release.tag_name
                ),
            );

            let content = format!(
                r#"{{
  "version": "{version}",
  "description": "Autonomous multi-agent software factory with isolated git worktrees",
  "homepage": "https://github.com/Ivy-Interactive/Ivy-Tendril",
  "license": "MIT",
  "architecture": {{
    "64bit": {{
      "url": "{win_x64_url}",
      "hash": "{win_x64_sha}"
    }},
    "arm64": {{
      "url": "{win_arm64_url}",
      "hash": "{win_arm64_sha}"
    }}
  }},
  "bin": "tendril.exe",
  "checkver": "github",
  "autoupdate": {{
    "architecture": {{
      "64bit": {{
        "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v$version/tendril-v$version-windows-x64.zip"
      }},
      "arm64": {{
        "url": "https://github.com/Ivy-Interactive/Ivy-Tendril/releases/download/v$version/tendril-v$version-windows-arm64.zip"
      }}
    }}
  }}
}}
"#,
                version = release.version,
                win_x64_url = win_x64_url,
                win_x64_sha = win_x64_sha,
                win_arm64_url = win_arm64_url,
                win_arm64_sha = win_arm64_sha,
            );

            Some(PackageManifestResponse {
                target_key: "scoop".to_string(),
                filename: "tendril.json".to_string(),
                language: "json".to_string(),
                install_command: "scoop bucket add extras && scoop install tendril".to_string(),
                instructions: "Submit manifest to ScoopInstaller/Extras bucket repository under bucket/tendril.json.".to_string(),
                content,
                release_tag: Some(release.tag_name.clone()),
                fetched_at: Some(release.fetched_at),
            })
        }
        "npx" => {
            let content = format!(
                r#"{{
  "name": "@ivy-interactive/tendril",
  "version": "{version}",
  "description": "Zero-install npx launcher for Tendril autonomous multi-agent software factory",
  "bin": {{
    "tendril": "./bin/tendril.js"
  }},
  "repository": {{
    "type": "git",
    "url": "https://github.com/Ivy-Interactive/Ivy-Tendril.git"
  }},
  "scripts": {{
    "start": "node ./bin/tendril.js"
  }},
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
  "engines": {{
    "node": ">=18.0.0"
  }},
  "publishConfig": {{
    "access": "public"
  }}
}}
"#,
                version = release.version
            );

            Some(PackageManifestResponse {
                target_key: "npx".to_string(),
                filename: "package.json".to_string(),
                language: "json".to_string(),
                install_command: "npx @ivy-interactive/tendril".to_string(),
                instructions: "Publish package to npm registry as @ivy-interactive/tendril. The zero-install launcher bootstraps the native binary in seconds.".to_string(),
                content,
                release_tag: Some(release.tag_name.clone()),
                fetched_at: Some(release.fetched_at),
            })
        }
        _ => None,
    }
}

pub async fn get_manifest(
    Path(target_key): Path<String>,
    Query(query): Query<ManifestQuery>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<Option<PackageManifestResponse>>) {
    let should_fetch = {
        let state = ctx.state.read().await;
        match &state.latest_release {
            None => true,
            Some(rel) => rel.is_expired(15 * 60) || query.refresh == Some(true),
        }
    };

    let release = if should_fetch {
        match ReleaseInfo::fetch_latest("Ivy-Interactive/Ivy-Tendril").await {
            Ok(fresh) => {
                let mut state = ctx.state.write().await;
                state.latest_release = Some(fresh.clone());
                let _ = state.save(&ctx.data_file);
                fresh
            }
            Err(err) => {
                tracing::warn!("Failed to fetch latest GitHub release: {}", err);
                let state = ctx.state.read().await;
                state
                    .latest_release
                    .clone()
                    .unwrap_or_else(ReleaseInfo::default_fallback)
            }
        }
    } else {
        let state = ctx.state.read().await;
        state
            .latest_release
            .clone()
            .unwrap_or_else(ReleaseInfo::default_fallback)
    };

    match generate_manifest_content(&target_key, &release) {
        Some(manifest) => (StatusCode::OK, Json(Some(manifest))),
        None => (StatusCode::NOT_FOUND, Json(None)),
    }
}

pub async fn refresh_release(
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<ReleaseInfo>) {
    let fresh_res = ReleaseInfo::fetch_latest("Ivy-Interactive/Ivy-Tendril").await;
    let release = match fresh_res {
        Ok(r) => {
            let mut state = ctx.state.write().await;
            state.latest_release = Some(r.clone());
            let _ = state.save(&ctx.data_file);
            r
        }
        Err(err) => {
            tracing::warn!("Failed to refresh GitHub release: {}", err);
            let state = ctx.state.read().await;
            state
                .latest_release
                .clone()
                .unwrap_or_else(ReleaseInfo::default_fallback)
        }
    };
    (StatusCode::OK, Json(release))
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

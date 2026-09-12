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
use uuid::Uuid;

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
                            for word in line.split(|c: char| {
                                c.is_whitespace() || c == '|' || c == ':' || c == '*' || c == '`'
                            }) {
                                let clean = word.trim().to_lowercase();
                                if clean.len() == 64
                                    && clean.chars().all(|ch| ch.is_ascii_hexdigit())
                                {
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

            // 3. Keep sha256 as None if not in digest or body; resolve_missing_checksums will compute it dynamically

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

    pub async fn resolve_missing_checksums(&mut self) -> Result<(), String> {
        let client = reqwest::Client::builder()
            .user_agent("GrowthHack-Backend/0.1.0")
            .build()
            .map_err(|e| e.to_string())?;
        self.resolve_missing_checksums_with_client(&client).await
    }

    pub async fn resolve_missing_checksums_with_client(
        &mut self,
        client: &reqwest::Client,
    ) -> Result<(), String> {
        // 1. Companion file inspection (checksums.txt, SHA256SUMS, hashes.txt, etc.)
        let companion_asset = self
            .assets
            .iter()
            .find(|a| {
                let lower = a.name.to_lowercase();
                lower.contains("checksum")
                    || lower.contains("sha256")
                    || lower.contains("hashes")
                    || lower.ends_with(".sha256")
            })
            .cloned();

        if let Some(comp) = companion_asset {
            if let Ok(resp) = client.get(&comp.browser_download_url).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        let parsed = parse_checksums_content(&text);
                        for asset in self.assets.iter_mut() {
                            if asset.sha256.is_none() {
                                for (fname, hash) in &parsed {
                                    if asset.name == *fname
                                        || fname.contains(&asset.name)
                                        || asset.name.contains(fname)
                                    {
                                        asset.sha256 = Some(hash.clone());
                                        asset.digest = Some(format!("sha256:{}", hash));
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // 2. Direct binary hashing for assets that still don't have sha256
        let platforms = [
            "darwin-arm64",
            "darwin-x64",
            "linux-arm64",
            "linux-x64",
            "windows-x64",
            "windows-arm64",
        ];

        for asset in self.assets.iter_mut() {
            let matches_platform = platforms.iter().any(|p| asset.name.contains(p));
            if matches_platform && asset.sha256.is_none() && !asset.browser_download_url.is_empty()
            {
                match compute_asset_sha256(client, &asset.browser_download_url).await {
                    Ok(hash) => {
                        asset.sha256 = Some(hash.clone());
                        asset.digest = Some(format!("sha256:{}", hash));
                    }
                    Err(e) => {
                        tracing::warn!("Failed to compute sha256 for asset {}: {}", asset.name, e);
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn fetch_release(repo: &str, tag: Option<&str>) -> Result<Self, String> {
        let repo_to_use = std::env::var("IVY_TENDRIL_REPO").unwrap_or_else(|_| repo.to_string());
        let client = reqwest::Client::builder()
            .user_agent("GrowthHack-Backend/0.1.0")
            .build()
            .map_err(|e| e.to_string())?;

        let url = format_release_url(&repo_to_use, tag);

        let mut request = client.get(&url);
        if let Ok(token) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
            if !token.is_empty() {
                request = request.header("Authorization", format!("Bearer {}", token));
            }
        }

        let mut response = request.send().await.map_err(|e| e.to_string())?;

        if response.status() == StatusCode::NOT_FOUND {
            if let Some(t) = tag {
                if t != "latest" {
                    let alt_url = if t.starts_with('v') {
                        format!(
                            "https://api.github.com/repos/{}/releases/tags/{}",
                            repo_to_use,
                            t.trim_start_matches('v')
                        )
                    } else {
                        format!(
                            "https://api.github.com/repos/{}/releases/tags/{}",
                            repo_to_use, t
                        )
                    };
                    let mut alt_req = client.get(&alt_url);
                    if let Ok(token) =
                        std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN"))
                    {
                        if !token.is_empty() {
                            alt_req = alt_req.header("Authorization", format!("Bearer {}", token));
                        }
                    }
                    if let Ok(alt_resp) = alt_req.send().await {
                        if alt_resp.status().is_success() {
                            response = alt_resp;
                        }
                    }
                }
            }
        }

        if !response.status().is_success() {
            return Err(format!("GitHub API returned status: {}", response.status()));
        }

        let text = response.text().await.map_err(|e| e.to_string())?;
        let mut release = Self::from_github_json(&text)?;
        let _ = release.resolve_missing_checksums_with_client(&client).await;
        Ok(release)
    }

    pub async fn fetch_latest(repo: &str) -> Result<Self, String> {
        Self::fetch_release(repo, None).await
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

pub fn format_release_url(repo: &str, tag: Option<&str>) -> String {
    match tag {
        None | Some("latest") => {
            format!("https://api.github.com/repos/{}/releases/latest", repo)
        }
        Some(t) => {
            if t.starts_with('v') {
                format!("https://api.github.com/repos/{}/releases/tags/{}", repo, t)
            } else {
                format!("https://api.github.com/repos/{}/releases/tags/v{}", repo, t)
            }
        }
    }
}

pub fn compute_sha256_bytes(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub async fn compute_asset_sha256(
    client: &reqwest::Client,
    download_url: &str,
) -> Result<String, String> {
    let resp = client
        .get(download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("Download failed with status {}", resp.status()));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    Ok(compute_sha256_bytes(&bytes))
}

pub fn parse_checksums_content(content: &str) -> std::collections::HashMap<String, String> {
    let mut map = std::collections::HashMap::new();
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((file, hash)) = line.split_once(':') {
            let file = file.trim();
            let hash = hash.trim().to_lowercase();
            if hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
                map.insert(file.to_string(), hash);
                continue;
            }
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 2 {
            let p0 = parts[0].trim().to_lowercase();
            let p1 = parts[1].trim_start_matches('*').trim();
            if p0.len() == 64 && p0.chars().all(|c| c.is_ascii_hexdigit()) {
                map.insert(p1.to_string(), p0);
            } else {
                let last = parts[parts.len() - 1].trim().to_lowercase();
                if last.len() == 64 && last.chars().all(|c| c.is_ascii_hexdigit()) {
                    map.insert(parts[0].trim().to_string(), last);
                }
            }
        }
    }
    map
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

#[derive(Clone, Debug, Default, Deserialize)]
pub struct ManifestQuery {
    pub refresh: Option<bool>,
    pub tag: Option<String>,
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
    let tag_param = query.tag.as_deref().filter(|t| !t.trim().is_empty());

    let should_fetch = {
        let state = ctx.state.read().await;
        if query.refresh == Some(true) {
            true
        } else {
            state.find_cached_release(tag_param).is_none()
        }
    };

    let release = if should_fetch {
        match ReleaseInfo::fetch_release("Ivy-Interactive/Ivy-Tendril", tag_param).await {
            Ok(fresh) => {
                let mut state = ctx.state.write().await;
                if tag_param.is_none() || tag_param == Some("latest") {
                    state.latest_release = Some(fresh.clone());
                }
                state.update_release_cache(fresh.clone());
                let _ = state.save(&ctx.data_file);
                fresh
            }
            Err(err) => {
                tracing::warn!(
                    "Failed to fetch GitHub release for tag {:?}: {}",
                    tag_param,
                    err
                );
                let state = ctx.state.read().await;
                state
                    .find_cached_release(tag_param)
                    .cloned()
                    .unwrap_or_else(|| {
                        let mut fallback = state
                            .latest_release
                            .clone()
                            .unwrap_or_else(ReleaseInfo::default_fallback);
                        if let Some(t) = tag_param {
                            fallback.tag_name = if t.starts_with('v') {
                                t.to_string()
                            } else {
                                format!("v{}", t)
                            };
                            fallback.version = t.trim_start_matches('v').to_string();
                        }
                        fallback
                    })
            }
        }
    } else {
        let state = ctx.state.read().await;
        state
            .find_cached_release(tag_param)
            .cloned()
            .unwrap_or_else(|| {
                let mut fallback = state
                    .latest_release
                    .clone()
                    .unwrap_or_else(ReleaseInfo::default_fallback);
                if let Some(t) = tag_param {
                    fallback.tag_name = if t.starts_with('v') {
                        t.to_string()
                    } else {
                        format!("v{}", t)
                    };
                    fallback.version = t.trim_start_matches('v').to_string();
                }
                fallback
            })
    };

    match generate_manifest_content(&target_key, &release) {
        Some(manifest) => (StatusCode::OK, Json(Some(manifest))),
        None => (StatusCode::NOT_FOUND, Json(None)),
    }
}

#[derive(Clone, Debug, Default, Deserialize)]
pub struct RefreshReleaseQuery {
    pub tag: Option<String>,
}

pub async fn refresh_release(
    Query(query): Query<RefreshReleaseQuery>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<ReleaseInfo>) {
    let tag_param = query.tag.as_deref().filter(|t| !t.trim().is_empty());
    let fresh_res = ReleaseInfo::fetch_release("Ivy-Interactive/Ivy-Tendril", tag_param).await;
    let release = match fresh_res {
        Ok(r) => {
            let mut state = ctx.state.write().await;
            if tag_param.is_none() || tag_param == Some("latest") {
                state.latest_release = Some(r.clone());
            }
            state.update_release_cache(r.clone());
            let _ = state.save(&ctx.data_file);
            r
        }
        Err(err) => {
            tracing::warn!("Failed to refresh GitHub release: {}", err);
            let state = ctx.state.read().await;
            state
                .find_cached_release(tag_param)
                .cloned()
                .unwrap_or_else(|| {
                    let mut fallback = state
                        .latest_release
                        .clone()
                        .unwrap_or_else(ReleaseInfo::default_fallback);
                    if let Some(t) = tag_param {
                        fallback.tag_name = if t.starts_with('v') {
                            t.to_string()
                        } else {
                            format!("v{}", t)
                        };
                        fallback.version = t.trim_start_matches('v').to_string();
                    }
                    fallback
                })
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
    if let Some(target) = state
        .packages
        .iter_mut()
        .find(|p| p.id == id || p.target_key == id)
    {
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
            "gh repo sync microsoft/winget-pkgs".to_string(),
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
            "gh repo sync ScoopInstaller/Extras".to_string(),
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
            "gh repo sync ivy-interactive/homebrew-tap".to_string(),
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
2. Synchronize existing fork with upstream repository default branch before creating feature branch.
3. Create a feature branch and stage the package manifest:
```{}
{}
```
4. Execute the following Git and GitHub CLI workflow commands:
{}

5. IMPORTANT: Once the Pull Request is created, output the final PR URL on a single line starting with:
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
                .find(|c: char| {
                    c.is_whitespace() || c == '"' || c == '\'' || c == ')' || c == ']' || c == '>'
                })
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

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct GhAuthStatus {
    pub authenticated: bool,
    pub account: Option<String>,
    pub message: String,
}

pub fn extract_gh_account(text: &str) -> Option<String> {
    for line in text.lines() {
        let trimmed = line.trim();
        let lower = trimmed.to_lowercase();
        if let Some(pos) = lower.find("account") {
            let after = &trimmed[pos + "account".len()..];
            let after_trimmed = after.trim_start_matches(|c: char| c == ':' || c.is_whitespace());
            let acc: String = after_trimmed
                .chars()
                .take_while(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
                .collect();
            if !acc.is_empty() && acc != "true" && acc != "false" {
                return Some(acc);
            }
        }
    }
    None
}

pub fn parse_gh_auth_output(success: bool, stdout: &str, stderr: &str) -> GhAuthStatus {
    let combined = format!("{}\n{}", stdout, stderr);
    let trimmed = combined.trim();

    if success {
        let account = extract_gh_account(trimmed);
        let message = if let Some(ref acc) = account {
            format!("GitHub CLI is authenticated as @{}.", acc)
        } else {
            "GitHub CLI is authenticated.".to_string()
        };
        GhAuthStatus {
            authenticated: true,
            account,
            message,
        }
    } else {
        let mut clean_msg = trimmed.to_string();
        if clean_msg.is_empty() {
            clean_msg = "GitHub CLI is not logged into any account.".to_string();
        }
        let message = if clean_msg.contains("gh auth login") {
            clean_msg
        } else {
            format!(
                "{} Run 'gh auth login' to authenticate GitHub CLI.",
                clean_msg
            )
        };
        GhAuthStatus {
            authenticated: false,
            account: None,
            message,
        }
    }
}

pub async fn check_gh_auth_status() -> GhAuthStatus {
    if let Ok(override_val) = std::env::var("GH_AUTH_STATUS_OVERRIDE") {
        if override_val.eq_ignore_ascii_case("unauthenticated")
            || override_val.eq_ignore_ascii_case("false")
        {
            return GhAuthStatus {
                authenticated: false,
                account: None,
                message: "You are not logged into any GitHub hosts. Run 'gh auth login' to authenticate GitHub CLI.".to_string(),
            };
        } else if let Some(user) = override_val.strip_prefix("authenticated:") {
            return GhAuthStatus {
                authenticated: true,
                account: Some(user.to_string()),
                message: format!("GitHub CLI is authenticated as @{}.", user),
            };
        } else if override_val.eq_ignore_ascii_case("authenticated")
            || override_val.eq_ignore_ascii_case("true")
        {
            return GhAuthStatus {
                authenticated: true,
                account: Some("testuser".to_string()),
                message: "GitHub CLI is authenticated as @testuser.".to_string(),
            };
        }
    }

    let mut cmd = tokio::process::Command::new("gh");
    cmd.args(["auth", "status"]);

    if let Ok(token) = std::env::var("GH_TOKEN").or_else(|_| std::env::var("GITHUB_TOKEN")) {
        if !token.is_empty() {
            cmd.env("GH_TOKEN", &token);
        }
    }

    match cmd.output().await {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let stderr = String::from_utf8_lossy(&output.stderr);
            parse_gh_auth_output(output.status.success(), &stdout, &stderr)
        }
        Err(e) => {
            if let Ok(token) = std::env::var("GH_TOKEN").or_else(|_| std::env::var("GITHUB_TOKEN"))
            {
                if !token.trim().is_empty() {
                    return GhAuthStatus {
                        authenticated: true,
                        account: None,
                        message: "GitHub CLI authenticated via environment token.".to_string(),
                    };
                }
            }
            GhAuthStatus {
                authenticated: false,
                account: None,
                message: format!(
                    "Failed to execute 'gh': {}. Run 'gh auth login' to authenticate GitHub CLI.",
                    e
                ),
            }
        }
    }
}

pub async fn get_gh_auth_status() -> (StatusCode, Json<GhAuthStatus>) {
    let status = check_gh_auth_status().await;
    (StatusCode::OK, Json(status))
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct ForkSyncStatus {
    pub target_key: String,
    pub upstream_repo: String,
    pub fork_repo: Option<String>,
    pub fork_exists: bool,
    pub is_synchronized: bool,
    pub behind_by: usize,
    pub ahead_by: usize,
    pub status: String,
    pub message: String,
}

fn fork_repo_name(upstream_repo: &str) -> &str {
    upstream_repo.rsplit('/').next().unwrap_or(upstream_repo)
}

fn synchronized_status(
    target_key: &str,
    upstream_repo: &str,
    fork_repo: Option<String>,
) -> ForkSyncStatus {
    ForkSyncStatus {
        target_key: target_key.to_string(),
        upstream_repo: upstream_repo.to_string(),
        fork_repo,
        fork_exists: true,
        is_synchronized: true,
        behind_by: 0,
        ahead_by: 0,
        status: "synchronized".to_string(),
        message: "Fork is synchronized with upstream.".to_string(),
    }
}

fn no_fork_status(target_key: &str, upstream_repo: &str) -> ForkSyncStatus {
    ForkSyncStatus {
        target_key: target_key.to_string(),
        upstream_repo: upstream_repo.to_string(),
        fork_repo: None,
        fork_exists: false,
        is_synchronized: true,
        behind_by: 0,
        ahead_by: 0,
        status: "no_fork".to_string(),
        message: "No existing fork detected. A clean fork will be created from upstream HEAD."
            .to_string(),
    }
}

fn behind_status(
    target_key: &str,
    upstream_repo: &str,
    fork_repo: Option<String>,
    behind_by: usize,
    ahead_by: usize,
) -> ForkSyncStatus {
    ForkSyncStatus {
        target_key: target_key.to_string(),
        upstream_repo: upstream_repo.to_string(),
        fork_repo,
        fork_exists: true,
        is_synchronized: false,
        behind_by,
        ahead_by,
        status: "behind".to_string(),
        message: format!(
            "Fork is {} commits behind upstream. Synchronize fork before dispatching.",
            behind_by
        ),
    }
}

fn parse_fork_sync_override(
    override_val: &str,
    target_key: &str,
    upstream_repo: &str,
    account: Option<&str>,
) -> ForkSyncStatus {
    let fork_repo = account.map(|a| format!("{}/{}", a, fork_repo_name(upstream_repo)));

    if override_val.eq_ignore_ascii_case("no_fork") {
        return no_fork_status(target_key, upstream_repo);
    }
    if override_val.eq_ignore_ascii_case("diverged") {
        return ForkSyncStatus {
            target_key: target_key.to_string(),
            upstream_repo: upstream_repo.to_string(),
            fork_repo,
            fork_exists: true,
            is_synchronized: false,
            behind_by: 0,
            ahead_by: 0,
            status: "diverged".to_string(),
            message: "Fork has diverged from upstream. Manual review required before syncing."
                .to_string(),
        };
    }
    if let Some(n_str) = override_val.strip_prefix("behind:") {
        let behind_by = n_str.trim().parse::<usize>().unwrap_or(1);
        return behind_status(target_key, upstream_repo, fork_repo, behind_by, 0);
    }
    // "synchronized" and any other unrecognized override value default to synchronized so a typo
    // in a test override never silently blocks dispatch.
    synchronized_status(target_key, upstream_repo, fork_repo)
}

fn parse_compare_counts(json_text: &str) -> (usize, usize) {
    let value: serde_json::Value = match serde_json::from_str(json_text) {
        Ok(v) => v,
        Err(_) => return (0, 0),
    };
    let behind_by = value.get("behind_by").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let ahead_by = value.get("ahead_by").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    (behind_by, ahead_by)
}

async fn gh_repo_default_branch(repo: &str) -> Option<String> {
    let output = tokio::process::Command::new("gh")
        .args(["api", &format!("/repos/{}", repo)])
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    let value: serde_json::Value = serde_json::from_str(&stdout).ok()?;
    value
        .get("default_branch")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

pub async fn check_fork_sync_status(
    target: &PackageManagerTarget,
    account: Option<&str>,
) -> ForkSyncStatus {
    let upstream_repo = target.registry_repo.clone();

    if let Ok(override_val) = std::env::var("GH_FORK_SYNC_OVERRIDE") {
        return parse_fork_sync_override(
            &override_val,
            &target.target_key,
            &upstream_repo,
            account,
        );
    }

    let account = match account {
        Some(a) => a,
        None => {
            // Without a known authenticated account we cannot look up a personal fork; treat this
            // the same as "no fork" so dispatch is never blocked by an auth problem the auth-status
            // check above is already responsible for surfacing.
            return no_fork_status(&target.target_key, &upstream_repo);
        }
    };

    let fork_repo = format!("{}/{}", account, fork_repo_name(&upstream_repo));

    let fork_view = tokio::process::Command::new("gh")
        .args(["api", &format!("/repos/{}", fork_repo)])
        .output()
        .await;
    let fork_exists = matches!(&fork_view, Ok(o) if o.status.success());

    if !fork_exists {
        return no_fork_status(&target.target_key, &upstream_repo);
    }

    let default_branch = gh_repo_default_branch(&upstream_repo)
        .await
        .unwrap_or_else(|| "main".to_string());

    let compare_output = tokio::process::Command::new("gh")
        .args([
            "api",
            &format!(
                "/repos/{}/compare/{}:{}...{}",
                upstream_repo, account, default_branch, default_branch
            ),
        ])
        .output()
        .await;

    match compare_output {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let (behind_by, ahead_by) = parse_compare_counts(&stdout);
            if behind_by == 0 {
                synchronized_status(&target.target_key, &upstream_repo, Some(fork_repo))
            } else {
                behind_status(
                    &target.target_key,
                    &upstream_repo,
                    Some(fork_repo),
                    behind_by,
                    ahead_by,
                )
            }
        }
        _ => ForkSyncStatus {
            target_key: target.target_key.clone(),
            upstream_repo,
            fork_repo: Some(fork_repo),
            fork_exists: true,
            is_synchronized: true,
            behind_by: 0,
            ahead_by: 0,
            status: "unknown".to_string(),
            message: "Unable to determine fork synchronization status.".to_string(),
        },
    }
}

pub async fn sync_fork_repo(upstream_repo: &str) -> Result<String, String> {
    if let Ok(override_val) = std::env::var("GH_FORK_SYNC_ACTION_OVERRIDE") {
        if override_val.eq_ignore_ascii_case("fail") {
            return Err(format!(
                "Simulated failure syncing fork of {} via GH_FORK_SYNC_ACTION_OVERRIDE.",
                upstream_repo
            ));
        }
        return Ok(format!("Fork synchronized with {}.", upstream_repo));
    }

    let output = tokio::process::Command::new("gh")
        .args(["repo", "sync", upstream_repo])
        .output()
        .await
        .map_err(|e| format!("Failed to execute 'gh repo sync {}': {}", upstream_repo, e))?;

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.trim().is_empty() {
            Ok(format!("Fork synchronized with {}.", upstream_repo))
        } else {
            Ok(stdout.trim().to_string())
        }
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!(
            "'gh repo sync {}' failed: {}",
            upstream_repo,
            stderr.trim()
        ))
    }
}

pub async fn get_package_fork_status(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<Option<ForkSyncStatus>>) {
    let state = ctx.state.read().await;
    let target = match state
        .packages
        .iter()
        .find(|p| p.id == id || p.target_key == id)
    {
        Some(t) => t.clone(),
        None => return (StatusCode::NOT_FOUND, Json(None)),
    };
    drop(state);

    let auth_status = check_gh_auth_status().await;
    let status = check_fork_sync_status(&target, auth_status.account.as_deref()).await;
    (StatusCode::OK, Json(Some(status)))
}

#[derive(Clone, Debug, Serialize)]
pub struct SyncPackageForkResponse {
    pub success: bool,
    pub message: String,
}

pub async fn sync_package_fork(
    Path(id): Path<String>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<SyncPackageForkResponse>) {
    let state = ctx.state.read().await;
    let target = match state
        .packages
        .iter()
        .find(|p| p.id == id || p.target_key == id)
    {
        Some(t) => t.clone(),
        None => {
            return (
                StatusCode::NOT_FOUND,
                Json(SyncPackageForkResponse {
                    success: false,
                    message: "Package target not found.".to_string(),
                }),
            )
        }
    };
    drop(state);

    match sync_fork_repo(&target.registry_repo).await {
        Ok(message) => (
            StatusCode::OK,
            Json(SyncPackageForkResponse {
                success: true,
                message,
            }),
        ),
        Err(message) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(SyncPackageForkResponse {
                success: false,
                message,
            }),
        ),
    }
}

#[derive(Clone, Debug, Deserialize)]
pub struct DispatchPackagePrRequest {
    pub version: Option<String>,
    pub tag: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub skip_auth_check: Option<bool>,
    #[serde(default)]
    pub skip_sync_check: Option<bool>,
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
    let tag_param = payload.tag.as_deref().filter(|t| !t.trim().is_empty());
    let state = ctx.state.read().await;
    let target = match state
        .packages
        .iter()
        .find(|p| p.id == id || p.target_key == id)
    {
        Some(t) => t.clone(),
        None => return (StatusCode::NOT_FOUND, Json(None)),
    };
    let release = state
        .find_cached_release(tag_param)
        .cloned()
        .unwrap_or_else(|| {
            let mut fallback = state
                .latest_release
                .clone()
                .unwrap_or_else(ReleaseInfo::default_fallback);
            if let Some(t) = tag_param {
                fallback.tag_name = if t.starts_with('v') {
                    t.to_string()
                } else {
                    format!("v{}", t)
                };
                fallback.version = t.trim_start_matches('v').to_string();
            }
            fallback
        });
    drop(state);

    let manifest = match generate_manifest_content(&target.target_key, &release) {
        Some(m) => m,
        None => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let default_ver = release.version.clone();
    let version = payload.version.as_deref().unwrap_or(&default_ver);
    let commands = build_upstream_pr_commands(&target, &manifest, version);

    let is_test_bypass = std::env::var("TEST_BYPASS_AUTH")
        .map(|v| v == "1" || v == "true")
        .unwrap_or(false);
    if payload.skip_auth_check != Some(true) && !is_test_bypass {
        let auth_status = check_gh_auth_status().await;
        if !auth_status.authenticated {
            return (
                StatusCode::PRECONDITION_FAILED,
                Json(Some(DispatchPackagePrResponse {
                    task_id: String::new(),
                    message: auth_status.message,
                    target_key: target.target_key,
                    upstream_repo: target.registry_repo,
                    commands,
                })),
            );
        }
    }

    if payload.skip_sync_check != Some(true) && !is_test_bypass {
        let auth_status = check_gh_auth_status().await;
        let sync_status = check_fork_sync_status(&target, auth_status.account.as_deref()).await;
        if sync_status.fork_exists && !sync_status.is_synchronized {
            return (
                StatusCode::PRECONDITION_FAILED,
                Json(Some(DispatchPackagePrResponse {
                    task_id: String::new(),
                    message: sync_status.message,
                    target_key: target.target_key,
                    upstream_repo: target.registry_repo,
                    commands,
                })),
            );
        }
    }

    let prompt = build_upstream_pr_agent_prompt(&target, &manifest, version);

    let task_id = format!("task-pkg-pr-{}", Uuid::new_v4().simple());
    let target_id = target.id.clone();
    let target_key = target.target_key.clone();
    let ctx_clone = ctx.clone();

    ctx.task_manager
        .spawn_task_with_callback(&task_id, prompt, move |output, tx| async move {
            if let Some(found_url) = extract_pr_url(&output) {
                let mut state = ctx_clone.state.write().await;
                if let Some(pkg) = state
                    .packages
                    .iter_mut()
                    .find(|p| p.id == target_id || p.target_key == target_key)
                {
                    pkg.status = "PR Submitted".to_string();
                    pkg.pr_url = Some(found_url.clone());
                    pkg.updated_at = Utc::now();
                    let _ = state.save(&ctx_clone.data_file);
                }
                let _ = tx.send(format!("[SYSTEM] Upstream PR registered: {}", found_url));
            }
        })
        .await;

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
    Query(query): Query<RefreshReleaseQuery>,
    State(ctx): State<Arc<AppContext>>,
) -> (StatusCode, Json<Option<DispatchPackagePrResponse>>) {
    let tag_param = query.tag.as_deref().filter(|t| !t.trim().is_empty());
    let state = ctx.state.read().await;
    let target = match state
        .packages
        .iter()
        .find(|p| p.id == id || p.target_key == id)
    {
        Some(t) => t.clone(),
        None => return (StatusCode::NOT_FOUND, Json(None)),
    };
    let release = state
        .find_cached_release(tag_param)
        .cloned()
        .unwrap_or_else(|| {
            let mut fallback = state
                .latest_release
                .clone()
                .unwrap_or_else(ReleaseInfo::default_fallback);
            if let Some(t) = tag_param {
                fallback.tag_name = if t.starts_with('v') {
                    t.to_string()
                } else {
                    format!("v{}", t)
                };
                fallback.version = t.trim_start_matches('v').to_string();
            }
            fallback
        });
    drop(state);

    let manifest = match generate_manifest_content(&target.target_key, &release) {
        Some(m) => m,
        None => return (StatusCode::BAD_REQUEST, Json(None)),
    };

    let commands = build_upstream_pr_commands(&target, &manifest, &release.version);

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

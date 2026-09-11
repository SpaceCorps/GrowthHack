use crate::api::issues::AppContext;
use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use base64::prelude::*;
use reqwest::header::{HeaderMap, HeaderValue, ACCEPT, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubUser {
    pub login: String,
    pub id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoInfo {
    pub default_branch: String,
    pub full_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PullRequestResponse {
    pub html_url: String,
    pub number: u64,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitHubStatusResponse {
    pub configured: bool,
    pub username: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SubmitBatchRequest {
    pub listing_ids: Option<Vec<String>>,
    pub category: Option<String>,
    pub limit: Option<usize>,
}

pub fn extract_github_repo(url: &str) -> Option<(String, String)> {
    let trimmed = url.trim();
    let idx = trimmed.find("github.com/")?;
    let after_github = &trimmed[idx + "github.com/".len()..];
    let parts: Vec<&str> = after_github
        .split('/')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();
    if parts.len() < 2 {
        return None;
    }
    let owner = parts[0].to_string();
    let mut repo = parts[1].to_string();
    if let Some(stripped) = repo.strip_suffix(".git") {
        repo = stripped.to_string();
    }
    if let Some(idx) = repo.find('?') {
        repo = repo[..idx].to_string();
    }
    if let Some(idx) = repo.find('#') {
        repo = repo[..idx].to_string();
    }
    if owner.is_empty() || repo.is_empty() {
        return None;
    }
    Some((owner, repo))
}

pub fn insert_listing_entry(existing_content: &str, entry: &str, category: &str) -> String {
    if existing_content.contains("github.com/Ivy-Interactive/Ivy-Tendril")
        || existing_content.contains("Ivy-Tendril")
    {
        return existing_content.to_string();
    }

    let trimmed_entry = entry.trim();
    let entry_line = if trimmed_entry.starts_with("- ") || trimmed_entry.starts_with("* ") {
        trimmed_entry.to_string()
    } else {
        format!("- {}", trimmed_entry)
    };

    let lines: Vec<&str> = existing_content.lines().collect();
    if lines.is_empty() {
        return entry_line;
    }

    let extract_sort_key = |line: &str| -> String {
        let trimmed = line.trim();
        let content = if let Some(stripped) = trimmed.strip_prefix("- ") {
            stripped
        } else if let Some(stripped) = trimmed.strip_prefix("* ") {
            stripped
        } else {
            trimmed
        };
        if let Some(start) = content.find('[') {
            if let Some(end) = content[start..].find(']') {
                return content[start + 1..start + end].to_lowercase();
            }
        }
        content.to_lowercase()
    };

    let entry_key = extract_sort_key(&entry_line);

    let is_matching_header = |line: &str| -> bool {
        let lower = line.to_lowercase();
        if !lower.starts_with('#') {
            return false;
        }
        let cat_lower = category.to_lowercase();
        if lower.contains(&cat_lower) {
            return true;
        }
        if cat_lower == "awesome repo" {
            lower.contains("ai agent")
                || lower.contains("coding assistant")
                || lower.contains("developer tool")
                || lower.contains("agent")
                || lower.contains("tools")
                || lower.contains("libraries")
        } else if cat_lower.contains("agent") {
            lower.contains("agent") || lower.contains("assistant") || lower.contains("tools")
        } else if cat_lower.contains("directory") {
            lower.contains("tool") || lower.contains("software") || lower.contains("platform")
        } else {
            lower.contains("tool") || lower.contains("software")
        }
    };

    let mut header_idx = None;
    for (i, line) in lines.iter().enumerate() {
        if is_matching_header(line) {
            header_idx = Some(i);
            break;
        }
    }

    if let Some(h_idx) = header_idx {
        let header_level = lines[h_idx].chars().take_while(|&c| c == '#').count();
        let mut section_end = lines.len();
        for (i, line_ref) in lines.iter().enumerate().skip(h_idx + 1) {
            let line = line_ref.trim();
            if line.starts_with('#') {
                let level = line.chars().take_while(|&c| c == '#').count();
                if level <= header_level {
                    section_end = i;
                    break;
                }
            }
        }

        let mut list_indices = Vec::new();
        for (i, line_ref) in lines.iter().enumerate().take(section_end).skip(h_idx + 1) {
            let trimmed = line_ref.trim();
            if trimmed.starts_with("- ") || trimmed.starts_with("* ") {
                list_indices.push(i);
            }
        }

        if !list_indices.is_empty() {
            let mut insert_at = None;
            for &idx in &list_indices {
                let existing_key = extract_sort_key(lines[idx]);
                if existing_key > entry_key {
                    insert_at = Some(idx);
                    break;
                }
            }
            let target_insert = insert_at.unwrap_or_else(|| list_indices.last().unwrap() + 1);
            let mut new_lines = lines.clone();
            new_lines.insert(target_insert, &entry_line);
            return new_lines.join("\n");
        } else {
            let mut new_lines = lines.clone();
            new_lines.insert(h_idx + 1, &entry_line);
            return new_lines.join("\n");
        }
    }

    let is_trailing_header = |line: &str| -> bool {
        let lower = line.to_lowercase();
        lower.starts_with('#')
            && (lower.contains("contribut")
                || lower.contains("license")
                || lower.contains("reference")
                || lower.contains("footnote")
                || lower.contains("acknowledg"))
    };

    for (i, line) in lines.iter().enumerate() {
        if is_trailing_header(line) {
            let mut new_lines = lines.clone();
            new_lines.insert(i, &entry_line);
            new_lines.insert(i + 1, "");
            return new_lines.join("\n");
        }
    }

    let trimmed = existing_content.trim_end();
    format!("{}\n\n{}\n", trimmed, entry_line)
}

#[derive(Clone)]
pub struct GitHubClient {
    client: reqwest::Client,
    base_url: String,
}

impl GitHubClient {
    pub fn new(token: &str) -> Result<Self, String> {
        Self::with_base_url(token, "https://api.github.com")
    }

    pub fn with_base_url(token: &str, base_url: &str) -> Result<Self, String> {
        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", token.trim()))
                .map_err(|e| e.to_string())?,
        );
        headers.insert(
            ACCEPT,
            HeaderValue::from_static("application/vnd.github+json"),
        );
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static("GrowthHack-UpstreamWorker/0.1.0"),
        );
        headers.insert(
            reqwest::header::HeaderName::from_static("x-github-api-version"),
            HeaderValue::from_static("2022-11-28"),
        );

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| e.to_string())?;

        Ok(Self {
            client,
            base_url: base_url.trim_end_matches('/').to_string(),
        })
    }

    pub async fn get_authenticated_user(&self) -> Result<GitHubUser, String> {
        let url = format!("{}/user", self.base_url);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GET /user failed with status {}: {}", status, body));
        }
        resp.json::<GitHubUser>().await.map_err(|e| e.to_string())
    }

    pub async fn get_repo_info(&self, owner: &str, repo: &str) -> Result<RepoInfo, String> {
        let url = format!("{}/repos/{}/{}", self.base_url, owner, repo);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GET /repos/{}/{} failed with status {}: {}", owner, repo, status, body));
        }
        resp.json::<RepoInfo>().await.map_err(|e| e.to_string())
    }

    pub async fn get_branch_sha(&self, owner: &str, repo: &str, branch: &str) -> Result<String, String> {
        let url = format!("{}/repos/{}/{}/git/ref/heads/{}", self.base_url, owner, repo, branch);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GET branch ref failed with status {}: {}", status, body));
        }
        let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        if let Some(sha) = val.get("object").and_then(|o| o.get("sha")).and_then(|s| s.as_str()) {
            return Ok(sha.to_string());
        }
        if let Some(sha) = val.get("sha").and_then(|s| s.as_str()) {
            return Ok(sha.to_string());
        }
        Err("Commit SHA not found in ref response".to_string())
    }

    pub async fn ensure_fork(&self, owner: &str, repo: &str) -> Result<String, String> {
        let user = self.get_authenticated_user().await?;
        let user_login = user.login;

        if user_login.eq_ignore_ascii_case(owner) {
            return Ok(user_login);
        }

        let fork_url = format!("{}/repos/{}/{}/forks", self.base_url, owner, repo);
        let resp = self.client.post(&fork_url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() && resp.status().as_u16() != 202 {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if !body.contains("already exists") {
                return Err(format!("POST /repos/{}/{}/forks failed ({}): {}", owner, repo, status, body));
            }
        }

        let check_url = format!("{}/repos/{}/{}", self.base_url, user_login, repo);
        let mut delay = Duration::from_millis(500);
        let total_timeout = Duration::from_secs(30);
        let start = std::time::Instant::now();

        while start.elapsed() < total_timeout {
            if let Ok(res) = self.client.get(&check_url).send().await {
                if res.status().is_success() {
                    return Ok(user_login);
                }
            }
            tokio::time::sleep(delay).await;
            delay = (delay * 2).min(Duration::from_secs(4));
        }

        Ok(user_login)
    }

    pub async fn create_branch(&self, user: &str, repo: &str, branch: &str, base_sha: &str) -> Result<(), String> {
        let url = format!("{}/repos/{}/{}/git/refs", self.base_url, user, repo);
        let body = serde_json::json!({
            "ref": format!("refs/heads/{}", branch),
            "sha": base_sha
        });
        let resp = self.client.post(&url).json(&body).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            if status.as_u16() != 422 {
                return Err(format!("POST /git/refs failed ({}): {}", status, text));
            }
        }
        Ok(())
    }

    pub async fn get_file_content(&self, owner: &str, repo: &str, path: &str, ref_name: &str) -> Result<(String, String), String> {
        let url = format!("{}/repos/{}/{}/contents/{}?ref={}", self.base_url, owner, repo, path, ref_name);
        let resp = self.client.get(&url).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(format!("GET file content failed ({}): {}", status, body));
        }
        let val: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
        let sha = val.get("sha").and_then(|s| s.as_str()).ok_or("Missing sha in content response")?.to_string();
        let encoded_content = val.get("content").and_then(|s| s.as_str()).ok_or("Missing content in response")?;
        let clean_content: String = encoded_content.chars().filter(|c| !c.is_whitespace()).collect();
        let decoded_bytes = BASE64_STANDARD.decode(clean_content).map_err(|e| format!("Base64 decode error: {}", e))?;
        let content_str = String::from_utf8(decoded_bytes).map_err(|e| format!("UTF-8 decode error: {}", e))?;
        Ok((content_str, sha))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn update_file(
        &self,
        user: &str,
        repo: &str,
        path: &str,
        branch: &str,
        message: &str,
        content: &str,
        sha: &str,
    ) -> Result<(), String> {
        let url = format!("{}/repos/{}/{}/contents/{}", self.base_url, user, repo, path);
        let encoded = BASE64_STANDARD.encode(content.as_bytes());
        let body = serde_json::json!({
            "message": message,
            "content": encoded,
            "sha": sha,
            "branch": branch
        });
        let resp = self.client.put(&url).json(&body).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("PUT /contents/{} failed ({}): {}", path, status, text));
        }
        Ok(())
    }

    pub async fn create_or_update_file(
        &self,
        user: &str,
        repo: &str,
        path: &str,
        branch: &str,
        message: &str,
        content: &str,
    ) -> Result<(), String> {
        let sha_opt = match self.get_file_content(user, repo, path, branch).await {
            Ok((_, sha)) => Some(sha),
            Err(_) => None,
        };

        let url = format!("{}/repos/{}/{}/contents/{}", self.base_url, user, repo, path);
        let encoded = BASE64_STANDARD.encode(content.as_bytes());
        let mut body = serde_json::json!({
            "message": message,
            "content": encoded,
            "branch": branch,
        });
        if let Some(sha) = sha_opt {
            body["sha"] = serde_json::json!(sha);
        }

        let resp = self.client.put(&url).json(&body).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("PUT /contents/{} failed ({}): {}", path, status, text));
        }
        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_pull_request(
        &self,
        owner: &str,
        repo: &str,
        head: &str,
        base: &str,
        title: &str,
        body: &str,
        draft: bool,
    ) -> Result<PullRequestResponse, String> {
        let url = format!("{}/repos/{}/{}/pulls", self.base_url, owner, repo);
        let payload = serde_json::json!({
            "title": title,
            "body": body,
            "head": head,
            "base": base,
            "maintainer_can_modify": true,
            "draft": draft
        });
        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| e.to_string())?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("POST /pulls failed ({}): {}", status, text));
        }
        resp.json::<PullRequestResponse>().await.map_err(|e| e.to_string())
    }
}

pub async fn get_github_status(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let token = ctx.get_github_token();
    let token = match token {
        Some(t) if !t.trim().is_empty() => t,
        _ => {
            return (
                StatusCode::OK,
                Json(GitHubStatusResponse {
                    configured: false,
                    username: None,
                    message: "GitHub token not configured. Set GITHUB_TOKEN or GITHUB_PAT environment variable.".to_string(),
                }),
            );
        }
    };

    match GitHubClient::new(&token) {
        Ok(client) => match client.get_authenticated_user().await {
            Ok(user) => (
                StatusCode::OK,
                Json(GitHubStatusResponse {
                    configured: true,
                    username: Some(user.login.clone()),
                    message: format!("Authenticated as GitHub user @{}", user.login),
                }),
            ),
            Err(e) => (
                StatusCode::OK,
                Json(GitHubStatusResponse {
                    configured: false,
                    username: None,
                    message: format!("GitHub authentication failed: {}", e),
                }),
            ),
        },
        Err(e) => (
            StatusCode::OK,
            Json(GitHubStatusResponse {
                configured: false,
                username: None,
                message: format!("Failed to initialize GitHub client: {}", e),
            }),
        ),
    }
}

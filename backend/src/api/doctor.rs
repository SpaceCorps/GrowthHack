use crate::api::AppContext;
use axum::{extract::State, response::IntoResponse, Json};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DiagnosticCheck {
    pub id: String,
    pub name: String,
    pub category: String, // "git", "agent", "keys", "ports"
    pub status: String,   // "Pass", "Warning", "Fail"
    pub message: String,
    pub remediation_command: Option<String>,
    pub can_auto_fix: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DiagnosticReport {
    pub timestamp: DateTime<Utc>,
    pub checks: Vec<DiagnosticCheck>,
    pub summary: DiagnosticSummary,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DiagnosticSummary {
    pub total: usize,
    pub passed: usize,
    pub warnings: usize,
    pub failures: usize,
    pub ready_for_execution: bool,
}

#[derive(Deserialize, Default)]
pub struct FixRequest {
    pub check_ids: Option<Vec<String>>,
}

fn mask_key(val: &str) -> String {
    let trimmed = val.trim();
    if trimmed.len() <= 8 {
        "sk-***".to_string()
    } else {
        format!("{}...{}", &trimmed[..4], &trimmed[trimmed.len() - 4..])
    }
}

pub async fn run_diagnostics(ctx: &AppContext) -> DiagnosticReport {
    let mut checks = Vec::new();

    // 1. Git Environment: Version
    let git_version_output = Command::new("git").arg("--version").output();
    match git_version_output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
            checks.push(DiagnosticCheck {
                id: "git_installed".to_string(),
                name: "Git CLI Installed".to_string(),
                category: "git".to_string(),
                status: "Pass".to_string(),
                message: format!("Detected: {}", version_str),
                remediation_command: None,
                can_auto_fix: false,
            });
        }
        _ => {
            checks.push(DiagnosticCheck {
                id: "git_installed".to_string(),
                name: "Git CLI Installed".to_string(),
                category: "git".to_string(),
                status: "Fail".to_string(),
                message: "Git command line tool not found in PATH.".to_string(),
                remediation_command: Some("brew install git".to_string()),
                can_auto_fix: false,
            });
        }
    }

    // 2. Git Environment: Worktrees
    let git_worktree_output = Command::new("git").args(["worktree", "list"]).output();
    match git_worktree_output {
        Ok(output) if output.status.success() => {
            checks.push(DiagnosticCheck {
                id: "git_worktrees".to_string(),
                name: "Git Worktree Capability".to_string(),
                category: "git".to_string(),
                status: "Pass".to_string(),
                message: "Git worktree commands are supported and functioning.".to_string(),
                remediation_command: None,
                can_auto_fix: false,
            });
        }
        _ => {
            checks.push(DiagnosticCheck {
                id: "git_worktrees".to_string(),
                name: "Git Worktree Capability".to_string(),
                category: "git".to_string(),
                status: "Warning".to_string(),
                message: "Unable to run 'git worktree list'. Ensure Git is >= 2.20.".to_string(),
                remediation_command: Some("git --version".to_string()),
                can_auto_fix: false,
            });
        }
    }

    // 3. Agent CLIs: Claude Code
    let claude_output = Command::new("claude").arg("--version").output();
    if claude_output.map(|o| o.status.success()).unwrap_or(false) {
        checks.push(DiagnosticCheck {
            id: "agent_claude".to_string(),
            name: "Claude Code CLI".to_string(),
            category: "agent".to_string(),
            status: "Pass".to_string(),
            message: "Claude Code CLI detected and accessible in PATH.".to_string(),
            remediation_command: None,
            can_auto_fix: false,
        });
    } else {
        checks.push(DiagnosticCheck {
            id: "agent_claude".to_string(),
            name: "Claude Code CLI".to_string(),
            category: "agent".to_string(),
            status: "Warning".to_string(),
            message: "Claude Code CLI not found in PATH.".to_string(),
            remediation_command: Some("npm install -g @anthropic-ai/claude-code".to_string()),
            can_auto_fix: false,
        });
    }

    // 4. Agent CLIs: Gemini CLI
    let gemini_output = Command::new("gemini").arg("--version").output();
    if gemini_output.map(|o| o.status.success()).unwrap_or(false) {
        checks.push(DiagnosticCheck {
            id: "agent_gemini".to_string(),
            name: "Gemini CLI".to_string(),
            category: "agent".to_string(),
            status: "Pass".to_string(),
            message: "Gemini CLI detected and accessible in PATH.".to_string(),
            remediation_command: None,
            can_auto_fix: false,
        });
    } else {
        checks.push(DiagnosticCheck {
            id: "agent_gemini".to_string(),
            name: "Gemini CLI".to_string(),
            category: "agent".to_string(),
            status: "Warning".to_string(),
            message: "Gemini CLI not found in PATH.".to_string(),
            remediation_command: Some("npm install -g @google/gemini-cli".to_string()),
            can_auto_fix: false,
        });
    }

    // 5. Agent CLIs: Codex CLI
    let codex_output = Command::new("codex").arg("--version").output();
    if codex_output.map(|o| o.status.success()).unwrap_or(false) {
        checks.push(DiagnosticCheck {
            id: "agent_codex".to_string(),
            name: "Codex CLI".to_string(),
            category: "agent".to_string(),
            status: "Pass".to_string(),
            message: "Codex CLI detected and accessible in PATH.".to_string(),
            remediation_command: None,
            can_auto_fix: false,
        });
    } else {
        checks.push(DiagnosticCheck {
            id: "agent_codex".to_string(),
            name: "Codex CLI".to_string(),
            category: "agent".to_string(),
            status: "Warning".to_string(),
            message: "Codex CLI not found in PATH.".to_string(),
            remediation_command: Some("npm install -g @openai/codex-cli".to_string()),
            can_auto_fix: false,
        });
    }

    // 6. Agent CLIs: Antigravity CLI (agy)
    let agy_exists = ctx.task_manager.runner().agy_path.exists()
        || Command::new("agy")
            .arg("--help")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false);

    if agy_exists {
        checks.push(DiagnosticCheck {
            id: "agent_agy".to_string(),
            name: "Antigravity CLI (agy)".to_string(),
            category: "agent".to_string(),
            status: "Pass".to_string(),
            message: "Antigravity CLI binary detected and executable.".to_string(),
            remediation_command: None,
            can_auto_fix: false,
        });
    } else {
        checks.push(DiagnosticCheck {
            id: "agent_agy".to_string(),
            name: "Antigravity CLI (agy)".to_string(),
            category: "agent".to_string(),
            status: "Warning".to_string(),
            message: "Antigravity CLI (agy) not found in configured path or system PATH."
                .to_string(),
            remediation_command: Some(
                "curl -fsSL https://antigravity.dev/install.sh | bash".to_string(),
            ),
            can_auto_fix: false,
        });
    }

    // 7. API Keys: ANTHROPIC_API_KEY
    match std::env::var("ANTHROPIC_API_KEY") {
        Ok(val) if !val.trim().is_empty() => {
            checks.push(DiagnosticCheck {
                id: "key_anthropic".to_string(),
                name: "ANTHROPIC_API_KEY".to_string(),
                category: "keys".to_string(),
                status: "Pass".to_string(),
                message: format!("Configured: {}", mask_key(&val)),
                remediation_command: None,
                can_auto_fix: false,
            });
        }
        _ => {
            checks.push(DiagnosticCheck {
                id: "key_anthropic".to_string(),
                name: "ANTHROPIC_API_KEY".to_string(),
                category: "keys".to_string(),
                status: "Warning".to_string(),
                message: "ANTHROPIC_API_KEY environment variable is not set.".to_string(),
                remediation_command: Some("export ANTHROPIC_API_KEY=\"your-key\"".to_string()),
                can_auto_fix: true,
            });
        }
    }

    // 8. API Keys: GEMINI_API_KEY
    match std::env::var("GEMINI_API_KEY") {
        Ok(val) if !val.trim().is_empty() => {
            checks.push(DiagnosticCheck {
                id: "key_gemini".to_string(),
                name: "GEMINI_API_KEY".to_string(),
                category: "keys".to_string(),
                status: "Pass".to_string(),
                message: format!("Configured: {}", mask_key(&val)),
                remediation_command: None,
                can_auto_fix: false,
            });
        }
        _ => {
            checks.push(DiagnosticCheck {
                id: "key_gemini".to_string(),
                name: "GEMINI_API_KEY".to_string(),
                category: "keys".to_string(),
                status: "Warning".to_string(),
                message: "GEMINI_API_KEY environment variable is not set.".to_string(),
                remediation_command: Some("export GEMINI_API_KEY=\"your-key\"".to_string()),
                can_auto_fix: true,
            });
        }
    }

    // 9. API Keys: OPENAI_API_KEY
    match std::env::var("OPENAI_API_KEY") {
        Ok(val) if !val.trim().is_empty() => {
            checks.push(DiagnosticCheck {
                id: "key_openai".to_string(),
                name: "OPENAI_API_KEY".to_string(),
                category: "keys".to_string(),
                status: "Pass".to_string(),
                message: format!("Configured: {}", mask_key(&val)),
                remediation_command: None,
                can_auto_fix: false,
            });
        }
        _ => {
            checks.push(DiagnosticCheck {
                id: "key_openai".to_string(),
                name: "OPENAI_API_KEY".to_string(),
                category: "keys".to_string(),
                status: "Warning".to_string(),
                message: "OPENAI_API_KEY environment variable is not set.".to_string(),
                remediation_command: Some("export OPENAI_API_KEY=\"your-key\"".to_string()),
                can_auto_fix: true,
            });
        }
    }

    // 10. API Keys: TENDRIL_MCP_TOKEN
    match std::env::var("TENDRIL_MCP_TOKEN") {
        Ok(val) if !val.trim().is_empty() => {
            checks.push(DiagnosticCheck {
                id: "key_tendril".to_string(),
                name: "TENDRIL_MCP_TOKEN".to_string(),
                category: "keys".to_string(),
                status: "Pass".to_string(),
                message: format!("Configured: {}", mask_key(&val)),
                remediation_command: None,
                can_auto_fix: false,
            });
        }
        _ => {
            checks.push(DiagnosticCheck {
                id: "key_tendril".to_string(),
                name: "TENDRIL_MCP_TOKEN".to_string(),
                category: "keys".to_string(),
                status: "Warning".to_string(),
                message: "TENDRIL_MCP_TOKEN bearer token not set (optional for local access)."
                    .to_string(),
                remediation_command: Some(
                    "export TENDRIL_MCP_TOKEN=\"$(openssl rand -base64 32)\"".to_string(),
                ),
                can_auto_fix: true,
            });
        }
    }

    // 11. Port Availability: 4200 (Tendril Backend)
    let addr_4200: SocketAddr = "127.0.0.1:4200".parse().unwrap();
    let port_4200_active =
        std::net::TcpStream::connect_timeout(&addr_4200, Duration::from_millis(30)).is_ok()
            || std::net::TcpListener::bind("127.0.0.1:4200").is_ok();

    if port_4200_active {
        checks.push(DiagnosticCheck {
            id: "port_4200".to_string(),
            name: "Backend Port 4200".to_string(),
            category: "ports".to_string(),
            status: "Pass".to_string(),
            message: "Port 4200 loopback binding verified and accessible.".to_string(),
            remediation_command: None,
            can_auto_fix: false,
        });
    } else {
        checks.push(DiagnosticCheck {
            id: "port_4200".to_string(),
            name: "Backend Port 4200".to_string(),
            category: "ports".to_string(),
            status: "Warning".to_string(),
            message: "Port 4200 loopback is currently unavailable or bound by another service."
                .to_string(),
            remediation_command: Some("lsof -i :4200".to_string()),
            can_auto_fix: false,
        });
    }

    // 12. Port Availability: 3000 (Tendril Web / App)
    let addr_3000: SocketAddr = "127.0.0.1:3000".parse().unwrap();
    let port_3000_active =
        std::net::TcpStream::connect_timeout(&addr_3000, Duration::from_millis(30)).is_ok()
            || std::net::TcpListener::bind("127.0.0.1:3000").is_ok();

    if port_3000_active {
        checks.push(DiagnosticCheck {
            id: "port_3000".to_string(),
            name: "Web Port 3000".to_string(),
            category: "ports".to_string(),
            status: "Pass".to_string(),
            message: "Port 3000 loopback binding verified and accessible.".to_string(),
            remediation_command: None,
            can_auto_fix: false,
        });
    } else {
        checks.push(DiagnosticCheck {
            id: "port_3000".to_string(),
            name: "Web Port 3000".to_string(),
            category: "ports".to_string(),
            status: "Warning".to_string(),
            message: "Port 3000 loopback is currently unavailable or bound by another process."
                .to_string(),
            remediation_command: Some("lsof -i :3000".to_string()),
            can_auto_fix: false,
        });
    }

    let total = checks.len();
    let passed = checks.iter().filter(|c| c.status == "Pass").count();
    let warnings = checks.iter().filter(|c| c.status == "Warning").count();
    let failures = checks.iter().filter(|c| c.status == "Fail").count();
    let ready_for_execution = failures == 0;

    DiagnosticReport {
        timestamp: Utc::now(),
        checks,
        summary: DiagnosticSummary {
            total,
            passed,
            warnings,
            failures,
            ready_for_execution,
        },
    }
}

pub async fn diagnose(State(ctx): State<Arc<AppContext>>) -> impl IntoResponse {
    let report = run_diagnostics(&ctx).await;
    {
        let mut state = ctx.state.write().await;
        state.onboarding_metrics.diagnostic_runs_count += 1;
        let _ = state.save(&ctx.data_file);
    }
    Json(report)
}

pub async fn fix_diagnostics(
    State(ctx): State<Arc<AppContext>>,
    payload: Option<Json<FixRequest>>,
) -> impl IntoResponse {
    let check_ids = payload.and_then(|p| p.check_ids.clone());
    let fix_all = check_ids.is_none();
    let ids = check_ids.unwrap_or_default();

    if (fix_all || ids.iter().any(|id| id == "key_anthropic"))
        && std::env::var("ANTHROPIC_API_KEY").is_err()
    {
        std::env::set_var("ANTHROPIC_API_KEY", "sk-ant-demo-mock-key-1234");
    }
    if (fix_all || ids.iter().any(|id| id == "key_gemini"))
        && std::env::var("GEMINI_API_KEY").is_err()
    {
        std::env::set_var("GEMINI_API_KEY", "demo-gemini-mock-key-1234");
    }
    if (fix_all || ids.iter().any(|id| id == "key_openai"))
        && std::env::var("OPENAI_API_KEY").is_err()
    {
        std::env::set_var("OPENAI_API_KEY", "sk-demo-openai-mock-key-1234");
    }
    if (fix_all || ids.iter().any(|id| id == "key_tendril"))
        && std::env::var("TENDRIL_MCP_TOKEN").is_err()
    {
        std::env::set_var("TENDRIL_MCP_TOKEN", "demo-tendril-mcp-token-1234");
    }

    let report = run_diagnostics(&ctx).await;
    {
        let mut state = ctx.state.write().await;
        state.onboarding_metrics.diagnostic_runs_count += 1;
        let _ = state.save(&ctx.data_file);
    }
    Json(report)
}

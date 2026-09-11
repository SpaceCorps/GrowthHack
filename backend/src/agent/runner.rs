use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::broadcast::Sender;
use uuid::Uuid;

pub const DEFAULT_PROCESS_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone, Debug)]
pub struct AgentRunner {
    pub agy_path: std::path::PathBuf,
    pub timeout: std::time::Duration,
}

impl AgentRunner {
    pub fn new(agy_path: std::path::PathBuf) -> Self {
        let timeout = std::env::var("AGY_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .map(std::time::Duration::from_secs)
            .unwrap_or(DEFAULT_PROCESS_TIMEOUT);
        Self { agy_path, timeout }
    }

    pub fn with_timeout(agy_path: std::path::PathBuf, timeout: std::time::Duration) -> Self {
        Self { agy_path, timeout }
    }

    pub async fn execute(&self, prompt: &str, tx: Sender<String>) -> Result<String, String> {
        let _ = tx.send("[SYSTEM] Initializing Antigravity agent runner...".to_string());
        let _ = tx.send(format!("[SYSTEM] Spawning: {:?}", self.agy_path));
        let _ = tx.send("[STAGE] Generating content with Antigravity engine...".to_string());
        let _ = tx.send(format!("[PROMPT] {}", prompt));

        let mut temp_file: Option<std::path::PathBuf> = None;
        let prompt_arg = if prompt.len() > 1024 {
            let temp_path = std::env::temp_dir()
                .join(format!("growthhack-prompt-{}.md", Uuid::new_v4().simple()));
            match tokio::fs::write(&temp_path, prompt).await {
                Ok(()) => {
                    let arg = format!("@{}", temp_path.to_string_lossy());
                    temp_file = Some(temp_path);
                    arg
                }
                Err(err) => {
                    let _ = tx.send(format!(
                        "[WARNING] Failed to write prompt to temp file: {}. Passing inline.",
                        err
                    ));
                    prompt.to_string()
                }
            }
        } else {
            prompt.to_string()
        };

        let mut cmd = Command::new(&self.agy_path);
        cmd.arg("--print")
            .arg("--dangerously-skip-permissions")
            .arg(&prompt_arg)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // On Windows, avoid opening a new console window if running as GUI
        #[cfg(windows)]
        {
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = match cmd.spawn() {
            Ok(child) => child,
            Err(err) => {
                if let Some(ref path) = temp_file {
                    let _ = tokio::fs::remove_file(path).await;
                }
                let err_msg = format!("Failed to spawn agy at {:?}: {}", self.agy_path, err);
                let _ = tx.send(format!("[ERROR] {}", err_msg));
                return Err(err_msg);
            }
        };

        let stdout = child.stdout.take();
        let stderr = child.stderr.take();

        let tx_out = tx.clone();
        let tx_err = tx.clone();

        // Spawn reader task for stdout
        let stdout_handle = tokio::spawn(async move {
            let mut out_acc = String::new();
            if let Some(stdout) = stdout {
                let mut reader = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = tx_out.send(line.clone());
                    out_acc.push_str(&line);
                    out_acc.push('\n');
                }
            }
            out_acc
        });

        // Spawn reader task for stderr
        let stderr_handle = tokio::spawn(async move {
            if let Some(stderr) = stderr {
                let mut reader = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = reader.next_line().await {
                    let _ = tx_err.send(format!("[STDERR] {}", line));
                }
            }
        });

        let status = match tokio::time::timeout(self.timeout, child.wait()).await {
            Ok(Ok(s)) => s,
            Ok(Err(e)) => {
                if let Some(ref path) = temp_file {
                    let _ = tokio::fs::remove_file(path).await;
                }
                let msg = format!("Process wait failed: {}", e);
                let _ = tx.send(format!("[ERROR] {}", msg));
                return Err(msg);
            }
            Err(_) => {
                let _ = child.start_kill();
                stdout_handle.abort();
                stderr_handle.abort();
                if let Some(ref path) = temp_file {
                    let _ = tokio::fs::remove_file(path).await;
                }
                let msg = format!(
                    "Antigravity agent process timed out after {:?}",
                    self.timeout
                );
                let _ = tx.send(format!("[ERROR] {}", msg));
                return Err(msg);
            }
        };

        let stdout_result = stdout_handle.await.unwrap_or_default();
        let _ = stderr_handle.await;

        if let Some(ref path) = temp_file {
            let _ = tokio::fs::remove_file(path).await;
        }

        if status.success() {
            let _ = tx.send("[DONE] Antigravity turn completed successfully.".to_string());
            Ok(stdout_result)
        } else {
            let err_msg = format!("Antigravity process exited with status: {}", status);
            let _ = tx.send(format!("[ERROR] {}", err_msg));
            if !stdout_result.is_empty() {
                Ok(stdout_result)
            } else {
                Err(err_msg)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_runner_default_and_custom_timeout() {
        let runner_custom = AgentRunner::with_timeout(
            std::path::PathBuf::from("agy"),
            std::time::Duration::from_secs(120),
        );
        assert_eq!(runner_custom.timeout, std::time::Duration::from_secs(120));
        assert_eq!(runner_custom.agy_path, std::path::PathBuf::from("agy"));

        assert_eq!(DEFAULT_PROCESS_TIMEOUT, std::time::Duration::from_secs(300));

        if std::env::var("AGY_TIMEOUT_SECS").is_err() {
            let runner_default = AgentRunner::new(std::path::PathBuf::from("agy"));
            assert_eq!(runner_default.timeout, DEFAULT_PROCESS_TIMEOUT);
        }
    }

    #[tokio::test]
    async fn test_agent_runner_timeout_kills_process_and_returns_error() {
        let temp_dir = std::env::temp_dir();
        #[cfg(unix)]
        let script_path = temp_dir.join(format!("slow_test_agy_{}.sh", Uuid::new_v4().simple()));
        #[cfg(windows)]
        let script_path = temp_dir.join(format!("slow_test_agy_{}.bat", Uuid::new_v4().simple()));

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::write(&script_path, "#!/bin/sh\nsleep 2\n").expect("write test script");
            let mut perms = std::fs::metadata(&script_path)
                .expect("metadata")
                .permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&script_path, perms).expect("set permissions");
        }

        #[cfg(windows)]
        {
            std::fs::write(&script_path, "@echo off\r\nping 127.0.0.1 -n 3 > nul\r\n")
                .expect("write test script");
        }

        let runner =
            AgentRunner::with_timeout(script_path.clone(), std::time::Duration::from_millis(50));
        let (tx, mut rx) = tokio::sync::broadcast::channel(32);

        let res = runner.execute("Test prompt for timeout", tx).await;

        let _ = std::fs::remove_file(&script_path);

        assert!(res.is_err(), "Expected timeout error, got {:?}", res);
        let err = res.unwrap_err();
        assert!(err.contains("timed out after 50ms"), "Error was: {}", err);

        let mut received_error = false;
        while let Ok(msg) = rx.try_recv() {
            if msg.contains("timed out after 50ms") && msg.contains("[ERROR]") {
                received_error = true;
                break;
            }
        }
        assert!(
            received_error,
            "Broadcast receiver should have received timeout [ERROR] event"
        );
    }

    #[test]
    fn test_create_no_window_constant() {
        assert_eq!(CREATE_NO_WINDOW, 0x08000000);
    }
}

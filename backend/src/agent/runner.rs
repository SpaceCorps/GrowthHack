use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::broadcast::Sender;

#[derive(Clone, Debug)]
pub struct AgentRunner {
    pub agy_path: std::path::PathBuf,
}

impl AgentRunner {
    pub fn new(agy_path: std::path::PathBuf) -> Self {
        Self { agy_path }
    }

    pub async fn execute(
        &self,
        prompt: &str,
        tx: Sender<String>,
    ) -> Result<String, String> {
        let _ = tx.send(format!("[SYSTEM] Spawning Antigravity agent: {:?}...", self.agy_path));
        let _ = tx.send(format!("[PROMPT] {}", prompt));

        let mut cmd = Command::new(&self.agy_path);
        cmd.arg("--print")
            .arg(prompt)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // On Windows, avoid opening a new console window if running as GUI
        #[cfg(windows)]
        {
            // standard execution
        }

        let mut child = match cmd.spawn() {
            Ok(child) => child,
            Err(err) => {
                let err_msg = format!("Failed to spawn agy.exe at {:?}: {}", self.agy_path, err);
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

        let status = match child.wait().await {
            Ok(s) => s,
            Err(e) => {
                let msg = format!("Process wait failed: {}", e);
                let _ = tx.send(format!("[ERROR] {}", msg));
                return Err(msg);
            }
        };

        let stdout_result = stdout_handle.await.unwrap_or_default();
        let _ = stderr_handle.await;

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

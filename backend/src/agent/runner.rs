use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::broadcast::Sender;
use uuid::Uuid;

pub const DEFAULT_PROCESS_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(300);
pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
struct JobObject {
    handle: windows_sys::Win32::Foundation::HANDLE,
}

#[cfg(windows)]
impl JobObject {
    fn new() -> Option<Self> {
        unsafe {
            let handle = windows_sys::Win32::System::JobObjects::CreateJobObjectW(
                std::ptr::null_mut(),
                std::ptr::null(),
            );
            if handle == 0 {
                return None;
            }

            let mut info: windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION =
                std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags =
                windows_sys::Win32::System::JobObjects::JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;

            let res = windows_sys::Win32::System::JobObjects::SetInformationJobObject(
                handle,
                windows_sys::Win32::System::JobObjects::JobObjectExtendedLimitInformation,
                &info as *const _ as *const std::ffi::c_void,
                std::mem::size_of::<
                    windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
                >() as u32,
            );

            if res == 0 {
                windows_sys::Win32::Foundation::CloseHandle(handle);
                None
            } else {
                Some(Self { handle })
            }
        }
    }

    fn assign_process(&self, process_handle: std::os::windows::io::RawHandle) -> bool {
        unsafe {
            windows_sys::Win32::System::JobObjects::AssignProcessToJobObject(
                self.handle,
                process_handle as windows_sys::Win32::Foundation::HANDLE,
            ) != 0
        }
    }

    fn terminate(&self, exit_code: u32) {
        unsafe {
            windows_sys::Win32::System::JobObjects::TerminateJobObject(self.handle, exit_code);
        }
    }
}

#[cfg(windows)]
impl Drop for JobObject {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.handle);
        }
    }
}

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
        self.execute_with_timeout(prompt, tx, None).await
    }

    pub async fn execute_with_timeout(
        &self,
        prompt: &str,
        tx: Sender<String>,
        timeout_override: Option<std::time::Duration>,
    ) -> Result<String, String> {
        let effective_timeout = timeout_override.unwrap_or(self.timeout);
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

        // On Unix, configure a new process group so child processes can be terminated as a group
        #[cfg(unix)]
        {
            cmd.process_group(0);
        }

        #[cfg(windows)]
        let job_object = JobObject::new();

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

        #[cfg(windows)]
        if let Some(ref job) = job_object {
            if let Some(raw_proc) = child.raw_handle() {
                if !job.assign_process(raw_proc) {
                    tracing::warn!(
                        "Failed to assign child process to Windows Job Object: {}",
                        std::io::Error::last_os_error()
                    );
                }
            }
        }

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

        let status = match tokio::time::timeout(effective_timeout, child.wait()).await {
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
                #[cfg(unix)]
                if let Some(pid) = child.id() {
                    unsafe {
                        // Passing negative PID (-pgid) to kill(2) delivers the signal to all processes in the process group
                        libc::kill(-(pid as libc::pid_t), libc::SIGKILL);
                    }
                }
                #[cfg(windows)]
                if let Some(ref job) = job_object {
                    job.terminate(1);
                }
                let _ = child.start_kill();
                stdout_handle.abort();
                stderr_handle.abort();
                if let Some(ref path) = temp_file {
                    let _ = tokio::fs::remove_file(path).await;
                }
                let msg = format!(
                    "Antigravity agent process timed out after {:?}",
                    effective_timeout
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

    #[tokio::test]
    async fn test_agent_runner_custom_timeout_override() {
        let temp_dir = std::env::temp_dir();
        #[cfg(unix)]
        let script_path = temp_dir.join(format!(
            "slow_test_agy_override_{}.sh",
            Uuid::new_v4().simple()
        ));
        #[cfg(windows)]
        let script_path = temp_dir.join(format!(
            "slow_test_agy_override_{}.bat",
            Uuid::new_v4().simple()
        ));

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

        // Runner has a large 300 second timeout by default
        let runner =
            AgentRunner::with_timeout(script_path.clone(), std::time::Duration::from_secs(300));
        let (tx, mut rx) = tokio::sync::broadcast::channel(32);

        // Override with 50ms timeout
        let res = runner
            .execute_with_timeout(
                "Test prompt with timeout override",
                tx,
                Some(std::time::Duration::from_millis(50)),
            )
            .await;

        let _ = std::fs::remove_file(&script_path);

        assert!(
            res.is_err(),
            "Expected timeout error with override, got {:?}",
            res
        );
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
            "Broadcast receiver should have received timeout [ERROR] event with override duration"
        );
    }

    #[tokio::test]
    #[cfg(unix)]
    async fn test_agent_runner_timeout_kills_descendant_process_group_on_unix() {
        use std::os::unix::fs::PermissionsExt;

        let temp_dir = std::env::temp_dir();
        let test_id = Uuid::new_v4().simple();
        let script_path = temp_dir.join(format!("slow_group_test_agy_{}.sh", test_id));
        let pid_file_path = temp_dir.join(format!("slow_group_test_pid_{}.txt", test_id));

        // Create an executable shell script that spawns a long-running background child process,
        // writes the child PID to a temporary file, and blocks on wait.
        let script_content = format!(
            "#!/bin/sh\nsh -c 'sleep 30' &\necho $! > \"{}\"\nwait\n",
            pid_file_path.display()
        );
        std::fs::write(&script_path, script_content).expect("write test script");
        let mut perms = std::fs::metadata(&script_path)
            .expect("metadata")
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&script_path, perms).expect("set permissions");

        // Execute AgentRunner with a short timeout (500ms)
        let runner =
            AgentRunner::with_timeout(script_path.clone(), std::time::Duration::from_millis(500));
        let (tx, _rx) = tokio::sync::broadcast::channel(32);

        let res = runner
            .execute("Test prompt for process group timeout", tx)
            .await;

        assert!(res.is_err(), "Expected timeout error, got {:?}", res);
        let err = res.unwrap_err();
        assert!(err.contains("timed out after 500ms"), "Error was: {}", err);

        // Read recorded child PID from temporary file
        assert!(
            pid_file_path.exists(),
            "PID file should have been written by test script"
        );
        let pid_str = std::fs::read_to_string(&pid_file_path).expect("read pid file");
        let child_pid: i32 = pid_str.trim().parse().expect("parse child PID");

        // Check that descendant background process is no longer running by calling libc::kill(child_pid, 0).
        // It returns -1 and sets errno to ESRCH when process does not exist.
        let mut process_dead = false;
        for _ in 0..20 {
            let kill_res = unsafe { libc::kill(child_pid as libc::pid_t, 0) };
            if kill_res == -1 {
                let last_err = std::io::Error::last_os_error();
                if last_err.raw_os_error() == Some(libc::ESRCH) {
                    process_dead = true;
                    break;
                }
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }

        // Clean up temporary test files
        let _ = std::fs::remove_file(&script_path);
        let _ = std::fs::remove_file(&pid_file_path);

        assert!(
            process_dead,
            "Descendant process (PID {}) should have been killed by process group SIGKILL",
            child_pid
        );
    }

    #[tokio::test]
    #[cfg(windows)]
    async fn test_agent_runner_timeout_kills_descendant_job_object_on_windows() {
        use windows_sys::Win32::Foundation::CloseHandle;
        use windows_sys::Win32::System::Threading::{
            GetExitCodeProcess, OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
        };

        let temp_dir = std::env::temp_dir();
        let test_id = Uuid::new_v4().simple();
        let script_path = temp_dir.join(format!("slow_job_test_agy_{}.bat", test_id));
        let pid_file_path = temp_dir.join(format!("slow_job_test_pid_{}.txt", test_id));

        // Create a temporary batch script (.bat) that spawns a background child process using PowerShell,
        // writes the child PID to a temporary file, and blocks on wait.
        let script_content = format!(
            "@echo off\r\npowershell -NoProfile -Command \"$p = Start-Process ping -ArgumentList '127.0.0.1 -n 30' -PassThru; Set-Content -Path '{}' -Value $p.Id; Wait-Process -Id $p.Id\"\r\n",
            pid_file_path.display()
        );
        std::fs::write(&script_path, script_content).expect("write test script");

        // Timeout must be long enough that the script writes its child PID under heavy
        // test concurrency (PowerShell cold start is the dominant cost), yet far below
        // the 30s the spawned child runs for, so the kill path is still what is exercised.
        let timeout = std::time::Duration::from_millis(5000);
        let runner = AgentRunner::with_timeout(script_path.clone(), timeout);
        let (tx, _rx) = tokio::sync::broadcast::channel(32);

        let res = runner
            .execute("Test prompt for job object timeout", tx)
            .await;

        assert!(res.is_err(), "Expected timeout error, got {:?}", res);
        let err = res.unwrap_err();
        let expected = format!("timed out after {:?}", timeout);
        assert!(err.contains(&expected), "Error was: {}", err);

        // The PID file is written by a separate process; allow a bounded settling window
        // rather than asserting on a single instantaneous check.
        let mut pid_file_written = false;
        for _ in 0..40 {
            if pid_file_path.exists() {
                pid_file_written = true;
                break;
            }
            tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        }

        // Read recorded child PID from the temporary file while it still exists (cleanup below
        // removes it), only if the poll loop above actually observed it.
        let child_pid: Option<u32> = if pid_file_written {
            std::fs::read_to_string(&pid_file_path)
                .ok()
                .and_then(|s| s.trim().parse().ok())
        } else {
            None
        };

        // Check that descendant background process is no longer running. This only needs
        // child_pid, not the files, so it can run before cleanup.
        let mut process_dead = false;
        if let Some(child_pid) = child_pid {
            for _ in 0..20 {
                unsafe {
                    let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, child_pid);
                    if handle == 0 {
                        process_dead = true;
                        break;
                    }
                    let mut exit_code: u32 = 0;
                    let res = GetExitCodeProcess(handle, &mut exit_code);
                    CloseHandle(handle);
                    if res != 0 && exit_code != 259 {
                        process_dead = true;
                        break;
                    }
                }
                tokio::time::sleep(std::time::Duration::from_millis(50)).await;
            }
        }

        // Clean up temporary test files ahead of the assertions below, so a flake doesn't
        // leak them into %TEMP%.
        let _ = std::fs::remove_file(&script_path);
        let _ = std::fs::remove_file(&pid_file_path);

        assert!(
            pid_file_written,
            "PID file should have been written by test script within 2s"
        );
        let child_pid = child_pid.expect("parse child PID");

        assert!(
            process_dead,
            "Descendant process (PID {}) should have been killed by Job Object termination",
            child_pid
        );
    }

    #[test]
    #[cfg(windows)]
    fn test_job_object_assign_process_invalid_handle_returns_false() {
        let job = JobObject::new();
        assert!(job.is_some(), "Failed to create JobObject");
        let job = job.unwrap();
        let invalid_handle = std::ptr::null_mut();
        let result = job.assign_process(invalid_handle);
        assert!(
            !result,
            "assign_process should return false for invalid handle"
        );
    }
}

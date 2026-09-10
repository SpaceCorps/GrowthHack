use std::net::{IpAddr, Ipv4Addr};
use std::path::{Path, PathBuf};

#[derive(Clone, Debug)]
pub struct Config {
    pub host: IpAddr,
    pub port: u16,
    pub agy_path: PathBuf,
    pub data_file: PathBuf,
    pub ivy_web_content_path: PathBuf,
    pub ivy_web_images_path: PathBuf,
    pub devto_api_key: Option<String>,
    pub hashnode_api_key: Option<String>,
    pub hashnode_publication_id: Option<String>,
}

pub fn get_user_home() -> Option<PathBuf> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from)
}

pub fn probe_existing_path(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates.iter().find(|p| p.exists()).cloned()
}

pub fn derive_images_path_from_content(content_path: &Path) -> Option<PathBuf> {
    if content_path.to_string_lossy().contains("ivy-web") {
        content_path
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("public/site/images"))
    } else {
        None
    }
}

pub fn resolve_ivy_web_content_path(env_var: Option<String>, home: Option<&Path>) -> PathBuf {
    if let Some(custom) = env_var {
        return PathBuf::from(custom);
    }

    let mut candidates = vec![
        PathBuf::from("../ivy-web/apps/web-new/content/posts"),
        PathBuf::from("../../ivy-web/apps/web-new/content/posts"),
        PathBuf::from("ivy-web/apps/web-new/content/posts"),
    ];

    if let Some(home_dir) = home {
        candidates.push(home_dir.join("git/ivy-web/apps/web-new/content/posts"));
    }

    probe_existing_path(&candidates).unwrap_or_else(|| PathBuf::from("./content/posts"))
}

pub fn resolve_ivy_web_images_path(
    env_var: Option<String>,
    content_path: &Path,
    home: Option<&Path>,
) -> PathBuf {
    if let Some(custom) = env_var {
        return PathBuf::from(custom);
    }

    if let Some(derived) = derive_images_path_from_content(content_path) {
        if derived.exists() {
            return derived;
        }
    }

    let mut candidates = vec![
        PathBuf::from("../ivy-web/apps/web-new/public/site/images"),
        PathBuf::from("../../ivy-web/apps/web-new/public/site/images"),
        PathBuf::from("ivy-web/apps/web-new/public/site/images"),
    ];

    if let Some(home_dir) = home {
        candidates.push(home_dir.join("git/ivy-web/apps/web-new/public/site/images"));
    }

    probe_existing_path(&candidates).unwrap_or_else(|| PathBuf::from("./public/site/images"))
}

impl Config {
    pub fn load() -> Self {
        let host = std::env::var("HOST")
            .ok()
            .and_then(|h| h.trim().parse::<IpAddr>().ok())
            .unwrap_or_else(|| IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));

        let port = std::env::var("PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(4200);

        // Detect agy executable path
        let agy_path = if let Ok(custom) = std::env::var("AGY_PATH") {
            PathBuf::from(custom)
        } else {
            let default_win = PathBuf::from(r"C:\Users\pavel\AppData\Local\agy\bin\agy.exe");
            if default_win.exists() {
                default_win
            } else {
                PathBuf::from("agy")
            }
        };

        let data_file = std::env::var("DATA_FILE")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("growth_data.json"));

        let home = get_user_home();

        let ivy_web_content_path = resolve_ivy_web_content_path(
            std::env::var("IVY_WEB_CONTENT_PATH").ok(),
            home.as_deref(),
        );

        let ivy_web_images_path = resolve_ivy_web_images_path(
            std::env::var("IVY_WEB_IMAGES_PATH").ok(),
            &ivy_web_content_path,
            home.as_deref(),
        );

        let devto_api_key = std::env::var("DEVTO_API_KEY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let hashnode_api_key = std::env::var("HASHNODE_API_KEY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        let hashnode_publication_id = std::env::var("HASHNODE_PUBLICATION_ID")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        Self {
            host,
            port,
            agy_path,
            data_file,
            ivy_web_content_path,
            ivy_web_images_path,
            devto_api_key,
            hashnode_api_key,
            hashnode_publication_id,
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self::load()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn test_ivy_web_content_path_custom_env() {
        let custom = Some("/custom/path/to/posts".to_string());
        let resolved = resolve_ivy_web_content_path(custom, None);
        assert_eq!(resolved, PathBuf::from("/custom/path/to/posts"));
    }

    #[test]
    fn test_ivy_web_images_path_custom_env() {
        let custom = Some("/custom/path/to/images".to_string());
        let content_path = PathBuf::from("/some/content/path");
        let resolved = resolve_ivy_web_images_path(custom, &content_path, None);
        assert_eq!(resolved, PathBuf::from("/custom/path/to/images"));
    }

    #[test]
    fn test_ivy_web_paths_fallback_when_unset() {
        let dummy_home = PathBuf::from("/nonexistent/dummy/home/path_for_growthhack_tests");
        let content_resolved = resolve_ivy_web_content_path(None, Some(&dummy_home));
        assert_eq!(content_resolved, PathBuf::from("./content/posts"));

        let images_resolved =
            resolve_ivy_web_images_path(None, &content_resolved, Some(&dummy_home));
        assert_eq!(images_resolved, PathBuf::from("./public/site/images"));
    }

    #[test]
    fn test_ivy_web_images_path_derived_from_content_path() {
        let content_path = PathBuf::from("/workspace/ivy-web/apps/web-new/content/posts");
        let derived = derive_images_path_from_content(&content_path);
        assert_eq!(
            derived,
            Some(PathBuf::from(
                "/workspace/ivy-web/apps/web-new/public/site/images"
            ))
        );

        let temp_dir =
            std::env::temp_dir().join(format!("test_ivy_derived_{}", uuid::Uuid::new_v4()));
        let test_content = temp_dir.join("ivy-web/apps/web-new/content/posts");
        let test_images = temp_dir.join("ivy-web/apps/web-new/public/site/images");
        let _ = std::fs::create_dir_all(&test_content);
        let _ = std::fs::create_dir_all(&test_images);

        let resolved = resolve_ivy_web_images_path(None, &test_content, None);
        assert_eq!(resolved, test_images);

        let _ = std::fs::remove_dir_all(&temp_dir);
    }

    #[test]
    fn test_host_default_when_unset() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::remove_var("HOST");
        let config = Config::load();
        assert_eq!(config.host, IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    }

    #[test]
    fn test_host_custom_ipv4() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("HOST", "0.0.0.0");
        let config = Config::load();
        std::env::remove_var("HOST");
        assert_eq!(config.host, IpAddr::V4(Ipv4Addr::new(0, 0, 0, 0)));
    }

    #[test]
    fn test_host_invalid_fallback() {
        let _guard = ENV_LOCK.lock().unwrap();
        std::env::set_var("HOST", "invalid-ip-address");
        let config = Config::load();
        std::env::remove_var("HOST");
        assert_eq!(config.host, IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    }

    #[test]
    fn test_config_default() {
        let _guard = ENV_LOCK.lock().unwrap();
        let config = Config::default();
        assert_eq!(config.port, 4200);
        assert_eq!(config.host, IpAddr::V4(Ipv4Addr::new(127, 0, 0, 1)));
    }
}

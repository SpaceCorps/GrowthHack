use std::net::{IpAddr, Ipv4Addr};
use std::path::PathBuf;

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

        let ivy_web_content_path = if let Ok(custom) = std::env::var("IVY_WEB_CONTENT_PATH") {
            PathBuf::from(custom)
        } else {
            let default_ivy =
                PathBuf::from("/Users/rorychatt/git/ivy-web/apps/web-new/content/posts");
            if default_ivy.exists() {
                default_ivy
            } else {
                PathBuf::from("./content/posts")
            }
        };

        let ivy_web_images_path = if let Ok(custom) = std::env::var("IVY_WEB_IMAGES_PATH") {
            PathBuf::from(custom)
        } else {
            let default_images =
                PathBuf::from("/Users/rorychatt/git/ivy-web/apps/web-new/public/site/images");
            if default_images.exists() {
                default_images
            } else if ivy_web_content_path.to_string_lossy().contains("ivy-web") {
                let derived = ivy_web_content_path
                    .parent()
                    .and_then(|p| p.parent())
                    .map(|p| p.join("public/site/images"));
                if let Some(derived_path) = derived {
                    if derived_path.exists()
                        || derived_path
                            .parent()
                            .and_then(|p| p.parent())
                            .map(|p| p.exists())
                            .unwrap_or(false)
                    {
                        derived_path
                    } else {
                        PathBuf::from("./public/site/images")
                    }
                } else {
                    PathBuf::from("./public/site/images")
                }
            } else {
                PathBuf::from("./public/site/images")
            }
        };

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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

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
}

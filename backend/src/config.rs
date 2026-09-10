use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct Config {
    pub port: u16,
    pub agy_path: PathBuf,
    pub data_file: PathBuf,
    pub ivy_web_content_path: PathBuf,
}

impl Config {
    pub fn load() -> Self {
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
            let default_ivy = PathBuf::from("/Users/rorychatt/git/ivy-web/apps/web-new/content/posts");
            if default_ivy.exists() {
                default_ivy
            } else {
                PathBuf::from("./content/posts")
            }
        };

        Self {
            port,
            agy_path,
            data_file,
            ivy_web_content_path,
        }
    }
}

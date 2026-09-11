use growthhack_backend::agent::{AgentRunner, TaskManager};
use growthhack_backend::api::AppContext;
use growthhack_backend::db::GrowthState;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

#[allow(dead_code)]
pub fn create_test_context_with_file() -> (Arc<AppContext>, PathBuf) {
    let temp_dir = std::env::temp_dir();
    let file_id = uuid::Uuid::new_v4().simple().to_string();
    let data_file = temp_dir.join(format!("test_growth_data_{}.json", file_id));

    let state = GrowthState::seed_default();
    let _ = state.save(&data_file);

    let state_arc = Arc::new(RwLock::new(state));
    let runner = AgentRunner::new(PathBuf::from("agy"));
    let task_manager = TaskManager::new(runner);

    let ctx = Arc::new(AppContext {
        state: state_arc,
        task_manager,
        data_file: data_file.clone(),
        ivy_web_content_path: temp_dir.clone(),
        ivy_web_images_path: temp_dir,
        config: growthhack_backend::config::Config::load(),
    });

    (ctx, data_file)
}

#[allow(dead_code)]
pub fn create_test_context() -> Arc<AppContext> {
    create_test_context_with_file().0
}

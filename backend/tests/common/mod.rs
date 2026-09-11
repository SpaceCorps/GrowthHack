use growthhack_backend::api::AppContext;
use std::path::PathBuf;
use std::sync::Arc;

#[allow(dead_code)]
pub fn create_test_context_with_file() -> (Arc<AppContext>, PathBuf) {
    AppContext::new_test_context()
}

#[allow(dead_code)]
pub fn create_test_context() -> Arc<AppContext> {
    create_test_context_with_file().0
}

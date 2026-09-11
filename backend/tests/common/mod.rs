use growthhack_backend::api::{AppContext, TestContextGuard};
use std::sync::Arc;

#[allow(dead_code)]
pub fn create_test_context_with_file() -> (Arc<AppContext>, std::path::PathBuf) {
    let guard = AppContext::new_test_context();
    let ctx = guard.ctx();
    let data_file = guard.data_file.clone();
    std::mem::forget(guard);
    (ctx, data_file)
}

#[allow(dead_code)]
pub fn create_test_context() -> TestContextGuard {
    AppContext::new_test_context()
}

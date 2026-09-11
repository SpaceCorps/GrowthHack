use growthhack_backend::api::{AppContext, TestContextGuard};

#[allow(dead_code)]
pub fn create_test_context_with_file() -> (std::sync::Arc<AppContext>, std::path::PathBuf) {
    let guard = AppContext::new_test_context();
    let ctx = guard.ctx();
    let file = guard.data_file.clone();
    std::mem::forget(guard);
    (ctx, file)
}

#[allow(dead_code)]
pub fn create_test_context() -> TestContextGuard {
    AppContext::new_test_context()
}

use growthhack_backend::api::{AppContext, TestContextGuard};
use std::path::PathBuf;
use std::sync::Arc;

#[allow(dead_code)]
pub fn create_test_context_with_file() -> (Arc<AppContext>, PathBuf) {
    let guard = AppContext::new_test_context();
    let ctx = guard.ctx.clone();
    let file = guard.data_file.clone();
    std::mem::forget(guard);
    (ctx, file)
}

#[allow(dead_code)]
pub fn create_test_context() -> TestContextGuard {
    AppContext::new_test_context()
}

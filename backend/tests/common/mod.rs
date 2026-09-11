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

#[allow(dead_code)]
pub fn create_test_context_with_token(token: Option<String>) -> TestContextGuard {
    let mut ctx = AppContext::default();
    ctx.config.github_token = token;
    let data_file = ctx.data_file.clone();
    if let Ok(state) = ctx.state.try_read() {
        let _ = state.save(&data_file);
    }
    TestContextGuard::new(std::sync::Arc::new(ctx), data_file)
}

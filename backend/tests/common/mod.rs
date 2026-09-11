use growthhack_backend::api::{AppContext, TestContextGuard};

#[allow(dead_code)]
pub fn create_test_context_with_file() -> TestContextGuard {
    AppContext::new_test_context()
}

#[allow(dead_code)]
pub fn create_test_context() -> TestContextGuard {
    AppContext::new_test_context()
}

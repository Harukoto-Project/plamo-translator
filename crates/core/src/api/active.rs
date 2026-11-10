//! 実行中のチャットリクエストの管理(中断用)。

use std::collections::HashMap;
use std::sync::Mutex;

use tokio_util::sync::CancellationToken;

/// `request_id` から中断用のトークンを引く表。
#[derive(Debug, Default)]
pub struct ActiveRequests {
    tokens: Mutex<HashMap<String, CancellationToken>>,
}

/// 実行中の印。破棄すると表から外れる。
#[derive(Debug)]
pub struct ActiveGuard<'a> {
    registry: &'a ActiveRequests,
    id: String,
    token: CancellationToken,
}

impl ActiveRequests {
    /// リクエストを登録する。
    pub fn register(&self, id: &str) -> ActiveGuard<'_> {
        let token = CancellationToken::new();
        self.lock().insert(id.to_owned(), token.clone());
        ActiveGuard {
            registry: self,
            id: id.to_owned(),
            token,
        }
    }

    /// リクエストを中断する。実行中のものがあれば `true`。
    pub fn cancel(&self, id: &str) -> bool {
        match self.lock().get(id) {
            Some(token) => {
                token.cancel();
                true
            }
            None => false,
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, CancellationToken>> {
        // ロック中にpanicしても、表の中身は壊れないので続行してよい
        self.tokens
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
    }
}

impl ActiveGuard<'_> {
    pub fn token(&self) -> &CancellationToken {
        &self.token
    }
}

impl Drop for ActiveGuard<'_> {
    fn drop(&mut self) {
        self.registry.lock().remove(&self.id);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancel_triggers_the_registered_token() {
        let active = ActiveRequests::default();
        let guard = active.register("a");
        assert!(!guard.token().is_cancelled());

        assert!(active.cancel("a"));

        assert!(guard.token().is_cancelled());
    }

    #[test]
    fn cancelling_an_unknown_request_is_harmless() {
        assert!(!ActiveRequests::default().cancel("nope"));
    }

    #[test]
    fn dropping_the_guard_unregisters_the_request() {
        let active = ActiveRequests::default();
        drop(active.register("a"));

        assert!(!active.cancel("a"));
    }

    #[test]
    fn cancelling_one_request_leaves_the_others_running() {
        let active = ActiveRequests::default();
        let a = active.register("a");
        let b = active.register("b");

        active.cancel("a");

        assert!(a.token().is_cancelled());
        assert!(!b.token().is_cancelled());
    }
}

//! 翻訳のコマンド。

use plamo_translator_core::error::AppError;
use plamo_translator_core::translate::{self, TranslateEvent, TranslateJob, TranslateRequest};
use tauri::State;
use tauri::ipc::Channel;

use crate::state::{AppState, blocking};

/// 翻訳を始め、完了・中断・失敗まで `on_event` にイベントを流す。
///
/// 失敗(接続できない・サーバーのエラー・設定の不備など)も、最後の `Error` イベントで伝える。
/// このコマンド自体は、イベントを流し終えてから `Ok` を返す。
#[tauri::command]
#[specta::specta]
pub async fn translate_start(
    state: State<'_, AppState>,
    request: TranslateRequest,
    on_event: Channel<TranslateEvent>,
) -> Result<(), AppError> {
    // 受け手(画面)が閉じていたら、送信の失敗は無視してよい
    let emit = |event: TranslateEvent| {
        let _ = on_event.send(event);
    };

    // 使用中のプロファイルと生成の設定は、リクエストのたびに読む(設定の変更がすぐ反映される)
    let profiles = state.profiles.clone();
    let loaded = blocking(move || profiles.active_connection()).await;

    match loaded {
        Ok(active) => {
            let job = TranslateJob {
                request_id: &request.request_id,
                source: request.source_lang,
                target: request.target_lang,
                text: &request.text,
                max_tokens: active.max_tokens,
                chunk_budget: active.chunk_budget,
            };
            translate::run(&state.api, &active.connection, job, emit).await;
        }
        Err(error) => emit(TranslateEvent::Error { error }),
    }
    Ok(())
}

/// 実行中の翻訳を中断する。完了済み・存在しないIDでも何も起きない。
#[tauri::command]
#[specta::specta]
pub fn translate_cancel(state: State<'_, AppState>, request_id: String) {
    state.api.cancel(&request_id);
}

import { Channel } from "@tauri-apps/api/core";
import { unwrap } from "@/services/ipc";
import {
  commands,
  type TranslateEvent,
  type TranslateRequest,
} from "@/types/bindings";

/**
 * Rust に翻訳を頼む。完了・中断・失敗まで、`onEvent` にイベントが届く。
 * Rust が最後のイベント(`done` か `error`)を流し終えると、返した Promise が解決する。
 */
export function startTranslation(
  request: TranslateRequest,
  onEvent: (event: TranslateEvent) => void,
): Promise<void> {
  const channel = new Channel<TranslateEvent>();
  channel.onmessage = onEvent;
  return unwrap(commands.translateStart(request, channel)).then(
    () => undefined,
  );
}

/** 実行中の翻訳を中断する。 */
export function cancelTranslation(requestId: string): Promise<void> {
  return commands.translateCancel(requestId);
}

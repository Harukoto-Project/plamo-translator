import type {
  AppError,
  ReplyStats,
  TranslateEvent,
  TranslateWarning,
} from "@/types/bindings";

/** 翻訳の進み具合。 */
export type TranslateStatus =
  /** まだ翻訳していない */
  | "idle"
  | "running"
  /** 最後まで翻訳した */
  | "done"
  /** 利用者が止めた(それまでの訳文は残る) */
  | "stopped"
  /** 失敗した(それまでの訳文は残る) */
  | "error";

export interface TranslateState {
  status: TranslateStatus;
  /** 訳文(届いた分だけ) */
  text: string;
  warnings: TranslateWarning[];
  stats: ReplyStats | null;
  error: AppError | null;
  /** 利用者が停止を押したか。完了のイベントが来たとき、「完了」と「停止」を見分ける */
  stopRequested: boolean;
}

export const initialTranslateState: TranslateState = {
  status: "idle",
  text: "",
  warnings: [],
  stats: null,
  error: null,
  stopRequested: false,
};

export type TranslateAction =
  | { type: "start" }
  | { type: "stop" }
  /** 訳文などを消して、最初の状態に戻す(実行中は何もしない) */
  | { type: "reset" }
  | { type: "event"; event: TranslateEvent }
  /** イベントを待たずに失敗した(IPC の呼び出し自体が失敗した) */
  | { type: "fail"; error: AppError };

/** 翻訳の状態遷移。実行中でないときに届いたイベントは無視する。 */
export function translateReducer(
  state: TranslateState,
  action: TranslateAction,
): TranslateState {
  switch (action.type) {
    case "start":
      return { ...initialTranslateState, status: "running" };
    case "stop":
      return state.status === "running"
        ? { ...state, stopRequested: true }
        : state;
    case "reset":
      return state.status === "running" ? state : initialTranslateState;
    case "fail":
      return state.status === "running"
        ? { ...state, status: "error", error: action.error }
        : state;
    case "event":
      return state.status === "running"
        ? applyEvent(state, action.event)
        : state;
  }
}

function applyEvent(
  state: TranslateState,
  event: TranslateEvent,
): TranslateState {
  switch (event.type) {
    case "warning":
      return state.warnings.includes(event.warning)
        ? state
        : { ...state, warnings: [...state.warnings, event.warning] };
    case "delta":
      return { ...state, text: state.text + event.text };
    case "stats":
      return { ...state, stats: event.stats };
    case "done":
      return { ...state, status: state.stopRequested ? "stopped" : "done" };
    case "error":
      return { ...state, status: "error", error: event.error };
  }
}

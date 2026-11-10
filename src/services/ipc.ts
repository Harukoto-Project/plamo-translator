import type { AppError } from "@/types/bindings";

/** Rust のコマンドが返す `Result` を、成功なら値、失敗なら例外にして取り出す。 */
type CommandResult<T> =
  | { status: "ok"; data: T }
  | { status: "error"; error: AppError };

/** Rust の `AppError`(種別と値)を例外にしたもの。表示用の文言は `lib/app-error.ts` で作る。 */
export class AppCommandError extends Error {
  readonly error: AppError;

  constructor(error: AppError) {
    super(error.kind);
    this.name = "AppCommandError";
    this.error = error;
  }
}

export async function unwrap<T>(result: Promise<CommandResult<T>>): Promise<T> {
  const settled = await result;
  if (settled.status === "error") {
    throw new AppCommandError(settled.error);
  }
  return settled.data;
}

/** 例外を `AppError` にする。Rust 以外から来た想定外の例外は、内部エラーとして扱う。 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppCommandError) {
    return error.error;
  }
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return { kind: "internal", detail };
}

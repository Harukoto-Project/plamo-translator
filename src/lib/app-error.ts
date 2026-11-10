import type { TFunction } from "i18next";
import type { AppError } from "@/types/bindings";

/**
 * Rust が返したエラー(種別と値)を、画面に出す文言にする。
 * 文言は `i18n/locales` にあり、種別を足すと、ここの `switch` が型エラーになって気づける。
 */
export function describeAppError(error: AppError, t: TFunction): string {
  switch (error.kind) {
    case "connectionFailed":
      return t("errors.connectionFailed", { url: error.url });
    case "invalidUrl":
      return t(`errors.invalidUrl.${error.reason}`);
    case "timeout":
      return t("errors.timeout");
    case "http":
      return error.status === null
        ? t("errors.http", { detail: error.detail })
        : t("errors.httpWithStatus", {
            status: error.status,
            detail: error.detail,
          });
    case "contextLengthExceeded":
      return t("errors.contextLengthExceeded", { detail: error.detail });
    case "invalidResponse":
      return t("errors.invalidResponse", { detail: error.detail });
    case "emptyText":
      return t("errors.emptyText");
    case "invalidMaxTokens":
      return t("errors.invalidMaxTokens");
    case "settingsReadFailed":
      return t("errors.settingsReadFailed", { detail: error.detail });
    case "settingsWriteFailed":
      return t("errors.settingsWriteFailed", { detail: error.detail });
    case "settingsVersionUnsupported":
      return t("errors.settingsVersionUnsupported", {
        version: error.version,
      });
    case "secret":
      return t("errors.secret", { detail: error.detail });
    case "internal":
      return t("errors.internal", { detail: error.detail });
    default:
      return assertNever(error);
  }
}

function assertNever(value: never): never {
  throw new Error(`未対応のエラー種別: ${JSON.stringify(value)}`);
}

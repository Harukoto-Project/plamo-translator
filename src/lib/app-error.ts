import type { TFunction } from "i18next";
import { formatByteSize } from "@/lib/format-byte-size";
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
    case "invalidChunkBudget":
      return t("errors.invalidChunkBudget");
    case "invalidProfileName":
      return t(`errors.invalidProfileName.${error.reason}`);
    case "profileNotFound":
      return t("errors.profileNotFound");
    case "duplicateProfile":
      return t("errors.duplicateProfile");
    case "lastProfile":
      return t("errors.lastProfile");
    case "invalidHistoryId":
      return t("errors.invalidHistoryId");
    case "historyNotFound":
      return t("errors.historyNotFound");
    case "historyVersionUnsupported":
      return t("errors.historyVersionUnsupported", { version: error.version });
    case "historyBroken":
      return t("errors.historyBroken");
    case "historyReadFailed":
      return t("errors.historyReadFailed", { detail: error.detail });
    case "historyWriteFailed":
      return t("errors.historyWriteFailed", { detail: error.detail });
    case "historyDeleteFailed":
      return t("errors.historyDeleteFailed", { detail: error.detail });
    case "historyTitleEmpty":
      return t("errors.historyTitleEmpty");
    case "historyTitleTooLong":
      return t("errors.historyTitleTooLong", { max: error.max });
    case "fileEmpty":
      return t("errors.fileEmpty");
    case "fileTooLarge":
      return t("errors.fileTooLarge", {
        size: formatByteSize(error.size),
        limit: formatByteSize(error.limit),
      });
    case "fileEncoding":
      return t("errors.fileEncoding");
    case "fileUnsupported":
      return t("errors.fileUnsupported");
    case "pdfUnreadable":
      return t("errors.pdfUnreadable");
    case "pdfNoText":
      return t("errors.pdfNoText");
    case "fileDataInvalid":
      return t("errors.fileDataInvalid");
    case "fileReadFailed":
      return error.detail === ""
        ? t("errors.fileReadFailed")
        : t("errors.fileReadFailedDetail", { detail: error.detail });
    case "fileTooMany":
      return t("errors.fileTooMany");
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

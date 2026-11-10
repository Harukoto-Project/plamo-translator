import i18n from "i18next";
import { describe, expect, it } from "vitest";
import { describeAppError } from "@/lib/app-error";
import type { AppError, UrlProblem } from "@/types/bindings";

const t = i18n.t.bind(i18n);

describe("describeAppError", () => {
  it("接続できないとき、接続先のURLを文言に入れる", () => {
    const text = describeAppError(
      { kind: "connectionFailed", url: "http://localhost:8000/v1" },
      t,
    );
    expect(text).toContain("http://localhost:8000/v1");
  });

  it("URLが正しくない理由ごとに、別の文言を返す", () => {
    const reasons: UrlProblem[] = [
      "empty",
      "containsWhitespace",
      "malformed",
      "missingHost",
      "queryOrFragment",
      "credentials",
    ];
    const texts = reasons.map((reason) =>
      describeAppError({ kind: "invalidUrl", reason }, t),
    );
    expect(new Set(texts).size).toBe(reasons.length);
    for (const text of texts) {
      expect(text).not.toMatch(/^errors\./);
    }
  });

  it("HTTPのステータスがあれば文言に入れる", () => {
    const withStatus = describeAppError(
      { kind: "http", status: 503, detail: "overloaded" },
      t,
    );
    expect(withStatus).toContain("503");
    expect(withStatus).toContain("overloaded");

    const withoutStatus = describeAppError(
      { kind: "http", status: null, detail: "reset" },
      t,
    );
    expect(withoutStatus).toContain("reset");
    expect(withoutStatus).not.toContain("HTTP");
  });

  it("設定ファイルのバージョンを文言に入れる", () => {
    expect(
      describeAppError({ kind: "settingsVersionUnsupported", version: 7 }, t),
    ).toContain("v7");
  });

  it("全ての種別で、文言のキーがそのまま出ることはない", () => {
    const errors: AppError[] = [
      { kind: "connectionFailed", url: "u" },
      { kind: "invalidUrl", reason: "empty" },
      { kind: "timeout" },
      { kind: "http", status: 500, detail: "d" },
      { kind: "contextLengthExceeded", detail: "d" },
      { kind: "invalidResponse", detail: "d" },
      { kind: "emptyText" },
      { kind: "invalidMaxTokens" },
      { kind: "settingsReadFailed", detail: "d" },
      { kind: "settingsWriteFailed", detail: "d" },
      { kind: "settingsVersionUnsupported", version: 2 },
      { kind: "secret", detail: "d" },
      { kind: "internal", detail: "d" },
    ];
    for (const error of errors) {
      expect(describeAppError(error, t)).not.toMatch(/^errors\./);
    }
  });
});

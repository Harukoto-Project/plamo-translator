import { describe, expect, it } from "vitest";
import {
  changeSourceLang,
  changeTargetLang,
  fallbackTargetFor,
  isLang,
  languages,
  resolveLanguages,
  sourceChoices,
} from "@/lib/languages";

describe("languages", () => {
  it("日本語・英語・韓国語を選べる", () => {
    expect(languages).toEqual(["ja", "en", "ko"]);
  });

  it("原文は、先頭に「自動」を加えて選べる", () => {
    expect(sourceChoices).toEqual(["auto", "ja", "en", "ko"]);
  });

  it("isLang は、対応する言語だけを通す", () => {
    expect(isLang("ko")).toBe(true);
    expect(isLang("auto")).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });
});

describe("changeSourceLang", () => {
  it("訳文と違う言語なら、原文だけ変える", () => {
    expect(changeSourceLang({ source: "ja", target: "en" }, "ko")).toEqual({
      source: "ko",
      target: "en",
    });
  });

  it("訳文と同じ言語を選んだら、訳文を元の原文の言語にする", () => {
    expect(changeSourceLang({ source: "ja", target: "en" }, "en")).toEqual({
      source: "en",
      target: "ja",
    });
  });

  it("今の原文と同じ言語を選んでも変わらない", () => {
    expect(changeSourceLang({ source: "ja", target: "en" }, "ja")).toEqual({
      source: "ja",
      target: "en",
    });
  });
});

describe("fallbackTargetFor", () => {
  it("日本語なら英語、それ以外は日本語", () => {
    expect(fallbackTargetFor("ja")).toBe("en");
    expect(fallbackTargetFor("en")).toBe("ja");
    expect(fallbackTargetFor("ko")).toBe("ja");
  });
});

describe("resolveLanguages", () => {
  const base = { target: "en", detected: undefined, fallback: "ja" } as const;

  it("手動の選択は、判定を使わない", () => {
    expect(resolveLanguages({ ...base, choice: "ko", detected: "en" })).toEqual(
      { source: "ko", target: "en" },
    );
  });

  it("自動なら、判定した言語を原文にする", () => {
    expect(
      resolveLanguages({ ...base, choice: "auto", detected: "ko" }),
    ).toEqual({ source: "ko", target: "en" });
  });

  it("自動で判定できなければ、直前の言語を使う", () => {
    expect(
      resolveLanguages({ ...base, choice: "auto", fallback: "ko" }),
    ).toEqual({ source: "ko", target: "en" });
  });

  it("判定した言語が訳文と同じなら、訳文を切り替える(日本語なら英語)", () => {
    expect(
      resolveLanguages({
        choice: "auto",
        target: "ja",
        detected: "ja",
        fallback: "ja",
      }),
    ).toEqual({ source: "ja", target: "en" });
  });

  it("判定した言語が訳文と同じなら、訳文を切り替える(日本語以外なら日本語)", () => {
    expect(
      resolveLanguages({ ...base, choice: "auto", detected: "en" }),
    ).toEqual({ source: "en", target: "ja" });
    expect(
      resolveLanguages({
        choice: "auto",
        target: "ko",
        detected: "ko",
        fallback: "ja",
      }),
    ).toEqual({ source: "ko", target: "ja" });
  });
});

describe("changeTargetLang", () => {
  it("原文と違う言語なら、訳文だけ変える", () => {
    expect(changeTargetLang({ source: "ja", target: "en" }, "ko")).toEqual({
      source: "ja",
      target: "ko",
    });
  });

  it("原文と同じ言語を選んだら、原文を元の訳文の言語にする", () => {
    expect(changeTargetLang({ source: "ja", target: "en" }, "ja")).toEqual({
      source: "en",
      target: "ja",
    });
  });

  it("今の訳文と同じ言語を選んでも変わらない", () => {
    expect(changeTargetLang({ source: "ja", target: "en" }, "en")).toEqual({
      source: "ja",
      target: "en",
    });
  });
});

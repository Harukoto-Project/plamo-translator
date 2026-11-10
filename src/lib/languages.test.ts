import { describe, expect, it } from "vitest";
import {
  changeSourceLang,
  changeTargetLang,
  isLang,
  languages,
} from "@/lib/languages";

describe("languages", () => {
  it("日本語・英語・韓国語を選べる", () => {
    expect(languages).toEqual(["ja", "en", "ko"]);
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

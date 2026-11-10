import { describe, expect, it } from "vitest";
import { parseMaxTokens, resolveSettings } from "@/lib/settings";

describe("parseMaxTokens", () => {
  it("1以上の整数を受け付ける(前後の空白は無視)", () => {
    expect(parseMaxTokens("1024")).toBe(1024);
    expect(parseMaxTokens(" 8 ")).toBe(8);
  });

  it.each(["", "  ", "0", "-5", "1.5", "1e3", "abc", "10 20", "0x10"])(
    "%j は受け付けない",
    (text) => {
      expect(parseMaxTokens(text)).toBeUndefined();
    },
  );

  it("Rust の u32 に収まらない値は受け付けない", () => {
    expect(parseMaxTokens("4294967295")).toBe(4294967295);
    expect(parseMaxTokens("4294967296")).toBeUndefined();
  });
});

describe("resolveSettings", () => {
  it("項目が揃っていれば、そのまま返す", () => {
    expect(
      resolveSettings({
        connection: { baseUrl: "http://x/v1", model: "m" },
        generation: { maxTokens: 10 },
      }),
    ).toEqual({
      connection: { baseUrl: "http://x/v1", model: "m" },
      generation: { maxTokens: 10 },
    });
  });

  it("項目が欠けていたら例外にする", () => {
    expect(() => resolveSettings({})).toThrow();
    expect(() =>
      resolveSettings({
        connection: { baseUrl: "http://x/v1" },
        generation: { maxTokens: 10 },
      }),
    ).toThrow();
  });
});

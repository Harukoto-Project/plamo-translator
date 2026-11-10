import { describe, expect, it } from "vitest";
import { formatSpeed, tokensPerSecond } from "@/lib/translate-stats";

describe("tokensPerSecond", () => {
  it("トークン数を秒で割る", () => {
    expect(
      tokensPerSecond({ tokens: 50, elapsedMs: 2000, estimated: false }),
    ).toBe(25);
  });

  it("時間かトークン数が0なら、速度を出さない", () => {
    expect(
      tokensPerSecond({ tokens: 50, elapsedMs: 0, estimated: false }),
    ).toBeUndefined();
    expect(
      tokensPerSecond({ tokens: 0, elapsedMs: 1000, estimated: false }),
    ).toBeUndefined();
  });
});

describe("formatSpeed", () => {
  it("100未満は小数1桁、100以上は整数にする", () => {
    expect(formatSpeed(42.34)).toBe("42.3");
    expect(formatSpeed(99.94)).toBe("99.9");
    expect(formatSpeed(120.6)).toBe("121");
  });
});

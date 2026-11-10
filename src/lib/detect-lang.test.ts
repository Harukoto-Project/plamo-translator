import { describe, expect, it } from "vitest";
import { detectLang } from "@/lib/detect-lang";

describe("detectLang", () => {
  it.each([
    ["こんにちは", "ja"],
    ["今日は天気がいいですね。", "ja"],
    ["コーヒー", "ja"],
    ["Hello, world!", "en"],
    ["The quick brown fox jumps over the lazy dog.", "en"],
    ["Café au lait, s'il vous plaît", "en"],
    ["안녕하세요", "ko"],
    ["오늘 날씨가 좋네요.", "ko"],
  ] as const)("%j は %s", (text, expected) => {
    expect(detectLang(text)).toBe(expected);
  });

  it("漢字だけの文は、ほかに手がかりがないので日本語", () => {
    expect(detectLang("漢字")).toBe("ja");
    expect(detectLang("東京都")).toBe("ja");
  });

  it("英単語が混ざる日本語は、日本語", () => {
    expect(detectLang("VRChatのOSCを使ったギミック")).toBe("ja");
    expect(detectLang("Kubernetesのクラスタ上でPodを再起動する")).toBe("ja");
  });

  it("英単語が混ざる韓国語は、韓国語", () => {
    expect(detectLang("API를 호출한다")).toBe("ko");
  });

  it("日本語の固有名詞が混ざる英語は、英語", () => {
    expect(detectLang("I met 田中さん yesterday at the store")).toBe("en");
    expect(detectLang("Please send it to カ")).toBe("en");
  });

  it("日本語の文に韓国語が少し混ざっても、多い方に判定する", () => {
    expect(detectLang("こんにちは、안녕")).toBe("ja");
    expect(detectLang("안녕하세요、こん")).toBe("ko");
  });

  it("空・空白・数字・記号だけなら、判定しない", () => {
    expect(detectLang("")).toBeUndefined();
    expect(detectLang("   \n\t")).toBeUndefined();
    expect(detectLang("12345")).toBeUndefined();
    expect(detectLang("!?...。、 ---")).toBeUndefined();
    expect(detectLang("😀😀")).toBeUndefined();
  });

  it("数字や記号が多くても、文字の割合で判定する", () => {
    expect(detectLang("2026/11/11 12:00 — ok")).toBe("en");
    expect(detectLang("【重要】2026年11月11日(水)")).toBe("ja");
  });

  it("どれも大半を占めないときは、判定しない", () => {
    // ラテン文字・漢字・キリル文字がほぼ同じ割合
    expect(detectLang("ab 漢字 жз")).toBeUndefined();
  });
});

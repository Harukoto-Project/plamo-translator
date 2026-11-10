import { describe, expect, it } from "vitest";
import {
  isMacPlatform,
  shouldTranslateOnKeyDown,
  type TranslateKeyInput,
} from "@/lib/translate-keys";

const base: TranslateKeyInput = {
  key: "Enter",
  ctrlKey: false,
  metaKey: false,
  isComposing: false,
  keyCode: 13,
};

describe("shouldTranslateOnKeyDown", () => {
  it("Ctrl+Enter と Cmd+Enter で翻訳する", () => {
    expect(shouldTranslateOnKeyDown({ ...base, ctrlKey: true })).toBe(true);
    expect(shouldTranslateOnKeyDown({ ...base, metaKey: true })).toBe(true);
  });

  it("Enter だけでは翻訳しない(改行する)", () => {
    expect(shouldTranslateOnKeyDown(base)).toBe(false);
  });

  it("Enter 以外のキーでは翻訳しない", () => {
    expect(shouldTranslateOnKeyDown({ ...base, key: "a", ctrlKey: true })).toBe(
      false,
    );
  });

  it("変換中のEnterでは翻訳しない", () => {
    expect(
      shouldTranslateOnKeyDown({ ...base, ctrlKey: true, isComposing: true }),
    ).toBe(false);
    expect(
      shouldTranslateOnKeyDown({ ...base, ctrlKey: true, keyCode: 229 }),
    ).toBe(false);
  });
});

describe("isMacPlatform", () => {
  it("macOS と iOS を見分ける", () => {
    expect(isMacPlatform("MacIntel")).toBe(true);
    expect(isMacPlatform("iPhone")).toBe(true);
    expect(isMacPlatform("Win32")).toBe(false);
    expect(isMacPlatform("Linux x86_64")).toBe(false);
  });
});

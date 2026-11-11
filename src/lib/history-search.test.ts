import { describe, expect, it } from "vitest";
import { filterByTitle } from "@/lib/history-search";

const items = [
  { id: "1", title: "Rustのライフタイムについて" },
  { id: "2", title: "旅行の計画(京都)" },
  { id: "3", title: "TypeScriptの型" },
];

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("filterByTitle", () => {
  it("語が無ければ全件を、元の順で返す", () => {
    expect(ids(filterByTitle(items, ""))).toEqual(["1", "2", "3"]);
    expect(ids(filterByTitle(items, "  \n "))).toEqual(["1", "2", "3"]);
  });

  it("タイトルに含まれるものだけを残す", () => {
    expect(ids(filterByTitle(items, "京都"))).toEqual(["2"]);
    expect(ids(filterByTitle(items, "なし"))).toEqual([]);
  });

  it("大文字小文字を区別しない", () => {
    expect(ids(filterByTitle(items, "rust"))).toEqual(["1"]);
    expect(ids(filterByTitle(items, "TYPESCRIPT"))).toEqual(["3"]);
  });

  it("全角半角を区別しない", () => {
    expect(ids(filterByTitle(items, "ＲＵＳＴ"))).toEqual(["1"]);
    expect(ids(filterByTitle(items, "(京都)"))).toEqual(["2"]);
  });

  it("空白で区切った語は、すべて含むものだけを残す", () => {
    expect(ids(filterByTitle(items, "rust ライフ"))).toEqual(["1"]);
    expect(ids(filterByTitle(items, "rust 京都"))).toEqual([]);
    expect(ids(filterByTitle(items, "　の　"))).toEqual(["1", "2", "3"]);
  });
});

import { describe, expect, it } from "vitest";
import { activeProfile, modelOptions } from "@/lib/profiles";
import type { ProfileBook } from "@/types/bindings";

const book: ProfileBook = {
  activeId: "b",
  profiles: [
    { id: "a", name: "A", baseUrl: "http://a/v1", model: "m" },
    { id: "b", name: "B", baseUrl: "http://b/v1", model: "" },
  ],
};

describe("activeProfile", () => {
  it("使用中のIDのプロファイルを返す", () => {
    expect(activeProfile(book)?.name).toBe("B");
  });

  it("IDが無ければ undefined", () => {
    expect(activeProfile({ ...book, activeId: "gone" })).toBeUndefined();
  });
});

describe("modelOptions", () => {
  it("一覧に無い現在のモデルを先頭に足す", () => {
    expect(modelOptions(["a", "b"], "current")).toEqual(["current", "a", "b"]);
  });

  it("既にあるモデルと、空のモデル名は足さない", () => {
    expect(modelOptions(["a"], "a")).toEqual(["a"]);
    expect(modelOptions(["a"], "  ")).toEqual(["a"]);
    expect(modelOptions([], "")).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import { groupByDate } from "@/lib/history-groups";

/** ローカル時間の日時から、UNIX秒を作る。 */
function secs(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
): number {
  return Math.floor(
    new Date(year, month - 1, day, hour, minute).getTime() / 1000,
  );
}

function item(id: string, updatedAt: number) {
  return { id, updatedAt };
}

const now = new Date(2026, 10, 10, 14, 0); // 2026-11-10 14:00

describe("groupByDate", () => {
  it("今日・昨日・過去7日間・それ以前に分け、この順に並べる", () => {
    const groups = groupByDate(
      [
        item("older", secs(2026, 10, 1)),
        item("week", secs(2026, 11, 4)),
        item("yesterday", secs(2026, 11, 9, 23, 59)),
        item("today", secs(2026, 11, 10, 9)),
      ],
      now,
    );

    expect(
      groups.map((group) => [group.id, group.items.map((entry) => entry.id)]),
    ).toEqual([
      ["today", ["today"]],
      ["yesterday", ["yesterday"]],
      ["week", ["week"]],
      ["older", ["older"]],
    ]);
  });

  it("日付の境目(0時ちょうど)は新しい側に入る", () => {
    const groups = groupByDate(
      [
        item("today", secs(2026, 11, 10, 0, 0)),
        item("yesterday", secs(2026, 11, 9, 0, 0)),
        item("week", secs(2026, 11, 3, 0, 0)),
        item("older", secs(2026, 11, 2, 23, 59)),
      ],
      now,
    );

    expect(groups.map((group) => group.id)).toEqual([
      "today",
      "yesterday",
      "week",
      "older",
    ]);
  });

  it("空のグループは返さない", () => {
    const groups = groupByDate([item("a", secs(2026, 11, 10, 8))], now);

    expect(groups.map((group) => group.id)).toEqual(["today"]);
    expect(groupByDate([], now)).toEqual([]);
  });

  it("グループの中は渡された順のまま", () => {
    const groups = groupByDate(
      [
        item("b", secs(2026, 11, 10, 12)),
        item("a", secs(2026, 11, 10, 13)),
        item("c", secs(2026, 11, 10, 1)),
      ],
      now,
    );

    expect(groups[0]?.items.map((entry) => entry.id)).toEqual(["b", "a", "c"]);
  });

  it("未来の時刻(時計のずれ)は今日に入れる", () => {
    const groups = groupByDate([item("future", secs(2026, 11, 12))], now);

    expect(groups.map((group) => group.id)).toEqual(["today"]);
  });
});

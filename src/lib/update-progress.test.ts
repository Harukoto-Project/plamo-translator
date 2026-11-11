import { describe, expect, it } from "vitest";
import {
  applyDownloadEvent,
  downloadPercent,
  initialDownloadProgress,
} from "@/lib/update-progress";

describe("applyDownloadEvent", () => {
  it("開始で全体の大きさを覚える", () => {
    const next = applyDownloadEvent(initialDownloadProgress, {
      event: "Started",
      data: { contentLength: 1000 },
    });
    expect(next).toEqual({ downloaded: 0, total: 1000 });
  });

  it("全体の大きさが分からなければ null のまま", () => {
    const next = applyDownloadEvent(initialDownloadProgress, {
      event: "Started",
      data: {},
    });
    expect(next.total).toBeNull();
  });

  it("受け取るたびに足していく", () => {
    let progress = applyDownloadEvent(initialDownloadProgress, {
      event: "Started",
      data: { contentLength: 1000 },
    });
    progress = applyDownloadEvent(progress, {
      event: "Progress",
      data: { chunkLength: 300 },
    });
    progress = applyDownloadEvent(progress, {
      event: "Progress",
      data: { chunkLength: 200 },
    });
    expect(progress.downloaded).toBe(500);
  });

  it("終了で100%にそろえる", () => {
    const progress = applyDownloadEvent(
      { downloaded: 990, total: 1000 },
      { event: "Finished" },
    );
    expect(downloadPercent(progress)).toBe(100);
  });
});

describe("downloadPercent", () => {
  it("0〜100の整数にする", () => {
    expect(downloadPercent({ downloaded: 0, total: 1000 })).toBe(0);
    expect(downloadPercent({ downloaded: 333, total: 1000 })).toBe(33);
    expect(downloadPercent({ downloaded: 1000, total: 1000 })).toBe(100);
  });

  it("全体が分からない・0のときは null", () => {
    expect(downloadPercent({ downloaded: 50, total: null })).toBeNull();
    expect(downloadPercent({ downloaded: 50, total: 0 })).toBeNull();
  });

  it("全体を超えても100で止める", () => {
    expect(downloadPercent({ downloaded: 1200, total: 1000 })).toBe(100);
  });
});

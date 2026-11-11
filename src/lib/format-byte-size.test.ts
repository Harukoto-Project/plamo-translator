import { describe, expect, it } from "vitest";
import { formatByteSize } from "@/lib/format-byte-size";

describe("formatByteSize", () => {
  it("MiB単位に揃う値は、小数を付けない", () => {
    expect(formatByteSize(0)).toBe("0MB");
    expect(formatByteSize(10 * 1024 * 1024)).toBe("10MB");
    expect(formatByteSize(25 * 1024 * 1024)).toBe("25MB");
  });

  it("端数は小数1桁にする", () => {
    expect(formatByteSize(11 * 1024 * 1024 + 512 * 1024)).toBe("11.5MB");
  });
});

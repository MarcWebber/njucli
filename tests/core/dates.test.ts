import { describe, expect, it } from "vitest";
import { parseCampusDate, weekRange } from "../../src/core/dates.js";

describe("campus dates", () => {
  it("uses Asia/Shanghai instead of the machine timezone", () => {
    const nearMidnight = new Date("2026-09-04T16:30:00.000Z");
    expect(parseCampusDate("today", nearMidnight)).toBe("2026-09-05");
    expect(parseCampusDate("tomorrow", nearMidnight)).toBe("2026-09-06");
  });

  it("computes a Monday to Sunday range", () => {
    expect(weekRange("2026-09-04")).toEqual({
      from: "2026-08-31",
      to: "2026-09-06",
    });
  });

  it("rejects impossible calendar dates", () => {
    expect(() => parseCampusDate("2026-02-30")).toThrow(/无效日期/);
  });
});

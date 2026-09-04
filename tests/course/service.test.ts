import { describe, expect, it } from "vitest";

import type { Clock } from "../../src/core/types.js";
import { scheduleToIcs } from "../../src/domains/course/ics.js";
import { CourseService } from "../../src/domains/course/service.js";

const remote: ConstructorParameters<typeof CourseService>[0] = {
  listTerms: async () => [{
    DM: "2026-2027-1",
    MC: "2026-2027 学年第一学期",
  }],
  currentTerm: async () => ({
    DM: "2026-2027-1",
    MC: "2026-2027 学年第一学期",
  }),
  listTermDates: async () => [{
    XN: "2026-2027",
    XQ: "1",
    XQKSRQ: "2026-08-31 00:00:00",
  }],
  listSchedule: async () => [{
    JXBID: "class-1",
    KCM: "程序设计",
    SKJS: "张老师,李老师",
    JASMC: "仙Ⅱ-204",
    XXXQDM_DISPLAY: "仙林校区",
    KSJC: 3,
    JSJC: 4,
    SKXQ: 2,
    SKZC: "1010",
  }],
};

describe("CourseService", () => {
  const clock: Clock = { now: () => new Date("2026-09-01T02:30:00.000Z") };

  it("maps structured weeks to Shanghai calendar dates", async () => {
    const service = new CourseService(remote, clock);
    const today = await service.onDate();

    expect(today).toEqual([
      expect.objectContaining({
        occurrenceId: "class-1:2026-09-01:3",
        date: "2026-09-01",
        startTime: "10:10",
        endTime: "12:00",
        location: "仙Ⅱ-204",
      }),
    ]);
  });

  it("returns the next not-yet-ended course", async () => {
    const service = new CourseService(remote, clock);
    await expect(service.next()).resolves.toMatchObject({
      date: "2026-09-01",
      name: "程序设计",
    });
  });

  it("exports a deterministic RFC 5545 calendar", async () => {
    const service = new CourseService(remote, clock);
    const schedule = await service.schedule();
    const ics = scheduleToIcs(
      service,
      schedule,
      new Date("2026-09-01T00:00:00.000Z"),
    );

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART;TZID=Asia/Shanghai:20260901T101000");
    expect(ics).toContain("LOCATION:仙林校区 仙Ⅱ-204");
    expect(ics).toContain("UID:class-1:2026-09-01:3@njucli");
  });
});

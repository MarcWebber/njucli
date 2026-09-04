import { describe, expect, it } from "vitest";

import {
  libraryHoldingsText,
  scheduleText,
  sportsSlotsText,
  sportsVenuesText,
} from "../../src/commands/text.js";

describe("course text output", () => {
  it("prints actual timetable time, weeks, and location", () => {
    const output = scheduleText({
      term: {
        id: "2026-1",
        name: "2026-2027 学年第一学期",
        startsOn: "2026-08-31",
      },
      courses: [{
        teachingClassId: "class-1",
        name: "操作系统",
        teachers: ["教师甲"],
        arrangements: [{
          weekday: 2,
          startPeriod: 3,
          startTime: "10:10",
          endTime: "12:00",
          weeks: [1, 3],
          location: "仙Ⅱ-204",
          campus: "仙林校区",
        }],
      }],
    });

    expect(output).toContain("操作系统\t教师甲\t周二 10:10-12:00\t第 1,3 周\t仙林校区 仙Ⅱ-204");
  });
});

describe("library text output", () => {
  it("keeps the library, exact location, shelf mark, and call number together", () => {
    const output = libraryHoldingsText([{
      callNumber: "TP316/1",
      library: "仙林图书馆",
      location: "三楼中文图书借阅区",
      shelfMark: "A-12-3",
      status: "可借",
      available: true,
    }]);

    expect(output).toBe(
      "仙林图书馆 / 三楼中文图书借阅区 / A-12-3\tTP316/1\t可借",
    );
  });
});

describe("sports text output", () => {
  it("shows sport IDs that can be reused as filters", () => {
    const output = sportsVenuesText([{
        siteId: "12",
        campus: "仙林校区",
        venue: "方肇周体育馆",
        name: "羽毛球场",
        sportId: "7",
        sport: "羽毛球",
        openStart: "08:00",
        openEnd: "22:00",
      }]);

    expect(output).toContain("羽毛球 (7)");
    expect(output).toContain("\t12");
  });

  it("reports remaining capacity and each space state", () => {
    const output = sportsSlotsText({
      date: "2026-09-07",
      slots: [{
        startAt: "18:00",
        endAt: "19:00",
        spaces: [{
          name: "1 号场",
          state: "available",
        }, {
          name: "2 号场",
          state: "occupied",
        }],
      }],
    });

    expect(output).toContain("剩余 1/2");
    expect(output).toContain("1 号场\t可预约");
  });
});

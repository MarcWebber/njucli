import type { SkillRuntime } from "../../../src/app/runtime.js";
import { addDays, parseCampusDate, weekRange } from "../../../src/core/dates.js";
import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
import { EHallTimetableClient } from "./client.js";
import type { CourseRow, TermDateRow, TermRow } from "./contract.js";
import { scheduleToIcs } from "./ics.js";
import { GraduateCourseSelectionClient } from "./selection-client.js";
import type { AcademicTerm, CourseOccurrence, CourseSchedule, ScheduledCourse } from "./types.js";

export type CourseServices = Pick<GraduateCourseSelectionClient, "select" | "withdraw"> & {
  terms(): Promise<AcademicTerm[]>;
  currentTerm(): Promise<AcademicTerm>;
  schedule(termId?: string): Promise<CourseSchedule>;
  today(date?: string, termId?: string): Promise<CourseOccurrence[]>;
  week(date?: string, termId?: string): Promise<CourseOccurrence[]>;
  next(termId?: string): Promise<CourseOccurrence | null>;
  available: GraduateCourseSelectionClient["listAvailable"];
  selected: GraduateCourseSelectionClient["listSelected"];
  export(path: string, termId?: string): Promise<{ path: string; eventCount: number }>;
};

export function createCourseServices({ withBrowser }: SkillRuntime): CourseServices {
  const withCourse = <T>(operation: (client: EHallTimetableClient) => Promise<T>): Promise<T> => {
    let client: EHallTimetableClient;
    return withBrowser("timetable", () => operation(client), async (session) => {
      client = new EHallTimetableClient(session.request);
      await client.currentTerm();
      return true;
    });
  };
  const withSelection = <T>(operation: (client: GraduateCourseSelectionClient) => Promise<T>): Promise<T> =>
    withBrowser("selection", (session) => operation(new GraduateCourseSelectionClient(session.request)));
  const schedule = (termId?: string): Promise<CourseSchedule> => withCourse(async (client) => {
    const [row, dates] = await Promise.all([
      termId ? client.listTerms().then((terms) => terms.find((term) => term.DM === termId)) : client.currentTerm(),
      client.listTermDates(),
    ]);
    if (!row) throw new AppError("NOT_FOUND", `没有找到学期 ${termId ?? "当前学期"}`);
    const term = mapTerm(row, dates);
    return { term, courses: (await client.listSchedule(term.id)).map(mapCourse) };
  });
  return {
    terms: () => withCourse(async (client) => {
      const [terms, dates] = await Promise.all([client.listTerms(), client.listTermDates()]);
      return terms.map((term) => mapTerm(term, dates));
    }),
    currentTerm: () => withCourse(async (client) => {
      const [term, dates] = await Promise.all([client.currentTerm(), client.listTermDates()]);
      return mapTerm(term, dates);
    }),
    schedule,
    today: async (input, termId) => {
      const date = parseCampusDate(input);
      return expandSchedule(await schedule(termId)).filter((entry) => entry.date === date);
    },
    week: async (input, termId) => {
      const range = weekRange(parseCampusDate(input));
      return expandSchedule(await schedule(termId)).filter((entry) => entry.date >= range.from && entry.date <= range.to);
    },
    next: async (termId) => {
      const now = Date.now();
      return expandSchedule(await schedule(termId)).find(
        (entry) => new Date(`${entry.date}T${entry.endTime}:00+08:00`).getTime() > now,
      ) ?? null;
    },
    export: async (path, termId) => {
      const occurrences = expandSchedule(await schedule(termId));
      const saved = await saveFile(path, scheduleToIcs(occurrences));
      return { path: saved.path, eventCount: occurrences.length };
    },
    available: (kind, query, page, pageSize) => withSelection((client) => client.listAvailable(kind, query, page, pageSize)),
    selected: () => withSelection((client) => client.listSelected()),
    withdraw: (classId) => withSelection((client) => client.withdraw(classId)),
    select: (classId, kind) => withSelection((client) => client.select(classId, kind)),
  };
}

const PERIODS = [
  ["08:00", "08:50"],
  ["09:00", "09:50"],
  ["10:10", "11:00"],
  ["11:10", "12:00"],
  ["14:00", "14:50"],
  ["15:00", "15:50"],
  ["16:10", "17:00"],
  ["17:10", "18:00"],
  ["18:30", "19:20"],
  ["19:30", "20:20"],
  ["20:30", "21:20"],
  ["21:30", "22:20"],
  ["22:30", "23:20"],
] as const;

function expandSchedule(schedule: CourseSchedule): CourseOccurrence[] {
  if (!schedule.term.startsOn) {
    throw new AppError("REMOTE_SCHEMA_CHANGED", "课表学期缺少开始日期，无法映射到自然日", {
      details: { contract: "nju-ehall-wdkb-v1", term: schedule.term.id },
    });
  }

  const entries: CourseOccurrence[] = [];
  for (const course of schedule.courses) {
    for (const arrangement of course.arrangements) {
      for (const week of arrangement.weeks) {
        const date = addDays(
          schedule.term.startsOn,
          (week - 1) * 7 + arrangement.weekday - 1,
        );
        entries.push({
          occurrenceId: `${course.teachingClassId}:${date}:${arrangement.startPeriod}`,
          name: course.name,
          teachers: course.teachers,
          date,
          startTime: arrangement.startTime,
          endTime: arrangement.endTime,
          location: arrangement.location,
          campus: arrangement.campus,
        });
      }
    }
  }
  return entries.sort(
    (left, right) =>
      `${left.date}T${left.startTime}`.localeCompare(`${right.date}T${right.startTime}`) ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}

function mapTerm(term: TermRow, dates: TermDateRow[]): AcademicTerm {
  const start = dates.find(
    (candidate) => `${candidate.XN}-${candidate.XQ}` === term.DM,
  );
  const startsOn = start ? parseCampusDate(start.XQKSRQ.slice(0, 10)) : null;
  return {
    id: term.DM,
    name: term.MC,
    startsOn,
  };
}

function mapCourse(row: CourseRow): ScheduledCourse {
  const isFreeTime = row.KSJC === 0 && row.JSJC === 0;
  const start = PERIODS[row.KSJC - 1];
  const end = PERIODS[row.JSJC - 1];
  if (
    !isFreeTime &&
    (!start || !end || row.JSJC < row.KSJC || row.SKXQ < 1 || row.SKXQ > 7)
  ) {
    throw new AppError("REMOTE_SCHEMA_CHANGED", "课表节次或星期超出已知范围", {
      details: {
        contract: "nju-ehall-wdkb-v1",
        teachingClassId: row.JXBID,
        startPeriod: row.KSJC,
        endPeriod: row.JSJC,
        weekday: row.SKXQ,
      },
    });
  }
  const weeks = [...row.SKZC]
    .map((value, index) => (value === "1" ? index + 1 : null))
    .filter((value): value is number => value !== null);
  return {
    teachingClassId: row.JXBID,
    name: row.KCM,
    teachers: splitTeachers(row.SKJS),
    arrangements: weeks.length === 0 || isFreeTime
      ? []
      : [{
          weekday: row.SKXQ,
          startPeriod: row.KSJC,
          startTime: start![0],
          endTime: end![1],
          weeks,
          location: clean(row.JASMC),
          campus: clean(row.XXXQDM_DISPLAY),
        }],
  };
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function splitTeachers(value: string | null | undefined): string[] {
  const cleaned = clean(value);
  return cleaned
    ? cleaned.split(/[,，、;/]+/).map((entry) => entry.trim()).filter(Boolean)
    : [];
}

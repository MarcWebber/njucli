import { addDays, parseCampusDate, weekRange } from "../../core/dates.js";
import { AppError } from "../../core/errors.js";
import { systemClock, type Clock } from "../../core/types.js";
import type { EHallTimetableClient } from "./client.js";
import type { CourseRow, TermDateRow, TermRow } from "./contract.js";
import type {
  AcademicTerm,
  CourseOccurrence,
  CourseSchedule,
  ScheduledCourse,
} from "./types.js";

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

export class CourseService {
  constructor(
    private readonly remote: Pick<
      EHallTimetableClient,
      "listTerms" | "currentTerm" | "listTermDates" | "listSchedule"
    >,
    private readonly clock: Clock = systemClock,
  ) {}

  async terms(): Promise<AcademicTerm[]> {
    const [terms, dates] = await Promise.all([
      this.remote.listTerms(),
      this.remote.listTermDates(),
    ]);
    return terms.map((term) => mapTerm(term, dates));
  }

  async currentTerm(): Promise<AcademicTerm> {
    const [term, dates] = await Promise.all([
      this.remote.currentTerm(),
      this.remote.listTermDates(),
    ]);
    return mapTerm(term, dates);
  }

  async schedule(termId?: string): Promise<CourseSchedule> {
    const term = termId
      ? await this.termById(termId)
      : await this.currentTerm();
    const rows = await this.remote.listSchedule(term.id);
    return {
      term,
      courses: rows.map(mapCourse),
    };
  }

  async onDate(input?: string, termId?: string): Promise<CourseOccurrence[]> {
    const date = parseCampusDate(input, this.clock.now());
    const schedule = await this.schedule(termId);
    return this.expand(schedule).filter((entry) => entry.date === date);
  }

  async week(input?: string, termId?: string): Promise<CourseOccurrence[]> {
    const date = parseCampusDate(input, this.clock.now());
    const range = weekRange(date);
    const schedule = await this.schedule(termId);
    return this.expand(schedule).filter(
      (entry) => entry.date >= range.from && entry.date <= range.to,
    );
  }

  async next(termId?: string): Promise<CourseOccurrence | null> {
    const now = this.clock.now();
    const schedule = await this.schedule(termId);
    return (
      this.expand(schedule).find(
        (entry) => new Date(`${entry.date}T${entry.endTime}:00+08:00`).getTime() > now.getTime(),
      ) ?? null
    );
  }

  expand(schedule: CourseSchedule): CourseOccurrence[] {
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

  private async termById(id: string): Promise<AcademicTerm> {
    const terms = await this.terms();
    const term = terms.find((candidate) => candidate.id === id);
    if (!term) {
      throw new AppError("NOT_FOUND", `没有找到学期 ${id}`);
    }
    return term;
  }
}

function mapTerm(term: TermRow, dates: TermDateRow[]): AcademicTerm {
  const start = dates.find(
    (candidate) => `${candidate.XN}-${candidate.XQ}` === term.DM,
  );
  const startsOn = start?.XQKSRQ.slice(0, 10) ?? null;
  if (startsOn && !/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) {
    throw new AppError("REMOTE_SCHEMA_CHANGED", "学期开始日期格式发生变化", {
      details: { contract: "nju-ehall-wdkb-v1", value: start?.XQKSRQ },
    });
  }
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

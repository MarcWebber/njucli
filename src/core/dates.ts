import { AppError } from "./errors.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function shanghaiDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseCampusDate(input: string | undefined, now = new Date()): string {
  if (input === undefined || input === "today") return shanghaiDate(now);
  if (input === "tomorrow") return addDays(shanghaiDate(now), 1);
  if (!DATE_PATTERN.test(input) || !isRealDate(input)) {
    throw new AppError("INVALID_INPUT", `无效日期：${input}`, {
      hint: "使用 today、tomorrow 或 YYYY-MM-DD",
    });
  }
  return input;
}

export function weekRange(date: string): { from: string; to: string } {
  const utc = new Date(`${date}T00:00:00.000Z`);
  const weekday = utc.getUTCDay() || 7;
  return {
    from: addDays(date, 1 - weekday),
    to: addDays(date, 7 - weekday),
  };
}

export function addDays(date: string, count: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + count);
  return value.toISOString().slice(0, 10);
}

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const candidate = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month! - 1 &&
    candidate.getUTCDate() === day
  );
}

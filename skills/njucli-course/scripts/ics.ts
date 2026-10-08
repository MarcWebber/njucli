import type { CourseOccurrence } from "./types.js";

export function scheduleToIcs(
  occurrences: CourseOccurrence[],
  generatedAt = new Date(),
): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//njucli//NJU timetable//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:NJU 课表",
    ...occurrences.flatMap((entry) => toEvent(entry, generatedAt)),
    "END:VCALENDAR",
    "",
  ];
  return lines.map(foldLine).join("\r\n");
}

function toEvent(entry: CourseOccurrence, generatedAt: Date): string[] {
  const location = [entry.campus, entry.location].filter(Boolean).join(" ");
  return [
    "BEGIN:VEVENT",
    `UID:${escapeIcs(entry.occurrenceId)}@njucli`,
    `DTSTAMP:${formatUtc(generatedAt)}`,
    `DTSTART;TZID=Asia/Shanghai:${compactLocal(entry.date, entry.startTime)}`,
    `DTEND;TZID=Asia/Shanghai:${compactLocal(entry.date, entry.endTime)}`,
    `SUMMARY:${escapeIcs(entry.name)}`,
    ...(location ? [`LOCATION:${escapeIcs(location)}`] : []),
    ...(entry.teachers.length > 0
      ? [`DESCRIPTION:${escapeIcs(`教师：${entry.teachers.join("、")}`)}`]
      : []),
    "END:VEVENT",
  ];
}

function compactLocal(date: string, time: string): string {
  return `${date.replaceAll("-", "")}T${time.replace(":", "")}00`;
}

function formatUtc(value: Date): string {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function foldLine(value: string): string {
  const chunks: string[] = [];
  let current = "";
  for (const character of value) {
    if (Buffer.byteLength(current + character, "utf8") > 73) {
      chunks.push(current);
      current = ` ${character}`;
    } else {
      current += character;
    }
  }
  chunks.push(current);
  return chunks.join("\r\n");
}

import type { AcademicTerm, CourseOfferingPage, CourseOccurrence, CourseSchedule, GraduateCourse } from "./types.js";

const NONE = "无";

export function termsText(terms: AcademicTerm[]): string {
  return terms.length === 0
    ? NONE
    : terms.map((term) => `${term.id}\t${term.name}`).join("\n");
}

export function termText(term: AcademicTerm): string {
  return `${term.name}\t${term.id}`;
}

export function courseOfferingsText(page: CourseOfferingPage): string {
  if (page.items.length === 0)
    return NONE;
  return page.items.map((course) => {
    const teachers = course.teachers.join("、") || "教师待定";
    return `${course.courseCode}\t${course.name}（${course.className}）\t${teachers}\t${course.campus}\t${course.schedule}\t剩余 ${course.remaining}/${course.capacity}\t${course.classId}`;
  }).join("\n");
}

export function selectedCoursesText(courses: GraduateCourse[]): string {
  if (courses.length === 0)
    return NONE;
  return courses.map((course) => {
    const teachers = course.teachers.join("、") || "教师待定";
    return `${course.courseCode}\t${course.name}（${course.className}）\t${teachers}\t${course.campus}\t${course.schedule}\t${course.classId}`;
  }).join("\n");
}

export function scheduleText(schedule: CourseSchedule): string {
  if (schedule.courses.length === 0)
    return `${schedule.term.name}\n${NONE}`;
  const courses = schedule.courses.flatMap((course) => {
    const teachers = course.teachers.join("、") || "教师待定";
    if (course.arrangements.length === 0) {
      return [`${course.name}\t${teachers}\t无固定排课`];
    }
    return course.arrangements.map((arrangement) => {
      const weeks = arrangement.weeks.join(",");
      const place = [arrangement.campus, arrangement.location].filter(Boolean).join(" ") || "地点待定";
      return `${course.name}\t${teachers}\t周${weekdayText(arrangement.weekday)} ${arrangement.startTime}-${arrangement.endTime}\t第 ${weeks} 周\t${place}`;
    });
  });
  return [`学期：${schedule.term.name}`, ...courses].join("\n");
}

export function occurrencesText(occurrences: CourseOccurrence[]): string {
  if (occurrences.length === 0)
    return NONE;
  return occurrences.map((course) => {
    const location = course.location ?? "地点待定";
    return `${course.date} ${course.startTime}-${course.endTime}\t${course.name}\t${location}`;
  }).join("\n");
}

export function occurrenceText(occurrence: CourseOccurrence | null): string {
  return occurrence === null ? NONE : occurrencesText([occurrence]);
}

function weekdayText(weekday: number): string {
  return ["一", "二", "三", "四", "五", "六", "日"][weekday - 1]!;
}

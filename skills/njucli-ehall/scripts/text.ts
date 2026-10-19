import type {
  EHallApplicationPage,
  EHallService,
  EHallServiceLink,
  EHallTaskPage,
  GraduateExam,
  GraduateGrade,
  GraduatePlan,
  GraduateSchedule,
  AcademicTerm,
  CourseOfferingPage,
  CourseOccurrence,
  CourseSchedule,
  GraduateCourse,
} from "./types.js";

const NONE = "无";

export function ehallServicesText(services: EHallService[]): string {
  if (services.length === 0)
    return NONE;
  return services.map((service) => `${service.available ? "可用" : "无权限"}\t${service.name}\t${service.appId}`).join("\n");
}

export function ehallTasksText(page: EHallTaskPage): string {
  if (page.items.length === 0)
    return NONE;
  return page.items.map((task) => `${task.subject}\t${task.node ?? task.status ?? ""}\t${task.author ?? ""}\t${task.time ?? ""}`).join("\n");
}

export function ehallApplicationsText(page: EHallApplicationPage): string {
  if (page.items.length === 0)
    return NONE;
  return page.items.map((item) => `${item.subject}\t${item.node ?? ""}\t${item.startedAt ?? ""}`).join("\n");
}

export function ehallServiceLinkText(link: EHallServiceLink): string {
  return `应用 ID：${link.appId}\n官方入口：${link.url}`;
}

export function graduateGradesText(grades: GraduateGrade[]): string {
  if (grades.length === 0)
    return NONE;
  return grades.map((grade) => `${grade.term ?? "学期未知"}\t${grade.courseCode}\t${grade.courseName}\t${grade.credits ?? "-"}\t${grade.score ?? "未公布"}\t${grade.passed === null ? "" : grade.passed ? "通过" : "未通过"}`).join("\n");
}

export function graduateExamsText(exams: GraduateExam[]): string {
  if (exams.length === 0)
    return NONE;
  return exams.map((exam) => {
    const time = [exam.date, exam.startsAt && exam.endsAt
        ? `${exam.startsAt}-${exam.endsAt}`
        : exam.startsAt].filter(Boolean).join(" ") || "时间未公布";
    return `${exam.kind === "exam" ? "考试" : "考查"}\t${exam.courseCode ?? ""}\t${exam.courseName}\t${time}\t${exam.location ?? "地点未公布"}\t${exam.seat ?? ""}`;
  }).join("\n");
}

export function graduateScheduleText(schedule: GraduateSchedule): string {
  if (schedule.courses.length === 0)
    return `${schedule.term.name}\n${NONE}`;
  return [
    `学期：${schedule.term.name}`,
    ...schedule.courses.map((course) => `${course.courseCode}\t${course.courseName}\t${course.teachers.join("、") || "教师待定"}\t${course.timePlace ?? `星期 ${course.weekday ?? "-"} / 节次 ${course.period ?? "-"}`}\t${course.location ?? ""}`),
  ].join("\n");
}

export function graduatePlanText(plan: GraduatePlan): string {
  const requirements = plan.requirements.map((item) => `要求\t${item.category}\t${item.minimumCredits ?? "-"}-${item.maximumCredits ?? "-"} 学分`);
  const courses = plan.courses.map((course) => `${course.courseCode}\t${course.courseName}\t${course.category ?? ""}\t${course.credits ?? "-"} 学分\t${course.suggestedTerm ?? ""}`);
  return [
    `${plan.name ?? "培养方案"}\t${plan.planId}`,
    ...requirements,
    ...courses,
  ].join("\n");
}

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

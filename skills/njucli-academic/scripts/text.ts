import type { GraduateExam, GraduateGrade, GraduatePlan, GraduateSchedule } from "./types.js";

const NONE = "无";

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

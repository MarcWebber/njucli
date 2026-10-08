import type { SoftSeAssignment, SoftSeCourse, SoftSeCourseSummary, SoftSeGrade, SoftSeLink, SoftSeParticipantPage } from "./types.js";

const NONE = "无";

export function softSeCoursesText(courses: SoftSeCourseSummary[]): string {
  if (courses.length === 0)
    return NONE;
  return courses.map((course) => `${course.name}\t${course.courseId}`).join("\n");
}

export function softSeParticipantsText(page: SoftSeParticipantPage): string {
  const rows = page.items.map((item) => `${item.name}\tMoodle ID: ${item.userId}\t${item.roles}\t${item.groups}`);
  return [
    `课程 ${page.courseId} · 第 ${page.page} 页`,
    rows.length ? rows.join("\n") : NONE,
    ...(page.nextPage === null ? [] : [`下一页：njucli softse participants ${page.courseId} --page ${page.nextPage}`]),
  ].join("\n");
}

export function softSeCourseText(course: SoftSeCourse): string {
  const sections = course.sections.flatMap((section) => [
    `[${section.name}]`,
    ...section.activities.map((activity) => `${activity.type}\t${activity.name}\t${activity.activityId}`),
  ]);
  return [course.name, ...sections].join("\n");
}

export function softSeAssignmentsText(assignments: SoftSeAssignment[]): string {
  if (assignments.length === 0)
    return NONE;
  return assignments.map((assignment) => `${assignment.dueAt ?? "无截止时间"}\t${assignment.submissionStatus}\t${assignment.name}\t课程 ${assignment.courseId}\t作业 ${assignment.activityId}`).join("\n");
}

export function softSeAssignmentText(assignment: SoftSeAssignment): string {
  return [
    `${assignment.name}\t${assignment.activityId}`,
    `提交：${assignment.submissionStatus ?? "未知"}`,
    `评分：${assignment.gradingStatus ?? "未知"}`,
    `截止：${assignment.dueAt ?? "未设置"}`,
    assignment.instructions,
    ...assignment.attachments.map((file) => `附件：${file.name}\t${file.url}`),
    ...assignment.submittedFiles.map((file) => `已交文件：${file.name}\t${file.url}`),
  ].join("\n");
}

export function softSeGradesText(grades: SoftSeGrade[]): string {
  if (grades.length === 0)
    return NONE;
  return grades.map((grade) => `${grade.item}\t${grade.grade ?? "-"}\t${grade.percentage ?? ""}\t${grade.feedback ?? ""}`).join("\n");
}

export function softSeLinkText(link: SoftSeLink): string {
  return `作业活动 ID：${link.activityId}\n官方提交页：${link.url}`;
}

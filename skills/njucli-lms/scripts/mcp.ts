import { z } from "zod";
import type { ReadTool } from "../../../src/mcp/read.js";
import type { LmsServices } from "./services.js";

export function registerLmsTools(read: ReadTool, service: LmsServices): void {
  const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
  const page = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional();
  read("lms_courses", "分页查询智汇南雍课程及教学权限，用 nextPage 翻页。", { page, query: z.string().optional() }, ({ page, query }) => service.courses(page, query));
  read("lms_course", "读取智汇南雍课程信息与学期。", { courseId: id }, ({ courseId }) => service.course(courseId));
  read("lms_activities", "读取智汇南雍课件等学习活动及附件信息。", { courseId: id }, ({ courseId }) => service.activities(courseId));
  read("lms_assignments", "分页查询智汇南雍作业类型活动；测试类型使用 lms_exams。", { courseId: id, page }, ({ courseId, page }) => service.assignments(courseId, page));
  read("lms_assignment", "读取作业正文、截止时间、发布状态及附件。", { activityId: id }, ({ activityId }) => service.assignment(activityId));
  read("lms_exams", "查询智汇南雍测试类型活动，包括使用测试布置的书面作业。", { courseId: id }, ({ courseId }) => service.exams(courseId));
  read("lms_todos", "读取智汇南雍首页待办。", {}, () => service.todos());
}

import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { SoftSeServices } from './services.js';

export function registerSoftSeTools(read: ReadTool, service: SoftSeServices): void {
  read("softse_courses", "List the signed-in user's Software School Moodle courses.", {}, () => service.courses());
  read("softse_catalog", "遍历当前账号可见的全部 SoftSE 课程分类与分页，返回去重后的课程目录。", {}, () => service.catalog());
  read("softse_participants", "分页读取当前账号有权查看的单门课程名单；userId 为 Moodle 用户 ID。", { courseId: z.string().regex(/^[1-9]\d*$/), page: z.number().int().min(1).optional() }, ({ courseId, page }) => service.participants(courseId, page));
  read("softse_search", "Search courses in the Software School Moodle catalog.", { query: z.string().min(1), page: z.number().int().min(1).optional() }, ({ query, page }) => service.search(query, page));
  read("softse_assignments", "List assignments with deadlines and submission state, ordered by due date. Omit courseId for all my courses.", { courseId: z.string().regex(/^\d+$/).optional(), pending: z.boolean().optional() }, ({ courseId, pending }) => service.assignments(courseId, pending));
  read("softse_assignment", "Read assignment instructions, submission state, deadline, and attachment links.", { activityId: z.string().regex(/^\d+$/) }, ({ activityId }) => service.assignment(activityId));
  read("softse_grades", "Read grade items for one Software School course.", { courseId: z.string().regex(/^\d+$/) }, ({ courseId }) => service.grades(courseId));
  read("softse_submission_link", "Return the official assignment edit page without uploading or submitting.", { activityId: z.string().regex(/^\d+$/) }, ({ activityId }) => service.submissionLink(activityId));
}

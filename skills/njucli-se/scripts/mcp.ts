import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { SeServices } from './services.js';

export function registerSeTools(tool: McpTool, service: SeServices): void {
  tool("se_courses", "List the signed-in user's Software School Moodle courses.", {}, () => service.courses());
  tool("se_catalog", "遍历当前账号可见的全部 SE 课程分类与分页，返回去重后的课程目录。", {}, () => service.catalog());
  tool("se_participants", "分页读取当前账号有权查看的单门课程名单；userId 为 Moodle 用户 ID。", { courseId: z.string().regex(/^[1-9]\d*$/), page: z.number().int().min(1).optional() }, ({ courseId, page }) => service.participants(courseId, page));
  tool("se_search", "Search courses in the Software School Moodle catalog.", { query: z.string().min(1), page: z.number().int().min(1).optional() }, ({ query, page }) => service.search(query, page));
  tool("se_assignments", "List assignments with deadlines and submission state, ordered by due date. Omit courseId for all my courses.", { courseId: z.string().regex(/^\d+$/).optional(), pending: z.boolean().optional() }, ({ courseId, pending }) => service.assignments(courseId, pending));
  tool("se_assignment", "Read assignment instructions, submission state, deadline, and attachment links.", { activityId: z.string().regex(/^\d+$/) }, ({ activityId }) => service.assignment(activityId));
  tool("se_grades", "Read grade items for one Software School course.", { courseId: z.string().regex(/^\d+$/) }, ({ courseId }) => service.grades(courseId));
  tool("se_submission_link", "Return the official assignment edit page without uploading or submitting.", { activityId: z.string().regex(/^\d+$/) }, ({ activityId }) => service.submissionLink(activityId));
  tool("se_enroll", "加入指定软件学院课程并回读；需要选课口令时提供 enrolmentKey。", {
    courseId: z.string().regex(/^[1-9]\d*$/), enrolmentKey: z.string().optional(),
  }, ({ courseId, enrolmentKey }) => service.enroll(courseId, enrolmentKey), { destructiveHint: false });
  tool("se_download", "下载指定作业附件，覆盖本地输出文件；submitted 选择本人已提交的附件。", {
    activityId: z.string().regex(/^[1-9]\d*$/), fileName: z.string().min(1), output: z.string().min(1), submitted: z.boolean().optional(),
  }, ({ activityId, fileName, output, submitted }) => service.download(activityId, fileName, output, submitted), { destructiveHint: true });

  tool("se_course", "读取软件学院课程详情。", { courseId: z.string().regex(/^[1-9]\d*$/) }, ({ courseId }) => service.course(courseId));
}

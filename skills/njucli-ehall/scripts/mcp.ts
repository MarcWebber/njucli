import { classroomQuerySchema } from './classrooms.js';
import { scholarshipDraftSchema, scholarshipSubmitSchema } from './scholarship.js';
import { tripInputSchema } from './trip.js';
import { profileInputSchema } from './profile.js';
import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { EHallServices } from './services.js';
import { COURSE_SELECTION_KINDS, EHALL_APPLICATION_STATES, EHALL_TASK_KINDS } from './types.js';
import { PROFILE_KINDS } from './profile.js';

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

const OPTIONAL_TERM = z
  .string()
  .min(1)
  .optional()
  .describe("Academic term ID; omit to use the current term");

export function registerEHallTools(tool: McpTool, service: EHallServices): void {
  tool("ehall_classroom_campuses", "查询空闲教室服务的校区代码。", {}, () => service.classroomCampuses());
  tool("ehall_classroom_buildings", "查询指定校区的教学楼代码。", { campus: classroomQuerySchema.shape.campus }, ({ campus }) => service.classroomBuildings(campus));
  tool("ehall_classrooms", "查询指定日期、校区和连续节次内均空闲的教室，返回教学楼、座位数及空闲时间。", classroomQuerySchema.shape, input => service.classrooms(input));
  tool("ehall_scholarships", "List graduate scholarship offerings.", { page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).optional() }, ({ page, pageSize }) => service.scholarships(page, pageSize));
  tool("ehall_scholarship", "Read scholarship details and award levels.", { awardId: z.string().min(1) }, ({ awardId }) => service.scholarship(awardId));
  tool("ehall_scholarship_applications", "Read the current account's scholarship application statuses.", { page: z.number().int().min(1).optional(), pageSize: z.number().int().min(1).optional() }, ({ page, pageSize }) => service.scholarshipApplications(page, pageSize));
  tool("ehall_scholarship_application", "Read an owned scholarship application and its editable content.", { applicationId: z.string().min(1) }, ({ applicationId }) => service.scholarshipApplication(applicationId));
  tool("ehall_scholarship_form", "Read a scholarship draft template and available batches.", { awardId: z.string().min(1), category: z.enum(["1", "2", "3", "4", "5", "6"]) }, ({ awardId, category }) => service.scholarshipForm(awardId, category));

  tool("ehall_profile", "Read the signed-in graduate student's papers, awards, patents, books, and supervisor projects.", {
    kind: z.enum(PROFILE_KINDS).optional().describe("Omit to read all available categories"),
  }, ({ kind }) => service.profile(kind));
  tool("ehall_profile_fields", "Read current personal-record field requirements, official choices, and edit permissions.", {
    kind: z.enum(PROFILE_KINDS),
  }, ({ kind }) => service.profileFields(kind));
  tool("ehall_services", "Search official NJU EHall service entries.", { query: z.string().optional().describe("Service name keyword") }, ({ query }) => service.services(query));
  tool("ehall_trip", "Read the current graduate holiday travel registration, contact defaults, and missing fields.", {}, () => service.trip());
  tool("ehall_tasks", "List EHall todo, done, or initiated tasks without opening forms.", {
    kind: z.enum(EHALL_TASK_KINDS).default("todo"),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).optional(),
  }, ({ kind, page, pageSize }) => service.tasks(kind, page, pageSize));
  tool("ehall_applications", "List application processes initiated by the signed-in user.", {
    state: z.enum(EHALL_APPLICATION_STATES).default("active"),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).optional(),
  }, ({ state, page, pageSize }) => service.applications(state, page, pageSize));
  tool("ehall_grades", "List the signed-in graduate student's published grades.", { termId: OPTIONAL_TERM }, ({ termId }) => service.grades(termId));
  tool("ehall_exams", "List published exam and assessment arrangements.", { termId: OPTIONAL_TERM }, ({ termId }) => service.exams(termId));
  tool("ehall_graduate_schedule", "List the signed-in graduate student's timetable.", { termId: OPTIONAL_TERM }, ({ termId }) => service.graduateSchedule(termId));
  tool("ehall_plan", "Read the signed-in graduate student's training plan.", {}, () => service.plan());
  tool("ehall_today", "List the signed-in student's courses on one date.", { date: CAMPUS_DATE.optional(), termId: OPTIONAL_TERM }, ({ date, termId }) => service.today(date, termId));
  tool("ehall_week", "List the signed-in student's courses for the week containing a date.", { date: CAMPUS_DATE.optional(), termId: OPTIONAL_TERM }, ({ date, termId }) => service.week(date, termId));
  tool("ehall_next", "Get the signed-in student's next scheduled course.", { termId: OPTIONAL_TERM }, ({ termId }) => service.next(termId));
  tool("ehall_available", "List graduate courses that currently report remaining seats.", {
    kind: z.enum(COURSE_SELECTION_KINDS).default("public").describe("Course scope: program-plan courses or public/cross-department courses"),
    query: z.string().optional().describe("Course code, name, or teacher keyword"),
    page: z.number().int().min(1).optional().describe("One-based result page"),
    pageSize: z.number().int().min(1).optional().describe("Results per page"),
  }, ({ kind, query, page, pageSize }) => service.available(kind, query, page, pageSize));
  tool("ehall_selected", "List the signed-in student's selected graduate courses.", {}, () => service.selected());
  tool("ehall_select", "选择指定研究生课程并回读选课结果。", {
    classId: z.string().min(1), kind: z.enum(COURSE_SELECTION_KINDS).default("public"),
  }, ({ classId, kind }) => service.select(classId, kind), { destructiveHint: false });
  tool("ehall_withdraw", "退选指定研究生课程并回读结果。", { classId: z.string().min(1) }, ({ classId }) => service.withdraw(classId), { destructiveHint: true });
  tool("ehall_profile_add", "新增本人个人资料并回读；dryRun 预览，attachments 为本地附件路径。", {
    kind: z.enum(PROFILE_KINDS), input: profileInputSchema, attachments: z.array(z.string().min(1)).optional(), dryRun: z.boolean().optional(),
  }, ({ kind, input, attachments, dryRun }) => service.addProfile(kind, input, attachments, dryRun), { destructiveHint: false });
  tool("ehall_profile_remove", "删除本人指定个人资料并回读。", {
    kind: z.enum(PROFILE_KINDS), id: z.string().min(1),
  }, ({ kind, id }) => service.removeProfile(kind, id), { destructiveHint: true });
  tool("ehall_scholarship_save", "保存本人奖学金草稿并回读；dryRun 预览，输入中的附件使用本地路径。", {
    input: scholarshipDraftSchema, dryRun: z.boolean().optional(),
  }, ({ input, dryRun }) => service.saveScholarshipDraft(input, dryRun), { destructiveHint: true });
  tool("ehall_scholarship_submit", "预览本人奖学金申请及官网链接；向用户展示并询问是否提交，收到明确同意后设置 confirmed=true 提交草稿并回读。", scholarshipSubmitSchema.shape,
    ({ applicationId, confirmed }) => service.submitScholarship(applicationId, confirmed), { destructiveHint: true });
  tool("ehall_trip_submit", "提交本人假期行程登记并回读；dryRun 预览。", {
    input: tripInputSchema, dryRun: z.boolean().optional(),
  }, ({ input, dryRun }) => service.submitTrip(input, dryRun), { destructiveHint: true });
  tool("ehall_export", "将指定学期课表保存为 ICS，覆盖本地输出文件。", {
    output: z.string().min(1), termId: OPTIONAL_TERM,
  }, ({ output, termId }) => service.export(output, termId), { destructiveHint: true });

  tool("ehall_terms", "列出可用学期。", {}, () => service.terms());
  tool("ehall_current_term", "查询当前学期。", {}, () => service.currentTerm());
  tool("ehall_schedule", "查询指定或当前学期的完整课表。", { termId: OPTIONAL_TERM }, ({ termId }) => service.schedule(termId));
  tool("ehall_link", "返回指定办事大厅应用的官方入口。", { appId: z.string().min(1) }, async ({ appId }) => service.serviceLink(appId));
}

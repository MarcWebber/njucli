import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";
import type { AssignmentInput } from "./commands.js";
import type { SkillRuntime } from "../../../src/app/runtime.js";

const SITE = "https://lms.nju.edu.cn";
const id = z.number().int().positive();
const named = z.object({ id, name: z.string() });
const courseSummary = z.object({
  id, name: z.string(), course_code: z.string(), url: z.url(), is_instructor: z.boolean(),
  instructors: z.array(named), instructor_assistants: z.array(named),
});
const courseDetail = z.object({
  id, name: z.string(), course_code: z.string(), url: z.url(),
  start_date: z.string().nullable(), end_date: z.string().nullable(),
  academic_year: named.nullable(), semester: named.nullable(),
  instructors: z.array(named),
});
const activity = z.object({
  id, title: z.string(), type: z.string(), published: z.boolean(),
  start_time: z.string().nullable(), end_time: z.string().nullable(),
  created_at: z.string(), updated_at: z.string().nullable(),
  data: z.object({ description: z.string().optional() }).passthrough(),
  uploads: z.array(z.record(z.string(), z.unknown())),
});
const exam = z.object({
  id, title: z.string(), published: z.boolean(), created_at: z.string(),
  start_time: z.string().nullable(), end_time: z.string().nullable(),
});
const paging = { page: z.number().int(), page_size: z.number().int(), pages: z.number().int(), total: z.number().int() };

export class LmsClient {
  constructor(private readonly fetch: FetchLike) {}

  async restoreSession(): Promise<boolean> {
    let url = `${SITE}/user/index`;
    for (let redirects = 0; redirects < 20; redirects++) {
      const response = await this.fetch(url, { redirect: "manual" });
      if (response.status >= 300 && response.status < 400) {
        const next = new URL(response.headers.get("location")!, response.url);
        // LMS CAS 返回 HTTP 回调；与浏览器的 HSTS 行为一致，始终通过 HTTPS 交接票据。
        if (next.hostname === "lms.nju.edu.cn") next.protocol = "https:";
        url = next.href;
        continue;
      }
      if (response.status === 401 || new URL(response.url).hostname === "authserver.nju.edu.cn") return false;
      if (response.status === 403) throw new AppError("PERMISSION_DENIED", "智汇南雍拒绝访问，请确认账号的平台权限");
      if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `智汇南雍登录检查返回 HTTP ${response.status}`);
      return new URL(response.url).origin === SITE
        && /\bglobalData\s*=\s*\{\s*user\s*:\s*\{\s*id\s*:\s*\d+/.test(await response.text());
    }
    throw new AppError("REMOTE_UNAVAILABLE", "智汇南雍认证跳转次数过多");
  }

  async courses(page = 1, query = "") {
    const result = parse(z.object({ ...paging, courses: z.array(courseSummary) }), await this.request("/api/my-courses", "POST", {
      page, page_size: 20,
      fields: "id,name,course_code,url,is_instructor,instructors(id,name),instructor_assistants(id,name)",
      conditions: { keyword: query, classify_type: "recently_started" },
    }));
    return { ...result, nextPage: result.page < result.pages ? page + 1 : null };
  }

  async course(courseId: number) {
    return parse(courseDetail, await this.request(`/api/courses/${courseId}?fields=id,name,course_code,url,start_date,end_date,academic_year,semester,instructors(id,name)`));
  }

  async activities(courseId: number) {
    const result = parse(z.object({ activities: z.array(activity) }), await this.request(`/api/courses/${courseId}/activities`));
    return result.activities.map(item => withActivityUrl(item, courseId));
  }

  async assignments(courseId: number, page = 1) {
    const result = parse(z.object({ ...paging, homework_activities: z.array(activity) }),
      await this.request(`/api/courses/${courseId}/homework-activities?page=${page}&page_size=20`));
    return { ...result, homework_activities: result.homework_activities.map(item => withActivityUrl(item, courseId)), nextPage: result.page < result.pages ? page + 1 : null };
  }

  async assignment(activityId: number) {
    const result = parse(activity.extend({ course_id: id }), await this.request(`/api/activities/${activityId}`));
    if (result.id !== activityId) throw new AppError("REMOTE_SCHEMA_CHANGED", "作业详情编号与查询目标存在差异");
    if (result.type !== "homework") throw new AppError("INVALID_INPUT", "该活动属于其他类型，请使用 lms activities 查询");
    return withActivityUrl(result, result.course_id);
  }

  async exams(courseId: number) {
    const result = parse(z.object({ exams: z.array(exam) }), await this.request(`/api/courses/${courseId}/exams`));
    return result.exams;
  }

  async todos() {
    return parse(z.object({ todo_list: z.array(z.record(z.string(), z.unknown())) }), await this.request("/api/todos")).todo_list;
  }

  async createAssignment(courseId: number, input: AssignmentInput, publish = false, notify = false) {
    const created = parse(z.object({ id }), await this.request(`/api/courses/${courseId}/activities`, "POST", {
      title: input.title, type: "homework", description: input.description,
      start_time: input.startTime ?? null, end_time: input.endTime,
      published: publish, notify_by_email: notify, notify_by_todo: notify,
      mode: "normal", submit_by_group: false, non_submit_times: true, submit_times: null,
      score_percentage: 0, score_rule: "highest", score_type: "percentage",
      announce_score_type: 2, announce_answer_status: "no_announce", reference_answer: "",
      allow_retract: true, review_by_instructor: true, instructor_score_percentage: 100,
      review_by_inter: false, rubric_id: 0, show_rubric: false,
      uploads: [], other_resources: [], prerequisites: [], knowledge_node_ids: [],
      completion_criterion: { activity_completion_criterion_type_id: 6, value: 0 },
      using_phase: "unspecified", teaching_model: "online",
    }));
    try {
      const result = await this.assignment(created.id);
      if (result.course_id !== courseId || result.title !== input.title || result.published !== publish
        || result.data.description !== input.description || Date.parse(result.end_time ?? "") !== Date.parse(input.endTime)
        || (input.startTime ? Date.parse(result.start_time ?? "") !== Date.parse(input.startTime) : result.start_time !== null)) {
        throw new Error("作业回读与提交内容不一致");
      }
      return result;
    } catch (cause) {
      throw new AppError("REMOTE_UNAVAILABLE", `作业 ${created.id} 已创建，回读确认尚未完成，请用 lms assignment ${created.id} 核对`, {
        cause, details: { activityId: created.id, courseId },
      });
    }
  }

  private async request(path: string, method = "GET", body?: unknown): Promise<unknown> {
    const response = await this.fetch(`${SITE}${path}`, {
      method, headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (response.status === 401 || new URL(response.url).origin !== SITE) throw new AppError("AUTH_REQUIRED", "请登录智汇南雍", { authCommand: "njucli auth login lms" });
    if (!response.ok) {
      const content = await response.text();
      let details: unknown;
      try { details = JSON.parse(content); } catch { /* HTTP status identifies non-JSON failures. */ }
      throw new AppError("REMOTE_UNAVAILABLE", `智汇南雍返回 HTTP ${response.status}`, { details });
    }
    try { return JSON.parse(await response.text()) as unknown; }
    catch (cause) { throw new AppError("REMOTE_SCHEMA_CHANGED", "智汇南雍响应应为 JSON", { cause }); }
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "智汇南雍响应字段发生变化", { details: result.error.issues });
  return result.data;
}

function withActivityUrl(item: z.infer<typeof activity>, courseId: number) {
  return { ...item, course_id: courseId, url: `${SITE}/course/${courseId}/learning-activity#/${item.id}` };
}

export type LmsServices = Omit<LmsClient, "restoreSession">;

export function createLmsServices({ withBrowser }: SkillRuntime): LmsServices {
  const withLms = <T>(operation: (client: LmsClient) => Promise<T>) =>
    withBrowser("lms", session => operation(new LmsClient(session.request)));
  return {
    courses: (page, query) => withLms(client => client.courses(page, query)),
    course: courseId => withLms(client => client.course(courseId)),
    activities: courseId => withLms(client => client.activities(courseId)),
    assignments: (courseId, page) => withLms(client => client.assignments(courseId, page)),
    assignment: activityId => withLms(client => client.assignment(activityId)),
    exams: courseId => withLms(client => client.exams(courseId)),
    todos: () => withLms(client => client.todos()),
    createAssignment: (courseId, input, publish, notify) => withLms(client => client.createAssignment(courseId, input, publish, notify)),
  };
}

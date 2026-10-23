import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";
import type { AssignmentInput, AssignmentUpdate, SubmissionInput } from "./commands.js";
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
const uploadInfo = z.object({
  id, name: z.string(), type: z.string(), status: z.string(), size: z.number(),
  deleted: z.boolean(), allow_download: z.boolean(), reference_id: z.number().int(),
});

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

  async file(uploadId: number) {
    return parse(uploadInfo, await this.request(`/api/uploads/${uploadId}`));
  }

  async download(uploadId: number): Promise<Uint8Array> {
    const response = await this.fetch(`${SITE}/api/uploads/${uploadId}/blob`, { headers: { Accept: "application/octet-stream" } });
    if (!response.ok || response.headers.get("content-type")?.includes("text/html"))
      throw new AppError("REMOTE_UNAVAILABLE", `智汇南雍文件下载返回 HTTP ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }

  async upload(courseId: number, path: string) {
    const bytes = await readFile(path);
    const created = parse(z.object({ id, name: z.string(), storage_type: z.string(), upload_url: z.url() }),
      await this.request("/api/uploads", "POST", {
        name: basename(path), size: bytes.length, parent_type: "course", parent_id: courseId,
        is_scorm: false, is_wmpkg: false, source: "", is_marked_attachment: false, embed_material_type: "",
      }));
    try {
      if (created.storage_type !== "MEDIA") throw new AppError("USER_ACTION_REQUIRED", `当前文件存储为 ${created.storage_type}，请在官网上传`);
      const form = new FormData();
      form.append("file", new File([new Uint8Array(bytes)], created.name));
      const response = await this.fetch(created.upload_url, { method: "PUT", body: form });
      if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `智汇南雍文件上传返回 HTTP ${response.status}`);
      const result = await this.file(created.id);
      if (result.deleted || result.name !== created.name || result.size !== bytes.length || result.status !== "ready")
        throw new AppError("REMOTE_UNAVAILABLE", "文件已上传，元数据尚未确认就绪，请用 lms file 核对");
      return result;
    } catch (cause) {
      throw new AppError("USER_ACTION_REQUIRED", `文件记录 ${created.id} 已创建，请查询状态后再处理`, { cause, details: { uploadId: created.id } });
    }
  }

  async deleteFile(uploadId: number) {
    await this.request(`/api/uploads/${uploadId}`, "DELETE");
    const response = await this.fetch(`${SITE}/api/uploads/${uploadId}`, { headers: { Accept: "application/json" } });
    if (response.status !== 404 && response.status !== 410) {
      if (!response.ok || !parse(uploadInfo, JSON.parse(await response.text())).deleted)
        throw new AppError("REMOTE_UNAVAILABLE", "文件删除后回读尚未确认", { details: { uploadId } });
    }
    return { uploadId, deleted: true };
  }

  async updateAssignment(activityId: number, input: AssignmentUpdate) {
    const raw = parse(z.record(z.string(), z.unknown()), await this.request(`/api/activities/${activityId}`));
    const before = parse(activity.extend({ course_id: id }), raw);
    if (before.type !== "homework") throw new AppError("INVALID_INPUT", "目标活动不是作业");
    const data = before.data;
    const percentages = parse(z.record(z.string(), z.unknown()), data.homework_score_percentage ?? {});
    const criteria = parse(z.object({ completion_criteria: z.array(z.object({ id, completion_criterion_type: z.string() })) }),
      await this.request(`/api/activities/${activityId}/completion-criteria?activity_type=homework&course_id=${before.course_id}`));
    const criterion = criteria.completion_criteria.find(item => item.completion_criterion_type === raw.completion_criterion_key);
    if (!criterion) throw new AppError("REMOTE_SCHEMA_CHANGED", "无法保留作业原有完成条件");
    const uploads = input.uploadIds ?? before.uploads.map(item => parse(z.object({ id }), item).id);
    const references = await Promise.all(uploads.map(async uploadId => {
      const file = await this.file(uploadId);
      return { upload_id: uploadId, reference_id: file.reference_id, allow_download: file.allow_download };
    }));
    const payload: Record<string, unknown> = {
      ...raw, ...data, title: input.title ?? before.title, description: input.description ?? data.description,
      end_time: input.endTime === undefined ? before.end_time : input.endTime, start_time: input.startTime === undefined ? before.start_time : input.startTime,
      uploads, upload_references: references,
      completion_criterion: { activity_completion_criterion_type_id: criterion.id, value: Number(raw.completion_criterion_value ?? 0) },
    };
    for (const [flag, field] of [["review_by_instructor", "instructor_score_percentage"], ["review_by_inter", "inter_score_percentage"],
      ["review_by_interGroup", "inter_group_score_percentage"], ["review_by_intraGroup", "intra_group_score_percentage"]] as const) {
      payload[flag] = Number(percentages[field] ?? 0) > 0;
      payload[field] = percentages[field] ?? null;
    }
    const inter = parse(z.record(z.string(), z.unknown()), raw.inter_score_map ?? {});
    payload.inter_score_start_time = inter.start_time ?? null;
    payload.inter_score_end_time = inter.end_time ?? null;
    payload.pieces_cnt = inter.pieces_cnt ?? null;
    payload.inter_review_by_submitter = raw.is_inter_review_by_submitter;
    delete payload.data;
    if (payload.start_time && payload.end_time && Date.parse(String(payload.start_time)) >= Date.parse(String(payload.end_time)))
      throw new AppError("INVALID_INPUT", "startTime 必须早于 endTime");
    await this.request(`/api/activities/${activityId}`, "PUT", payload);
    const result = await this.assignment(activityId);
    if (result.title !== payload.title || result.data.description !== payload.description
      || result.uploads.map(item => item.id).join(",") !== uploads.join(",")
      || !sameTime(result.end_time, payload.end_time) || !sameTime(result.start_time, payload.start_time))
      throw new AppError("REMOTE_UNAVAILABLE", "作业已更新，回读与输入尚未匹配", { details: { activityId } });
    return result;
  }

  async publishAssignment(activityId: number, published: boolean) {
    const before = await this.assignment(activityId);
    await this.request(`/api/courses/${before.course_id}/publish-activities`, "POST", {
      published, activity_ids: [activityId], exam_ids: [],
    });
    const result = await this.assignment(activityId);
    if (result.published !== published) throw new AppError("REMOTE_UNAVAILABLE", "作业发布状态回读尚未匹配", { details: { activityId } });
    return result;
  }

  async deleteAssignment(activityId: number) {
    await this.assignment(activityId);
    await this.request(`/api/activities/${activityId}`, "DELETE");
    const response = await this.fetch(`${SITE}/api/activities/${activityId}`, { headers: { Accept: "application/json" } });
    if (response.status !== 404 && response.status !== 410)
      throw new AppError("REMOTE_UNAVAILABLE", "作业删除后回读尚未确认", { details: { activityId, status: response.status } });
    return { activityId, deleted: true };
  }

  async submissions(activityId: number) {
    const response = await this.fetch(`${SITE}/user/index`);
    const match = /\bglobalData\s*=\s*\{\s*user\s*:\s*\{\s*id\s*:\s*(\d+)/.exec(await response.text());
    if (!response.ok || !match) throw new AppError("AUTH_REQUIRED", "请登录智汇南雍", { authCommand: "njucli auth login lms" });
    return parse(z.object({ list: z.array(z.record(z.string(), z.unknown())) }),
      await this.request(`/api/activities/${activityId}/students/${match[1]}/submission_list`)).list;
  }

  async submitAssignment(activityId: number, input: SubmissionInput) {
    const assignment = await this.assignment(activityId);
    const result = parse(z.object({ submission: z.object({ id }) }), await this.request(`/api/course/activities/${activityId}/submissions`, "POST", {
      comment: input.comment ?? "", uploads: input.uploadIds ?? [], slides: [], is_draft: input.draft ?? false,
      mode: assignment.data.mode ?? "normal", other_resources: [], uploads_in_rich_text: [],
      ...(input.multipleChoiceTitle ? { multiple_choice_title: input.multipleChoiceTitle } : {}),
    }));
    const submissionId = result.submission.id;
    try {
      const saved = (await this.submissions(activityId)).find(item => item.id === submissionId);
      if (!saved) throw new Error("本人提交列表尚未出现本次记录");
      return { activityId, submission: saved };
    } catch (cause) {
      throw new AppError("USER_ACTION_REQUIRED", "提交已返回编号，回读尚未确认，请先查询本人提交再处理", { cause, details: { activityId, submissionId } });
    }
  }

  async retractSubmission(activityId: number, submissionId: number) {
    if (!(await this.submissions(activityId)).some(item => item.id === submissionId))
      throw new AppError("INVALID_INPUT", "提交编号不在本人的目标作业记录中");
    await this.request(`/api/submissions/${submissionId}/retract`, "PUT");
    const saved = (await this.submissions(activityId)).find(item => item.id === submissionId);
    if (saved && saved.is_draft !== true) throw new AppError("REMOTE_UNAVAILABLE", "撤回后仍存在正式提交，请查询状态", { details: { activityId, submissionId } });
    return { activityId, submissionId, retracted: true };
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
      throw new AppError(response.status === 403 ? "PERMISSION_DENIED" : "REMOTE_UNAVAILABLE", `智汇南雍返回 HTTP ${response.status}`, { details });
    }
    const text = await response.text();
    if (!text.trim()) return null;
    try { return JSON.parse(text) as unknown; }
    catch (cause) { throw new AppError("REMOTE_SCHEMA_CHANGED", "智汇南雍响应应为 JSON", { cause }); }
  }
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "智汇南雍响应字段发生变化", { details: result.error.issues });
  return result.data;
}

function sameTime(actual: string | null, expected: unknown): boolean {
  if (actual === null || expected === null) return actual === expected;
  return Date.parse(actual) === Date.parse(String(expected));
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
    file: uploadId => withLms(client => client.file(uploadId)),
    download: uploadId => withLms(client => client.download(uploadId)),
    upload: (courseId, path) => withLms(client => client.upload(courseId, path)),
    deleteFile: uploadId => withLms(client => client.deleteFile(uploadId)),
    updateAssignment: (activityId, input) => withLms(client => client.updateAssignment(activityId, input)),
    publishAssignment: (activityId, published) => withLms(client => client.publishAssignment(activityId, published)),
    deleteAssignment: activityId => withLms(client => client.deleteAssignment(activityId)),
    submissions: activityId => withLms(client => client.submissions(activityId)),
    submitAssignment: (activityId, input) => withLms(client => client.submitAssignment(activityId, input)),
    retractSubmission: (activityId, submissionId) => withLms(client => client.retractSubmission(activityId, submissionId)),
  };
}

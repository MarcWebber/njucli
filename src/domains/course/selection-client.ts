import { setTimeout as delay } from "node:timers/promises";

import { z } from "zod";

import type { FetchLike } from "../../core/types.js";
import type {
  CourseOfferingPage,
  CourseSelectionKind,
  GraduateCourse,
} from "./types.js";

export const COURSE_SELECTION_HOME_URL =
  "https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/index_nju.html";
export const COURSE_SELECTION_LOGOUT_URL =
  "https://yjsxk.nju.edu.cn/yjsxkapp/sys/xsxkapp/login/auth/logout.do";

const BASE_URL = "https://yjsxk.nju.edu.cn/yjsxkapp/";
const SESSION_PATH = "sys/xsxkapp/xsxkHome/loadPublicInfo_course.do";
const SELECTED_PATH = "sys/xsxkapp/xsxkCourse/loadStdCourseInfo.do";
const SUBMIT_PATH = "sys/xsxkapp/xsxkCourse/choiceCourse.do";
const WITHDRAW_PATH = "sys/xsxkapp/xsxkCourse/cancelCourse.do";
const RESULT_PATH = "sys/xsxkapp/xsxkCourse/loadXkjgRes.do";
const OFFERING_PATHS: Record<CourseSelectionKind, string> = {
  plan: "sys/xsxkapp/xsxkCourse/loadFanCourseInfo.do",
  public: "sys/xsxkapp/xsxkCourse/loadGxkCourseInfo.do",
};
const SELECTION_TYPES: Record<CourseSelectionKind, string> = {
  plan: "2",
  public: "1",
};

const sessionSchema = z.object({
  loginUserId: z.union([z.string(), z.number()]).nullish(),
  csrfToken: z.string().nullish(),
});

const courseRowSchema = z.object({
  BJDM: z.string().min(1),
  BJMC: z.string(),
  KCDM: z.string().min(1),
  KCMC: z.string().min(1),
  RKJS: z.string(),
  KCKKDWMC: z.string(),
  XQMC: z.string(),
  SKYYMC: z.string(),
  XF: z.number(),
  PKSJDDMS: z.string(),
});

const offeringRowSchema = courseRowSchema.extend({
  DQRS: z.number().int(),
  KXRS: z.number().int(),
  IS_CONFLICT: z.union([z.literal(0), z.literal(1)]),
});

const offeringPageSchema = z.object({
  datas: z.array(offeringRowSchema),
  pageIndex: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});

const selectedPageSchema = z.object({ results: z.array(courseRowSchema) });
const submitSchema = z.object({ code: z.number(), msg: z.string().nullish() });
const resultEnvelopeSchema = z.object({ msg: z.string().nullish() });

export class GraduateCourseSelectionClient {
  constructor(private readonly fetch: FetchLike) {}

  async hasSession(): Promise<boolean> {
    const response = await this.fetch(new URL(SESSION_PATH, BASE_URL), { method: "GET" });
    if (!response.ok) throw new Error(`研究生选课服务返回 HTTP ${response.status}`);
    const body = await response.text();
    if (isLoginPage(body)) return false;
    const session = sessionSchema.parse(JSON.parse(body));
    return Boolean(id(session.loginUserId) && session.csrfToken);
  }

  async listAvailable(
    kind: CourseSelectionKind,
    query = "",
    page = 1,
    pageSize = 20,
  ): Promise<CourseOfferingPage> {
    const form = new URLSearchParams({
      query_keyword: query.trim(),
      query_kkyx: "",
      query_kcfl: "",
      query_kcbq: "",
      query_xqdm: "",
      query_skyydm: "",
      query_sfct: "",
      query_sfym: "0",
      fixedAutoSubmitBug: "",
      pageIndex: String(page),
      pageSize: String(pageSize),
      sortField: "",
      sortOrder: "",
    });
    const value = offeringPageSchema.parse(await this.post(OFFERING_PATHS[kind], form));
    return {
      kind,
      page: value.pageIndex,
      pageSize: value.pageSize,
      total: value.total,
      items: value.datas.map((row) => ({
        ...course(row),
        enrolled: row.DQRS,
        capacity: row.KXRS,
        remaining: row.KXRS - row.DQRS,
        conflict: row.IS_CONFLICT === 1,
      })),
    };
  }

  async listSelected(): Promise<GraduateCourse[]> {
    const value = selectedPageSchema.parse(await this.get(SELECTED_PATH));
    return value.results.map(course);
  }

  async select(classIdInput: string, kind: CourseSelectionKind): Promise<GraduateCourse> {
    const classId = classIdInput.trim();
    if (!classId) throw new Error("classId 不能为空");

    const csrfToken = await this.sessionToken();

    const submit = submitSchema.parse(await this.post(SUBMIT_PATH, new URLSearchParams({
      bjdm: classId,
      lx: SELECTION_TYPES[kind],
      csrfToken,
    })));
    if (submit.code === 0) throw new Error(submit.msg || "选课失败");
    const transactionId = submit.msg?.trim();
    if (!transactionId) throw new Error("选课响应没有事务 ID");

    const result = await this.waitForResult(transactionId);
    if (result.code !== 1) throw new Error(result.msg || "选课失败");

    const selected = (await this.listSelected()).find((item) => item.classId === classId);
    if (!selected) throw new Error("选课结果未出现在已选课程中");
    return selected;
  }

  async withdraw(classIdInput: string): Promise<GraduateCourse> {
    const classId = classIdInput.trim();
    if (!classId) throw new Error("classId 不能为空");
    const selected = (await this.listSelected()).find((item) => item.classId === classId);
    if (!selected) throw new Error("该教学班不在当前已选课程中，未提交退课");

    const csrfToken = await this.sessionToken();
    const result = submitSchema.parse(await this.post(WITHDRAW_PATH, new URLSearchParams({
      bjdm: classId,
      csrfToken,
    })));
    if (result.code !== 1) throw new Error(result.msg || "退课失败");
    if ((await this.listSelected()).some((item) => item.classId === classId)) {
      throw new Error("退课后该教学班仍在已选课程中，请运行 njucli course selected 确认结果");
    }
    return selected;
  }

  private async sessionToken(): Promise<string> {
    const session = sessionSchema.parse(await this.get(SESSION_PATH));
    const csrfToken = session.csrfToken?.trim();
    if (!id(session.loginUserId) || !csrfToken) {
      throw new Error("研究生选课会话无效，请运行 njucli auth login selection");
    }
    return csrfToken;
  }

  private async waitForResult(transactionId: string): Promise<z.infer<typeof submitSchema>> {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const envelope = resultEnvelopeSchema.parse(await this.post(
        RESULT_PATH,
        new URLSearchParams({
          xid: transactionId,
          sfhqdqxkqqs: attempt === 0 ? "1" : "0",
        }),
      ));
      if (envelope.msg?.trim()) return submitSchema.parse(JSON.parse(envelope.msg));
      await delay(1_000);
    }
    throw new Error("选课结果仍在排队，请运行 njucli course selected 确认结果");
  }

  private get(path: string): Promise<unknown> {
    return this.request(path, { method: "GET" });
  }

  private post(path: string, form: URLSearchParams): Promise<unknown> {
    return this.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        "x-requested-with": "XMLHttpRequest",
      },
      body: form.toString(),
    });
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetch(new URL(path, BASE_URL), init);
    if (!response.ok) throw new Error(`研究生选课服务返回 HTTP ${response.status}`);
    const body = await response.text();
    if (isLoginPage(body)) {
      throw new Error("研究生选课会话无效，请运行 njucli auth login selection");
    }
    return JSON.parse(body) as unknown;
  }
}

function course(row: z.infer<typeof courseRowSchema>): GraduateCourse {
  return {
    classId: row.BJDM,
    courseCode: row.KCDM,
    name: row.KCMC,
    className: row.BJMC,
    teachers: row.RKJS.split(/[,，、]/).map((value) => value.trim()).filter(Boolean),
    department: row.KCKKDWMC,
    campus: row.XQMC,
    language: row.SKYYMC,
    credits: row.XF,
    schedule: row.PKSJDDMS,
  };
}

function id(value: string | number | null | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function isLoginPage(body: string): boolean {
  return body.includes("studentLoginBtn") || body.includes("未登录不能选课");
}

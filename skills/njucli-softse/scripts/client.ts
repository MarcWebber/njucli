import { load, type CheerioAPI } from "cheerio";

import { AppError } from "../../../src/core/errors.js";
import { requiredText } from "../../../src/core/guards.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";
import { SOFTSE_SUBMISSION_STATES } from "./types.js";
import type {
  SoftSeActivity,
  SoftSeAssignment,
  SoftSeCourse,
  SoftSeCoursePage,
  SoftSeCourseSummary,
  SoftSeFile,
  SoftSeGrade,
  SoftSeLink,
  SoftSeParticipantPage,
} from "./types.js";

const SOFTSE_BASE_URL = "https://selearning.nju.edu.cn";

export class SoftSeClient {
  constructor(private readonly fetch: FetchLike) {}

  async courses(): Promise<SoftSeCourseSummary[]> {
    const { $, response } = await this.page("/my/");
    const courses = new Map<string, SoftSeCourseSummary>();
    $('a[data-parent-key="mycourses"][href*="/course/view.php?id="]').each((_, element) => {
      const link = $(element);
      const url = absolute(link.attr("href"), response.url);
      const courseId = queryId(url, "id");
      const name = text(link);
      if (name) courses.set(courseId, { courseId, name, url });
    });
    return [...courses.values()];
  }

  async catalog(): Promise<SoftSeCourseSummary[]> {
    const pending = new Set([new URL("/course/index.php", SOFTSE_BASE_URL).href]);
    const courses = new Map<string, SoftSeCourseSummary>();
    for (const url of pending) {
      const { $, response } = await this.page(url);
      const emptyCategory = $("body").attr("id") === "page-course-index-category" &&
        $('#switchcategory select[name="categoryid"]').val() === new URL(url).searchParams.get("categoryid");
      if (new URL(response.url).pathname !== "/course/index.php" ||
          ($(".course_category_tree").length !== 1 && !emptyCategory)) {
        throw new Error("SoftSE 返回的页面不是课程目录");
      }
      for (const course of courseSummaries($, response.url)) courses.set(course.courseId, course);
      $(".course_category_tree .categoryname a[href], .course_category_tree .pagination a[href], .course_category_tree .paging-morelink a[href]")
        .each((_, element) => {
          const href = $(element).attr("href")!;
          if (href.startsWith("#")) return;
          const next = new URL(href, response.url);
          if (next.origin !== SOFTSE_BASE_URL || next.pathname !== "/course/index.php") {
            throw new Error("SoftSE 课程目录包含非目录链接");
          }
          next.hash = "";
          if (next.searchParams.get("page") === "0") next.searchParams.delete("page");
          next.searchParams.sort();
          pending.add(next.href);
        });
    }
    return [...courses.values()];
  }

  async participants(courseId: string, page = 1): Promise<SoftSeParticipantPage> {
    const url = new URL("/user/index.php", SOFTSE_BASE_URL);
    url.search = new URLSearchParams({ id: courseId, page: String(page - 1), perpage: "20" }).toString();
    const { $, response } = await this.page(url.href);
    const target = new URL(response.url);
    if (target.pathname === "/enrol/index.php") {
      throw new AppError("USER_ACTION_REQUIRED", "当前账号没有该课程的名单访问权限");
    }
    if (target.pathname !== "/user/index.php" || target.searchParams.get("id") !== courseId || $("#participants").length !== 1) {
      throw new Error("SoftSE 未返回目标课程名单，或当前账号没有访问权限");
    }
    const items: SoftSeParticipantPage["items"] = [];
    $("#participants tbody tr:not(.emptyrow)").each((_, element) => {
      const row = $(element);
      const link = row.find('th.c0 a[href*="/user/view.php"]').first();
      const profile = new URL(link.attr("href") ?? "", response.url);
      const userId = profile.searchParams.get("id");
      const name = text(link);
      if (profile.origin !== SOFTSE_BASE_URL || profile.pathname !== "/user/view.php" ||
          profile.searchParams.get("course") !== courseId || !userId || !/^\d+$/.test(userId) || !name) {
        throw new Error("SoftSE 课程名单行结构已变化");
      }
      items.push({ userId, name, url: profile.href, roles: text(row.find("td.c1")), groups: text(row.find("td.c2")) });
    });
    const nextPage = $(".pagination a[href]").toArray().some((element) => {
      const next = new URL($(element).attr("href")!, response.url);
      return next.origin === SOFTSE_BASE_URL && next.pathname === "/user/index.php" &&
        next.searchParams.get("id") === courseId && next.searchParams.get("page") === String(page);
    }) ? page + 1 : null;
    return { courseId, page, nextPage, items };
  }

  async search(queryInput: string, page = 1): Promise<SoftSeCoursePage> {
    const query = requiredText(queryInput, "query");
    const url = new URL("/course/search.php", SOFTSE_BASE_URL);
    url.search = new URLSearchParams({
      search: query,
      perpage: "20",
      page: String(page - 1),
    }).toString();
    const { $, response } = await this.page(url.toString());
    return { page, items: courseSummaries($, response.url) };
  }

  async course(courseIdInput: string): Promise<SoftSeCourse> {
    const courseId = courseIdInput.trim();
    const { $, response } = await this.page(`/course/view.php?id=${encodeURIComponent(courseId)}`);
    if (new URL(response.url).pathname === "/enrol/index.php") {
      throw new AppError("USER_ACTION_REQUIRED", "尚未加入该 SoftSE 课程", {
        hint: `运行 njucli softse enroll ${courseId}，或在官方页面完成选课`,
      });
    }
    return parseCourse($, response.url, courseId);
  }

  async assignments(courseId?: string, pending = false): Promise<SoftSeAssignment[]> {
    const ids = courseId === undefined
      ? (await this.courses()).map((course) => course.courseId)
      : [courseId];
    const assignments: SoftSeAssignment[] = [];
    for (const id of ids) {
      const activities = (await this.course(id)).sections
        .flatMap((section) => section.activities)
        .filter((activity) => activity.type === "assign");
      for (const activity of activities) {
        const assignment = await this.assignment(activity.activityId);
        if (!pending || assignment.state !== "submitted") assignments.push(assignment);
      }
    }
    return assignments.sort((a, b) => (a.dueAt ?? "~").localeCompare(b.dueAt ?? "~"));
  }

  async assignment(activityIdInput: string): Promise<SoftSeAssignment> {
    const activityId = activityIdInput.trim();
    const { $, response } = await this.page(`/mod/assign/view.php?id=${encodeURIComponent(activityId)}`);
    const name = text($("#region-main h2").first());
    if (!name || $(".submissionstatustable").length !== 1) {
      throw new Error("SoftSE 页面不是学生作业状态页");
    }
    const status = new Map<string, string>();
    let state: SoftSeAssignment["state"] | undefined;
    $(".submissionstatustable tr").each((_, row) => {
      const label = text($(row).find("th").first()).replace(/：$/, "");
      const cell = $(row).find("td").first();
      const value = text(cell);
      if (label) status.set(label, value);
      if (label === "作业状态") {
        const token = cell.attr("class")?.split(/\s+/).find((value) => value.startsWith("submissionstatus"));
        const remote = token?.slice("submissionstatus".length);
        const known = SOFTSE_SUBMISSION_STATES.find((value) => value === remote);
        if (known) state = known;
        else if (remote === undefined) state = "not-submitted";
        else throw new Error(`未知 SoftSE 提交状态：${remote}`);
      }
    });
    if (!state) throw new Error("SoftSE 作业缺少提交状态");
    const intro = $("#intro").clone();
    intro.find("script,style").remove();
    intro.find("br").replaceWith("\n");
    intro.find("p,li,div").append("\n");
    return {
      activityId,
      courseId: queryId(absolute($('.breadcrumb a[href*="/course/view.php?id="]').first().attr("href"), response.url), "id"),
      name,
      url: response.url,
      instructions: intro.text().replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim(),
      state,
      submissionStatus: status.get("作业状态") ?? null,
      gradingStatus: status.get("评分状态") ?? null,
      dueAt: assignmentDate(status.get("到期日期")),
      modifiedAt: status.get("最后修改") ?? null,
      attachments: files($, "#intro a[href*='/pluginfile.php/']", response.url),
      submittedFiles: files(
        $,
        ".submissionstatustable a[href*='/pluginfile.php/']",
        response.url,
      ),
    };
  }

  async download(activityId: string, fileName: string, submitted = false): Promise<Uint8Array> {
    const assignment = await this.assignment(activityId);
    const candidates = (submitted ? assignment.submittedFiles : assignment.attachments)
      .filter((file) => file.name === fileName);
    if (candidates.length !== 1) throw new AppError("NOT_FOUND", "没有找到唯一匹配的作业文件");
    const url = new URL(candidates[0]!.url);
    url.searchParams.set("forcedownload", "1");
    const response = await this.request(url.toString());
    if (!/^attachment(?:;|$)/i.test(response.headers.get("content-disposition") ?? "")) {
      throw new Error("SoftSE 未返回附件，未保存文件");
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  async grades(courseIdInput: string): Promise<SoftSeGrade[]> {
    const courseId = courseIdInput.trim();
    const { $ } = await this.page(`/grade/report/index.php?id=${encodeURIComponent(courseId)}`);
    const items: SoftSeGrade[] = [];
    $("table.user-grade tbody tr").each((_, row) => {
      const current = $(row);
      const item = text(current.find(".column-itemname").first());
      if (!item) return;
      items.push({
        item,
        weight: cell(current, ".column-weight"),
        grade: cell(current, ".column-grade"),
        range: cell(current, ".column-range"),
        percentage: cell(current, ".column-percentage"),
        feedback: cell(current, ".column-feedback"),
        contribution: cell(current, ".column-contributiontocoursetotal"),
      });
    });
    return items;
  }

  async enroll(courseIdInput: string, enrolmentKey?: string): Promise<SoftSeCourseSummary> {
    const courseId = courseIdInput.trim();
    const { $, response } = await this.page(`/enrol/index.php?id=${encodeURIComponent(courseId)}`);
    const form = $("form").filter((_, element) =>
      $(element).find('input[name="instance"], input[name="sesskey"]').length === 2
    ).first();
    if (form.length === 0) throw new Error("SoftSE 页面没有自助选课表单");

    const password = form.find('input[name="enrolpassword"]');
    if (password.length > 0 && !enrolmentKey?.trim()) {
      throw new AppError("USER_ACTION_REQUIRED", "该课程要求选课密钥", {
        hint: "通过 NJUCLI_SOFTSE_ENROLMENT_KEY 环境变量提供密钥后重试",
      });
    }

    const body = new URLSearchParams();
    form.find('input[type="hidden"][name]').each((_, input) => {
      const current = $(input);
      body.append(current.attr("name")!, current.attr("value") ?? "");
    });
    if (password.length > 0) body.set("enrolpassword", enrolmentKey!.trim());
    const submit = form.find('input[name="submitbutton"]').first();
    body.set("submitbutton", submit.attr("value") ?? "将我加入");

    await this.page(absolute(form.attr("action"), response.url), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const membership = await this.page(`/enrol/index.php?id=${encodeURIComponent(courseId)}`);
    const detail = parseCourse(membership.$, membership.response.url, courseId);
    return {
      courseId,
      name: detail.name,
      url: new URL(`/course/view.php?id=${encodeURIComponent(courseId)}`, SOFTSE_BASE_URL).toString(),
    };
  }

  async submissionLink(activityIdInput: string): Promise<SoftSeLink> {
    const activity = await this.assignment(activityIdInput);
    return {
      activityId: activity.activityId,
      url: new URL(
        `/mod/assign/view.php?id=${activity.activityId}&action=editsubmission`,
        SOFTSE_BASE_URL,
      ).toString(),
    };
  }

  private async page(path: string, init?: RequestInit): Promise<{ $: CheerioAPI; response: FetchResponse }> {
    const response = await this.request(path, init);
    const $ = load(await response.text());
    if ($(".errorbox, .alert-danger, .invalid-feedback").filter((_, element) => text($(element)).length > 0).length) {
      throw new Error("SoftSE 返回错误页面，请在官方页面核对结果");
    }
    return { $, response };
  }

  private async request(path: string, init?: RequestInit): Promise<FetchResponse> {
    const url = new URL(path, SOFTSE_BASE_URL);
    const response = await this.fetch(url, { ...init, redirect: init?.method === "POST" ? "manual" : "follow" });
    if (init?.method === "POST" && [301, 302, 303].includes(response.status)) {
      return this.request(new URL(response.headers.get("location")!, url).href);
    }
    const target = new URL(response.url);
    if (target.hostname === "authserver.nju.edu.cn" || target.pathname === "/login/index.php" ||
        response.status === 401 || response.status === 403) {
      throw new AppError("AUTH_REQUIRED", "SoftSE 会话未登录或已经失效", { authCommand: "njucli auth login softse" });
    }
    if (!response.ok) throw new Error(`SoftSE 返回 HTTP ${response.status}`);
    return response;
  }
}

function courseSummaries($: CheerioAPI, base: string): SoftSeCourseSummary[] {
  return $(".coursebox").toArray().map((element) => {
    const link = $(element).find('.coursename a[href*="/course/view.php"]').first();
    const url = new URL(link.attr("href") ?? "", base);
    const courseId = url.searchParams.get("id");
    const name = text(link);
    if (url.origin !== SOFTSE_BASE_URL || url.pathname !== "/course/view.php" || !courseId || !/^\d+$/.test(courseId) || !name) {
      throw new Error("SoftSE 课程目录条目结构已变化");
    }
    return { courseId, name, url: url.href };
  });
}

function parseCourse($: CheerioAPI, url: string, courseId: string): SoftSeCourse {
  if (new URL(url).pathname !== "/course/view.php" || queryId(url, "id") !== courseId ||
      $("li.section[data-sectionid]").length === 0) {
    throw new Error("SoftSE 返回的页面不是目标课程");
  }
  const sections: SoftSeCourse["sections"] = [];
  $("li.section[data-sectionid]").each((_, section) => {
    const current = $(section);
    const activities: SoftSeActivity[] = [];
    current.find("li.activity[id^='module-']").each((_, activityElement) => {
      const activity = $(activityElement);
      const link = activity.find(".activityinstance a[href]").first();
      if (link.length === 0) return;
      const activityUrl = absolute(link.attr("href"), url);
      const match = activity.attr("id")?.match(/^module-(\d+)$/);
      const type = [...(activity.attr("class")?.split(/\s+/) ?? [])]
        .find((value) => value.startsWith("modtype_"))?.slice(8);
      if (!match?.[1] || !type) return;
      const nameNode = link.find(".instancename").first().clone();
      nameNode.find(".accesshide").remove();
      activities.push({
        activityId: match[1],
        type,
        name: text(nameNode.length > 0 ? nameNode : link),
        url: activityUrl,
      });
    });
    const sectionName = text(current.find(".sectionname").first()) || "未命名章节";
    sections.push({ name: sectionName, activities });
  });
  const name = text($(".page-header-headings h1, #page-header h1, h1").first());
  if (!name) throw new Error("SoftSE 课程页缺少标题");
  return { courseId, name, sections };
}

function files($: CheerioAPI, selector: string, base: string): SoftSeFile[] {
  const result = new Map<string, SoftSeFile>();
  $(selector).each((_, element) => {
    const link = $(element);
    const url = absolute(link.attr("href"), base);
    result.set(url, { name: text(link) || new URL(url).pathname.split("/").pop() || "附件", url });
  });
  return [...result.values()];
}

function cell(row: ReturnType<CheerioAPI>, selector: string): string | null {
  const value = text(row.find(selector).first());
  return value && value !== "-" ? value : null;
}

function text(element: ReturnType<CheerioAPI>): string {
  return element.text().replace(/\s+/g, " ").trim();
}

function absolute(value: string | undefined, base: string): string {
  return new URL(value!, base).toString();
}

function queryId(url: string, name: string): string {
  return new URL(url).searchParams.get(name)!;
}

function assignmentDate(value: string | undefined): string | null {
  if (value === undefined) return null;
  const match = value.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日\s+\S+\s+(\d{2}:\d{2})$/);
  if (!match) throw new Error("SoftSE 截止时间格式已变化");
  const date = parseCampusDate(`${match[1]}-${match[2]!.padStart(2, "0")}-${match[3]!.padStart(2, "0")}`);
  return `${date}T${match[4]}:00+08:00`;
}

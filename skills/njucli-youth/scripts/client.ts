import { load } from "cheerio";

import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";

const BASE = "https://youth.nju.edu.cn/tw/";

interface YouthMenu {
  id: string;
  name: string;
  type: string;
  urlN: string;
}

interface Context {
  userId: string;
  name: string;
  departmentName: string;
  anonymous: boolean;
  menus: YouthMenu[];
}

export type YouthRow = Record<string, unknown> & { id: string | number };
export interface YouthPage<T = YouthRow> {
  page: number;
  size: number;
  total: number;
  items: T[];
}

export interface YouthListOptions {
  page?: number | undefined;
  size?: number | undefined;
  query?: string | undefined;
  year?: string | undefined;
}

export const ACTIVITY_STATES = ["all", "recruiting", "ongoing", "ended"] as const;
export type ActivityState = (typeof ACTIVITY_STATES)[number];
const STATE_QUERY: Record<ActivityState, string> = { all: "all", recruiting: "zmz", ongoing: "jxz", ended: "yjs" };

interface YouthActivity {
  id: string;
  name: string;
  year: string | null;
  organizer: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  registrationStartsAt: string | null;
  registrationEndsAt: string | null;
  enrolled: boolean;
  registrationId: string | null;
  registrationStatus: string | null;
  hours: number | null;
  serviceHours: number | null;
  travelHours: number | null;
  trainingHours: number | null;
  url: string;
}

interface ActivityRow extends YouthRow {
  mc: string;
  xn: { id: string } | null;
  xm: { ssxy: { mc: string } };
  hddd: string;
  hdks: string | null;
  hdjs: string | null;
  bmks: string | null;
  bmjs: string | null;
  dqrsfybm: boolean;
  currentState: { id: string } | null;
}

interface RegistrationRow extends YouthRow {
  hd: ActivityRow;
  shzt: { label: string };
  fwzsc: number;
  fwsc: number;
  jtsc: number;
  pxsc: number;
  pj: string | null;
  pjxj: number | null;
}

interface Envelope<T> {
  code: number;
  msg: string | null;
  data: T;
  extend: Record<string, unknown>;
  count: number;
  pageIndex: number;
  pageSize: number;
}

export interface YouthDocument {
  url: string;
  fields: Array<{ label: string; value: string }>;
  text: string;
  links: Array<{ text: string; url: string }>;
}

export const AWARD_KINDS = ["team", "report", "student", "advisor", "volunteer"] as const;
export type AwardKind = (typeof AWARD_KINDS)[number];

export class YouthClient {
  private context: Context | undefined;

  constructor(private readonly fetch: FetchLike) {}

  async hasSession(): Promise<boolean> {
    const value = await this.json<string>(new URL("ctx", BASE), form({}));
    const context = JSON.parse(Buffer.from(value.data, "base64").toString("utf8")) as Context;
    this.context = context.anonymous ? undefined : context;
    return !context.anonymous;
  }

  async restoreSession(): Promise<boolean> {
    const response = await this.fetch(BASE);
    if (!response.ok) throw new Error(`青年平台登录返回 HTTP ${response.status}`);
    if (new URL(response.url).hostname === "authserver.nju.edu.cn") return false;
    return this.hasSession();
  }

  async profile(): Promise<{ studentId: string; name: string; department: string; volunteer: YouthDocument }> {
    const context = await this.currentContext();
    return {
      studentId: context.userId,
      name: context.name,
      department: context.departmentName,
      volunteer: await this.document("zyz/grzl/create", "/zyz/grzl/create"),
    };
  }

  async menus(): Promise<Array<{ name: string; path: string; url: string }>> {
    return (await this.currentContext()).menus.filter((menu) => menu.urlN).map((menu) => ({
      name: menu.name, path: menu.urlN, url: new URL(menu.urlN.replace(/^\//, ""), BASE).href,
    }));
  }

  async years(): Promise<Array<{ id: string; name: string }>> {
    const url = await this.url("common/selector", "/zyz/wdhd", { clazz: "Xn", valueField: "id", labelField: "mc" });
    const value = await this.json<Array<{ value: string; label: string }>>(url);
    return value.data.map((row) => ({ id: row.value, name: row.label }));
  }

  async hours(year = ""): Promise<{ year: string | null; hours: number; activities: number }> {
    const value = await this.json<null>(await this.url("zyz/wdhd/fwsc", "/zyz/wdhd", { xnid: year }), form({}));
    return { year: year || null, hours: Number(value.extend.fwzsc), activities: Number(value.extend.cjhds) };
  }

  async activities(options: YouthListOptions & { mine?: boolean | undefined; state?: ActivityState | undefined } = {}): Promise<YouthPage<YouthActivity>> {
    const path = options.mine ? "zyz/wdhd" : "zyz/hdzx";
    const result = await this.list<ActivityRow | RegistrationRow>(path, options, {
      queryType: options.mine ? "all" : STATE_QUERY[options.state ?? "recruiting"],
      xmmc: options.query ?? "", xn: options.year ?? "",
    });
    return { ...result, items: result.items.map((row) => {
      const registration = options.mine ? row as RegistrationRow : undefined;
      const activity = registration ? registration.hd : row as ActivityRow;
      const recognized = registration && activity.currentState?.id === "99";
      return {
        id: String(activity.id), name: activity.mc, year: activity.xn?.id ?? null,
        organizer: activity.xm.ssxy.mc, location: activity.hddd,
        startsAt: activity.hdks, endsAt: activity.hdjs,
        registrationStartsAt: activity.bmks, registrationEndsAt: activity.bmjs,
        enrolled: registration ? true : activity.dqrsfybm,
        registrationId: registration ? String(registration.id) : null,
        registrationStatus: registration?.shzt.label ?? null,
        hours: recognized ? registration.fwzsc : null,
        serviceHours: recognized ? registration.fwsc : null,
        travelHours: recognized ? registration.jtsc : null,
        trainingHours: recognized ? registration.pxsc : null,
        url: new URL(`zyz/hdzx/${activity.id}/update?view=true`, BASE).href,
      };
    }) };
  }

  activity(id: string): Promise<YouthDocument> {
    return this.document(`zyz/hdzx/${encodeURIComponent(id)}/update`, "/zyz/hdzx", { view: "true" });
  }

  async enroll(id: string, input: { understanding: string; strengths: string; qq: string; password?: string | undefined }): Promise<YouthActivity> {
    await this.json(await this.url("zyz/hdzx/bm", "/zyz/hdzx", { hdid: id, mm: input.password ?? "" }),
      form({ bhdrs: input.understanding, zwys: input.strengths, qq: input.qq }));
    const row = (await this.allRegistrations()).find((item) => item.id === id);
    if (!row) throw new Error("活动报名已提交，但我的活动中未找到对应记录");
    return row;
  }

  async cancel(registrationId: string): Promise<{ registrationId: string; cancelled: true }> {
    await this.json(await this.url("zyz/wdhd/qxbm", "/zyz/wdhd", { id: registrationId }), form({}));
    if ((await this.allRegistrations()).some((row) => row.registrationId === registrationId)) {
      throw new Error("取消报名已提交，但我的活动中仍存在该记录");
    }
    return { registrationId, cancelled: true };
  }

  async rate(registrationId: string, stars: number, comment: string): Promise<{ registrationId: string; stars: number; comment: string }> {
    await this.json(await this.url("zyz/wdhd/hdpj", "/zyz/wdhd"), form({ id: registrationId, pjxj: stars, pj: comment }));
    const rows = await this.allRows((page) => this.list<RegistrationRow>("zyz/wdhd", { page }, { queryType: "all" }));
    const row = rows.find((item) => String(item.id) === registrationId);
    if (!row || row.pjxj !== stars || row.pj !== comment) throw new Error("活动评价已提交，回读结果未匹配");
    return { registrationId, stars, comment };
  }

  teams(options: YouthListOptions = {}): Promise<YouthPage> {
    return this.list("zyz/tdzz", options, { mc: options.query ?? "", "mc.op": "ILIKE" });
  }

  team(id: string): Promise<YouthDocument> {
    return this.document(`zyz/tdzz/${encodeURIComponent(id)}`, "/zyz/tdzz");
  }

  trainings(options: YouthListOptions = {}): Promise<YouthPage> {
    return this.list("zyz/pxgl/bm", options, { mc: options.query ?? "", "mc.op": "ILIKE" });
  }

  enrollTraining(id: string): Promise<YouthRow> {
    return this.trainingRegistration(id, true);
  }

  cancelTraining(id: string): Promise<YouthRow> {
    return this.trainingRegistration(id, false);
  }

  categories(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("xssq/xssq", options); }
  applications(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("xssq/wdsq", options, { queryType: "all" }); }
  application(id: string): Promise<YouthDocument> { return this.document(`xssq/wdsq/${encodeURIComponent(id)}/update`, "/xssq/wdsq", { view: "true" }); }

  async transcript(options: YouthListOptions = {}): Promise<YouthPage> {
    const context = await this.currentContext();
    return this.list("xssq/zxsck/sqmx", options, { xh: context.userId, mc: options.query ?? "", "mc.op": "ILIKE" }, "/xssq/zxsck");
  }

  async exportTranscript(output: string): Promise<{ path: string; bytes: number }> {
    const context = await this.currentContext();
    const response = await this.request(await this.url("xssq/zxsck/sqmx/export", "/xssq/zxsck", { xh: context.userId, ids: "" }));
    if (!response.headers.get("content-disposition")) throw new Error("青年平台未返回成绩单下载文件");
    return saveFile(output, new Uint8Array(await response.arrayBuffer()));
  }

  courses(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("kcgl/xxzx", options); }
  courseGrades(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("kcgl/cjcx", options); }
  course(id: string): Promise<YouthDocument> { return this.document("kcgl/xxzx/view", "/kcgl/xxzx", { kcid: id }); }
  practices(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("shsj/wdshsj", options); }
  practiceTeams(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("shsj/sjzx", options, { tdmc: options.query ?? "", xn: options.year ?? "" }); }
  practiceResources(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("shsj/sjzlk", options, { tdmc: options.query ?? "", "tdmc.op": "ILIKE", "sz.xn.id": options.year ?? "", "sz.xn.id.op": "EQ" }); }
  practiceJournals(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("shsj/rj", options); }
  practice(id: string): Promise<YouthDocument> { return this.document(`shsj/wdshsj/${encodeURIComponent(id)}/update`, "/shsj/wdshsj", { view: "true" }); }
  practiceTeam(id: string): Promise<YouthDocument> { return this.document(`shsj/sjzx/${encodeURIComponent(id)}`, "/shsj/sjzx"); }
  practiceResource(id: string): Promise<YouthDocument> { return this.document(`shsj/sjzlk/${encodeURIComponent(id)}/update`, "/shsj/sjzlk", { view: "true" }); }

  async clubs(options: YouthListOptions & { mine?: boolean | undefined; category?: string | undefined; stars?: string | undefined; department?: string | undefined } = {}): Promise<YouthPage> {
    const page = options.page ?? 1, size = options.size ?? 20;
    const value = await this.json<YouthRow[]>(await this.url("st/qxstqk/loadData", "/st/qxstqk"), form({
      tab: options.mine ? "mine" : "all", lb: options.category ?? "", xj: options.stars ?? "", dw: options.department ?? "", page, limit: size,
    }));
    return { page: value.pageIndex, size: value.pageSize, total: value.count, items: value.data };
  }

  club(id: string): Promise<YouthDocument> { return this.document("st/qxstqk/view", "/st/qxstqk", { id }); }
  jobs(options: YouthListOptions & { mine?: boolean | undefined } = {}): Promise<YouthPage> { return this.list(options.mine ? "sxgw/wdgw" : "sxgw/gwzx", options, { queryType: "all", mc: options.query ?? "" }); }
  recruitments(options: YouthListOptions & { mine?: boolean | undefined } = {}): Promise<YouthPage> { return this.list(options.mine ? "xsgb/wdbm" : "xsgb/zmzx", options, { queryType: "all" }); }
  tickets(options: YouthListOptions & { mine?: boolean | undefined } = {}): Promise<YouthPage> { return this.list(options.mine ? "dzp/wdpq" : "dzp/pwzx", options, { queryType: "all", mc: options.query ?? "" }); }

  awards(kind: AwardKind, options: YouthListOptions = {}): Promise<YouthPage> {
    const paths: Record<AwardKind, string> = { team: "shsj/yxtd", report: "shsj/yxbg", student: "shsj/yxxs", advisor: "shsj/yxzdls", volunteer: "zyzpy/grsq" };
    return this.list(paths[kind], options);
  }

  projects(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("kcss/sb", options); }
  complaints(options: YouthListOptions = {}): Promise<YouthPage> { return this.list("zyz/wqts", options); }

  private async trainingRegistration(id: string, enrolled: boolean): Promise<YouthRow> {
    const endpoint = enrolled ? "saveBm" : "qxBm";
    await this.json(await this.url(`zyz/pxgl/bm/${endpoint}`, "/zyz/pxgl/bm"), form({ id }));
    const rows = await this.allRows((page) => this.trainings({ page }));
    const row = rows.find((item) => String(item.id) === id);
    if (!row || row.bmzt !== enrolled) throw new Error("培训报名操作已提交，回读结果未匹配");
    return row;
  }

  private allRegistrations(): Promise<YouthActivity[]> {
    return this.allRows((page) => this.activities({ mine: true, page }));
  }

  private async allRows<T>(read: (page: number) => Promise<YouthPage<T>>): Promise<T[]> {
    const result = await read(1);
    const rows = [...result.items];
    for (let page = 2; page <= Math.ceil(result.total / result.size); page++) rows.push(...(await read(page)).items);
    return rows;
  }

  private async list<T = YouthRow>(path: string, options: YouthListOptions, params: Record<string, string> = {}, menu = `/${path}`): Promise<YouthPage<T>> {
    const page = options.page ?? 1, size = options.size ?? 20;
    const value = await this.json<T[]>(await this.url(`${path}/ajaxList`, menu, { page: String(page), limit: String(size), ...params }));
    return { page: value.pageIndex, size: value.pageSize, total: value.count, items: value.data };
  }

  private async document(path: string, menu: string, params: Record<string, string> = {}): Promise<YouthDocument> {
    const url = await this.url(path, menu, params);
    const response = await this.request(url);
    return parseYouthDocument(await response.text(), new URL(path, BASE).href);
  }

  private async currentContext(): Promise<Context> {
    if (!this.context && !await this.hasSession()) throw new AppError("AUTH_REQUIRED", "青年平台尚未登录", { authCommand: "njucli auth login youth" });
    return this.context!;
  }

  private async url(path: string, menuPath: string, params: Record<string, string> = {}): Promise<URL> {
    const menu = (await this.currentContext()).menus.find((item) => item.urlN === menuPath && item.type === "PC");
    const url = new URL(path, BASE);
    url.search = new URLSearchParams(params).toString();
    if (menu) url.searchParams.set(".me", Buffer.from(menu.id).toString("base64"));
    return url;
  }

  private async json<T>(url: URL, init?: RequestInit): Promise<Envelope<T>> {
    const response = await this.request(url, init);
    const value = JSON.parse(await response.text()) as Envelope<T>;
    if (value.code !== 0) throw new Error(`青年平台：${value.msg ?? `错误码 ${value.code}`}`);
    return value;
  }

  private async request(url: URL, init?: RequestInit): Promise<FetchResponse> {
    const response = await this.fetch(url, init);
    if (new URL(response.url).hostname === "authserver.nju.edu.cn" || response.status === 401) {
      throw new AppError("AUTH_REQUIRED", "青年平台会话已失效", { authCommand: "njucli auth login youth" });
    }
    if (!response.ok) throw new Error(`青年平台返回 HTTP ${response.status}`);
    return response;
  }
}

function form(values: Record<string, string | number>): RequestInit {
  return { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest" }, body: new URLSearchParams(Object.entries(values).map(([key, value]) => [key, String(value)])).toString() };
}

function parseYouthDocument(html: string, url: string): YouthDocument {
  const $ = load(html);
  $("script, style, button, .layui-btn-group").remove();
  const fields: YouthDocument["fields"] = [];
  $(".layui-form-label").each((_, label) => {
    const container = $(label).parent();
    const control = container.find("input, textarea, select").first();
    let value: string;
    if (control.is("select")) value = control.find("option[selected]").text() || control.find("option").first().text();
    else if (control.is("input")) value = control.attr("type") === "checkbox" ? (control.attr("checked") !== undefined ? "是" : "否") : control.attr("value") ?? "";
    else if (control.is("textarea")) value = control.text();
    else value = container.find(".layui-input-inline, .layui-input-block").text();
    fields.push({ label: $(label).text().trim().replace(/[：:]$/, ""), value: value.trim() });
  });
  const links: YouthDocument["links"] = [];
  $("a[href]").each((_, anchor) => {
    const href = $(anchor).attr("href")!;
    if (/^(javascript:|#)/i.test(href)) return;
    links.push({ text: $(anchor).text().trim(), url: new URL(href, url).href });
  });
  $("input").each((_, element) => {
    const input = $(element);
    input.replaceWith(input.attr("type") === "hidden" ? "" : input.attr("value") ?? "");
  });
  $("select").each((_, element) => {
    const select = $(element);
    select.replaceWith(select.find("option[selected]").text() || select.find("option").first().text());
  });
  $("br").replaceWith("\n");
  $("div, p, tr, blockquote").append("\n");
  return { url, fields, text: $("body").text().split("\n").map((line) => line.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n"), links };
}

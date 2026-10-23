import { z } from "zod";
import type { SkillRuntime } from "../../../src/app/runtime.js";
import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
import type { FetchLike } from "../../../src/core/types.js";

const BASE = "https://ndyy.nju.edu.cn/zzfw/";
const rowSchema = z.record(z.string(), z.unknown());
const rowsSchema = z.array(rowSchema);
const resultSchema = z.object({ code: z.number(), msg: z.string().nullable().optional(), data: z.unknown(), count: z.number().optional() });
type Row = z.infer<typeof rowSchema>;

export interface HospitalProject {
  id: string;
  name: string;
  bookingId: string;
  campus: string;
  date: string;
  slot: string;
  state: string;
  executedAt: string;
  fees: string;
}

function hospital(fetch: FetchLike) {
  async function hasSession(): Promise<boolean> {
    const response = await fetch(new URL("Pages/Default.Aspx", BASE));
    return response.ok && new URL(response.url).pathname.toLowerCase() === "/zzfw/pages/default.aspx";
  }

  async function initialize(): Promise<void> {
    if (await hasSession()) return;
    const response = await fetch(new URL("asLogin.aspx", BASE));
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `校医院登录返回 HTTP ${response.status}`);
    if (!(await hasSession())) throw new AppError("AUTH_REQUIRED", "校医院需要恢复统一认证会话", { authCommand: "njucli auth login sso" });
  }

  async function kinds() {
    const response = await fetch(new URL("ashx/PageInit.ashx", BASE));
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `校医院菜单返回 HTTP ${response.status}`);
    const menu = z.object({ menuInfo: z.array(z.object({ title: z.string(), child: z.array(z.object({ title: z.string(), href: z.string() })).optional() })) }).parse(JSON.parse(await response.text()));
    return menu.menuInfo.flatMap(group => (group.child ?? []).flatMap(item => {
      const kind = new URL(item.href, new URL("Pages/", BASE)).searchParams.get("MKID");
      return kind ? [{ id: Number(kind), name: item.title }] : [];
    }));
  }

  async function projects(kind: number): Promise<HospitalProject[]> {
    return (await rows("API_Appointment", "selectTaskData", String(kind))).map(row => ({
      id: text(row, "任务ID"), name: text(row, "任务名称"), bookingId: text(row, "预约ID"),
      campus: text(row, "预约校区"), date: text(row, "预约日期"), slot: text(row, "预约时间段"),
      state: text(row, "任务状态"), executedAt: text(row, "执行时间"), fees: text(row, "基础费用"),
    }));
  }

  async function campuses(projectId: string) {
    return (await rows("API_Appointment", "selectTaskXq", projectId)).map(row => ({ name: text(row, "校区") }));
  }

  async function dates(projectId: string, campus: string) {
    return (await rows("API_Appointment", "selectTaskRq", [projectId, campus].join("^"))).map(row => ({
      date: text(row, "日期"), remaining: Number(row["可预约人数"]), note: text(row, "备注"),
    }));
  }

  async function slots(projectId: string, campus: string, date: string) {
    return (await rows("API_Appointment", "selectTaskSjd", [projectId, campus, date].join("^"))).map(row => ({
      slot: text(row, "时间段"), remaining: Number(row["可预约人数"]),
    }));
  }

  async function book(kind: number, projectId: string, campus: string, date: string, slot: string) {
    const before = (await projects(kind)).find(row => row.id === projectId);
    if (!before) throw new AppError("NOT_FOUND", "当前账号没有该预约项目，请使用 projects 返回的 ID");
    if (before.bookingId) throw new AppError("INVALID_INPUT", "该项目已有预约，请先核对当前记录");
    await api("API_Appointment", "insertUserYy", [projectId, campus, date, slot, "12"].join("^"));
    const booking = (await projects(kind)).find(row => row.id === projectId && row.bookingId && row.campus === campus && row.date === date && row.slot === slot);
    if (!booking) throw new AppError("REMOTE_UNAVAILABLE", "预约请求已提交，回读未确认目标时段，请用 projects 核对后再操作", { details: { kind, projectId } });
    return booking;
  }

  async function cancel(kind: number, bookingId: string) {
    const booking = (await projects(kind)).find(row => row.bookingId === bookingId);
    if (!booking) throw new AppError("NOT_FOUND", "当前账号没有该预约，请先用 projects 核对预约 ID");
    if (booking.state !== "1") throw new AppError("INVALID_INPUT", "只有尚未执行的本人预约可以取消");
    await api("API_Appointment", "deleteUserYy", bookingId);
    if ((await projects(kind)).some(row => row.bookingId === bookingId))
      throw new AppError("REMOTE_UNAVAILABLE", "取消请求已提交，回读仍有该预约，请用 projects 核对");
    return { bookingId, cancelled: true };
  }

  async function reports(page: number, pageSize: number) {
    const result = await api("API_Report", "MyHealthReportList", "", { page, limit: pageSize });
    return { page, pageSize, total: result.count ?? rowsSchema.parse(result.data).length, items: rowsSchema.parse(result.data).map(row => ({
      id: text(row, "ID"), name: text(row, "体检名称"), date: text(row, "体检日期"), reviewedAt: text(row, "总检时间"), ready: Number(row["生成状态"]) === 1,
    })) };
  }

  async function downloadReport(id: string, path: string) {
    let page = 1;
    let report: Awaited<ReturnType<typeof reports>>["items"][number] | undefined;
    while (true) {
      const result = await reports(page, 100);
      report = result.items.find(row => row.id === id);
      if (report || page * 100 >= result.total) break;
      page += 1;
    }
    if (!report) throw new AppError("NOT_FOUND", "本人报告列表中没有该报告");
    if (!report.ready) throw new AppError("INVALID_INPUT", "该报告的 PDF 尚未生成");
    const response = await fetch(new URL("Pages/SelfHelp/HealthReport.aspx", BASE));
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `报告页面返回 HTTP ${response.status}`);
    const html = await response.text();
    const uid = html.match(/\bvar\s+UID\s*=\s*["']([^"']+)["']/)?.[1];
    if (!uid) throw new AppError("REMOTE_SCHEMA_CHANGED", "报告页面缺少本人文件下载标识");
    const url = new URL("Ashx/API_ReportFileOtherDown.ashx", BASE);
    url.search = new URLSearchParams({ USID: uid, ID: id }).toString();
    const file = await fetch(url);
    if (!file.ok) throw new AppError("REMOTE_UNAVAILABLE", `报告下载返回 HTTP ${file.status}`);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (Buffer.from(bytes.subarray(0, 5)).toString() !== "%PDF-") throw new AppError("REMOTE_SCHEMA_CHANGED", "报告下载未返回 PDF，请在官网核对生成状态");
    return { id, ...await saveFile(path, bytes) };
  }

  async function hepatitisReports() {
    const result = await api("API_Report", "HepatitisBReportList", "", { page: 1, limit: 100 });
    return rowsSchema.parse(result.data).map(row => ({
      id: text(row, "ID"), year: text(row, "年度"), batch: text(row, "批次"), antigen: text(row, "HBSAG"), antibody: text(row, "HBSAB"), advice: text(row, "医生建议"),
    }));
  }

  async function insuranceInfo() {
    const row = (await rows("API_SIStudent", "selectMyInfo", ""))[0];
    if (!row) throw new AppError("NOT_FOUND", "校医院未返回本人的医保资料");
    return { studentId: text(row, "学号"), name: text(row, "姓名"), campus: text(row, "校区"), department: text(row, "院系"), residenceType: text(row, "户籍性质"), phone: text(row, "手机"), email: text(row, "电子邮件"), insuranceDocumentType: text(row, "医保证件类型"), insuranceDocumentNumber: text(row, "医保证件号") };
  }

  async function insuranceFields() {
    const residence = await rows("API_SIStudent", "selectZD", "户口性质");
    const documents = await rows("API_Common", "selectZD", "^证件类型^^^1^^^");
    return { residenceTypes: residence.map(row => text(row, "值名称")), documentTypes: documents.map(row => ({ value: text(row, "值"), name: text(row, "值") })) };
  }

  async function insuranceRecords(page: number, pageSize: number) {
    const result = await api("API_SIStudent", "selectMySI", "0", { page, limit: pageSize });
    return { page, pageSize, total: result.count ?? rowsSchema.parse(result.data).length, items: rowsSchema.parse(result.data).map(row => ({
      id: text(row, "参保ID"), kind: text(row, "记录性质"), source: text(row, "申请来源"), paid: String(row["费用状态"]) === "1", process: text(row, "流程状态"), startsIn: Number(row["起始年度"]), years: Number(row["年数"]), annualPrice: Number(row["年度价格"]), total: Number(row["总金额"]), payable: Number(row["支付金额"]), effectiveAt: text(row, "生效时间"), createdAt: text(row, "参保时间"),
    })) };
  }

  async function insuranceOpening() {
    const records = await rows("API_SIStudent", "CheckSITime", "");
    return records.map(row => ({ year: Number(row["年度"]), opensAt: text(row, "开放时间"), closesAt: text(row, "截止时间"), description: text(row, "开放说明") }));
  }

  async function rows(handler: string, action: string, params: string): Promise<Row[]> {
    return rowsSchema.parse((await api(handler, action, params)).data);
  }

  async function api(handler: string, action: string, params: string, pagination?: { page: number; limit: number }) {
    const url = new URL(`Ashx/${handler}.ashx`, BASE);
    url.searchParams.set("action", action);
    let init: RequestInit | undefined;
    if (pagination) {
      url.searchParams.set("params", params);
      url.searchParams.set("page", String(pagination.page));
      url.searchParams.set("limit", String(pagination.limit));
    } else init = { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ params }).toString() };
    const response = await fetch(url, init);
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `校医院请求返回 HTTP ${response.status}`);
    if (new URL(response.url).pathname.toLowerCase() === "/zzfw/" || new URL(response.url).hostname === "authserver.nju.edu.cn")
      throw new AppError("AUTH_REQUIRED", "校医院会话已失效", { authCommand: "njucli auth login sso" });
    const result = resultSchema.parse(JSON.parse(await response.text()));
    if (result.code !== 0) throw new AppError("REMOTE_UNAVAILABLE", result.msg || "校医院拒绝本次操作", { details: { action, code: result.code } });
    let data = result.data;
    if (typeof data === "string" && /^[\[{]/.test(data.trim())) {
      try { data = JSON.parse(data); } catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "校医院返回的数据字段不是有效 JSON"); }
    }
    return { ...result, data };
  }
  return { hasSession, initialize, kinds, projects, campuses, dates, slots, book, cancel, reports, downloadReport, hepatitisReports, insuranceInfo, insuranceFields, insuranceRecords, insuranceOpening };
}

function text(row: Row, key: string): string {
  const value = row[key];
  return value === null || value === undefined ? "" : String(value);
}

export function createHospitalServices({ withBrowser }: SkillRuntime) {
  return <T>(operation: (client: ReturnType<typeof hospital>) => Promise<T>): Promise<T> => withBrowser("sso", async session => {
    const client = hospital(session.request);
    await client.initialize();
    return operation(client);
  }, session => hospital(session.request).hasSession());
}

export type HospitalServices = ReturnType<typeof createHospitalServices>;

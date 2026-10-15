import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";

export const SCHOLARSHIP_LINK = "https://ehall.nju.edu.cn/appShow?appId=5907343959144076";
const ROOT = "https://ehallapp.nju.edu.cn/xxfw/sys/yjsjxjappnju";
type Row = Record<string, unknown>;
const rowSchema = z.record(z.string(), z.unknown());
const id = z.string().trim().min(1);
export const scholarshipDraftSchema = z.object({
  applicationId: id.optional(),
  awardId: id.optional(),
  levelId: id.optional(),
  category: z.enum(["1", "2", "3", "4", "5", "6"]).optional(),
  reason: z.string().max(1000).optional(),
  practice: z.string().max(100).optional(),
  research: z.string().max(1000).optional(),
  phone: z.string().max(40).optional(),
  contactPhone: z.string().max(300).optional(),
  email: z.string().email().max(100).optional(),
  attachments: z.array(id).min(1).max(3).optional(),
}).strict().superRefine((v, ctx) => {
  if (v.applicationId ? Boolean(v.awardId || v.levelId || v.category) : !(v.awardId && v.levelId && v.category)) {
    ctx.addIssue({ code: "custom", message: "修改草稿仅指定 applicationId；新建须指定 awardId、levelId 和 category" });
  }
  if (![v.reason, v.practice, v.research, v.phone, v.contactPhone, v.email, v.attachments].some(v => v !== undefined)) {
    ctx.addIssue({ code: "custom", message: "至少填写一个内容字段" });
  }
});
export type ScholarshipDraftInput = z.infer<typeof scholarshipDraftSchema>;
const EDIT_FIELDS = { reason: "SQLY", practice: "BZ5", research: "DZ_KYCX", phone: "BZ18", contactPhone: "BZ19", email: "DZ_DZYX" } as const;
// These are the fields collected by the official save handler, not an arbitrary model update.
const PRESERVED_FIELDS = ["WID", "XSBH", "PCDM", "PDXN", "PDXQ", "JXJDM", "JXJDJDM", "SQDJ", "JE", "DZ_KHJG", "DZ_SFQYSQBSZ", "SQLY", "BZ5", "DZ_KYCX", "BZ18", "BZ19", "DZ_DZYX", "FJ", "HJJL", "DZ_HYDSSHFJCL", ...Array.from({ length: 30 }, (_, i) => `DZ_SQBZ${i + 1}`)];

export class ScholarshipClient {
  private studentId = "";
  constructor(private readonly fetch: FetchLike) {}

  private async prepare(): Promise<void> {
    if (this.studentId) return;
    const response = await this.fetch(SCHOLARSHIP_LINK);
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `奖学金入口 HTTP ${response.status}`);
    const html = await response.text();
    const match = /var\s+pageMeta\s*=\s*(\{[^\n]+\});/.exec(html);
    if (!match?.[1]) throw new AppError("AUTH_EXPIRED", "奖学金应用未返回登录身份，请重新登录 ehall");
    let meta: unknown;
    try { meta = JSON.parse(match[1]); } catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金入口身份格式变化"); }
    const parsed = z.object({ params: z.object({ USERID: id }) }).safeParse(meta);
    if (!parsed.success) throw new AppError("AUTH_EXPIRED", "奖学金应用缺少当前登录学号");
    this.studentId = parsed.data.params.USERID;
  }

  private async post(path: string, params: Record<string, string>): Promise<Row> {
    const response = await this.fetch(ROOT + path, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: ROOT + "/*default/index.do" },
      body: new URLSearchParams(params).toString(),
    });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `奖学金请求 HTTP ${response.status}；写入结果不明时先查询申请，勿直接重试`);
    let value: unknown;
    try { value = JSON.parse(await response.text()); } catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金接口未返回 JSON；写入结果不明时先查询申请"); }
    const parsed = rowSchema.safeParse(value);
    if (!parsed.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金响应格式变化");
    return parsed.data;
  }

  private async page(action: "cxxsysqjxjjl" | "xsdcxjzxx2", params: Record<string, string>, page: number, pageSize: number) {
    const result = await this.post(`/modules/apply/${action}.do`, { ...params, pageNumber: String(page), pageSize: String(pageSize) });
    const parsed = z.object({ code: z.literal("0"), datas: z.record(z.string(), z.object({ totalSize: z.number(), rows: z.array(rowSchema) })) }).safeParse(result);
    const data = parsed.success ? parsed.data.datas[action] : undefined;
    if (!data) throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金列表查询失败或响应结构变化");
    return { ...data, page, pageSize };
  }

  private async query(action: string, kind: "MINE" | "DATAMODEL", params: Row): Promise<Row[]> {
    const result = await this.post(`/commoncall/callQuery/${action}-${kind}-QUERY.do`, {
      requestParams: JSON.stringify(params), actionType: kind, actionName: action, dataModelAction: "QUERY",
    });
    const parsed = z.object({ resultCode: z.literal("00000"), data: z.array(rowSchema) }).safeParse(result);
    if (!parsed.success) throw new AppError("REMOTE_SCHEMA_CHANGED", `奖学金 ${action} 查询失败或响应结构变化`);
    return parsed.data.data;
  }

  async scholarships(page = 1, pageSize = 20) {
    await this.prepare();
    const data = await this.page("xsdcxjzxx2", { XSBH: this.studentId, XSBH1: this.studentId, XSBH2: this.studentId, XSBH3: this.studentId, TJ1: "3", TJ2: "3", TJ3: "3", FHTJ: "" }, page, pageSize);
    return { total: data.totalSize, page, pageSize, items: data.rows.map(row => ({
      awardId: text(row, "JXJDM"), batchId: text(row, "PCDM"), name: text(row, "JXJMC"), academicYear: text(row, "PDXN_DISPLAY"), term: text(row, "PDXQ_DISPLAY"), opensAt: text(row, "SQKSSJ"), closesAt: text(row, "SQJSSJ"), eligibility: text(row, "FHTJ"), description: text(row, "JJ"),
    })) };
  }

  async scholarship(awardId: string) {
    await this.prepare();
    const award = (await this.query("T_JXJ_ZL", "DATAMODEL", { JXJDM: awardId }))[0];
    if (!award) throw new AppError("NOT_FOUND", "未找到奖种");
    const levels = await this.query("cxjxjdj", "MINE", { JXJDM: awardId });
    return { awardId, name: text(award, "JXJMC"), description: text(award, "JJ"), formMode: text(award, "DZ_SFQYSQBSZ"), groupAward: text(award, "SFTT") === "1", levels: levels.map(row => ({ levelId: text(row, "JXJDJDM"), name: text(row, "DJMC"), amount: text(row, "JE") })), link: SCHOLARSHIP_LINK };
  }

  async scholarshipForm(awardId: string, category: string) {
    const award = await this.scholarship(awardId);
    const batches = await this.query("cxpcdydjxlxxx2", "MINE", { FLDM: category, JXJDM: awardId });
    return { award, category, batches: batches.map(row => ({ batchId: text(row, "PCDM"), year: text(row, "PDXN_DISPLAY"), term: text(row, "PDXQ_DISPLAY") })),
      fields: { reason: { maxLength: award.formMode === "1" ? 600 : 1000 }, practice: { maxLength: 100 }, research: { maxLength: 1000 }, phone: {}, contactPhone: {}, email: {}, attachments: { maxFiles: 3, maxBytesPerFile: 5242880 } },
      template: { awardId, levelId: award.levels.length === 1 ? award.levels[0]!.levelId : "", category, reason: "", practice: "" },
    };
  }

  async scholarshipApplications(page = 1, pageSize = 20) {
    await this.prepare();
    const data = await this.page("cxxsysqjxjjl", { XSBH: this.studentId }, page, pageSize);
    return { total: data.totalSize, page, pageSize, items: data.rows.map(application) };
  }

  private async allApplications(): Promise<Row[]> {
    const rows: Row[] = [];
    for (let page = 1; ; page++) {
      const data = await this.page("cxxsysqjxjjl", { XSBH: this.studentId }, page, 100);
      rows.push(...data.rows);
      if (rows.length >= data.totalSize) return rows;
      if (!data.rows.length) throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金分页未返回完整记录");
    }
  }

  private async ownRecord(applicationId: string) {
    const entry = (await this.allApplications()).find(row => text(row, "WID") === applicationId);
    if (!entry) throw new AppError("NOT_FOUND", "当前账号的奖学金申请中未找到该编号");
    const row = (await this.query("T_JXJ_PDXX", "DATAMODEL", { WID: applicationId }))[0];
    if (!row || text(row, "WID") !== applicationId || text(row, "XSBH") !== this.studentId) throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金记录与当前账号不一致");
    return { entry, row };
  }

  private async attachments(token: string) {
    if (!token) return [];
    const response = await this.fetch(`https://ehallapp.nju.edu.cn/xxfw/sys/emapcomponent/file/getUploadedAttachment/${encodeURIComponent(token)}.do`, { method: "POST" });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", "未能回读奖学金附件列表");
    const parsed = z.object({ success: z.literal(true), items: z.array(z.object({ name: z.string(), size: z.union([z.string(), z.number()]) })) }).safeParse(JSON.parse(await response.text()));
    if (!parsed.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "奖学金附件列表格式变化");
    return parsed.data.items;
  }

  async scholarshipApplication(applicationId: string) {
    await this.prepare();
    const { entry, row } = await this.ownRecord(applicationId);
    return { ...application(entry), editable: text(entry, "SHZT") === "0" && text(row, "SHZT") === "0", values: values(row), attachments: await this.attachments(text(row, "FJ")), link: SCHOLARSHIP_LINK };
  }

  async saveScholarshipDraft(input: ScholarshipDraftInput, dryRun = false) {
    const files = await Promise.all((input.attachments ?? []).map(async path => {
      if (![".doc", ".jpg", ".png", ".jpeg", ".bmp", ".docx", ".zip", ".rar", ".pdf", ".xls", ".xlsx", ".txt"].includes(extname(path).toLowerCase())) throw new AppError("INVALID_INPUT", "附件格式不受支持");
      const bytes = await readFile(path);
      if (!bytes.length || bytes.length > 5242880) throw new AppError("INVALID_INPUT", "附件须为非空文件，大小在 5MB 以内");
      return { name: basename(path), bytes };
    }));
    await this.prepare();
    let data: Row;
    let before: Row | undefined;
    if (input.applicationId) {
      const owned = await this.ownRecord(input.applicationId);
      if (text(owned.entry, "SHZT") !== "0" || text(owned.row, "SHZT") !== "0") throw new AppError("INVALID_INPUT", "只允许修改草稿（SHZT=0）；当前申请已进入审核或其他状态");
      before = owned.row;
      data = Object.fromEntries(PRESERVED_FIELDS.filter(key => before![key] !== undefined).map(key => [key, before![key]]));
      data.JXJSQLXCS = required(owned.entry, "FLDM");
    } else {
      const available = await this.query("cxpcdydjxlxxx2", "MINE", { FLDM: input.category, JXJDM: input.awardId });
      if (available.length !== 1) throw new AppError("INVALID_INPUT", "所选分类中未找到唯一开放批次，请从官网核对奖种与分类");
      const batch = available[0]!;
      if (text(batch, "JXJDM") !== input.awardId) throw new AppError("REMOTE_SCHEMA_CHANGED", "奖种与批次不匹配");
      const award = await this.scholarship(input.awardId!);
      if (award.groupAward) throw new AppError("INVALID_INPUT", "团体奖学金需在官网维护团队成员");
      const level = award.levels.find(l => l.levelId === input.levelId);
      if (!level) throw new AppError("INVALID_INPUT", "奖学金等级不属于所选奖种");
      const existing = await this.allApplications();
      if (existing.some(row => text(row, "JXJDM") === input.awardId && text(row, "PDXN") === text(batch, "PDXN"))) throw new AppError("INVALID_INPUT", "本学年已有该奖种申请，请查询并使用现有草稿编号");
      const eligibility = await this.post("/modules/scholarShipApply/studentCanApply.do", { requestParamStr: JSON.stringify({ XSBH: this.studentId, PCDM: required(batch, "PCDM"), JXJDM: input.awardId!, JXJDJDM: input.levelId! }) });
      if (eligibility.returnCode !== "#E000000000000" || !eligibility.data || (eligibility.data as Row).FLAG !== 1) throw new AppError("INVALID_INPUT", "官网未确认当前账号满足该奖种的申请条件");
      const defaults = await this.post("/modules/apply/wysqjbxxbd.do", { XSBH: this.studentId });
      const parsedDefaults = z.object({ code: z.literal("0"), datas: z.object({ wysqjbxxbd: z.object({ rows: z.array(rowSchema).min(1) }) }) }).safeParse(defaults);
      if (!parsedDefaults.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "未能读取当前账号的申请联系方式");
      const contact = parsedDefaults.data.datas.wysqjbxxbd.rows[0]!;
      data = { BZ18: text(contact, "SJH"), BZ19: text(contact, "LXDH"), DZ_DZYX: text(contact, "DZXX"), XSBH: this.studentId, PCDM: required(batch, "PCDM"), PDXN: required(batch, "PDXN"), PDXQ: required(batch, "PDXQ"), JXJDM: input.awardId, JXJDJDM: level.levelId, SQDJ: level.levelId, JE: level.amount, DZ_SFQYSQBSZ: award.formMode, JXJSQLXCS: input.category };
    }
    for (const [key, remote] of Object.entries(EDIT_FIELDS)) {
      const value = input[key as keyof typeof EDIT_FIELDS];
      if (value !== undefined) data[remote] = value;
    }
    if (!["0", "1"].includes(text(data, "DZ_SFQYSQBSZ"))) throw new AppError("REMOTE_SCHEMA_CHANGED", "未知的奖学金表单模式");
    if (text(data, "DZ_SFQYSQBSZ") === "1" && input.reason && input.reason.length > 600) throw new AppError("INVALID_INPUT", "该奖种动态表单申请理由最多 600 字");
    if (files.length && text(data, "FJ")) throw new AppError("INVALID_INPUT", "草稿已有附件；请在官网维护附件，避免替换或删除已有材料");
    const preview = { applicationId: input.applicationId ?? null, awardId: text(data, "JXJDM"), levelId: text(data, "JXJDJDM"), batchId: text(data, "PCDM"), values: values(data), preservesAttachments: Boolean(text(data, "FJ")), attachments: files.map(f => ({ name: f.name, size: f.bytes.length })) };
    if (dryRun) return { saved: false, preview };
    if (!input.applicationId) {
      const generated = (await this.query("zdscwid", "MINE", {}))[0];
      if (!generated) throw new AppError("REMOTE_SCHEMA_CHANGED", "未取得新草稿编号");
      data.WID = required(generated, "WID");
    }
    if (files.length) {
      const scope = randomUUID().replaceAll("-", "");
      const token = scope + "1";
      const orderMap: Record<string, number> = {};
      for (const file of files) {
        const form = new FormData();
        form.set("scope", scope); form.set("fileToken", token); form.set("size", "5120"); form.set("type", extname(file.name).slice(1)); form.set("storeId", "file"); form.set("isSingle", "0"); form.set("fileName", "");
        form.set("bhFile", new Blob([new Uint8Array(file.bytes)]), file.name);
        const response = await this.fetch("https://ehallapp.nju.edu.cn/xxfw/sys/emapcomponent/file/uploadTempFile.do", { method: "POST", body: form });
        if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", "附件上传失败；不会自动重试");
        const result = JSON.parse(await response.text()) as Row;
        if (result.success !== true || typeof result.id !== "string") throw new AppError("REMOTE_UNAVAILABLE", "附件上传未确认成功；不会自动重试");
        orderMap[result.id as string] = Object.keys(orderMap).length + 1;
      }
      const response = await this.fetch(`https://ehallapp.nju.edu.cn/xxfw/sys/emapcomponent/file/saveAttachment/${scope}/${token}.do`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ attachmentParam: JSON.stringify({ storeId: "file", orderMap }), ...(text(data, "DZ_SFQYSQBSZ") === "1" ? { authAppName: "jxjapp", authBeanName: "jxjFileOpAuthManager" } : {}) }).toString(),
      });
      if (!response.ok || (JSON.parse(await response.text()) as Row).success !== true) throw new AppError("REMOTE_UNAVAILABLE", "附件保存未确认成功；不会自动重试");
      const uploaded = await this.attachments(token);
      const expectedFiles = files.map(f => JSON.stringify([f.name, f.bytes.length])).sort();
      const actualFiles = uploaded.map(f => JSON.stringify([f.name, Number(f.size)])).sort();
      if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new AppError("REMOTE_SCHEMA_CHANGED", "上传文件回读不一致，尚未绑定草稿；不会自动重试");
      data.FJ = token;
    }
    if (input.applicationId) {
      const current = await this.ownRecord(input.applicationId);
      if (text(current.entry, "SHZT") !== "0" || text(current.row, "SHZT") !== "0" || PRESERVED_FIELDS.some(k => (current.row[k] ?? null) !== (before![k] ?? null))) throw new AppError("INVALID_INPUT", "草稿内容或状态已变化，请重新读取后再保存");
    }
    // The shared endpoint also submits applications with TYPE=1. Never accept TYPE or raw INDATA from callers.
    const result = await this.post("/modules/scholarShipApply/Applyjxj.do", { data: JSON.stringify({ INDATA: JSON.stringify(data), MODE: "T_JXJ_PDXX", ACTIONTYPE: input.applicationId ? "MODIFY" : "ADD", TYPE: "0" }) });
    if (result.returnCode !== "#E000000000000" || !result.data || String((result.data as Row).flag) !== "1") throw new AppError("REMOTE_UNAVAILABLE", "草稿保存未确认成功，请先查询申请；不会自动重试");
    const applicationId = required(data, "WID");
    const after = await this.ownRecord(applicationId);
    if (text(after.entry, "SHZT") !== "0" || text(after.row, "SHZT") !== "0" || PRESERVED_FIELDS.some(key => data[key] !== undefined && text(after.row, key) !== text(data, key))) {
      throw new AppError("REMOTE_SCHEMA_CHANGED", "保存已返回成功，但草稿状态、内容或附件回读不一致，请到官网核对；不会自动重试");
    }
    return { saved: true, application: application(after.entry), values: values(after.row), reviewUrl: SCHOLARSHIP_LINK, nextStep: "请使用保存草稿的账号打开官网，在“我的申请”中核对该申请，确认无误后自行提交。" };
  }
}
function text(row: Row, key: string): string { const v = row[key]; return v === null || v === undefined ? "" : String(v); }
function required(row: Row, key: string): string { const v = text(row, key); if (!v) throw new AppError("REMOTE_SCHEMA_CHANGED", `奖学金响应缺少 ${key}`); return v; }
function values(row: Row) { return Object.fromEntries(Object.entries(EDIT_FIELDS).map(([key, remote]) => [key, text(row, remote)])); }
function application(row: Row) { return { applicationId: required(row, "WID"), awardId: text(row, "JXJDM"), levelId: text(row, "JXJDJDM"), name: text(row, "JXJMC"), academicYear: text(row, "PDXN_DISPLAY"), term: text(row, "PDXQ_DISPLAY"), statusCode: required(row, "SHZT"), status: required(row, "SHZT_DISPLAY"), appliedAt: text(row, "SQRQ"), returnReason: text(row, "THYY") }; }

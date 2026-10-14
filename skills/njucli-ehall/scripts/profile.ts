import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { z } from "zod";

import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";

const BASE = "https://ehallapp.nju.edu.cn/xxfw/sys/yjsjbxxappnju/";
const APP_ID = "5897665714264135";
export const PROFILE_KINDS = ["papers", "awards", "patents", "books", "projects"] as const;
export type ProfileKind = typeof PROFILE_KINDS[number];
export const profileInputSchema = z.record(z.string(), z.union([z.string(), z.number().finite(), z.boolean()]));
type Input = z.infer<typeof profileInputSchema>;
type Row = Record<string, unknown>;
type Choice = { id: string; name: string };
type Control = { name: string; caption?: string; dataType?: string; xtype?: string; required?: boolean; hidden?: boolean; readonly?: boolean; dataSize?: number | number[]; url?: string; "form.hidden"?: boolean; "form.readonly"?: boolean };
type Model = { name: string; controls: Control[] };
type Definition = { type: number; section: string; model: string; page: string; fields: Record<string, string> };
const DEFINITIONS: Record<ProfileKind, Definition> = {
  papers: { type: 10, section: "JBXXLWQK", model: "xslwqkbd", page: "baseInfo", fields: {
    title: "LWTM", affiliation: "DYSMDW", journal: "FBQK", journalLevel: "KWJB", published: "YL2",
    publishedOn: "FBRQ", acceptedOn: "YL3", wordCount: "ZS", authorRole: "ZZWC", impactFactor: "YXYZ", remarks: "BZ",
  } },
  awards: { type: 7, section: "JBXXXWJL", model: "xsjlxxbd", page: "baseInfo", fields: {
    title: "JLMC", awardedOn: "HJRQ", organization: "JLBM", amount: "JLJE", level: "JLJB", ranking: "HJPMQK", description: "JLSM", remarks: "BZ",
  } },
  patents: { type: 11, section: "JBXXZLQK", model: "xszlqkbd", page: "baseInfo", fields: {
    title: "ZLMC", number: "ZLBH", inventorRank: "BRPM", type: "ZLLX", category: "ZLLB", status: "WCQK", date: "HDSJ",
    projectLevel: "XMJB", projectCategory: "XMLB", projectNumber: "XMH", projectTitle: "XMMC", projectLeaderId: "XMFZRXGH",
    projectLeader: "XMFZRXM", funding: "XMJF", fundingSource: "JFLY", studentRank: "XSPM",
  } },
  books: { type: 13, section: "JBXXZZQK", model: "xszzqkbd", page: "wdxx", fields: {
    title: "ZZM", category: "ZZLB", ranking: "ZZPM", publisher: "CBDW", publishedOn: "CBSJ",
  } },
  projects: { type: 14, section: "JBXXDSKYXM", model: "dskyxmqkbd", page: "wdxx", fields: {
    title: "XMMC", participatedOn: "CYSJ", hasPublication: "FBJG",
  } },
};

type ProfileField = { name: string; label: string; required: boolean; requiredWhen?: { published: boolean }; type: string; maxLength: number | null; choices?: Choice[] };
type ProfileRecord = { id: string; title: string; values: Input; attachmentToken: string | null };
type Context = { userId: string; editable: boolean; requiresReview: boolean; sections: Row[] };

/** 研究生个人扩展资料，沿用官方的栏目配置、表单模型与整组保存流程。 */
export class EHallProfileClient {
  private referer = new URL("*default/index.do", BASE).href;
  private models = new Map<string, Model[]>();
  constructor(private readonly fetch: FetchLike) {}

  async profile(kind?: ProfileKind) {
    const context = await this.prepare();
    const categories = [];
    for (const current of kind ? [kind] : PROFILE_KINDS) {
      const section = context.sections.find((s) => s.NRDZ === DEFINITIONS[current].section);
      if (!section) {
        if (kind) throw new AppError("NOT_FOUND", "当前账号未开放此资料栏目");
        continue;
      }
      const controls = await this.controls(current);
      categories.push({ ...this.category(current, context, section), fields: this.fields(current, controls),
        records: (await this.rows(current, context.userId)).map((r) => this.record(current, r)) });
    }
    return { url: `${this.referer}#/wdxx`, categories };
  }

  async profileFields(kind: ProfileKind) {
    const context = await this.prepare();
    const section = this.section(kind, context);
    const controls = await this.controls(kind);
    const fields = this.fields(kind, controls);
    for (const field of fields) {
      const control = controls.find((c) => c.name === DEFINITIONS[kind].fields[field.name])!;
      if (control.url) field.choices = await this.choices(control);
    }
    return { ...this.category(kind, context, section), fields,
      attachments: controls.some((c) => c.name === "FJ" && visible(c)) };
  }

  async addProfile(kind: ProfileKind, input: Input, attachments: string[] = [], dryRun = false) {
    const context = await this.prepare();
    const section = this.section(kind, context);
    this.canEdit(kind, context, section);
    const controls = await this.controls(kind);
    const row = await this.inputRow(kind, input, controls);
    const attachmentControl = controls.find((c) => c.name === "FJ" && visible(c));
    if (attachments.length && !attachmentControl) throw new AppError("INVALID_INPUT", "此栏目当前未开放附件上传");
    if (attachmentControl?.required && !attachments.length) throw new AppError("INVALID_INPUT", "请提供佐证材料附件");
    const files = await Promise.all(attachments.map(async (path) => ({ name: basename(path), bytes: await readFile(path) })));
    const previous = await this.rows(kind, context.userId);
    const payload: Row = { ...row, XSBH: context.userId, TYPE: DEFINITIONS[kind].type, NRDM: string(section, "NRDM"),
      ...(kind === "papers" ? { YL1: "0" } : {}) };
    const plan = { kind, name: string(section, "NRMC"), values: input, attachments: files.map((f) => ({ name: f.name, size: f.bytes.length })),
      previousCount: previous.length, requiresReview: context.requiresReview };
    if (dryRun) return { submitted: false as const, plan };
    if (files.length) payload.FJ = await this.upload(files);
    // 官网保存整个栏目；每条原记录原样保留，再追加本次资料。
    await this.custom("modules/infoStudent/saveStuExtendInfo.do", [
      ...previous.map((r) => ({ ...r, TYPE: payload.TYPE, NRDM: payload.NRDM })), payload,
    ], "data");
    const saved = await this.rows(kind, context.userId);
    const previousIds = new Set(previous.map((r) => string(r, "WID")));
    const added = saved.filter((r) => !previousIds.has(string(r, "WID")) && matches(r, payload));
    if (added.length !== 1 || previous.some((old) => !saved.some((r) => r.WID === old.WID && matches(r, old)))) {
      throw new AppError("REMOTE_SCHEMA_CHANGED", "保存后未能核对新增资料及原有记录", { hint: `先运行 njucli ehall profile ${kind} 核对，勿直接重复提交` });
    }
    if (files.length) await this.verifyAttachments(String(payload.FJ), files);
    return { submitted: true as const, plan, record: this.record(kind, added[0]!) };
  }

  async removeProfile(kind: ProfileKind, id: string) {
    const context = await this.prepare();
    this.canEdit(kind, context, this.section(kind, context));
    const previous = await this.rows(kind, context.userId);
    const row = previous.find((r) => r.WID === id);
    if (!row) throw new AppError("NOT_FOUND", "本人资料中没有此记录");
    if (row.KZXXWID || (kind === "papers" && String(row.YL1) !== "0")) throw new AppError("USER_ACTION_REQUIRED", "此记录由学校系统维护，请联系对应管理部门");
    await this.custom("modules/infoStudent/deleteStuExtendInfo.do", { ...row, TYPE: DEFINITIONS[kind].type, NRDM: string(this.section(kind, context), "NRDM") });
    const saved = await this.rows(kind, context.userId);
    if (saved.some((r) => r.WID === id) || previous.some((old) => old.WID !== id && !saved.some((r) => r.WID === old.WID && matches(r, old)))) {
      throw new AppError("REMOTE_SCHEMA_CHANGED", "删除后回读核对失败", { hint: `运行 njucli ehall profile ${kind} 查看当前资料` });
    }
    return { removed: true as const, kind, id, title: this.record(kind, row).title };
  }

  private async prepare(): Promise<Context> {
    this.models.clear();
    const response = await this.fetch(`https://ehall.nju.edu.cn/appShow?appId=${APP_ID}`);
    const html = await this.responseText(response);
    const url = new URL(response.url);
    if (url.origin !== new URL(BASE).origin || !url.pathname.startsWith(new URL(BASE).pathname)) throw new AppError("AUTH_REQUIRED", "未能进入研究生个人信息应用");
    this.referer = response.url;
    const meta = html.match(/var pageMeta\s*=\s*(\{[^\n]*\});/);
    if (!meta) throw schema("pageMeta");
    const userId = string((JSON.parse(meta[1]!) as { params: Row }).params, "USERID");
    const config = await this.post("../swpubapp/indexmenu/getAppConfig.do?appId=" + APP_ID + "&appName=yjsjbxxappnju", {});
    const roles = (config.HEADER as { dropMenu: { id: string; active?: boolean }[] })?.dropMenu;
    if (!Array.isArray(roles)) throw schema("应用角色");
    const role = roles.find((r) => r.active) ?? (roles.length === 1 ? roles[0] : undefined);
    if (!role || !/^\d+$/.test(role.id)) throw schema("当前应用角色");
    const changed = await this.post(`../funauthapp/api/changeAppRole/yjsjbxxappnju/${role.id}.do`, {});
    if (changed.success !== true) throw schema("应用角色切换");
    await this.post("../swpubapp/userinfo/setXgCommonAppRole.do", { requestParamStr: JSON.stringify({ ROLEID: role.id }) });
    const batch = (await this.custom("modules/infoStudent/getStuBatchInfo.do", { XSBH: userId })).data as Row;
    if (!batch || batch.XSBH !== userId) throw schema("本人维护批次");
    const open = batch.SFXS === "0" || (typeof batch.XTDQSJ === "string" && typeof batch.WHKSRQ === "string" && typeof batch.WHJSRQ === "string" && batch.XTDQSJ >= batch.WHKSRQ && batch.XTDQSJ <= batch.WHJSRQ);
    const flow = open ? (await this.custom("modules/infoStudent/getLcslInfo.do", { SLDM: string(batch, "SHLC") }, "data")).data : [];
    if (!Array.isArray(flow)) throw schema("维护审核流程");
    const requiresReview = open && flow.length > 1;
    const editable = !!batch.PCDM && (open ? !requiresReview || batch.SHZT === undefined || String(batch.SHZT) === "0" || batch.SFTH === "1" || batch.SHZT === "99" : batch.SFYXRCWH === "1");
    const groups = (await this.custom("../swpubapp/baseInfoSet/getSetFzInfo.do", { APP: "yjsjbxxappnju", querySetting: JSON.stringify([[{ name: "NRLXDM", caption: "", builder: "equal", linkOpt: "AND", value: "LXDM5" }, { name: "NRLXDM", caption: "", builder: "equal", linkOpt: "OR", value: "LXDM3" }]]) })).data;
    if (!Array.isArray(groups)) throw schema("资料分组");
    const sections: Row[] = [];
    for (const group of groups as Row[]) {
      const list = (await this.custom("../swpubapp/baseInfoSet/getSetNrInfo.do", { APP: "yjsjbxxappnju", ID: string(group, "id") })).data;
      if (!Array.isArray(list)) throw schema("资料栏目");
      sections.push(...list as Row[]);
    }
    return { userId, editable, requiresReview, sections };
  }

  private section(kind: ProfileKind, context: Context): Row {
    const result = context.sections.find((s) => s.NRDZ === DEFINITIONS[kind].section);
    if (!result) throw new AppError("NOT_FOUND", "当前账号未开放此资料栏目");
    return result;
  }

  private category(kind: ProfileKind, context: Context, section: Row) {
    return { kind, name: string(section, "NRMC"), editable: context.editable && section.CZLX === "1" && section.XSKWH === "1", requiresReview: context.requiresReview };
  }

  private canEdit(kind: ProfileKind, context: Context, section: Row) {
    if (!this.category(kind, context, section).editable) throw new AppError("USER_ACTION_REQUIRED", "当前维护批次或资料栏目不允许编辑", { hint: "请在官方页面确认开放时间与审核状态" });
  }

  private async controls(kind: ProfileKind): Promise<Control[]> {
    const definition = DEFINITIONS[kind];
    let models = this.models.get(definition.page);
    if (!models) {
      const result = await this.post(`modules/${definition.page}.do`, { "*json": "1" });
      if (!Array.isArray(result.models)) throw schema("表单模型");
      models = result.models as Model[];
      this.models.set(definition.page, models);
    }
    const controls = models.find((m) => m.name === definition.model)?.controls;
    if (!Array.isArray(controls)) throw schema(definition.model);
    return controls;
  }

  private fields(kind: ProfileKind, controls: Control[]): ProfileField[] {
    return Object.entries(DEFINITIONS[kind].fields).flatMap(([name, remote]) => {
      const c = controls.find((item) => item.name === remote);
      if (!c || !visible(c)) return [];
      return [{ name, label: c.caption ?? remote, required: c.required === true,
        ...(kind === "papers" && ["FBRQ", "YL3"].includes(remote) ? { requiredWhen: { published: remote === "FBRQ" } } : {}),
        type: ["published", "hasPublication"].includes(name) ? "boolean" : c.xtype === "date-local" ? "date" : c.url ? "choice" : c.dataType === "int" ? "integer" : c.dataType === "double" ? "number" : "string", maxLength: typeof c.dataSize === "number" && c.dataType === "String" ? c.dataSize : null }];
    });
  }

  private async inputRow(kind: ProfileKind, input: Input, controls: Control[]): Promise<Row> {
    const fields = this.fields(kind, controls);
    const row: Row = {};
    for (const [name, value] of Object.entries(input)) {
      const field = fields.find((f) => f.name === name);
      if (!field) throw new AppError("INVALID_INPUT", `当前表单不支持字段：${name}`);
      const control = controls.find((c) => c.name === DEFINITIONS[kind].fields[name])!;
      let result: string;
      if (field.type === "boolean") {
        if (typeof value !== "boolean") throw new AppError("INVALID_INPUT", `${name} 应为 true 或 false`);
        result = value ? "1" : "0";
      } else if (field.type === "number" || field.type === "integer") {
        if (typeof value !== "number" || value < 0 || (field.type === "integer" && !Number.isSafeInteger(value))) throw new AppError("INVALID_INPUT", `${name} 应为非负${field.type === "integer" ? "整数" : "数值"}`);
        result = String(value);
        if (Array.isArray(control.dataSize)) {
          const [digits, precision] = control.dataSize;
          const [whole, fraction = ""] = result.split(".");
          if (result.includes("e") || whole!.length + fraction.length > digits! || fraction.length > precision!) throw new AppError("INVALID_INPUT", `${name} 超出官网允许的金额精度`);
        } else if (typeof control.dataSize === "number" && result.length > control.dataSize) throw new AppError("INVALID_INPUT", `${name} 超出官网允许的长度`);
      } else {
        if (typeof value !== "string" || !value.trim()) throw new AppError("INVALID_INPUT", `${name} 应为非空文本`);
        result = value.trim();
        if (field.maxLength !== null && result.length > field.maxLength) throw new AppError("INVALID_INPUT", `${name} 最多 ${field.maxLength} 个字符`);
        if (field.type === "date" && !z.iso.date().safeParse(result).success) throw new AppError("INVALID_INPUT", `${name} 应为有效日期 YYYY-MM-DD`);
        if (field.type === "choice") {
          const matches = (await this.choices(control)).filter((c) => c.id === result || c.name.trim() === result);
          if (matches.length !== 1) throw new AppError("INVALID_INPUT", `${field.label}无法唯一匹配：${result}`, { hint: `运行 njucli ehall profile-fields ${kind} 获取官网选项` });
          result = matches[0]!.id;
        }
      }
      row[control.name] = result;
    }
    if (kind === "papers") {
      if (input.published === true && input.acceptedOn !== undefined) throw new AppError("INVALID_INPUT", "已发表论文填写 publishedOn；录用日期用于尚未发表的论文");
      if (input.published === false && input.publishedOn !== undefined) throw new AppError("INVALID_INPUT", "尚未发表的论文填写 acceptedOn");
    }
    for (const control of controls.filter((c) => visible(c) && c.required && c.name !== "FJ" && c.name !== "YL1")) {
      if (kind === "papers" && ((control.name === "FBRQ" && input.published === false) || (control.name === "YL3" && input.published === true))) continue;
      if (row[control.name] === undefined) throw new AppError("INVALID_INPUT", `请填写：${control.caption ?? control.name}`, { hint: `运行 njucli ehall profile-fields ${kind} 查看填写字段` });
    }
    return row;
  }

  private record(kind: ProfileKind, row: Row): ProfileRecord {
    const values: Input = {};
    for (const [name, remote] of Object.entries(DEFINITIONS[kind].fields)) {
      if (row[remote] === undefined || row[remote] === null || row[remote] === "") continue;
      values[name] = ["published", "hasPublication"].includes(name) ? String(row[remote]) === "1" : String(row[`${remote}_DISPLAY`] ?? row[remote]);
    }
    return { id: string(row, "WID"), title: string(row, DEFINITIONS[kind].fields.title!), values, attachmentToken: row.FJ ? String(row.FJ) : null };
  }

  private async rows(kind: ProfileKind, userId: string): Promise<Row[]> {
    const data = (await this.custom("modules/infoStudent/getStuExtendInfo.do", { TYPE: DEFINITIONS[kind].type, XSBH: userId })).data;
    if (!Array.isArray(data) || data.some((r: Row) => r.XSBH !== userId)) throw schema("本人扩展资料");
    for (const row of data as Row[]) string(row, "WID");
    return data as Row[];
  }

  private async choices(control: Control): Promise<Choice[]> {
    const url = new URL(control.url!, BASE);
    if (url.origin !== new URL(BASE).origin || !url.pathname.startsWith("/xxfw/code/")) throw schema("字段字典地址");
    const value = await this.post(url.href, {});
    const rows = (value.datas as { code?: { rows?: Choice[] } })?.code?.rows;
    if (!Array.isArray(rows) || rows.some((r) => typeof r.id !== "string" || typeof r.name !== "string")) throw schema("字段字典");
    return rows.map((r) => ({ id: r.id, name: r.name.trim() }));
  }

  private async upload(files: { name: string; bytes: Buffer }[]) {
    const scope = randomUUID().replaceAll("-", "");
    const token = `${scope}1`;
    const orderMap: Record<string, number> = {};
    for (const file of files) {
      const form = new FormData();
      for (const [name, value] of Object.entries({ scope, fileToken: token, storeId: "file", isSingle: "0", size: "0" })) form.set(name, value);
      form.set("files[]", new Blob([new Uint8Array(file.bytes)], { type: "application/octet-stream" }), file.name);
      const response = await this.fetch(new URL("../emapcomponent/file/uploadTempFile.do", BASE), { method: "POST", headers: { referer: this.referer }, body: form });
      const result = JSON.parse(await this.responseText(response)) as Row;
      if (result.success !== true) throw new AppError("REMOTE_UNAVAILABLE", String(result.msg ?? "附件上传失败"));
      orderMap[string(result, "id")] = Object.keys(orderMap).length + 1;
    }
    const saved = await this.post(`../emapcomponent/file/saveAttachment/${scope}/${token}.do`, { scope, fileToken: token,
      attachmentParam: JSON.stringify({ storeId: "file", orderMap }), authAppName: "yjsjbxxappnju", authBeanName: "jbxxFileOpAuthManager" });
    if (saved.success !== true || saved.successCount !== files.length) throw new AppError("REMOTE_UNAVAILABLE", String(saved.msg ?? saved.content ?? "附件保存失败"));
    return token;
  }

  private async verifyAttachments(token: string, files: { name: string; bytes: Buffer }[]) {
    // 文件权限由个人资料中的 FJ 关联决定；记录保存后再读取附件。
    const readback = await this.post(`../emapcomponent/file/getUploadedAttachment/${token}.do`, {});
    const items = readback.items as { name: string; size: string | number }[];
    if (readback.success !== true || !Array.isArray(items) || items.length !== files.length || files.some((file) => !items.some((item) => item.name === file.name && Number(item.size) === file.bytes.length))) throw schema("附件回读");
  }

  private custom(path: string, data: unknown, parameter = "requestParamStr") {
    return this.post(path, { [parameter]: JSON.stringify(data) });
  }

  private async post(path: string, params: Record<string, string>): Promise<Row> {
    const response = await this.fetch(new URL(path, BASE), { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest", referer: this.referer }, body: new URLSearchParams(params).toString() });
    const value = JSON.parse(await this.responseText(response)) as Row;
    if ((value.returnCode !== undefined && value.returnCode !== "#E000000000000") || (value.code !== undefined && String(value.code) !== "0")) throw new AppError("REMOTE_UNAVAILABLE", String(value.description ?? value.msg ?? "个人资料请求失败"));
    return value;
  }

  private async responseText(response: Awaited<ReturnType<FetchLike>>) {
    if ([401, 403].includes(response.status) || new URL(response.url).hostname === "authserver.nju.edu.cn") throw new AppError("AUTH_REQUIRED", "个人资料会话失效或当前角色无权限");
    if (!response.ok) throw new Error(`个人资料接口返回 HTTP ${response.status}`);
    return response.text();
  }
}

function visible(c: Control) { return !c.hidden && !c["form.hidden"] && !c.readonly && !c["form.readonly"]; }
function schema(part: string) { return new AppError("REMOTE_SCHEMA_CHANGED", `个人资料接口结构已变化：${part}`); }
function string(row: Row, key: string): string {
  if (typeof row[key] !== "string" || !row[key]) throw schema(key);
  return row[key] as string;
}
function matches(actual: Row, expected: Row) {
  return Object.entries(expected).filter(([key]) => !key.endsWith("_DISPLAY") && key !== "TYPE" && key !== "NRDM")
    .every(([key, value]) => String(actual[key] ?? "") === String(value ?? ""));
}

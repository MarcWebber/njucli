import { join } from "node:path";
import { z } from "zod";

import { AppError } from "../../core/errors.js";
import { readJsonFile, writeJsonFile } from "../../core/fs.js";
import type { FetchLike } from "../../core/types.js";

const APP_ID = "6092355728536569";
const BASE = "https://ehallapp.nju.edu.cn/xxfw/sys/yjsjjrlfxappnju/";
const ENTRY = `https://ehall.nju.edu.cn/appShow?appId=${APP_ID}`;
const text = (max: number) => z.string().trim().min(1).max(max);
const stopSchema = z.strictObject({
  from: z.iso.date(), to: z.iso.date(), destination: text(200), address: text(900),
  transport: text(40), serviceNumber: text(40).optional(),
});

export const tripInputSchema = z.strictObject({
  holidayId: text(40).optional(),
  stayOnCampus: z.boolean(),
  phone: text(300).optional(), emergencyContact: text(90).optional(), emergencyPhone: text(40).optional(),
  onCampus: z.boolean().optional(), residence: text(300).optional(),
  trips: z.array(z.strictObject({ stops: z.array(stopSchema).min(1), returnTransport: text(40).optional() })).default([]),
});

export type TripInput = z.infer<typeof tripInputSchema>;
type Row = Record<string, unknown>;
type Choice = { id: string; name: string };
type Contacts = { phone: string | null; emergencyContact: string | null; emergencyPhone: string | null; onCampus: boolean | null; residence: string | null };
type Holiday = { id: string; name: string; year: string; from: string; to: string; deadline: string };
type TripRecord = {
  id: string; registrationId: string | null; stayOnCampus: boolean; from: string | null; to: string | null;
  returnTransport: string | null;
  stops: { from: string; to: string; destination: string; address: string; transport: string; serviceNumber: string | null }[];
};
type TripContext = {
  status: "open" | "submitted" | "closed";
  holiday: Holiday | null;
  defaults: Contacts;
  missing: string[];
  transportOptions: Choice[];
  records: TripRecord[];
};

/** 研究生节假日离返校登记，复用 ehall 认证会话。 */
export class EHallTripClient {
  private referer = new URL("*default/index.do", BASE).href;
  private userId = "";
  private readonly metadataPath: string;

  constructor(private readonly fetch: FetchLike, configDir: string) {
    this.metadataPath = join(configDir, "ehall.json");
  }

  async trip(): Promise<TripContext> {
    const { context } = await this.prepare();
    return context;
  }

  async submitTrip(input: TripInput, dryRun = false) {
    const { context, models } = await this.prepare();
    if (context.status !== "open" || !context.holiday) {
      throw new AppError("USER_ACTION_REQUIRED", context.status === "submitted" ? "本假期已有登记，请先查看 ehall trip 的结果" : "当前没有开放的行程登记");
    }
    const holiday = context.holiday;
    if (input.holidayId !== undefined && input.holidayId !== holiday.id) throw new AppError("INVALID_INPUT", "填报假期已变化，请重新运行 ehall trip");
    const contacts: Contacts = {
      phone: input.phone ?? context.defaults.phone,
      emergencyContact: input.emergencyContact ?? context.defaults.emergencyContact,
      emergencyPhone: input.emergencyPhone ?? context.defaults.emergencyPhone,
      onCampus: input.onCampus ?? context.defaults.onCampus,
      residence: input.residence ?? context.defaults.residence,
    };
    const missing = missingContacts(contacts);
    if (missing.length) throw new AppError("INVALID_INPUT", `请补充：${missing.join("、")}`, { details: { missing } });
    if (input.stayOnCampus === (input.trips.length > 0)) {
      throw new AppError("INVALID_INPUT", "全程留校时不填写 trips；离校时至少填写一段 trips");
    }
    const regions = input.trips.length ? await this.dictionary(models, "xsdjqxmxbd", "BY3") : [];
    const trips = input.trips.map((trip) => {
      const stops = trip.stops.map((stop) => ({
        ...stop,
        destination: choose(regions.filter((r) => r.isParent === 0 || (typeof r.pId === "string" && r.pId !== "")), stop.destination, "目的地"),
        transport: choose(context.transportOptions, stop.transport, "交通工具"),
      })).sort((a, b) => a.from.localeCompare(b.from));
      for (const [i, stop] of stops.entries()) {
        if (stop.from > stop.to || (i > 0 && stop.from <= stops[i - 1]!.to)) {
          throw new AppError("INVALID_INPUT", "行程开始日期须不晚于结束日期，各段日期不能重叠");
        }
      }
      return { from: stops[0]!.from, to: stops.at(-1)!.to, stops,
        returnTransport: trip.returnTransport ? choose(context.transportOptions, trip.returnTransport, "返校交通工具") : null };
    }).sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < trips.length; i++) {
      if (trips[i]!.from <= trips[i - 1]!.to) throw new AppError("INVALID_INPUT", "多次离返校的日期不能重叠");
    }
    const plan = { holiday, stayOnCampus: input.stayOnCampus, contacts, trips };
    if (dryRun) return { submitted: false as const, plan };
    await writeJsonFile(this.metadataPath, { userId: this.userId, contacts });

    const common = {
      YL2: input.stayOnCampus ? "1" : "0", YL3: contacts.phone!, JJLXR: contacts.emergencyContact!,
      JJLXRDH: contacts.emergencyPhone!, YL5: contacts.onCampus ? "1" : "0",
      YL6: contacts.onCampus ? "" : contacts.residence!, JJRDM: holiday.id, DJXN: holiday.year,
    };
    const parents: Row[] = [];
    const registrationIds: string[] = [];
    const expectedDetails = new Map<string, Row[]>();
    let stage = "创建行程编号";
    let mutationStarted = false;
    try {
      for (const trip of trips) {
        stage = "创建行程编号";
        const generated = await this.query("zdscwid", {});
        const id = required(generated[0], "WID");
        registrationIds.push(id);
        const details = trip.stops.map((stop) => ({
          DJBH: id, KSRQ: stop.from, JSRQ: stop.to, BY3: stop.destination.id,
          XXDZ: stop.address, BY1: stop.transport.id, BY2: stop.serviceNumber ?? "",
        }));
        expectedDetails.set(id, details);
        for (const detail of details) {
          stage = "保存行程明细";
          mutationStarted = true;
          const added = await this.post("commoncall/call/T_JJR_DJ_MX-DATAMODEL-ADD.do", {
            requestParams: JSON.stringify(detail), actionType: "DATAMODEL", actionName: "T_JJR_DJ_MX", dataModelAction: "ADD",
          });
          if (added.resultCode !== "00000") throw schema("明细保存结果");
        }
        stage = "回读行程明细";
        verifyRows(await this.query("xsdjqxmxbd", { DJBH: id }), details);
        parents.push({ ...common, DJBH: id, YL1: trip.from, YJFXRQ: trip.to, YL4: trip.returnTransport?.id ?? "" });
      }
      if (input.stayOnCampus) parents.push(common);
      stage = "提交总登记";
      mutationStarted = true;
      const submitted = await this.post("modules/holiday/SaveRegister.do", { data: JSON.stringify({ data: parents }) });
      if (String(submitted.code) !== "0") throw schema("登记提交结果");
      stage = "回读总登记";
      const index = (await this.custom("getStuIndexPage", {})).data as Row;
      if (index.PAGE !== "YDJ") throw new Error("提交后尚未读到已登记状态");
      const recordId = required(index.SQOBJ as Row, "WID");
      const detail = (await this.custom("getCurStuApply", { WID: recordId })).data as Row;
      const current = detail.DATA as Row;
      verifyRows([current], [{ ...common, WID: recordId, XSBH: this.userId }]);
      if (!input.stayOnCampus) {
        if (!registrationIds.includes(required(current, "DJBH"))) throw new Error("当前登记不属于本次提交");
        const saved = await this.rows("cxxsdjjjrbddz", { JJRDM: holiday.id, DJXN: holiday.year, XSBH: this.userId });
        for (const parent of parents) {
          const matches = saved.filter((r) => r.DJBH === parent.DJBH);
          if (matches.length !== 1) throw new Error("未能按本次登记编号唯一回读记录");
          const id = required(matches[0], "WID");
          const readback = (await this.custom("getCurStuApply", { WID: id })).data as Row;
          const row = readback.DATA as Row;
          verifyRows([row], [{ ...parent, WID: id, XSBH: this.userId }]);
          verifyRows(await this.query("xsdjqxmxbd", { DJBH: String(parent.DJBH) }), expectedDetails.get(String(parent.DJBH))!);
        }
      }
      return { submitted: true as const, recordId, registrationIds, plan };
    } catch (error) {
      if (!mutationStarted) throw error;
      throw new AppError("REMOTE_UNAVAILABLE", `行程填报在“${stage}”阶段未能确认完成，可能已有数据保存`, {
        hint: "先运行 njucli ehall trip 核对，勿直接重复提交；未关联的明细可凭登记编号在官方页面或联系管理员核查",
        details: { stage, registrationIds, reason: error instanceof Error ? error.message : String(error) }, cause: error,
      });
    }
  }

  private async prepare() {
    const landing = await this.fetch(ENTRY);
    if (!landing.ok) throw new Error(`行程登记入口返回 HTTP ${landing.status}`);
    if (new URL(landing.url).hostname !== new URL(BASE).hostname || !new URL(landing.url).pathname.startsWith(new URL(BASE).pathname)) {
      throw new AppError("AUTH_REQUIRED", "未能进入研究生节假日离返校登记", { hint: "运行 njucli auth login ehall" });
    }
    this.referer = landing.url;
    const html = await landing.text();
    const metadata = html.match(/var pageMeta\s*=\s*(\{[^\n]*\});/);
    if (!metadata) throw schema("pageMeta");
    this.userId = required((JSON.parse(metadata[1]!) as { params: Row }).params, "userId");
    const config = await this.post(`../swpubapp/indexmenu/getAppConfig.do?appId=${APP_ID}&appName=yjsjjrlfxappnju`, {});
    const roles = (config.HEADER as { dropMenu: { id: string; active?: boolean }[] }).dropMenu;
    const role = roles.find((r) => r.active) ?? (roles.length === 1 ? roles[0] : undefined);
    if (!role || !/^\d+$/.test(role.id)) throw schema("当前应用角色");
    const changed = await this.post(`../funauthapp/api/changeAppRole/yjsjjrlfxappnju/${role.id}.do`, {});
    if (changed.success !== true) throw schema("应用角色切换");
    await this.post("../swpubapp/userinfo/setXgCommonAppRole.do", { requestParamStr: JSON.stringify({ ROLEID: role.id }) });
    const index = (await this.custom("getStuIndexPage", {})).data as Row;
    if (!["WDJ", "YDJ", "WXDJ"].includes(String(index.PAGE))) throw schema("PAGE");
    const settings = index.SZOBJ as Row | undefined;
    const holiday = settings ? {
      id: required(settings, "JJRDM"), name: required(settings, "JJRMC"), year: required(settings, "XN"),
      from: required(settings, "JJRKSRQ"), to: required(settings, "JJRJSRQ"), deadline: required(settings, "DJJSRQ"),
    } : null;
    const models = (await this.post("modules/register.do", { "*json": "1" })).models as Model[];
    if (!Array.isArray(models)) throw schema("表单模型");
    const basic = (await this.rows("cxxsjbxxdz", { XSBH: this.userId }))[0];
    if (!basic || required(basic, "XH") !== this.userId) throw schema("本人基本信息");
    let current: Row | undefined;
    if (index.PAGE === "YDJ") {
      const result = await this.custom("getCurStuApply", { WID: required(index.SQOBJ as Row, "WID") });
      current = (result.data as Row).DATA as Row;
      if (required(current, "XSBH") !== this.userId) throw schema("本人登记信息");
    }
    const cache = await readJsonFile<{ userId: string; contacts: Contacts }>(this.metadataPath);
    let defaults = mergeContacts(cache?.userId === this.userId ? cache.contacts : undefined, contactsFrom(basic), contactsFrom(current ?? {}));
    if (missingContacts(defaults).length) {
      const history: Row[] = [];
      for (let page = 1; ; page++) {
        const value = await this.post("modules/register/xsdjlsjlbg.do", { pageNumber: String(page), pageSize: "20" });
        const bucket = (value.datas as Record<string, { rows: Row[]; totalSize: number }>).xsdjlsjlbg!;
        if (!Array.isArray(bucket?.rows) || !Number.isSafeInteger(bucket.totalSize)) throw schema("历史登记");
        history.push(...bucket.rows);
        if (history.length >= bucket.totalSize) break;
        if (!bucket.rows.length) throw schema("历史登记分页");
      }
      let previous = history.filter((r) => r.XSBH === this.userId).sort((a, b) => required(b, "DJRQ").localeCompare(required(a, "DJRQ")))[0];
      if (previous) previous = (await this.custom("getCurStuApply", { WID: required(previous, "WID") })).data as Row;
      previous = previous?.DATA as Row | undefined;
      if (previous && required(previous, "XSBH") !== this.userId) throw schema("本人历史登记");
      defaults = mergeContacts(contactsFrom(previous ?? {}), defaults);
    }
    const records: TripRecord[] = [];
    if (current) {
      const parents = current.YL2 === "1" ? [current] : await this.rows("cxxsdjjjrbddz", {
        JJRDM: required(current, "JJRDM"), DJXN: required(current, "DJXN"), XSBH: this.userId,
      });
      for (const parent of parents) {
        const registrationId = field(parent, "DJBH");
        const stops = current.YL2 === "1" ? [] : await this.query("xsdjqxmxbd", { DJBH: required(parent, "DJBH") });
        records.push({ id: required(parent, "WID"), registrationId, stayOnCampus: current.YL2 === "1",
          from: field(parent, "YL1"), to: field(parent, "YJFXRQ"), returnTransport: field(parent, "YL4_DISPLAY"),
          stops: stops.map((s) => ({ from: required(s, "KSRQ"), to: required(s, "JSRQ"),
            destination: field(s, "BY3_DISPLAY") ?? required(s, "BY3"), address: required(s, "XXDZ"),
            transport: field(s, "BY1_DISPLAY") ?? required(s, "BY1"), serviceNumber: field(s, "BY2") })),
        });
      }
    }
    const context: TripContext = {
      status: index.PAGE === "WDJ" ? "open" : index.PAGE === "YDJ" ? "submitted" : "closed",
      holiday, defaults, missing: missingContacts(defaults), records,
      transportOptions: (await this.dictionary(models, "xsdjqxmxbd", "BY1")).map((r) => ({ id: required(r, "id"), name: required(r, "name") })),
    };
    await writeJsonFile(this.metadataPath, { userId: this.userId, contacts: defaults });
    return { context, models };
  }

  private async dictionary(models: Model[], model: string, name: string): Promise<(Choice & Row)[]> {
    const path = models.find((m) => m.name === model)?.controls.find((c) => c.name === name)?.url;
    if (!path) throw schema(name);
    const url = new URL(path, BASE);
    if (url.origin !== new URL(BASE).origin || !url.pathname.startsWith("/xxfw/code/")) throw schema("字典地址");
    const value = await this.post(url.href, {});
    const rows = (value.datas as { code: { rows: (Choice & Row)[] } })?.code?.rows;
    if (!Array.isArray(rows)) throw schema("字典内容");
    return rows;
  }

  private async rows(action: string, params: Record<string, string>): Promise<Row[]> {
    const value = await this.post(`modules/register/${action}.do`, params);
    const rows = (value.datas as Record<string, { rows: Row[] }>)[action]?.rows;
    if (!Array.isArray(rows)) throw schema(action);
    return rows;
  }

  private custom(action: string, params: Row) {
    return this.post(`modules/apply/${action}.do`, { data: JSON.stringify(params) });
  }

  private async query(action: string, params: Row): Promise<Row[]> {
    const result = await this.post(`commoncall/callQuery/${action}-MINE-QUERY.do`, {
      requestParams: JSON.stringify(params), actionType: "MINE", actionName: action, dataModelAction: "QUERY",
    });
    if (!Array.isArray(result.data)) throw schema(action);
    return result.data as Row[];
  }

  private async post(path: string, params: Record<string, string>): Promise<Row> {
    const response = await this.fetch(new URL(path, BASE), {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-requested-with": "XMLHttpRequest", referer: this.referer },
      body: new URLSearchParams(params).toString(),
    });
    if ([401, 403].includes(response.status) || new URL(response.url).hostname === "authserver.nju.edu.cn") {
      throw new AppError("AUTH_REQUIRED", "行程登记会话失效或当前角色无权限");
    }
    if (!response.ok) throw new Error(`行程登记返回 HTTP ${response.status}`);
    const value = JSON.parse(await response.text()) as Row;
    if ((value.code !== undefined && String(value.code) !== "0") || (value.resultCode !== undefined && value.resultCode !== "00000") || (value.returnCode !== undefined && value.returnCode !== "#E000000000000")) {
      throw new AppError("REMOTE_UNAVAILABLE", String(value.msg ?? value.description ?? "行程登记请求失败"));
    }
    return value;
  }
}

type Model = { name: string; controls: { name: string; url?: string }[] };

function field(row: Row, key: string): string | null {
  const value = row[key];
  return value == null || value === "" ? null : String(value);
}

function required(row: Row | undefined, key: string): string {
  const value = row && field(row, key);
  if (!value) throw schema(key);
  return value;
}

function schema(part: string) {
  return new AppError("REMOTE_SCHEMA_CHANGED", `行程登记接口结构已变化：${part}`);
}

function contactsFrom(row: Row): Contacts {
  return { phone: field(row, "YL3"), emergencyContact: field(row, "JJLXR"), emergencyPhone: field(row, "JJLXRDH"),
    onCampus: row.YL5 === "1" ? true : row.YL5 === "0" ? false : null, residence: field(row, "YL6") };
}

function mergeContacts(...sources: (Contacts | undefined)[]): Contacts {
  return Object.assign(contactsFrom({}), ...sources.map((source) =>
    Object.fromEntries(Object.entries(source ?? {}).filter(([, value]) => value !== null && value !== undefined && value !== "")),
  ));
}

function missingContacts(c: Contacts): string[] {
  return [!c.phone && "phone", !c.emergencyContact && "emergencyContact", !c.emergencyPhone && "emergencyPhone",
    c.onCampus === null && "onCampus", c.onCampus === false && !c.residence && "residence"].filter((v): v is string => typeof v === "string");
}

function choose(options: Choice[], value: string, label: string): Choice {
  const exact = options.filter((o) => o.id === value || o.name === value || o.name.split("/").at(-1) === value);
  const matches = exact.length ? exact : options.filter((o) => o.name.replaceAll("/", "").includes(value.replaceAll("/", "")));
  if (matches.length !== 1) throw new AppError("INVALID_INPUT", `${label}无法唯一匹配：${value}`, { details: { candidates: matches.slice(0, 20) } });
  return { id: matches[0]!.id, name: matches[0]!.name };
}

function verifyRows(actual: Row[], expected: Row[]): void {
  if (actual.length !== expected.length || expected.some((row) => actual.filter((item) => Object.entries(row).every(([k, v]) => String(item[k] ?? "") === String(v))).length !== 1)) {
    throw new Error("回读内容与本次填报不一致");
  }
}

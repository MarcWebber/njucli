import { load } from "cheerio";
import { z } from "zod";
import type { SkillRuntime } from "../../../src/app/runtime.js";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";

const EPAY_BASE = "https://epay.nju.edu.cn";
const EDIT_PATH = "/epay/h5/nju/electric/edit";
const responseSchema = z.object({ retcode: z.union([z.string(), z.number()]), retmsg: z.string().optional(), list: z.unknown().optional() });
const campusSchema = z.object({ elcsysid: z.number().int(), elcname: z.string() });
const buildingSchema = z.object({ buiId: z.string(), buiName: z.string() });
const roomSchema = z.object({ roomId: z.string(), roomName: z.string() });
const bindingSchema = z.object({
  id: z.union([z.string(), z.number().int()]).transform(String), type: z.literal("elec"),
  sysId: z.union([z.string(), z.number().int()]).transform(Number).pipe(z.number().int().positive()), sysName: z.string(),
  buildId: z.string(), buildName: z.string(), roomId: z.string(), roomName: z.string(),
});
const billSchema = z.object({
  elcname: z.string(), build_name: z.string(), elecroomno: z.string(), paytime: z.string(),
  amount: z.number(), issend: z.union([z.string(), z.number()]),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "电费系统返回字段发生变化，请核对官方页面");
  return result.data;
}

export class DormClient {
  private csrf: { header: string; token: string } | undefined;

  constructor(private readonly fetch: FetchLike) {}

  async initialize(): Promise<void> {
    this.csrf = undefined;
    await this.page(EDIT_PATH);
  }

  private async page(path: string) {
    const response = await this.fetch(`${EPAY_BASE}${path}`);
    const url = new URL(response.url);
    if (response.status === 401 || response.status === 403 || url.origin !== EPAY_BASE || url.pathname.split(";")[0] !== path)
      throw new AppError("AUTH_REQUIRED", "电费页面需要统一认证登录", { authCommand: "njucli auth login" });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `电费页面返回 HTTP ${response.status}`);
    const $ = load(await response.text());
    const header = $("meta[name=_csrf_header]").attr("content");
    const token = $("meta[name=_csrf]").attr("content");
    if (!header || !token)
      throw new AppError("REMOTE_SCHEMA_CHANGED", "电费页面缺少会话校验字段，请核对官方页面");
    this.csrf = { header, token };
    return $;
  }

  async bindings() {
    const $ = await this.page("/epay/h5/nju/electric/index");
    const scripts = $("script:not([src])").map((_, script) => $(script).html()).get().join("\n");
    // 官方页面将当前账号的绑定记录作为 JSON 数组注入 initList。
    const list = scripts.match(/\blet\s+list\s*=\s*(\[(?:"(?:\\.|[^"\\])*"|[^"\]])*\])\s*(?:;|\r?\n|$)/)?.[1];
    if (!list) throw new AppError("REMOTE_SCHEMA_CHANGED", "电费页面缺少绑定房间列表");
    let value: unknown;
    try { value = JSON.parse(list); }
    catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "电费页面的绑定房间列表格式发生变化"); }
    return parse(z.array(bindingSchema), value).map(row => ({
      id: row.id, campusId: row.sysId, campus: row.sysName.replace("电控", "校区"),
      buildingId: row.buildId, building: row.buildName, roomId: row.roomId, room: row.roomName,
    }));
  }

  async bind(campusId: number, buildingId: string, roomId: string, replace?: string) {
    const before = await this.bindings();
    if (replace !== undefined && !before.some(row => row.id === replace))
      throw new AppError("NOT_FOUND", "当前账号没有该绑定记录，请先运行 dorm bindings");
    const campus = (await this.campuses()).find(row => row.id === campusId);
    if (!campus) throw new AppError("INVALID_INPUT", "校区不存在，请使用 dorm campuses 返回的 ID");
    const building = (await this.buildings(campusId)).find(row => row.id === buildingId);
    if (!building) throw new AppError("INVALID_INPUT", "该校区没有此楼栋，请使用 dorm buildings 返回的 ID");
    const room = (await this.rooms(campusId, buildingId)).find(row => row.id === roomId);
    if (!room) throw new AppError("INVALID_INPUT", "该楼栋没有此房间，请使用 dorm rooms 返回的 ID");
    const sysId = buildingId.startsWith("west") ? 9 : campusId;
    const matches = (row: Awaited<ReturnType<DormClient["bindings"]>>[number]) =>
      row.campusId === sysId && row.buildingId === buildingId && row.roomId === roomId;
    if (before.some(row => row.id !== replace && matches(row)))
      throw new AppError("INVALID_INPUT", "该房间已有绑定记录，请运行 dorm bindings 查看");
    await this.request(replace === undefined ? "addRoom.json" : "updateRoom.json", {
      ...(replace === undefined ? {} : { id: replace }),
      type: "elec", areaId: "0", areaName: "0", districtId: "", districtName: "",
      sysId: String(sysId), sysName: campus.name, buildId: buildingId, buildName: building.name,
      roomId, roomName: room.name,
    });
    const binding = (await this.bindings()).find(row => matches(row) && (replace === undefined
      ? !before.some(previous => previous.id === row.id) : row.id === replace));
    if (!binding) throw new AppError("REMOTE_UNAVAILABLE", "绑定请求已提交，回读未确认目标房间，请运行 dorm bindings 核对");
    return binding;
  }

  async unbind(id: string) {
    if (!(await this.bindings()).some(row => row.id === id))
      throw new AppError("NOT_FOUND", "当前账号没有该绑定记录，请先运行 dorm bindings");
    await this.request("delRoom.json", { id, type: "elec" });
    if ((await this.bindings()).some(row => row.id === id))
      throw new AppError("REMOTE_UNAVAILABLE", "解绑请求已提交，回读仍有该记录，请运行 dorm bindings 核对");
    return { id, removed: true };
  }

  async campuses() {
    const rows = parse(z.array(campusSchema), await this.request("getelesys.json"));
    return rows.filter(row => row.elcname.includes("电控")).map(row => ({
      id: row.elcsysid, name: row.elcname.replace("电控", "校区"),
    }));
  }

  async buildings(campus: number) {
    const rows = parse(z.array(buildingSchema), await this.request("getbuild.json", {
      sysid: String(campus), areaid: "0", districtid: "0",
    }));
    return rows.map(row => ({ id: row.buiId, name: row.buiName }));
  }

  async rooms(campus: number, building: string) {
    const rows = parse(z.array(roomSchema), await this.request("getroom.json", {
      // 官方页面将苏州西区楼栋转到电控系统 9。
      sysid: building.startsWith("west") ? "9" : String(campus),
      areaid: "0", districtid: "0", buildid: building, floorid: "0",
    }));
    return rows.map(row => ({ id: row.roomId, name: row.roomName }));
  }

  async bills(from: string, to: string) {
    const rows = parse(z.array(billSchema), await this.request("getElecOrWaterDtl.json", {
      startdate: from.replaceAll("-", ""), enddata: to.replaceAll("-", ""), name: "电控",
    }));
    return rows.map(row => ({
      campus: row.elcname.replace("电控", "校区"), building: row.build_name, room: row.elecroomno,
      paidAt: row.paytime, amount: row.amount, statusCode: row.issend,
      status: String(row.issend) === "1" ? "交易成功" : String(row.issend) === "0" ? "处理中" : "未知状态",
    }));
  }

  private async request(path: string, form?: Record<string, string>): Promise<unknown> {
    if (!this.csrf) throw new AppError("AUTH_REQUIRED", "请先初始化电费会话");
    const response = await this.fetch(`${EPAY_BASE}/epay/h5/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json",
        [this.csrf.header]: this.csrf.token,
      },
      body: form ? new URLSearchParams(form).toString() : "{}",
    });
    if (response.status === 401 || response.status === 403 || new URL(response.url).origin !== EPAY_BASE)
      throw new AppError("AUTH_REQUIRED", "电费会话已失效，请重新登录", { authCommand: "njucli auth login" });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `电费请求返回 HTTP ${response.status}`);
    let value: unknown;
    try { value = JSON.parse(await response.text()); }
    catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "电费接口未返回有效 JSON"); }
    const data = parse(responseSchema, value);
    if (String(data.retcode) !== "0") throw new AppError("REMOTE_UNAVAILABLE", data.retmsg || "电费请求失败");
    return data.list;
  }
}

export function createDormServices({ withBrowser }: SkillRuntime) {
  return <T>(operation: (client: DormClient) => Promise<T>): Promise<T> =>
    withBrowser("sso", async session => {
      const client = new DormClient(session.request);
      await client.initialize();
      return operation(client);
    });
}

export type DormServices = ReturnType<typeof createDormServices>;

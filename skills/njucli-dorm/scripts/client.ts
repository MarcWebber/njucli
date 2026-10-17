import { load } from "cheerio";
import { z } from "zod";
import type { SkillRuntime } from "../../../src/app/runtime.js";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";

const EPAY_BASE = "https://epay.nju.edu.cn";
const EDIT_PATH = "/epay/h5/nju/electric/edit";
const responseSchema = z.object({ retcode: z.union([z.string(), z.number()]), retmsg: z.string(), list: z.unknown().optional() });
const campusSchema = z.object({ elcsysid: z.number().int(), elcname: z.string() });
const buildingSchema = z.object({ buiId: z.string(), buiName: z.string() });
const roomSchema = z.object({ roomId: z.string(), roomName: z.string() });
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

  async hasSession(): Promise<boolean> {
    this.csrf = undefined;
    const response = await this.fetch(`${EPAY_BASE}${EDIT_PATH}`);
    if (response.status === 401 || response.status === 403) return false;
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `电费页面返回 HTTP ${response.status}`);
    const url = new URL(response.url);
    if (url.origin !== EPAY_BASE || url.pathname.split(";")[0] !== EDIT_PATH) return false;
    const $ = load(await response.text());
    const header = $("meta[name=_csrf_header]").attr("content");
    const token = $("meta[name=_csrf]").attr("content");
    if (!header || !token)
      throw new AppError("REMOTE_SCHEMA_CHANGED", "电费页面缺少会话校验字段，请核对官方页面");
    this.csrf = { header, token };
    return true;
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
    if (!this.csrf) throw new AppError("AUTH_REQUIRED", "请登录电费系统", { authCommand: "njucli auth login epay" });
    const response = await this.fetch(`${EPAY_BASE}/epay/h5/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": form ? "application/x-www-form-urlencoded" : "application/json",
        [this.csrf.header]: this.csrf.token,
      },
      body: form ? new URLSearchParams(form).toString() : "{}",
    });
    if (response.status === 401 || response.status === 403 || new URL(response.url).origin !== EPAY_BASE)
      throw new AppError("AUTH_REQUIRED", "电费会话已失效，请重新登录", { authCommand: "njucli auth login epay" });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `电费查询返回 HTTP ${response.status}`);
    const data = parse(responseSchema, JSON.parse(await response.text()));
    if (String(data.retcode) !== "0") throw new AppError("REMOTE_UNAVAILABLE", data.retmsg || "电费查询失败");
    return data.list;
  }
}

export function createDormServices({ withBrowser }: SkillRuntime) {
  return <T>(operation: (client: DormClient) => Promise<T>): Promise<T> => {
    let client: DormClient;
    return withBrowser("epay", () => operation(client), async session => {
      client = new DormClient(session.request);
      return client.hasSession();
    });
  };
}

export type DormServices = ReturnType<typeof createDormServices>;

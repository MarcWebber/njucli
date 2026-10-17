import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";

const HOUSING_BASE = "https://ehallapp.nju.edu.cn/xsfw/sys/xszsapp";
const responseSchema = z.object({ code: z.string(), msg: z.string(), data: z.unknown() });
const addressSchema = z.object({ ZSDZ: z.string() });
const applicationSchema = z.object({
  WID: z.string(), SQLB: z.union([z.string(), z.number()]), SQLB_DISPLAY: z.string(),
  SQRQ: z.string(), SHZT: z.union([z.string(), z.number()]), SHZT_DISPLAY: z.string(),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "住宿系统返回字段发生变化，请核对宿舍申办页面");
  return result.data;
}

export class HousingClient {
  constructor(private readonly fetch: FetchLike) {}

  async initialize(): Promise<void> {
    const response = await this.fetch("https://ehall.nju.edu.cn/appShow?appId=4618295887225301");
    const url = new URL(response.url);
    if (response.status === 401 || url.origin !== new URL(HOUSING_BASE).origin)
      throw new AppError("AUTH_REQUIRED", "宿舍申办需要统一认证登录", { authCommand: "njucli auth login" });
    if (response.status === 403) throw new AppError("USER_ACTION_REQUIRED", "当前账号没有宿舍申办访问权限");
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `宿舍申办页面返回 HTTP ${response.status}`);
    if (url.pathname.split(";")[0] !== "/xsfw/sys/xszsapp/*default/index.do")
      throw new AppError("REMOTE_SCHEMA_CHANGED", "宿舍申办入口发生变化，请核对官方页面");
  }

  async addresses() {
    const rows = parse(z.array(addressSchema), await this.request("getStudentAddress"));
    return rows.map(row => ({ address: row.ZSDZ }));
  }

  async applications() {
    const rows = parse(z.array(applicationSchema), await this.request("getDormApplyInfo"));
    return rows.map(row => ({
      id: row.WID, type: row.SQLB_DISPLAY, typeCode: row.SQLB,
      appliedAt: row.SQRQ, status: row.SHZT_DISPLAY, statusCode: row.SHZT,
    }));
  }

  private async request(action: string): Promise<unknown> {
    const response = await this.fetch(`${HOUSING_BASE}/modules/studentApplyDorm/${action}.do`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ data: "{}" }).toString(),
    });
    if (response.status === 401 || new URL(response.url).origin !== new URL(HOUSING_BASE).origin)
      throw new AppError("AUTH_REQUIRED", "宿舍申办会话已失效，请重新登录", { authCommand: "njucli auth login" });
    if (response.status === 403) throw new AppError("USER_ACTION_REQUIRED", "当前账号没有该住宿查询权限");
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `住宿查询返回 HTTP ${response.status}`);
    let value: unknown;
    try { value = JSON.parse(await response.text()); }
    catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "住宿接口未返回有效 JSON"); }
    const result = parse(responseSchema, value);
    if (result.code !== "0") throw new AppError("REMOTE_UNAVAILABLE", result.msg || "住宿查询失败");
    return result.data;
  }
}

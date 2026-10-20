import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";

const ROOT = "https://ehallapp.nju.edu.cn/jwapp/sys/kxjas";
const APP = "https://ehall.nju.edu.cn/appShow?appId=4768402106681759";
const ENTRY = `${ROOT}/*default/index.do`;
const id = z.string().trim().min(1);
export const classroomQuerySchema = z.object({
  campus: id.describe("校区代码，取自 ehall_classroom_campuses"),
  date: z.string().default("today").describe("today、tomorrow 或 YYYY-MM-DD"),
  period: z.string().regex(/^[1-9]\d*(?:-[1-9]\d*)?$/, "节次使用正整数，例如 5 或 5-8")
    .refine(value => {
      const [start = 0, end = start] = value.split("-").map(Number);
      return Number.isSafeInteger(start) && Number.isSafeInteger(end) && end >= start;
    }, "节次须为有效整数，结束节次须大于等于开始节次")
    .describe("单节或连续节次，如 5 或 5-8；整个区间均须空闲"),
  building: id.optional().describe("教学楼代码，取自 ehall_classroom_buildings"),
});
type ClassroomQuery = z.infer<typeof classroomQuerySchema>;
const count = z.union([z.number().int().nonnegative(), z.string().regex(/^\d+$/).transform(Number)]);
const roomSchema = z.object({
  JASMC: z.string(),
  XXXQDM_DISPLAY: z.string().nullish(),
  JXLDM: z.string().nullish(),
  JXLDM_DISPLAY: z.string().nullish(),
  JASLXDM_DISPLAY: z.string().nullish(),
  KXSJ: z.string().nullish(),
  SKZWS: count.nullish(),
  KSZWS: count.nullish(),
});

export class ClassroomClient {
  constructor(private readonly fetch: FetchLike) {}

  async classroomCampuses() {
    const data = await this.query("/zd/getXxxqdqx.do", "code", {},
      z.object({ rows: z.array(z.object({ id, name: z.string() })) }));
    return data.rows;
  }

  async classroomBuildings(campus: string) {
    const data = await this.query("/modules/kxjas/jxlcx.do", "jxlcx", { XXXQDM: campus },
      z.object({ rows: z.array(z.object({ JXLDM: id, JXLMC: z.string() })) }));
    return data.rows.map(row => ({ id: row.JXLDM, name: row.JXLMC }));
  }

  async classrooms(input: ClassroomQuery) {
    const [start, end = start] = input.period.split("-");
    const data = await this.query("/modules/kxjscx/cxkxjs.do", "cxkxjs", {
      KXRQ: input.date, XXXQDM: input.campus, KSJC: start!, JSJC: end!,
      ...(input.building === undefined ? {} : { JXLDM: input.building }),
      querySetting: "[]",
    }, z.object({ totalSize: count, rows: z.array(roomSchema) }));
    // 上游会把楼栋 111 同时匹配到 11，按返回的楼栋代码精确筛选。
    const rows = input.building === undefined ? data.rows : data.rows.filter(row => row.JXLDM === input.building);
    return { ...input, total: input.building === undefined ? data.totalSize : rows.length, items: rows.map(row => ({
      name: row.JASMC, campus: row.XXXQDM_DISPLAY ?? null,
      buildingId: row.JXLDM ?? null, building: row.JXLDM_DISPLAY ?? null,
      type: row.JASLXDM_DISPLAY ?? null, time: row.KXSJ ?? null,
      seats: row.SKZWS ?? null, examSeats: row.KSZWS ?? null,
    })) };
  }

  private async query<T>(path: string, key: string, params: Record<string, string>, schema: z.ZodType<T>): Promise<T> {
    await this.request(APP);
    const response = await this.request(ROOT + path, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest", Referer: ENTRY },
      body: new URLSearchParams(params).toString(),
    });
    let value: unknown;
    try { value = JSON.parse(await response.text()); }
    catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "空闲教室接口未返回 JSON"); }
    const envelope = z.object({ code: z.union([z.string(), z.number()]), datas: z.record(z.string(), z.unknown()).optional() }).safeParse(value);
    if (!envelope.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "空闲教室响应格式变化");
    if (String(envelope.data.code) !== "0") throw new AppError("REMOTE_UNAVAILABLE", `空闲教室查询失败，业务码 ${envelope.data.code}`);
    const parsed = schema.safeParse(envelope.data.datas?.[key]);
    if (!parsed.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "空闲教室结果字段变化");
    return parsed.data;
  }

  private async request(url: string, init?: RequestInit): Promise<FetchResponse> {
    const response = await this.fetch(url, init);
    if (new URL(response.url).hostname === "authserver.nju.edu.cn" || response.status === 401) {
      throw new AppError("AUTH_REQUIRED", "空闲教室会话未登录或已失效", { authCommand: "njucli auth login ehall" });
    }
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `空闲教室请求 HTTP ${response.status}`);
    return response;
  }
}

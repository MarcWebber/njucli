import { load } from "cheerio";
import { z } from "zod";
import type { SkillRuntime } from "../../../src/app/runtime.js";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";

const EPAY_BASE = "https://epay.nju.edu.cn";
const resultSchema = z.object({
  retcode: z.union([z.number(), z.string()]), retmsg: z.string().optional(), data: z.unknown().optional(),
});
const money = z.string().regex(/^-?\d+(?:\.\d+)?$/).transform(Number).pipe(z.number());
const billsSchema = z.object({
  pageno: z.number().int().positive(), pagesize: z.number().int().positive(), totalcnt: z.number().int().nonnegative(),
  list: z.array(z.object({
    transdate: z.string().regex(/^\d{8}$/), transtime: z.string().regex(/^\d{6}$/),
    transname: z.string(), termname: z.string(), amount: money, balance: z.unknown(),
  })),
});

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "校园卡系统返回字段发生变化，请核对官方页面");
  return parsed.data;
}

function resultData(value: unknown): unknown {
  const result = parse(resultSchema, value);
  if (String(result.retcode) !== "0") throw new AppError("REMOTE_UNAVAILABLE", result.retmsg || "校园卡交易查询失败");
  return result.data;
}

export class PayClient {
  constructor(private readonly fetch: FetchLike) {}

  private async page(path: string) {
    const response = await this.fetch(`${EPAY_BASE}${path}`);
    const url = new URL(response.url);
    if (response.status === 401 || response.status === 403 || url.origin !== EPAY_BASE || url.pathname.split(";")[0] !== path)
      throw new AppError("AUTH_REQUIRED", "校园卡页面需要统一认证登录", { authCommand: "njucli auth login" });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `校园卡页面返回 HTTP ${response.status}`);
    return load(await response.text());
  }

  async balance() {
    const $ = await this.page("/epay/h5/recharge");
    const label = $("p").filter((_, element) => $(element).text().trim().startsWith("校园卡余额："));
    const amount = label.find("span").text().trim().match(/^(-?\d+(?:\.\d+)?)元$/)?.[1];
    if (amount === undefined) throw new AppError("REMOTE_SCHEMA_CHANGED", "校园卡页面未返回有效余额");
    return { balance: parse(money, amount), currency: "CNY" };
  }

  async bills(from: string, to: string, page: number) {
    const $ = await this.page("/epay/h5/nju/bills");
    const header = $("meta[name=_csrf_header]").attr("content");
    const token = $("meta[name=_csrf]").attr("content");
    if (!header || !token) throw new AppError("REMOTE_SCHEMA_CHANGED", "校园卡页面缺少会话校验字段");
    const response = await this.fetch(`${EPAY_BASE}/epay/h5/getBills.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", [header]: token },
      body: new URLSearchParams({
        starttime: `${from.replaceAll("-", "")}000000`, endtime: `${to.replaceAll("-", "")}000000`,
        pageno: String(page), pagesize: "200",
      }).toString(),
    });
    if (response.status === 401 || response.status === 403 || new URL(response.url).origin !== EPAY_BASE)
      throw new AppError("AUTH_REQUIRED", "校园卡会话已失效，请重新登录", { authCommand: "njucli auth login" });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `校园卡查询返回 HTTP ${response.status}`);
    let value: unknown;
    try { value = JSON.parse(await response.text()); }
    catch { throw new AppError("REMOTE_SCHEMA_CHANGED", "校园卡接口未返回有效 JSON"); }
    const gatewayData = resultData(value);
    const result = parse(billsSchema, resultData(gatewayData));
    return {
      from, to, page: result.pageno, pageSize: result.pagesize, total: result.totalcnt,
      bills: result.list.map(row => ({
        date: `${row.transdate.slice(0, 4)}-${row.transdate.slice(4, 6)}-${row.transdate.slice(6, 8)}`,
        time: `${row.transtime.slice(0, 2)}:${row.transtime.slice(2, 4)}:${row.transtime.slice(4, 6)}`,
        description: row.transname, location: row.termname, amount: row.amount,
        // 官方页面不展示微信消费后的校园卡余额。
        balance: row.transname.includes("微信") && row.transname.includes("消费") ? null : parse(money, row.balance),
      })),
    };
  }
}

export function createPayServices({ withBrowser }: SkillRuntime) {
  return <T>(operation: (client: PayClient) => Promise<T>): Promise<T> =>
    withBrowser("sso", session => operation(new PayClient(session.request)));
}

export type PayServices = ReturnType<typeof createPayServices>;

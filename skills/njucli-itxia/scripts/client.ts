import { z } from "zod";
import { AppError, asAppError } from "../../../src/core/errors.js";
import type { OrderInput } from "./schema.js";

const ORIGIN = "https://itxia.nju.edu.cn";
// 官网预约单页 /custom/order 仅从 localStorage.requestedOrderId（JSON 字符串）读取编号，路由与查询参数均不携带编号。
export const ITXIA_ORDER_URL = `${ORIGIN}/custom/order`;
export const ITXIA_RETRIEVE_URL = `${ORIGIN}/custom/retrieve`;

/** 在 itxia.nju.edu.cn 任一页面的浏览器控制台运行，即可打开该预约单页。 */
export function openScript(id: string): string {
  return `localStorage.setItem("requestedOrderId", ${JSON.stringify(JSON.stringify(id))}); location.href = "/custom/order";`;
}

export function orderLinks(id: string) {
  return { url: ITXIA_ORDER_URL, openScript: openScript(id), retrieveUrl: ITXIA_RETRIEVE_URL };
}
const STATUS = { PENDING: "待接单", HANDLING: "处理中", DONE: "已完成", CANCELED: "已取消" } as const;
const CAMPUS = { XIANLIN: "仙林", GULOU: "鼓楼", SUZHOU: "苏州" } as const;
const person = z.object({ realName: z.string() });
const attachment = z.object({ _id: z.string(), fileName: z.string(), mimeType: z.string(), size: z.number() });
const order = z.object({
  _id: z.string().min(1),
  status: z.enum(["PENDING", "HANDLING", "DONE", "CANCELED"]),
  name: z.string(),
  phone: z.string(),
  email: z.string().nullish(),
  campus: z.enum(["XIANLIN", "GULOU", "SUZHOU"]),
  brandModel: z.string(),
  os: z.string(),
  description: z.string(),
  freeTime: z.string().nullish(),
  createTime: z.string(),
  handler: person.nullish(),
  attachments: z.array(attachment),
  reply: z.array(z.object({
    content: z.string(), createTime: z.string(), postBy: person.nullish(), attachments: z.array(attachment),
  })),
});

export class ItxiaClient {
  async create(input: OrderInput) {
    const created = parse(z.object({ _id: z.string().min(1) }), await this.request("/custom/order", {
      ...input, agreement: true, attachments: [],
    }));
    try {
      const data = await this.status(created._id);
      for (const key of ["name", "phone", "email", "campus", "brandModel", "os", "description", "freeTime"] as const) {
        if (data[key] !== input[key]) throw new AppError("REMOTE_SCHEMA_CHANGED", `预约单回读字段 ${key} 与提交内容存在差异`);
      }
      return data;
    } catch (error) {
      const cause = asAppError(error);
      throw new AppError(cause.code, "预约已提交，详情回读待确认", {
        hint: `请先执行 njucli itxia status ${created._id} 核对本单，再决定后续操作。`,
        details: { orderId: created._id, reason: cause.message }, cause,
      });
    }
  }

  async status(id: string) {
    const data = parse(order, await this.request(`/custom/order/${encodeURIComponent(id)}`));
    if (data._id !== id) throw new AppError("REMOTE_SCHEMA_CHANGED", "预约详情编号与查询目标存在差异");
    return {
      id: data._id, ...orderLinks(data._id), status: data.status, statusText: STATUS[data.status],
      name: data.name, phone: data.phone, email: data.email ?? null,
      campus: data.campus, campusName: CAMPUS[data.campus],
      brandModel: data.brandModel, os: data.os, description: data.description, freeTime: data.freeTime ?? null,
      createTime: data.createTime, handler: data.handler?.realName ?? null,
      attachments: data.attachments,
      replies: data.reply.map((reply) => ({
        author: reply.postBy?.realName ?? data.name, createTime: reply.createTime,
        content: reply.content, attachments: reply.attachments,
      })),
    };
  }

  async cancel(id: string) {
    await this.request(`/custom/order/${encodeURIComponent(id)}/cancel`, undefined, "PUT");
    return this.status(id);
  }

  async retrieve(identity: { name: string; phone: string }) {
    const id = parse(z.string().min(1), await this.request("/custom/order/retrieve", identity));
    const data = await this.status(id);
    if (data.name !== identity.name || data.phone !== identity.phone) {
      throw new AppError("REMOTE_SCHEMA_CHANGED", "找回的预约单与提供的姓名、手机号存在差异");
    }
    return data;
  }

  private async request(path: string, body?: unknown, method?: "PUT"): Promise<unknown> {
    const response = await fetch(`${ORIGIN}/api${path}`, {
      method: method ?? (body === undefined ? "GET" : "POST"),
      headers: { "content-type": "application/json", "itxia-from": ORIGIN },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `IT 侠服务返回 HTTP ${response.status}`);
    const result = parse(z.object({ code: z.number(), message: z.string().optional(), payload: z.unknown() }), await response.json());
    if (result.code !== 0) throw new AppError(result.code === 8 ? "NOT_FOUND" : "REMOTE_UNAVAILABLE",
      result.message ?? `IT 侠服务返回业务码 ${result.code}`);
    return result.payload;
  }
}

export type ItxiaOrder = Awaited<ReturnType<ItxiaClient["status"]>>;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "IT 侠响应格式有变，请核对官网预约单");
  return result.data;
}

import type { SkillRuntime } from "../../../src/app/runtime.js";
import { MailClient } from "../../njucli-mail/scripts/client.js";
import { z } from "zod";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

export const SELF_SERVICE_BASE = "https://zzfwx.nju.edu.cn/wec-self-print-app-console";
// 官方移动端使用的客户端标识，与微信入口的 appId 参数不同。
export const SELF_SERVICE_HEADERS = { "X-Requested-With": "XMLHttpRequest", appId: "80019", LoginMode: "MOBILE" };
export const DELIVERIES = ["electronic", "paper"] as const;
export type Delivery = (typeof DELIVERIES)[number];
export const ORDER_STATES = ["pending", "completed"] as const;
export type OrderState = (typeof ORDER_STATES)[number];

const identitySchema = z.object({ id: z.string(), name: z.string(), schoolCode: z.string() });
const itemSchema = z.object({
  id: z.string(), name: z.string(), parentId: z.string(), pickupType: z.number(),
  hasChildren: z.boolean().optional(),
});
const detailSchema = itemSchema.extend({
  schoolCode: z.string(), state: z.number(), formState: z.number(), afterFormState: z.number(),
  takeCodeLength: z.number(), expireDay: z.number(), takeNote: z.string().nullable(),
  chargesNotes: z.string().nullable(), relatedDescription: z.string().nullable(),
});
const quoteSchema = z.object({
  totalFee: z.number(), price: z.number(), canFreeNumber: z.number(), curFreeNumber: z.number(),
  curChargeNumber: z.number(), printLimitNumber: z.number(), isOutOfLimitNumber: z.boolean(),
  errorMsg: z.string().nullable(),
});
const orderSchema = z.object({
  orderId: z.string(), itemId: z.string(), userId: z.string(), schoolCode: z.string(),
  title: z.string(), copies: z.number(), fee: z.number(), takeType: z.number(),
  takeCode: z.string().nullable(), fileType: z.string().nullable(), filePages: z.number(),
  createTime: z.string().nullable(), completeTime: z.string().nullable(), expireTime: z.string().nullable(),
});
const configSchema = z.object({ DOWN_LOAD_TYPE: z.string(), MODIFY_MAIL: z.string(), MAIL_PATTERN: z.string() });
type Identity = z.infer<typeof identitySchema>;

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("REMOTE_SCHEMA_CHANGED", "自助服务返回字段发生变化，请核对官方页面");
  return result.data;
}

export class SelfServiceClient {
  private identity: Identity | undefined;

  constructor(private readonly fetch: FetchLike, private readonly boundEmail: () => Promise<string | null> = async () => null) {}

  async hasSession(): Promise<boolean> {
    const result = await this.json<{ success: boolean; data: unknown }>("/mobile/isLogin");
    this.identity = result.success ? parse(identitySchema, result.data) : undefined;
    return !!this.identity;
  }

  private async current(): Promise<Identity> {
    if (!this.identity && !await this.hasSession()) throw new AppError("AUTH_REQUIRED", "请登录自助服务", { authCommand: "njucli auth login self-service" });
    return this.identity!;
  }

  async profile() {
    const me = await this.current();
    const user = parse(z.object({ email: z.string().nullable() }), await this.json(`/sys/sp-user/${encodeURIComponent(me.id)}`));
    const config = parse(configSchema, JSON.parse(await this.data<string>("/mobile/getDict/PRINT_RELATED_CONFIGURATION/ELECTRONIC_FILE_CONFIG")));
    const platformEmail = user.email || null;
    const canChangeEmail = config.MODIFY_MAIL === "1";
    const boundEmail = await this.boundEmail();
    return {
      ...me, platformEmail, boundEmail,
      defaultEmail: platformEmail || (canChangeEmail ? boundEmail : null),
      emailEnabled: config.DOWN_LOAD_TYPE[1] === "1", downloadEnabled: config.DOWN_LOAD_TYPE[0] === "1",
      canChangeEmail, emailPattern: config.MAIL_PATTERN,
    };
  }

  async items(query = "", parentId?: string) {
    await this.current();
    const result = await this.data<{ records: unknown[]; total: number }>("/item/sp-print-item/list/terminal", {
      name: query, state: "1", rows: "5000", page: "1",
      ...(parentId ? { parentId } : {}),
    });
    return { total: result.total, items: result.records.map((row) => parse(itemSchema, row)) };
  }

  async show(id: string) {
    await this.current();
    const allowed = await this.data<boolean>(`/item/sp-print-item/checkItemRight/${encodeURIComponent(id)}`);
    if (allowed !== true) throw new AppError("USER_ACTION_REQUIRED", "当前账号无权申请此项目");
    const item = parse(detailSchema, await this.json(`/item/sp-print-item/terminal/${encodeURIComponent(id)}`));
    if (item.id !== id) throw new AppError("REMOTE_SCHEMA_CHANGED", "返回的项目与请求不一致");
    return { ...item, url: `${SELF_SERVICE_BASE}/mobile.html#/mobile/orderDetail?id=${encodeURIComponent(id)}` };
  }

  async quote(id: string, delivery: Delivery = "electronic", copies = 1) {
    const me = await this.current();
    const result = parse(quoteSchema, await this.data(`/item/sp-print-item/${delivery === "electronic" ? "downloadChargeFee" : "chargeFee"}`, {
      itemId: id, userId: me.id, copies: String(copies),
    }));
    return { itemId: id, delivery, copies, ...result };
  }

  async orders(state: OrderState = "completed") {
    const me = await this.current();
    const result = await this.data<{ orders: unknown[] }>(`/order/list?${new URLSearchParams({
      schoolCode: me.schoolCode, userId: me.id, type: state === "pending" ? "0" : "1", itemName: "",
    })}`);
    return result.orders.map((row) => this.ownOrder(row, me));
  }

  async order(id: string) {
    const me = await this.current();
    const result = await this.data<{ order: unknown }>(`/order/get?${new URLSearchParams({ orderId: id, schoolCode: me.schoolCode })}`);
    const order = this.ownOrder(result.order, me);
    if (order.orderId !== id) throw new AppError("REMOTE_SCHEMA_CHANGED", "返回的申请与请求不一致");
    return order;
  }

  async create(id: string, delivery: Delivery = "electronic", copies = 1, email?: string) {
    const item = await this.show(id);
    const takeType = delivery === "electronic" ? 2 : 1;
    if (item.state !== 1 || (item.pickupType !== takeType && item.pickupType !== 3))
      throw new AppError("INVALID_INPUT", "此项目不支持所选领取方式，请查看项目详情");
    if (item.formState !== 0 || item.afterFormState !== 0)
      throw new AppError("USER_ACTION_REQUIRED", "此项目需要在官方页面填写表单", { hint: item.url });
    const recipient = delivery === "electronic" ? await this.recipient(email) : null;
    const quote = await this.quote(id, delivery, copies);
    if (quote.errorMsg || quote.isOutOfLimitNumber || quote.totalFee !== 0)
      throw new AppError("USER_ACTION_REQUIRED", quote.errorMsg || "当前申请涉及付费或超出额度，请在官方页面办理", { hint: item.url });
    let result: { orderId: string };
    try {
      result = parse(z.object({ orderId: z.string() }), await this.data("/order/create", {
        itemId: item.id, copies: String(copies), schoolCode: item.schoolCode,
        orderType: "5", apiType: "2", reportFormValue: "", takeType: String(takeType), takeCodeLength: String(item.takeCodeLength),
      }));
    } catch (cause) {
      throw new AppError("USER_ACTION_REQUIRED", `未确认申请结果，请先查询申请记录再决定后续操作：${cause instanceof Error ? cause.message : "请求失败"}`, { cause });
    }
    // 创建后失败也保留申请号，后续查询或发邮件复用该申请，避免再次扣减额度。
    try {
      const order = await this.order(result.orderId);
      if (order.itemId !== id || order.takeType !== takeType || order.copies !== copies || order.fee !== 0)
        throw new AppError("REMOTE_SCHEMA_CHANGED", "创建结果与所选项目、份数、费用或领取方式不一致");
      if (recipient) await this.deliver(order.orderId, recipient);
      return { order, email: recipient, emailSent: recipient !== null };
    } catch (cause) {
      throw new AppError("USER_ACTION_REQUIRED", `申请已创建，请使用此申请号查询或继续发放：${cause instanceof Error ? cause.message : "后续处理未完成"}`, { details: { orderId: result.orderId }, cause });
    }
  }

  async send(id: string, email?: string) {
    const order = await this.order(id);
    if (order.takeType !== 2) throw new AppError("INVALID_INPUT", "此申请为纸质领取，请查询取件码与打印机位置");
    const recipient = await this.recipient(email);
    await this.deliver(order.orderId, recipient);
    return { orderId: order.orderId, email: recipient, emailSent: true };
  }

  async cancel(id: string) {
    const pending = await this.orders("pending");
    const order = pending.find((row) => row.orderId === id);
    if (!order) throw new AppError("INVALID_INPUT", "此申请不在本人的未完成列表中");
    if (order.fee !== 0) throw new AppError("USER_ACTION_REQUIRED", "涉及费用的申请请在官方页面处理");
    await this.data("/order/cancelOrders", { orderIds: id, schoolCode: order.schoolCode });
    if ((await this.orders("pending")).some((row) => row.orderId === id))
      throw new AppError("USER_ACTION_REQUIRED", "申请仍在未完成列表中，请查询状态后再处理");
    return { orderId: id, cancelled: true };
  }

  async cloud() {
    await this.current();
    const config = parse(z.object({
      price: z.string(), initFreeCopies: z.number(), singlePrintPages: z.number(), filePageLimit: z.string(),
    }), await this.data("/order/cloud-print/config"));
    const result = await this.data<{ records: unknown[]; total: number }>("/order/cloud-print-list?rows=10000&page=1&type=0");
    const files = result.records.map((row) => parse(z.object({ orderId: z.string(), title: z.string(), fileType: z.string() }), row));
    return { config, total: result.total, files };
  }

  async cloudUpload(path: string, terminalCode: string) {
    await this.current();
    const bytes = await readFile(path);
    const fileType = extname(path).slice(1).toLowerCase();
    if (!["pdf", "doc", "docx", "png", "jpg", "jpeg", "gif", "bmp"].includes(fileType))
      throw new AppError("INVALID_INPUT", "云打印支持 PDF、Word 和 png/jpg/jpeg/gif/bmp 图片");
    if (bytes.length > 5 * 1024 * 1024) throw new AppError("INVALID_INPUT", "云打印上传文件不能超过 5 MB");
    const form = new FormData();
    form.append("file", new File([new Uint8Array(bytes)], basename(path)));
    form.append("fileType", fileType);
    form.append("terminalCode", terminalCode);
    const order = parse(z.object({ orderId: z.string(), takeCode: z.string(), expireTime: z.string(), fee: z.number() }),
      await this.data("/order/cloud-print-order/create", form));
    const file = (await this.cloud()).files.find(item => item.orderId === order.orderId);
    if (!file || file.fileType.toLowerCase() !== fileType || file.title !== basename(path, extname(path)))
      throw new AppError("USER_ACTION_REQUIRED", "文件已返回申请号，待打印列表回读尚未匹配，请先查询 cloud", { details: { orderId: order.orderId } });
    return { ...order, ...file };
  }

  async cloudDelete(orderId: string, terminalCode: string) {
    if (!(await this.cloud()).files.some(item => item.orderId === orderId))
      throw new AppError("INVALID_INPUT", "目标文件不在本人的待打印列表中");
    await this.data(`/order/cloud-print-order-byGet/${encodeURIComponent(orderId)}/${encodeURIComponent(terminalCode)}`);
    if ((await this.cloud()).files.some(item => item.orderId === orderId))
      throw new AppError("USER_ACTION_REQUIRED", "删除后文件仍在待打印列表，请查询 cloud 后再处理", { details: { orderId } });
    return { orderId, deleted: true };
  }

  async terminals() {
    await this.current();
    const result = await this.json<{ success: boolean; msg: string | null; data: unknown }>("/warn/sp-terminal-status/getTerminalState");
    if (!result.success) throw new AppError("REMOTE_UNAVAILABLE", result.msg || "打印机位置查询失败");
    return parse(z.array(z.object({
      terminalCode: z.string(), address: z.string(), schoolDistrict: z.string().nullable(),
      longitude: z.number().nullable(), latitude: z.number().nullable(), networkState: z.number(), state: z.number(),
    })), result.data);
  }

  private ownOrder(value: unknown, me: Identity) {
    const order = parse(orderSchema, value);
    if (order.userId !== me.id || order.schoolCode !== me.schoolCode)
      throw new AppError("AUTH_REJECTED", "申请不属于当前登录账号");
    return order;
  }

  private async recipient(email?: string): Promise<string> {
    const profile = await this.profile();
    if (!profile.emailEnabled) throw new AppError("USER_ACTION_REQUIRED", "平台当前未开放邮件发放");
    const target = email ?? profile.defaultEmail;
    if (!target) throw new AppError("USER_ACTION_REQUIRED", "请先绑定校园邮箱，或使用 --email 指定收件地址");
    if (!profile.canChangeEmail && target !== profile.platformEmail)
      throw new AppError("USER_ACTION_REQUIRED", "平台要求使用自助服务中绑定的邮箱");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) throw new AppError("INVALID_INPUT", "请输入完整邮箱地址");
    if (profile.emailPattern) {
      const match = /^\/(.*)\/([a-z]*)$/.exec(profile.emailPattern);
      if (!match) throw new AppError("REMOTE_SCHEMA_CHANGED", "平台邮箱格式规则发生变化");
      if (!new RegExp(match[1]!, match[2]).test(target)) throw new AppError("INVALID_INPUT", "邮箱不符合平台当前的邮箱格式要求");
    }
    return target;
  }

  private async deliver(id: string, email: string): Promise<void> {
    await this.data(`/order/downloadCheck/${encodeURIComponent(id)}`);
    // 官方接口使用 GET 执行邮件发送；只调用一次，不按普通读取重试。
    await this.data(`/message/sendElectronicItemEmail?${new URLSearchParams({ orderId: id, email })}`);
  }

  private async json<T>(path: string, form?: Record<string, string> | FormData): Promise<T> {
    const response = await this.fetch(`${SELF_SERVICE_BASE}${path}`, {
      headers: form && !(form instanceof FormData) ? { ...SELF_SERVICE_HEADERS, "Content-Type": "application/x-www-form-urlencoded" } : SELF_SERVICE_HEADERS,
      ...(form ? { method: "POST", body: form instanceof FormData ? form : new URLSearchParams(form).toString() } : {}),
    });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `自助服务返回 HTTP ${response.status}`);
    return JSON.parse(await response.text()) as T;
  }

  private async data<T>(path: string, form?: Record<string, string> | FormData): Promise<T> {
    const result = await this.json<{ code: string; msg: string; data: T }>(path, form);
    if (result.code !== "0000") throw new AppError("REMOTE_UNAVAILABLE", result.msg || "自助服务请求失败");
    return result.data;
  }
}

export function createSelfServiceServices({ withBrowser }: SkillRuntime) {
  return <T>(operation: (client: SelfServiceClient) => Promise<T>): Promise<T> => {
    return withBrowser("self-service", async (session, account) => {
      return operation(new SelfServiceClient(session.request, async () => (await new MailClient(account.configDir).status()).address));
    }, (session) => new SelfServiceClient(session.request).hasSession());
  };
}

export type SelfServiceServices = ReturnType<typeof createSelfServiceServices>;

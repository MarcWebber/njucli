import { z } from "zod";
import type { ReadTool } from "../../../src/mcp/read.js";
import { DELIVERIES, ORDER_STATES } from "./client.js";
import type { SelfServiceServices } from "./services.js";

export function registerSelfServiceTools(read: ReadTool, service: SelfServiceServices): void {
  read("self_service_profile", "查询自助服务身份、默认邮箱与领取渠道。", {}, () => service.profile());
  read("self_service_items", "查询当前账号可申请的证明文件项目。", { query: z.string().optional() }, ({ query }) => service.items(query));
  read("self_service_show", "查询自助服务项目的条件与官方入口。", { id: z.string().min(1) }, ({ id }) => service.show(id));
  read("self_service_quote", "查询一份证明的费用与剩余额度。", { id: z.string().min(1), delivery: z.enum(DELIVERIES).default("electronic") }, ({ id, delivery }) => service.quote(id, delivery));
  read("self_service_orders", "查询本人的自助服务申请记录。", { state: z.enum(ORDER_STATES).default("completed") }, ({ state }) => service.orders(state));
  read("self_service_order", "查询本人申请的状态与取件信息。", { id: z.string().min(1) }, ({ id }) => service.order(id));
  read("self_service_terminals", "查询自助打印机位置与联网状态。", {}, () => service.terminals());
}

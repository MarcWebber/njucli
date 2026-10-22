import { orderLinks } from './client.js';
import { z } from 'zod';
import type { McpTool } from "../../../src/mcp/tools.js";
import type { ItxiaClient } from "./client.js";
import { identityInput, orderId, orderInput } from "./schema.js";

export function registerItxiaTools(tool: McpTool, service: ItxiaClient): void {
  tool("itxia_status", "按本人预约单编号查询 IT 侠处理状态、处理人及回复记录。", { id: orderId }, ({ id }) => service.status(id));
  tool("itxia_retrieve", "使用本人预约时的姓名和手机号找回当前 IT 侠预约并查询进度。", identityInput.shape, (identity) => service.retrieve(identity));
  tool("itxia_create", "提交 IT 侠维修预约并回读；agreeTerms 表示已阅读并同意预约须知与服务条款。", {
    input: orderInput, agreeTerms: z.literal(true),
  }, ({ input }) => service.create(input), { destructiveHint: false });
  tool("itxia_cancel", "取消指定维修预约并回读；yes 为 true 确认取消。", {
    id: orderId, yes: z.literal(true),
  }, ({ id }) => service.cancel(id), { destructiveHint: true });

  tool("itxia_open", "返回指定维修预约单的打开链接与方法。", { id: orderId }, async ({ id }) => ({ id, ...orderLinks(id) }));
}

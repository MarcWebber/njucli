import type { ReadTool } from "../../../src/mcp/read.js";
import type { ItxiaClient } from "./client.js";
import { identityInput, orderId } from "./schema.js";

export function registerItxiaTools(read: ReadTool, service: ItxiaClient): void {
  read("itxia_status", "按本人预约单编号查询 IT 侠处理状态、处理人及回复记录。", { id: orderId }, ({ id }) => service.status(id));
  read("itxia_retrieve", "使用本人预约时的姓名和手机号找回当前 IT 侠预约并查询进度。", identityInput.shape, (identity) => service.retrieve(identity));
}

import { z } from "zod";
import type { McpTool } from "../mcp/tools.js";
import type { AccountServices } from "./service.js";

export function registerAccountTools(tool: McpTool, service: AccountServices): void {
  const name = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/);
  tool("account_current", "显示当前本地账号。", {}, () => service.current());
  tool("account_list", "列出本地隔离账号。", {}, () => service.list());
  tool("account_add", "新增并切换到本地账号。", { name }, ({ name }) => service.add(name), { destructiveHint: false });
  tool("account_use", "切换当前本地账号及其业务身份。", { name }, ({ name }) => service.use(name), { destructiveHint: true });
  tool("account_remove", "移除指定本地账号及其凭据和会话目录。", { name }, async ({ name }) => {
    await service.remove(name);
    return { name, removed: true };
  }, { destructiveHint: true });
}

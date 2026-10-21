import type { McpTool } from "../mcp/tools.js";
import type { AuthServices } from "./service.js";
import { capabilityInput, credentialsInput, intervalInput } from "./schema.js";

export function registerAuthTools(tool: McpTool, service: AuthServices): void {
  tool("auth_status", "检查当前账号的认证会话状态。", { capability: capabilityInput }, ({ capability }) => service.status(capability));
  tool("auth_login", "登录指定校园站点，保存凭据供后续业务复用；省略 credentials 使用本地凭据或官方登录页面。", {
    capability: capabilityInput, credentials: credentialsInput.optional(),
  }, ({ capability, credentials }) => service.login(capability, credentials), { destructiveHint: true });
  tool("auth_authenticate", "重新验证账号密码，并通过青年平台回读本人学号。", { credentials: credentialsInput }, ({ credentials }) => service.authenticate(credentials), { destructiveHint: true });
  tool("auth_logout", "清除指定站点或当前账号全部校园会话。", { capability: capabilityInput }, ({ capability }) => service.logout(capability), { destructiveHint: true });
  tool("auth_maintain", "维护统一认证会话，过期时使用已存凭据恢复。", {}, () => service.maintain(), { destructiveHint: false });
  tool("auth_daemon_start", "启动当前账号的后台会话保活进程。", { interval: intervalInput }, ({ interval }) => service.daemonStart(interval), { destructiveHint: false });
  tool("auth_daemon_status", "查看当前账号的后台保活进程与最近维护结果。", {}, () => service.daemonStatus());
  tool("auth_daemon_stop", "停止当前账号的后台保活进程。", {}, () => service.daemonStop(), { destructiveHint: true });
  tool("auto_start", "启用当前账号登录系统后的自动保活，并立即启动。", { interval: intervalInput }, ({ interval }) => service.autostart("enable", interval), { destructiveHint: true });
  tool("auto_status", "查看当前账号的系统登录自启动配置。", {}, () => service.autostart("status"));
  tool("auto_stop", "关闭当前账号的系统登录自启动并停止保活。", {}, () => service.autostart("disable"), { destructiveHint: true });
}

import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { text } from "node:stream/consumers";
import { AUTH_CAPABILITIES } from "./capabilities.js";
import type { AuthCapability, AuthCredentials, SessionMetadata } from "./types.js";
import { requiredText } from "../core/guards.js";
import { AppError } from "../core/errors.js";

import type { AuthServices } from './service.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";

export function registerAuthCommands(
  program: Command,
  service: AuthServices,
  runtime: CommandRuntime,
): Command {
  const auth = program.command("auth").description("管理统一认证会话");

  addFormatOption(auth.command("maintain").description("维持统一认证会话；过期时使用已存凭据自动恢复"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.maintain();
      return { data, text: data.action === "restored" ? "已自动恢复统一认证会话" : "已维护统一认证会话" };
    }));

  const daemon = auth.command("daemon").description("管理 CLI 后台会话保活进程");
  addFormatOption(daemon.command("start").description("启动独立的 CLI 后台保活进程")
    .option("--interval <seconds>", "维护间隔（正整数秒）", "600"))
    .action(async (options: FormatOptions & { interval: string }) => runCommand(runtime, options, async () => {
      const data = await service.daemonStart(parseInterval(options.interval));
      return { data, text: `已启用 ${data.account} 后台保活，每 ${data.intervalSeconds} 秒维护一次` };
    }));
  addFormatOption(daemon.command("status").description("查看后台保活与最近维护结果"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.daemonStatus();
      return { data, text: `${data.account}\t${data.running ? `运行中（PID ${data.pid}）` : "已停止"}\n日志：${data.logPath}\n最近成功：${data.lastSuccess?.checkedAt ?? "待首次维护"}` };
    }));

  const autostart = program.command("auto").description("管理当前系统登录后的后台保活自启动");
  addFormatOption(autostart.command("start").description("启用当前账号自启动并立即启动保活")
    .option("--interval <seconds>", "维护间隔（正整数秒）", "600"))
    .action(async (options: FormatOptions & { interval: string }) => runCommand(runtime, options, async () => {
      const data = await service.autostart("enable", parseInterval(options.interval));
      return { data, text: `已启用 ${data.account} 登录后自动保活` };
    }));
  for (const action of ["stop", "status"] as const) {
    addFormatOption(autostart.command(action).description(action === "stop" ? "关闭自启动并停止当前账号保活" : "查看当前账号自启动配置"))
      .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
        const data = await service.autostart(action === "stop" ? "disable" : "status");
        return { data, text: `${data.account}\t自启动${data.enabled ? "已启用" : "已关闭"}\n配置：${data.path}` };
      }));
  }

  addFormatOption(daemon.command("run", { hidden: true })
    .option("--foreground", "由系统服务管理前台进程")
    .option("--interval <seconds>", "维护间隔（正整数秒）", "600"))
    .action(async (options: FormatOptions & { interval: string; foreground?: boolean }) => runCommand(runtime, options, async () => {
      if (!process.send && !options.foreground) throw new AppError("INVALID_INPUT", "请使用 auth daemon start 启动后台保活");
      const interval = parseInterval(options.interval);
      const controller = new AbortController();
      const stop = () => controller.abort();
      process.once("SIGTERM", stop);
      process.once("SIGINT", stop);
      try { await service.daemonRun(interval, controller.signal, runtime.output); }
      finally {
        process.removeListener("SIGTERM", stop);
        process.removeListener("SIGINT", stop);
      }
      return { data: { stopped: true }, text: "后台保活已停止" };
    }));
  addFormatOption(daemon.command("stop").description("完成当前维护后停止后台保活"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.daemonStop();
      return { data, text: `已停止 ${data.account} 后台保活` };
    }));

  addFormatOption(auth.command("status [capability]").description("检查认证状态"))
    .action(async (capability: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.status(parseCapability(capability));
      return { data, text: sessionsText(data) };
    }));

  addFormatOption(auth.command("authenticate").description("重新验证密码并经青年平台返回本人学号；依赖 SSO 与青年平台")
    .requiredOption("--credentials <path>", "含 username 和 password 的 JSON 文件；- 从标准输入读取"))
    .action(async (options: FormatOptions & { credentials: string }) => runCommand(runtime, options, async () => {
      const data = await service.authenticate(await readCredentials(options.credentials));
      return { data, text: `已验证学号：${data.studentId}` };
    }));

  addFormatOption(auth.command("login [capability]").description("保存账号密码并登录；后续自动使用本地凭据")
    .option("--username <username>", "统一认证账号")
    .option("--password <password>", "统一认证密码")
    .option("--credentials <path>", "含 username 和 password 的 JSON 文件；- 从标准输入读取"))
    .action(async (capability: string | undefined, options: FormatOptions & { username?: string; password?: string; credentials?: string }) => runCommand(runtime, options, async () => {
      let credentials: AuthCredentials | undefined;
      if (options.credentials) credentials = await readCredentials(options.credentials);
      else if (options.username !== undefined || options.password !== undefined) credentials = {
        username: requiredText(options.username ?? "", "--username"),
        password: requiredText(options.password ?? "", "--password"),
      };
      const data = await service.login(parseCapability(capability), credentials);
      return { data, text: sessionsText([data]) };
    }));

  addFormatOption(auth.command("logout [capability]").description("清除认证会话"))
    .action(async (capability: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.logout(parseCapability(capability));
      return {
        data,
        text: data.length === 0 ? "没有可清除的会话" : `已清除：${data.join("、")}`,
      };
    }));

  return auth;
}

async function readCredentials(path: string): Promise<AuthCredentials> {
  const input = path === "-" ? await text(process.stdin) : await readFile(path, "utf8");
  let value: unknown;
  try { value = JSON.parse(input); }
  catch { throw new AppError("INVALID_INPUT", "凭据应为包含 username 和 password 的 JSON 对象"); }
  if (typeof value !== "object" || value === null || !("username" in value) || !("password" in value)
    || typeof value.username !== "string" || !value.username.trim()
    || typeof value.password !== "string" || !value.password) {
    throw new AppError("INVALID_INPUT", "凭据应包含非空字符串 username 和 password");
  }
  return { username: value.username.trim(), password: value.password };
}

function parseInterval(value: string): number {
  const interval = Number(value);
  if (!Number.isSafeInteger(interval) || interval <= 0 || interval * 1000 > 2_147_483_647) {
    throw new AppError("INVALID_INPUT", "维护间隔应为 1–2147483 秒的整数");
  }
  return interval;
}

function parseCapability(value: string | undefined): AuthCapability | undefined {
  if (value === undefined) return undefined;
  if (!(AUTH_CAPABILITIES as readonly string[]).includes(value)) {
    throw new AppError("AUTH_CAPABILITY_UNKNOWN", `未知认证能力: ${value}`, {
      details: { supported: AUTH_CAPABILITIES },
    });
  }
  return value as AuthCapability;
}

function sessionsText(sessions: SessionMetadata[]): string {
  return sessions.length === 0 ? "无" : sessions.map((session) => `${session.capability}\t${session.status}`).join("\n");
}

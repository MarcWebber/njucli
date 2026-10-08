import type { Command } from "commander";
import { readFile } from "node:fs/promises";
import { AUTH_CAPABILITIES, type AuthCapability, type AuthCredentials, type SessionMetadata } from "./types.js";
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

  addFormatOption(auth.command("status [capability]").description("检查认证状态"))
    .action(async (capability: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.status(parseCapability(capability));
      return { data, text: sessionsText(data) };
    }));

  addFormatOption(auth.command("login [capability]").description("保存账号密码并登录；后续自动使用本地凭据")
    .option("--username <username>", "统一认证账号")
    .option("--password <password>", "统一认证密码")
    .option("--credentials <path>", "含 username 和 password 的 JSON 文件"))
    .action(async (capability: string | undefined, options: FormatOptions & { username?: string; password?: string; credentials?: string }) => runCommand(runtime, options, async () => {
      let credentials: AuthCredentials | undefined;
      if (options.credentials) credentials = JSON.parse(await readFile(options.credentials, "utf8")) as AuthCredentials;
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

import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { parseAuthCapability } from "../auth/capabilities.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { sessionsText } from "./text.js";

export function registerAuthCommands(
  program: Command,
  service: NjuServices["auth"],
  runtime: CommandRuntime,
): Command {
  const auth = program.command("auth").description("管理统一认证会话");

  addFormatOption(auth.command("status [capability]").description("检查认证状态"))
    .action(async (capability: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.status(parseCapability(capability));
      return { data, text: sessionsText(data) };
    }));

  addFormatOption(auth.command("login [capability]").description("建立认证会话"))
    .action(async (capability: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.login(parseCapability(capability));
      return { data, text: sessionsText([data]) };
    }));

  addFormatOption(auth.command("refresh [capability]").description("刷新认证会话"))
    .action(async (capability: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.refresh(parseCapability(capability));
      return { data, text: sessionsText(data) };
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

function parseCapability(value: string | undefined) {
  return value === undefined ? undefined : parseAuthCapability(value);
}

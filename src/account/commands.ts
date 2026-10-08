import type { Command } from "commander";

import type { AccountServices } from './service.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";

export function registerAccountCommands(
  program: Command,
  service: AccountServices,
  runtime: CommandRuntime,
): Command {
  const account = program.command("account").description("管理本机隔离账号");

  addFormatOption(account.command("current").description("显示当前账号"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.current();
      return { data, text: data };
    }));

  addFormatOption(account.command("list").description("列出本机账号"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.list();
      return { data, text: data.length === 0 ? "无" : data.join("\n") };
    }));

  addFormatOption(account.command("add <name>").description("新增并切换到账号"))
    .action(async (name: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.add(name);
      return { data, text: data };
    }));

  addFormatOption(account.command("use <name>").description("切换当前账号"))
    .action(async (name: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.use(name);
      return { data, text: data };
    }));

  addFormatOption(account.command("remove <name>").description("移除本机账号"))
    .action(async (name: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      await service.remove(name);
      const data = { name, removed: true };
      return { data, text: `已移除账号 ${name}` };
    }));

  return account;
}

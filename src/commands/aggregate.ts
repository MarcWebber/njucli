import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { doctorText, todayText } from "./text.js";

export function registerAggregateCommands(
  program: Command,
  services: Pick<NjuServices, "today" | "doctor">,
  runtime: CommandRuntime,
): void {
  addFormatOption(program.command("today [date]").description("汇总今天的课程、借阅与体育预约"))
    .action(async (date: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await services.today(date);
      return { data, text: todayText(data) };
    }));

  addFormatOption(program.command("doctor").description("检查本机账号、认证能力与校园服务连通性"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await services.doctor();
      return { data, text: doctorText(data) };
    }));
}

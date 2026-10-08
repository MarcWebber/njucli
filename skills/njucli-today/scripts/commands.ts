import type { Command } from 'commander';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from '../../../src/core/command.js';
import type { TodayServices } from './services.js';

export function registerTodayCommand(program: Command, service: TodayServices, runtime: CommandRuntime): void {
  addFormatOption(program.command("today [date]").description("汇总今天的课程、借阅与体育预约"))
    .action(async (date: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service(date);
      return { data, text: [
        `日期：${data.date}`,
        `课程：${data.course.length} 项`,
        `借阅：${data.library.length} 项`,
        `体育预约：${data.sports.length} 项`,
      ].join("\n") };
    }));
}

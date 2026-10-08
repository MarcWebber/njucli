import type { Command } from 'commander';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from '../../../src/core/command.js';
import type { DoctorServices } from './services.js';

export function registerDoctorCommand(program: Command, service: DoctorServices, runtime: CommandRuntime): void {
  addFormatOption(program.command("doctor").description("检查本机账号、认证能力与校园服务连通性"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service();
      const checks = data.checks.map((check) => `${check.ok ? "OK" : "FAIL"}\t${check.name}${check.code ? `\t${check.code}` : ""}`);
      return { data, text: [`账号：${data.account}`, ...checks].join("\n") };
    }));
}

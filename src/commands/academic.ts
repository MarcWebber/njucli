import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import {
  graduateExamsText,
  graduateGradesText,
  graduatePlanText,
  graduateScheduleText,
} from "./text.js";

interface TermOptions extends FormatOptions {
  term?: string;
}

export function registerAcademicCommands(
  program: Command,
  service: NjuServices["academic"],
  runtime: CommandRuntime,
): Command {
  const academic = program.command("academic").description("查询研究生成绩、考试、课表与培养方案");

  addFormatOption(academic.command("grades").description("查询我的成绩").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.grades(options.term);
      return { data, text: graduateGradesText(data) };
    }));

  addFormatOption(academic.command("exams").description("查询考试与考查安排").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.exams(options.term);
      return { data, text: graduateExamsText(data) };
    }));

  addFormatOption(academic.command("schedule").description("查询研究生课表").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.schedule(options.term);
      return { data, text: graduateScheduleText(data) };
    }));

  addFormatOption(academic.command("plan").description("查询我的培养方案"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.plan();
      return { data, text: graduatePlanText(data) };
    }));

  return academic;
}

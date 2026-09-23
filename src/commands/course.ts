import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { requireConfirmation } from "../core/confirmation.js";
import { AppError } from "../core/errors.js";
import type { CourseSelectionKind } from "../domains/course/types.js";
import { optionalPositiveInteger } from "./options.js";
import {
  courseOfferingsText,
  occurrenceText,
  occurrencesText,
  scheduleText,
  selectedCoursesText,
  termText,
  termsText,
} from "./text.js";

interface TermOptions extends FormatOptions {
  term?: string;
}

interface SelectionOptions extends FormatOptions {
  kind: string;
  page?: string;
  pageSize?: string;
  yes?: boolean;
}

export function registerCourseCommands(
  program: Command,
  service: NjuServices["course"],
  runtime: CommandRuntime,
): Command {
  const course = program.command("course").description("查询课表与研究生选课");

  addFormatOption(course.command("terms").description("列出学期"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.terms();
      return { data, text: termsText(data) };
    }));

  addFormatOption(course.command("current-term").description("显示当前学期"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.currentTerm();
      return { data, text: termText(data) };
    }));

  addFormatOption(course.command("available [query]").description("查询仍有名额的研究生课程")
    .option("--kind <kind>", "课程范围：plan 或 public", "public")
    .option("--page <page>", "页码")
    .option("--page-size <size>", "每页条数"))
    .action(async (query: string | undefined, options: SelectionOptions) => runCommand(runtime, options, async () => {
      const data = await service.available(
        selectionKind(options.kind),
        query,
        optionalPositiveInteger(options.page, "--page"),
        optionalPositiveInteger(options.pageSize, "--page-size"),
      );
      return { data, text: courseOfferingsText(data) };
    }));

  addFormatOption(course.command("selected").description("查询已选研究生课程"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.selected();
      return { data, text: selectedCoursesText(data) };
    }));

  addFormatOption(course.command("select <class-id>").description("提交一次研究生选课")
    .option("--kind <kind>", "课程范围：plan 或 public", "public")
    .option("--yes", "确认提交选课"))
    .action(async (classId: string, options: SelectionOptions) => runCommand(runtime, options, async () => {
      requireConfirmation(options.yes === true);
      const data = await service.select(classId, selectionKind(options.kind));
      return { data, text: selectedCoursesText([data]) };
    }));

  addFormatOption(course.command("withdraw <class-id>").description("提交一次研究生退课")
    .option("--yes", "确认退出已选课程"))
    .action(async (classId: string, options: FormatOptions & { yes?: boolean }) => runCommand(runtime, options, async () => {
      requireConfirmation(options.yes === true);
      const data = await service.withdraw(classId);
      return { data, text: `已退课：${data.name}\t${data.classId}` };
    }));

  addFormatOption(course.command("schedule").description("读取完整课表").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.schedule(options.term);
      return { data, text: scheduleText(data) };
    }));

  addFormatOption(course.command("today [date]").description("查询某日课程").option("--term <term>", "学期 ID"))
    .action(async (date: string | undefined, options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.today(date, options.term);
      return { data, text: occurrencesText(data) };
    }));

  addFormatOption(course.command("week [date]").description("查询日期所在周的课程").option("--term <term>", "学期 ID"))
    .action(async (date: string | undefined, options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.week(date, options.term);
      return { data, text: occurrencesText(data) };
    }));

  addFormatOption(course.command("next").description("查询下一节课").option("--term <term>", "学期 ID"))
    .action(async (options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.next(options.term);
      return { data, text: occurrenceText(data) };
    }));

  addFormatOption(course.command("export <path>").description("导出 ICS 课表").option("--term <term>", "学期 ID"))
    .action(async (path: string, options: TermOptions) => runCommand(runtime, options, async () => {
      const data = await service.export(path, options.term);
      return {
        data,
        text: `已导出 ${data.eventCount} 个日程到 ${data.path}`,
      };
    }));

  return course;
}

function selectionKind(value: string): CourseSelectionKind {
  if (value === "plan" || value === "public") return value;
  throw new AppError("INVALID_INPUT", `不支持的课程范围：${value}`, {
    hint: "使用 plan 或 public",
  });
}

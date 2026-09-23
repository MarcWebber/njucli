import type { Command } from "commander";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { requireConfirmation } from "../core/confirmation.js";
import { optionalPositiveInteger } from "./options.js";
import {
  softSeAssignmentsText,
  softSeAssignmentText,
  softSeCoursePageText,
  softSeCourseText,
  softSeCoursesText,
  softSeGradesText,
  softSeLinkText,
} from "./text.js";

interface PageOptions extends FormatOptions {
  page?: string;
}

interface MutationOptions extends FormatOptions {
  yes?: boolean;
}

export function registerSoftSeCommands(
  program: Command,
  service: NjuServices["softse"],
  runtime: CommandRuntime,
): Command {
  const softse = program.command("softse").description("使用软件学院教学支持系统");

  addFormatOption(softse.command("courses").description("查询我的 SoftSE 课程"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.courses();
      return { data, text: softSeCoursesText(data) };
    }));

  addFormatOption(softse.command("search <query>").description("搜索 SoftSE 课程").option("--page <page>", "页码"))
    .action(async (query: string, options: PageOptions) => runCommand(runtime, options, async () => {
      const data = await service.search(query, optionalPositiveInteger(options.page, "--page"));
      return { data, text: softSeCoursePageText(data) };
    }));

  addFormatOption(softse.command("course <course-id>").description("查询课程章节与活动"))
    .action(async (courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.course(courseId);
      return { data, text: softSeCourseText(data) };
    }));

  addFormatOption(softse.command("assignments [course-id]").description("按截止时间列出作业；省略课程则查我的全部课程")
    .option("--pending", "只列未提交、草稿或重新开放的作业"))
    .action(async (courseId: string | undefined, options: FormatOptions & { pending?: boolean }) => runCommand(runtime, options, async () => {
      const data = await service.assignments(courseId, options.pending);
      return { data, text: softSeAssignmentsText(data) };
    }));

  addFormatOption(softse.command("assignment <activity-id>").description("读取作业要求、提交状态、截止时间与附件"))
    .action(async (activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.assignment(activityId);
      return { data, text: softSeAssignmentText(data) };
    }));

  addFormatOption(softse.command("download <activity-id> <file-name>").description("下载作业附件，替换指定输出文件")
    .requiredOption("--output <path>", "保存路径")
    .option("--submitted", "下载本人已交文件，默认下载作业要求附件"))
    .action(async (activityId: string, fileName: string, options: FormatOptions & { output: string; submitted?: boolean }) => runCommand(runtime, options, async () => {
      const data = await service.download(activityId, fileName, options.output, options.submitted);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));

  addFormatOption(softse.command("grades <course-id>").description("查询课程成绩项"))
    .action(async (courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.grades(courseId);
      return { data, text: softSeGradesText(data) };
    }));

  addFormatOption(softse.command("enroll <course-id>").description("提交一次 SoftSE 自助选课")
    .option("--yes", "确认加入课程"))
    .action(async (courseId: string, options: MutationOptions) => runCommand(runtime, options, async () => {
      requireConfirmation(options.yes === true);
      const data = await service.enroll(
        courseId,
        runtime.environment.NJUCLI_SOFTSE_ENROLMENT_KEY,
      );
      return { data, text: softSeCoursesText([data]) };
    }));

  addFormatOption(softse.command("submission-link <activity-id>")
    .description("返回官方作业提交页，不上传或提交文件"))
    .action(async (activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.submissionLink(activityId);
      return { data, text: softSeLinkText(data) };
    }));

  return softse;
}

import type { Command } from "commander";

import type { SeServices } from './services.js';
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";
import {
  seAssignmentsText,
  seAssignmentText,
  seCourseText,
  seCoursesText,
  seGradesText,
  seLinkText,
  seParticipantsText,
} from './text.js';

interface PageOptions extends FormatOptions {
  page?: string;
}

export function registerSeCommands(
  program: Command,
  service: SeServices,
  runtime: CommandRuntime,
): Command {
  const se = program.command("se").description("使用软件学院教学支持系统");

  addFormatOption(se.command("courses").description("查询我的 SE 课程"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.courses();
      return { data, text: seCoursesText(data) };
    }));

  addFormatOption(se.command("catalog").description("遍历全部可见分类与分页，列出 SE 课程目录"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.catalog();
      return { data, text: seCoursesText(data) };
    }));

  addFormatOption(se.command("participants <course-id>").description("分页查询当前账号有权查看的课程名单")
    .option("--page <page>", "页码，从 1 开始，每页 20 人"))
    .action(async (courseId: string, options: PageOptions) => runCommand(runtime, options, async () => {
      const id = String(optionalPositiveInteger(courseId, "course-id"));
      const data = await service.participants(id, optionalPositiveInteger(options.page, "--page"));
      return { data, text: seParticipantsText(data) };
    }));

  addFormatOption(se.command("search <query>").description("搜索 SE 课程").option("--page <page>", "页码"))
    .action(async (query: string, options: PageOptions) => runCommand(runtime, options, async () => {
      const data = await service.search(query, optionalPositiveInteger(options.page, "--page"));
      return { data, text: seCoursesText(data.items) };
    }));

  addFormatOption(se.command("course <course-id>").description("查询课程章节与活动"))
    .action(async (courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.course(courseId);
      return { data, text: seCourseText(data) };
    }));

  addFormatOption(se.command("assignments [course-id]").description("按截止时间列出作业；省略课程则查我的全部课程")
    .option("--pending", "只列未提交、草稿或重新开放的作业"))
    .action(async (courseId: string | undefined, options: FormatOptions & { pending?: boolean }) => runCommand(runtime, options, async () => {
      const data = await service.assignments(courseId, options.pending);
      return { data, text: seAssignmentsText(data) };
    }));

  addFormatOption(se.command("assignment <activity-id>").description("读取作业要求、提交状态、截止时间与附件"))
    .action(async (activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.assignment(activityId);
      return { data, text: seAssignmentText(data) };
    }));

  addFormatOption(se.command("download <activity-id> <file-name>").description("下载作业附件，替换指定输出文件")
    .requiredOption("--output <path>", "保存路径")
    .option("--submitted", "下载本人已交文件，默认下载作业要求附件"))
    .action(async (activityId: string, fileName: string, options: FormatOptions & { output: string; submitted?: boolean }) => runCommand(runtime, options, async () => {
      const data = await service.download(activityId, fileName, options.output, options.submitted);
      return { data, text: `${data.path}\t${data.bytes} bytes` };
    }));

  addFormatOption(se.command("grades <course-id>").description("查询课程成绩项"))
    .action(async (courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.grades(courseId);
      return { data, text: seGradesText(data) };
    }));

  addFormatOption(se.command("enroll <course-id>").description("提交一次 SE 自助选课"))
    .action(async (courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.enroll(
        courseId,
        runtime.environment.NJUCLI_SE_ENROLMENT_KEY,
      );
      return { data, text: seCoursesText([data]) };
    }));

  addFormatOption(se.command("submission-link <activity-id>")
    .description("返回官方作业提交页，不上传或提交文件"))
    .action(async (activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.submissionLink(activityId);
      return { data, text: seLinkText(data) };
    }));

  return se;
}

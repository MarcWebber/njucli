import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { optionalPositiveInteger } from "../../../src/core/options.js";
import { z } from "zod";
import type { McpTool } from "../../../src/mcp/tools.js";
import type { LmsServices } from "./client.js";

const timestamp = z.iso.datetime({ offset: true, precision: 0 })
  .transform(value => new Date(value).toISOString().replace(".000Z", "Z"));

const assignmentInput = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  endTime: timestamp,
  startTime: timestamp.optional(),
}).strict().refine(input => !input.startTime || Date.parse(input.startTime) < Date.parse(input.endTime), {
  message: "startTime 必须早于 endTime",
});

export type AssignmentInput = z.infer<typeof assignmentInput>;

const resultText = (data: unknown) => ({ data, text: JSON.stringify(data, null, 2) });
const id = (value: string) => optionalPositiveInteger(value, "编号")!;

export function registerLmsCommands(program: Command, service: LmsServices, runtime: CommandRuntime): Command {
  const lms = program.command("lms").description("智汇南雍：课程、课件、作业、测试与助教作业创建");
  addFormatOption(lms.command("courses [query]").description("分页查询我的课程及教学权限").option("--page <number>", "页码，从 1 开始"))
    .action((query: string | undefined, options: FormatOptions & { page?: string }) => runCommand(runtime, options, async () => {
      const data = await service.courses(optionalPositiveInteger(options.page, "--page"), query);
      return { data, text: data.courses.map(item => `${item.id}\t${item.name}\t${item.is_instructor ? "教学权限" : "学生"}\n${item.url}`).join("\n")
        + `\n共 ${data.total} 门；${data.nextPage ? `下一页：--page ${data.nextPage}` : "已到末页"}` };
    }));
  addFormatOption(lms.command("course <course-id>").description("查看课程信息、学期与起止日期"))
    .action((courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.course(id(courseId)))));
  addFormatOption(lms.command("activities <course-id>").description("读取课程课件等学习活动及附件信息"))
    .action((courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.activities(id(courseId)))));
  addFormatOption(lms.command("assignments <course-id>").description("分页读取作业类型活动；测试类型使用 exams").option("--page <number>", "页码，从 1 开始"))
    .action((courseId: string, options: FormatOptions & { page?: string }) => runCommand(runtime, options, async () =>
      resultText(await service.assignments(id(courseId), optionalPositiveInteger(options.page, "--page")))));
  addFormatOption(lms.command("assignment <activity-id>").description("读取作业正文、截止时间、发布状态与附件"))
    .action((activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.assignment(id(activityId)))));
  addFormatOption(lms.command("exams <course-id>").description("列出测试类型活动，包括使用测试布置的书面作业"))
    .action((courseId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.exams(id(courseId)))));
  addFormatOption(lms.command("todos").description("查询平台首页待办"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.todos())));
  addFormatOption(lms.command("create-assignment <course-id>").description("助教或教师创建个人作业草稿并回读")
    .requiredOption("--input <path>", "JSON：title、description、endTime，可选 startTime")
    .option("--publish", "创建并发布作业")
    .option("--notify", "发布时发送平台邮件及待办通知，配合 --publish"))
    .action((courseId: string, options: FormatOptions & { input: string; publish?: boolean; notify?: boolean }) => runCommand(runtime, options, async () => {
      const target = id(courseId);
      if (options.notify && !options.publish) throw new AppError("INVALID_INPUT", "--notify 需配合 --publish 使用");
      let value: unknown;
      try { value = JSON.parse(await readFile(options.input, "utf8")); }
      catch (cause) { throw new AppError("INVALID_INPUT", "请提供可读取的作业 JSON 文件", { cause }); }
      const input = assignmentInput.safeParse(value);
      if (!input.success) throw new AppError("INVALID_INPUT", "作业输入格式有误", { details: input.error.issues });
      return resultText(await service.createAssignment(target, input.data, options.publish, options.notify));
    }));
  return lms;
}

export function registerLmsTools(tool: McpTool, service: LmsServices): void {
  const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
  const page = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional();
  tool("lms_courses", "分页查询智汇南雍课程及教学权限，用 nextPage 翻页。", { page, query: z.string().optional() }, ({ page, query }) => service.courses(page, query));
  tool("lms_course", "读取智汇南雍课程信息与学期。", { courseId: id }, ({ courseId }) => service.course(courseId));
  tool("lms_activities", "读取智汇南雍课件等学习活动及附件信息。", { courseId: id }, ({ courseId }) => service.activities(courseId));
  tool("lms_assignments", "分页查询智汇南雍作业类型活动；测试类型使用 lms_exams。", { courseId: id, page }, ({ courseId, page }) => service.assignments(courseId, page));
  tool("lms_assignment", "读取作业正文、截止时间、发布状态及附件。", { activityId: id }, ({ activityId }) => service.assignment(activityId));
  tool("lms_exams", "查询智汇南雍测试类型活动，包括使用测试布置的书面作业。", { courseId: id }, ({ courseId }) => service.exams(courseId));
  tool("lms_todos", "读取智汇南雍首页待办。", {}, () => service.todos());
  tool("lms_create_assignment", "助教或教师创建个人作业草稿并回读；publish 发布，notify 随发布发送平台通知。", {
    courseId: id, input: assignmentInput, publish: z.boolean().optional(), notify: z.boolean().optional(),
  }, ({ courseId, input, publish, notify }) => {
    if (notify && !publish) throw new AppError("INVALID_INPUT", "notify 需配合 publish 使用");
    return service.createAssignment(courseId, input, publish, notify);
  }, { destructiveHint: false });
}

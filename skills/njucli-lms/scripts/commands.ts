import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { saveFile } from "../../../src/core/fs.js";
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
const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const assignmentUpdate = z.object({
  title: z.string().trim().min(1).optional(), description: z.string().trim().min(1).optional(),
  endTime: timestamp.optional(), startTime: timestamp.nullable().optional(), uploadIds: z.array(positiveId).optional(),
}).strict().refine(input => Object.keys(input).length > 0, "至少提供一个修改字段");
export type AssignmentUpdate = z.infer<typeof assignmentUpdate>;
const submissionInput = z.object({
  comment: z.string().trim().optional(), uploadIds: z.array(positiveId).optional(),
  draft: z.boolean().optional(), multipleChoiceTitle: z.string().trim().min(1).optional(),
}).strict().refine(input => !!input.comment || !!input.uploadIds?.length, "提供 comment 或非空 uploadIds");
export type SubmissionInput = z.infer<typeof submissionInput>;

async function readInput<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  let value: unknown;
  try { value = JSON.parse(await readFile(path, "utf8")); }
  catch (cause) { throw new AppError("INVALID_INPUT", "请提供可读取的 JSON 文件", { cause }); }
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("INVALID_INPUT", "输入格式有误", { details: result.error.issues });
  return result.data;
}

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
  addFormatOption(lms.command("file <upload-id>").description("查询单个文件的名称、状态与下载权限"))
    .action((uploadId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.file(id(uploadId)))));
  addFormatOption(lms.command("download <upload-id>").description("下载单个课件或作业附件").requiredOption("--output <path>", "保存路径，同名覆盖"))
    .action((uploadId: string, options: FormatOptions & { output: string }) => runCommand(runtime, options, async () =>
      resultText(await saveFile(options.output, await service.download(id(uploadId))))));
  addFormatOption(lms.command("upload <course-id> <path>").description("上传一个本地文件，返回可用于作业或提交的文件编号"))
    .action((courseId: string, path: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.upload(id(courseId), path))));
  addFormatOption(lms.command("delete-file <upload-id>").description("删除指定文件并回读"))
    .action((uploadId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.deleteFile(id(uploadId)))));
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
  addFormatOption(lms.command("update-assignment <activity-id>").description("修改已有作业的标题、正文、时间或附件并回读")
    .requiredOption("--input <path>", "JSON：title、description、startTime、endTime、uploadIds 均可选"))
    .action((activityId: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () =>
      resultText(await service.updateAssignment(id(activityId), await readInput(options.input, assignmentUpdate)))));
  for (const [name, published] of [["publish-assignment", true], ["unpublish-assignment", false]] as const) {
    addFormatOption(lms.command(`${name} <activity-id>`).description(published ? "发布已有作业并回读，关闭通知" : "取消发布已有作业并回读"))
      .action((activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.publishAssignment(id(activityId), published))));
  }
  addFormatOption(lms.command("delete-assignment <activity-id>").description("删除已有作业并回读"))
    .action((activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.deleteAssignment(id(activityId)))));
  addFormatOption(lms.command("submissions <activity-id>").description("查询本人对目标作业的提交与草稿记录"))
    .action((activityId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.submissions(id(activityId)))));
  addFormatOption(lms.command("submit-assignment <activity-id>").description("提交本人作业或保存提交草稿并回读")
    .requiredOption("--input <path>", "JSON：comment、uploadIds，可选 draft、multipleChoiceTitle"))
    .action((activityId: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () =>
      resultText(await service.submitAssignment(id(activityId), await readInput(options.input, submissionInput)))));
  addFormatOption(lms.command("retract-submission <activity-id> <submission-id>").description("撤回本人指定提交并回读"))
    .action((activityId: string, submissionId: string, options: FormatOptions) => runCommand(runtime, options, async () =>
      resultText(await service.retractSubmission(id(activityId), id(submissionId)))));
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
  tool("lms_file", "读取单个文件的元数据与下载权限。", { uploadId: id }, ({ uploadId }) => service.file(uploadId));
  tool("lms_download", "下载单个课件或作业附件到本地文件。", { uploadId: id, output: z.string().min(1) }, async ({ uploadId, output }) =>
    saveFile(output, await service.download(uploadId)), { destructiveHint: false });
  tool("lms_upload", "上传一个本地文件并回读就绪状态。", { courseId: id, path: z.string().min(1) }, ({ courseId, path }) => service.upload(courseId, path), { destructiveHint: false });
  tool("lms_delete_file", "删除指定文件并回读。", { uploadId: id }, ({ uploadId }) => service.deleteFile(uploadId), { destructiveHint: true });
  tool("lms_create_assignment", "助教或教师创建个人作业草稿并回读；publish 发布，notify 随发布发送平台通知。", {
    courseId: id, input: assignmentInput, publish: z.boolean().optional(), notify: z.boolean().optional(),
  }, ({ courseId, input, publish, notify }) => {
    if (notify && !publish) throw new AppError("INVALID_INPUT", "notify 需配合 publish 使用");
    return service.createAssignment(courseId, input, publish, notify);
  }, { destructiveHint: false });
  tool("lms_update_assignment", "修改已有作业并回读，保留原有评分及完成条件。", { activityId: id, input: assignmentUpdate },
    ({ activityId, input }) => service.updateAssignment(activityId, input), { destructiveHint: false });
  tool("lms_publish_assignment", "发布已有作业并回读，关闭通知。", { activityId: id }, ({ activityId }) => service.publishAssignment(activityId, true), { destructiveHint: false });
  tool("lms_unpublish_assignment", "取消发布已有作业并回读。", { activityId: id }, ({ activityId }) => service.publishAssignment(activityId, false), { destructiveHint: false });
  tool("lms_delete_assignment", "删除目标作业并回读。", { activityId: id }, ({ activityId }) => service.deleteAssignment(activityId), { destructiveHint: true });
  tool("lms_submissions", "查询本人对目标作业的提交与草稿记录。", { activityId: id }, ({ activityId }) => service.submissions(activityId));
  tool("lms_submit_assignment", "提交本人作业或保存提交草稿并回读。", { activityId: id, input: submissionInput },
    ({ activityId, input }) => service.submitAssignment(activityId, input), { destructiveHint: false });
  tool("lms_retract_submission", "撤回本人指定提交并回读。", { activityId: id, submissionId: id },
    ({ activityId, submissionId }) => service.retractSubmission(activityId, submissionId), { destructiveHint: true });
}

import type { Command } from "commander";
import { z } from "zod";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import type { McpTool } from "../../../src/mcp/tools.js";
import type { HospitalServices } from "./hospital.js";

const text = z.string().trim().min(1).refine(value => !value.includes("^"), "参数不能包含 ^ 分隔符");
const positive = z.coerce.number().int().positive();
const pageSize = z.coerce.number().int().min(1).max(100);
type KindOptions = FormatOptions & { kind: string };
type PageOptions = FormatOptions & { page: string; size: string };
const output = <T>(data: T) => ({ data, text: JSON.stringify(data, null, 2) });

export function registerHospitalCommands(program: Command, service: HospitalServices, runtime: CommandRuntime): Command {
  const group = program.command("hospital").description("校医院预约、体检报告与大学生医保");
  addFormatOption(group.command("kinds").description("读取医院开放的预约类别及 ID"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.kinds()))));
  addFormatOption(group.command("projects").description("读取预约项目及本人预约状态").option("--kind <id>", "kinds 返回的类别 ID", "2"))
    .action((options: KindOptions) => runCommand(runtime, options, async () => output(await service(client => client.projects(positive.parse(options.kind))))));
  addFormatOption(group.command("campuses <project-id>").description("读取项目可预约校区"))
    .action((id: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.campuses(text.parse(id))))));
  addFormatOption(group.command("dates <project-id> <campus>").description("读取可预约日期及余量"))
    .action((id: string, campus: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.dates(text.parse(id), text.parse(campus))))));
  addFormatOption(group.command("slots <project-id> <campus> <date>").description("读取指定日期的预约时段及余量"))
    .action((id: string, campus: string, date: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.slots(text.parse(id), text.parse(campus), parseCampusDate(date))))));
  addFormatOption(group.command("book <project-id>").description("预约指定医院项目并回读确认")
    .option("--kind <id>", "项目所属预约类别 ID", "2").requiredOption("--campus <name>", "campuses 返回的校区名称")
    .requiredOption("--date <date>", "dates 返回的日期").requiredOption("--slot <time>", "slots 返回的时段"))
    .action((id: string, options: KindOptions & { campus: string; date: string; slot: string }) => runCommand(runtime, options, async () => output(await service(client => client.book(positive.parse(options.kind), text.parse(id), text.parse(options.campus), parseCampusDate(options.date), text.parse(options.slot))))));
  addFormatOption(group.command("cancel <booking-id>").description("取消本人医院预约并回读确认").option("--kind <id>", "项目所属预约类别 ID", "2"))
    .action((id: string, options: KindOptions) => runCommand(runtime, options, async () => output(await service(client => client.cancel(positive.parse(options.kind), text.parse(id))))));
  addFormatOption(group.command("reports").description("查询本人体检报告列表").option("--page <page>", "页码", "1").option("--size <size>", "每页条数，最多100", "20"))
    .action((options: PageOptions) => runCommand(runtime, options, async () => output(await service(client => client.reports(positive.parse(options.page), pageSize.parse(options.size))))));
  addFormatOption(group.command("report-download <report-id> <output>").description("下载本人体检报告原 PDF，同名文件覆盖"))
    .action((id: string, path: string, options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.downloadReport(text.parse(id), text.parse(path))))));
  addFormatOption(group.command("hepatitis-reports").description("查询本人乙肝检验结果与医生建议"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.hepatitisReports()))));
  addFormatOption(group.command("insurance-info").description("查询本人校医院医保资料"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.insuranceInfo()))));
  addFormatOption(group.command("insurance-fields").description("读取医保资料的户籍性质与证件类型选项"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.insuranceFields()))));
  addFormatOption(group.command("insurance-records").description("查询本人医保参保、缴费与生效状态").option("--page <page>", "页码", "1").option("--size <size>", "每页条数，最多100", "20"))
    .action((options: PageOptions) => runCommand(runtime, options, async () => output(await service(client => client.insuranceRecords(positive.parse(options.page), pageSize.parse(options.size))))));
  addFormatOption(group.command("insurance-opening").description("查询当前医保参保年度和开放说明"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => output(await service(client => client.insuranceOpening()))));
  return group;
}

export function registerHospitalTools(tool: McpTool, service: HospitalServices): void {
  const kind = z.number().int().positive().default(2);
  const page = z.number().int().positive().default(1);
  const size = z.number().int().min(1).max(100).default(20);
  tool("hospital_kinds", "读取医院开放的预约类别。", {}, () => service(client => client.kinds()));
  tool("hospital_projects", "读取医院项目及本人预约状态。", { kind }, args => service(client => client.projects(args.kind)));
  tool("hospital_campuses", "读取指定医院项目的可预约校区。", { projectId: text }, args => service(client => client.campuses(args.projectId)));
  tool("hospital_dates", "读取医院项目的可预约日期及余量。", { projectId: text, campus: text }, args => service(client => client.dates(args.projectId, args.campus)));
  tool("hospital_slots", "读取医院项目某日的预约时段及余量。", { projectId: text, campus: text, date: text }, args => service(client => client.slots(args.projectId, args.campus, parseCampusDate(args.date))));
  tool("hospital_book", "预约用户指定的医院项目与时段并回读确认。", { kind, projectId: text, campus: text, date: text, slot: text }, args => service(client => client.book(args.kind, args.projectId, args.campus, parseCampusDate(args.date), args.slot)), { destructiveHint: false });
  tool("hospital_cancel", "取消本人指定的医院预约并回读。", { kind, bookingId: text }, args => service(client => client.cancel(args.kind, args.bookingId)), { destructiveHint: true });
  tool("hospital_reports", "查询本人体检报告列表。", { page, size }, args => service(client => client.reports(args.page, args.size)));
  tool("hospital_report_download", "下载本人体检报告原 PDF，同名文件覆盖。", { id: text, output: text }, args => service(client => client.downloadReport(args.id, args.output)), { destructiveHint: true });
  tool("hospital_hepatitis_reports", "查询本人乙肝检验结果及医生建议。", {}, () => service(client => client.hepatitisReports()));
  tool("hospital_insurance_info", "查询本人校医院医保资料。", {}, () => service(client => client.insuranceInfo()));
  tool("hospital_insurance_fields", "读取医保资料户籍性质和证件类型选项。", {}, () => service(client => client.insuranceFields()));
  tool("hospital_insurance_records", "查询本人医保参保、缴费与生效状态。", { page, size }, args => service(client => client.insuranceRecords(args.page, args.size)));
  tool("hospital_insurance_opening", "读取当前医保参保年度及开放说明。", {}, () => service(client => client.insuranceOpening()));
}

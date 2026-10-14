import type { Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../../../src/core/command.js";
import { AppError } from "../../../src/core/errors.js";
import { optionalNonNegativeInteger, optionalPositiveInteger } from "../../../src/core/options.js";
import { type InstitutionClient, type SearchOptions } from "./client.js";
import { institutionContactText, recordText } from "./text.js";
import type { KnowledgeKind } from "./types.js";

interface QueryOptions extends FormatOptions { institution?: string; kind?: string; limit?: string; offset?: string }
interface LiveOptions extends FormatOptions { live?: boolean }

function searchOptions(options: QueryOptions): SearchOptions {
  const limit = optionalPositiveInteger(options.limit, "--limit") ?? 20;
  if (limit > 100) throw new AppError("INVALID_INPUT", "--limit 最大为 100");
  if (options.kind !== undefined && !["overview", "teacher"].includes(options.kind)) throw new AppError("INVALID_INPUT", "--kind 请选择 overview 或 teacher");
  return { institution: options.institution, kind: options.kind as KnowledgeKind | undefined, limit, offset: optionalNonNegativeInteger(options.offset, "--offset") ?? 0 };
}

export function registerInstitutionCommands(program: Command, service: InstitutionClient, runtime: CommandRuntime): Command {
  const institution = program.command("institution").description("检索学校机构、教师（含联系方式）与后勤电话");
  addFormatOption(institution.command("list [query]").description("按名称或分类查询机构目录").option("--live", "读取当前官方目录"))
    .action((query: string | undefined, options: LiveOptions) => runCommand(runtime, options, async () => {
      const data = await service.list(query, options.live);
      return { data, text: [`${data.mode === "live" ? "官网读取" : "本地快照"}：${data.fetchedAt}`, ...data.items.map(item => `${item.id}\t${item.name}\t${item.category}\n${item.url ?? "目录未提供官网链接"}`)].join("\n") };
    }));
  addFormatOption(institution.command("show <id>").description("查看学院简介").option("--live", "读取当前官网简介摘录"))
    .action((id: string, options: LiveOptions) => runCommand(runtime, options, async () => {
      const data = await service.show(id, options.live);
      return { data, text: [data.institution.name, institutionContactText(data.institution), `官网：${data.institution.url ?? "目录未提供"}`, `快照名录条数：${data.teacherCount}`, ...data.records.map(recordText), ...(data.coverage?.notes ?? [])].filter(Boolean).join("\n\n") };
    }));
  for (const name of ["teachers", "search"] as const) {
    const command = institution.command(name === "teachers" ? "teachers [query]" : "search <query>")
      .description(name === "teachers" ? "按姓名、职称/身份、单位、联系方式或研究方向查询教师" : "检索机构简介与教师联系方式及基础资料")
      .option("--institution <id>", "按机构 ID 或完整名称过滤")
      .option("--limit <count>", "返回条数，1–100", "20")
      .option("--offset <count>", "跳过条数", "0");
    if (name === "search") command.option("--kind <kind>", "资料类别：overview、teacher");
    addFormatOption(command).action((query: string | undefined, options: QueryOptions) => runCommand(runtime, options, async () => {
      const data = await (name === "teachers" ? service.teachers(query, searchOptions(options)) : service.search(query ?? "", searchOptions(options)));
      return { data, text: [`共 ${data.total} 条；本页 ${data.items.length} 条；偏移 ${data.offset}`, `快照时间：${data.generatedAt}`, ...data.items.map(record => `${record.id}\t${record.institutionName}\n${recordText({ ...record, text: record.excerpt })}`)].join("\n\n") };
    }));
  }
  addFormatOption(institution.command("teacher <id>").description("读取一个教师的基础信息").option("--live", "读取当前官网职称、联系方式和研究方向"))
    .action((id: string, options: LiveOptions) => runCommand(runtime, options, async () => {
      const data = await service.teacher(id, options.live);
      return { data, text: [data.institution.name, recordText(data.record), !data.record.phone && !data.record.email && institutionContactText(data.institution)].filter(Boolean).join("\n\n") };
    }));
  addFormatOption(institution.command("services [query]").description("查询后勤单位、部门与办公电话").option("--live", "读取当前官方后勤服务表"))
    .action((query: string | undefined, options: LiveOptions) => runCommand(runtime, options, async () => {
      const data = await service.services(query, options.live);
      return { data, text: [`${data.mode === "live" ? "官网读取" : "本地快照"}：${data.fetchedAt}`, ...data.items.map(item => `${item.unit}\t${item.department}\t${item.phone}\n来源：${item.source.url}`)].join("\n") };
    }));
  addFormatOption(institution.command("dump").description("导出本地快照 JSON 与按机构组织的 Markdown").requiredOption("--output <directory>", "输出目录，同名文件直接覆盖"))
    .action((options: FormatOptions & { output: string }) => runCommand(runtime, options, async () => {
      const data = await service.dump(options.output);
      return { data, text: `已导出 ${data.files.length} 个文件至 ${data.directory}\n快照时间：${data.generatedAt}` };
    }));
  return institution;
}

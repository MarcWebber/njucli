import { readFile } from "node:fs/promises";
import type { Command } from "commander";
import { z } from "zod";

import type { NjuServices } from "../app/services.js";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";
import { AppError } from "../core/errors.js";
import { saveFile } from "../core/fs.js";
import { baseInput, columnInput, rowsInput, sheetInput, updatesInput, viewInput } from "../domains/table/schema.js";

async function input<T>(path: string | URL, schema: z.ZodType<T>): Promise<T> {
  const text = await readFile(path, "utf8");
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new AppError("INVALID_INPUT", "输入文件需要合法 JSON"); }
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("INVALID_INPUT", "表格输入格式有误", { details: result.error.issues });
  return result.data;
}
const presetPath = new URL("../../skills/njucli-table/templates/gradebook.json", import.meta.url);
const resultText = (data: unknown) => ({ data, text: JSON.stringify(data, null, 2) });

export function registerTableCommands(program: Command, service: NjuServices["table"], runtime: CommandRuntime): Command {
  const table = program.command("table").description("南大协同表格：模板、登分表、字段与数据填写");
  addFormatOption(table.command("workspaces").description("列出可访问工作区"))
    .action((options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.workspaces())));
  addFormatOption(table.command("bases [query]").description("查找表格及稳定 UUID"))
    .action((query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.bases(query);
      return { data, text: data.map((item) => `${item.uuid}\t${item.name}\n${item.url}`).join("\n") };
    }));
  addFormatOption(table.command("templates [query]").description("查找官方模板及预览链接"))
    .action((query: string | undefined, options: FormatOptions) => runCommand(runtime, options, async () => {
      const data = await service.templates(query);
      return { data, text: data.map((item) => `${item.name}\t${item.display_name}\n${item.link}\n${item.description}`).join("\n\n") };
    }));
  addFormatOption(table.command("preset <name>").description("查看或导出内置模板定义：gradebook（登分表）").option("--output <path>", "保存 JSON 定义供修改"))
    .action((name: string, options: FormatOptions & { output?: string }) => runCommand(runtime, options, async () => {
      if (name !== "gradebook") throw new AppError("INVALID_INPUT", "内置模板：gradebook");
      const data = await input(presetPath, baseInput);
      if (options.output) return resultText(await saveFile(options.output, JSON.stringify(data, null, 2) + "\n"));
      return resultText(data);
    }));
  addFormatOption(table.command("show <base>").description("读取工作表、字段、公式和视图；base 使用 UUID"))
    .action((base: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.show(base))));
  addFormatOption(table.command("rows <base> <sheet>").description("分页读取数据，可按视图筛选和排序")
    .option("--view <name>", "视图名称").option("--page <number>", "页码", "1").option("--size <number>", "每页 1–1000 行", "100"))
    .action((base: string, sheet: string, options: FormatOptions & { page: string; size: string; view?: string }) => runCommand(runtime, options, async () => {
      const parsed = z.object({ page: z.coerce.number().int().min(1), size: z.coerce.number().int().min(1).max(1000) }).safeParse(options);
      if (!parsed.success) throw new AppError("INVALID_INPUT", "页码须为正整数，每页 1–1000 行");
      return resultText(await service.rows(base, sheet, { ...parsed.data, view: options.view }));
    }));
  addFormatOption(table.command("row <base> <sheet> <row-id>").description("按稳定行 ID 读取一行"))
    .action((base: string, sheet: string, rowId: string, options: FormatOptions) => runCommand(runtime, options, async () => resultText(await service.row(base, sheet, rowId))));
  addFormatOption(table.command("create <name>").description("创建空白表格、复制官方模板或使用自定义结构")
    .option("--template <id>", "官方模板 ID，见 templates").option("--preset <name>", "内置模板：gradebook")
    .option("--input <path>", "自定义表格结构 JSON").option("--workspace <id>", "目标工作区；默认个人工作区"))
    .action((name: string, options: FormatOptions & { template?: string; preset?: string; input?: string; workspace?: string }) => runCommand(runtime, options, async () => {
      if ([options.template, options.preset, options.input].filter(Boolean).length > 1) throw new AppError("INVALID_INPUT", "template、preset、input 选择一种");
      if (options.preset && options.preset !== "gradebook") throw new AppError("INVALID_INPUT", "内置模板：gradebook");
      const workspace = options.workspace === undefined ? undefined : Number(options.workspace);
      if (workspace !== undefined && (!Number.isInteger(workspace) || workspace < 1)) throw new AppError("INVALID_INPUT", "工作区 ID 须为正整数");
      const definition = options.preset ? await input(presetPath, baseInput) : options.input ? await input(options.input, baseInput) : undefined;
      return resultText(await service.create(name, { template: options.template, definition, workspace }));
    }));
  addFormatOption(table.command("sheet-add <base>").description("新增带字段和视图的工作表").requiredOption("--input <path>", "工作表结构 JSON"))
    .action((base: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => resultText(await service.addSheet(base, await input(options.input, sheetInput)))));
  addFormatOption(table.command("column-add <base> <sheet>").description("新增字段，包括公式和选项").requiredOption("--input <path>", "字段定义 JSON"))
    .action((base: string, sheet: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => resultText(await service.addColumn(base, sheet, await input(options.input, columnInput)))));
  for (const [name, description, schema, operation] of [
    ["view-add", "创建筛选、排序、分组视图", viewInput, service.addView],
    ["view-update", "修改已有视图设置", viewInput, service.updateView],
  ] as const) {
    addFormatOption(table.command(`${name} <base> <sheet>`).description(description).requiredOption("--input <path>", "视图定义 JSON"))
      .action((base: string, sheet: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => resultText(await operation(base, sheet, await input(options.input, schema)))));
  }
  addFormatOption(table.command("append <base> <sheet>").description("新增 1–1000 行并回读结果").requiredOption("--input <path>", "行对象数组 JSON，字段名作键"))
    .action((base: string, sheet: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => resultText(await service.append(base, sheet, await input(options.input, rowsInput)))));
  addFormatOption(table.command("update <base> <sheet>").description("按行 ID 填写字段并回读结果").requiredOption("--input <path>", "[{row_id, row}] JSON"))
    .action((base: string, sheet: string, options: FormatOptions & { input: string }) => runCommand(runtime, options, async () => resultText(await service.update(base, sheet, await input(options.input, updatesInput)))));
  return table;
}

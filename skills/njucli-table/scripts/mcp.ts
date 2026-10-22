import { loadTablePreset } from "./services.js";
import { appId, appPageInput, appPaginationInput, formInput, baseInput, columnInput, rowsInput, sheetInput, updatesInput, viewInput } from './schema.js';
import { AppError } from '../../../src/core/errors.js';
import { z } from "zod";
import type { McpTool } from "../../../src/mcp/tools.js";
import type { TableServices } from "./services.js";

export function registerTableTools(tool: McpTool, service: TableServices): void {
  tool("table_workspaces", "列出南大协同表格工作区。", {}, () => service.workspaces());
  tool("table_bases", "查找协同表格及 UUID。", { query: z.string().optional() }, ({ query }) => service.bases(query));
  tool("table_templates", "查找官方协同表格模板及预览链接。", { query: z.string().optional() }, ({ query }) => service.templates(query));
  tool("table_show", "读取协同表格字段、公式和视图。", { base: z.string().min(1) }, ({ base }) => service.show(base));
  tool("table_rows", "分页读取工作表，支持视图筛选排序。", {
    base: z.string().min(1), sheet: z.string().min(1), view: z.string().optional(),
    page: z.number().int().min(1).optional(), size: z.number().int().min(1).max(1000).optional(),
  }, ({ base, sheet, ...options }) => service.rows(base, sheet, options));
  tool("table_row", "按稳定行 ID 读取记录。", { base: z.string().min(1), sheet: z.string().min(1), rowId: z.string().min(1) },
    ({ base, sheet, rowId }) => service.row(base, sheet, rowId));
  tool("table_preset", "读取内置登分表模板；指定 output 时覆盖保存到本地文件。", {
    name: z.literal("gradebook"), output: z.string().min(1).optional(),
  }, ({ name, output }) => service.preset(name, output), { destructiveHint: true });
  const target = { base: z.string().min(1), sheet: z.string().min(1) };
  tool("table_create", "创建空白表格、复制官方模板或使用自定义结构并回读；template、preset 与 definition 选择一种。", {
    name: z.string().trim().min(1), template: z.string().min(1).optional(), definition: baseInput.optional(), preset: z.literal("gradebook").optional(), workspace: z.number().int().positive().optional(),
  }, async ({ name, preset, ...options }) => {
    if ([options.template, options.definition, preset].filter(Boolean).length > 1) throw new AppError("INVALID_INPUT", "template、preset 与 definition 选择一种");
    return service.create(name, { ...options, definition: preset ? await loadTablePreset(preset) : options.definition });
  }, { destructiveHint: false });
  tool("table_sheet_add", "新增带字段和视图的工作表并回读。", { base: target.base, input: sheetInput }, ({ base, input }) => service.addSheet(base, input), { destructiveHint: false });
  tool("table_column_add", "新增字段，包括公式和选项，并回读。", { ...target, input: columnInput }, ({ base, sheet, input }) => service.addColumn(base, sheet, input), { destructiveHint: false });
  tool("table_view_add", "创建筛选、排序和分组视图并回读。", { ...target, input: viewInput }, ({ base, sheet, input }) => service.addView(base, sheet, input), { destructiveHint: false });
  tool("table_view_update", "更新指定视图的设置并回读。", { ...target, input: viewInput }, ({ base, sheet, input }) => service.updateView(base, sheet, input), { destructiveHint: true });
  tool("table_append", "新增 1–1000 行并回读，字段名作键。", { ...target, rows: rowsInput }, ({ base, sheet, rows }) => service.append(base, sheet, rows), { destructiveHint: false });
  tool("table_update", "按稳定行 ID 更新字段并回读。", { ...target, updates: updatesInput }, ({ base, sheet, updates }) => service.update(base, sheet, updates), { destructiveHint: true });
  tool("table_app_show", "读取外部应用页面、字段和表单默认值。", {
    app: z.string().min(1),
  }, ({ app }) => service.appShow(appId(app)));
  tool("table_app_rows", "分页读取外部应用表格页的可见记录。", {
    app: z.string().min(1), pageId: appPageInput, ...appPaginationInput.shape,
  }, ({ app, pageId, page, size }) => service.appRows(appId(app), pageId, page, size));
  tool("table_form_submit", "提交文本或日期表单，并从指定表格页回读本次新增记录。", {
    app: z.string().min(1), pageId: appPageInput, input: formInput, readbackPage: appPageInput,
  }, ({ app, pageId, input, readbackPage }) => service.formSubmit(appId(app), pageId, input, readbackPage), { destructiveHint: false });

}

import { z } from "zod";
import type { ReadTool } from "../../../src/mcp/read.js";
import type { TableServices } from "./services.js";

export function registerTableTools(read: ReadTool, service: TableServices): void {
  read("table_workspaces", "列出南大协同表格工作区。", {}, () => service.workspaces());
  read("table_bases", "查找协同表格及 UUID。", { query: z.string().optional() }, ({ query }) => service.bases(query));
  read("table_templates", "查找官方协同表格模板及预览链接。", { query: z.string().optional() }, ({ query }) => service.templates(query));
  read("table_show", "读取协同表格字段、公式和视图。", { base: z.string().min(1) }, ({ base }) => service.show(base));
  read("table_rows", "分页读取工作表，支持视图筛选排序。", {
    base: z.string().min(1), sheet: z.string().min(1), view: z.string().optional(),
    page: z.number().int().min(1).optional(), size: z.number().int().min(1).max(1000).optional(),
  }, ({ base, sheet, ...options }) => service.rows(base, sheet, options));
  read("table_row", "按稳定行 ID 读取记录。", { base: z.string().min(1), sheet: z.string().min(1), rowId: z.string().min(1) },
    ({ base, sheet, rowId }) => service.row(base, sheet, rowId));
}

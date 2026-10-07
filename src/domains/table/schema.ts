import { z } from "zod";

const text = z.string().trim().min(1);
const data = z.record(z.string(), z.unknown());
export const columnInput = z.strictObject({
  column_name: text,
  column_type: text,
  column_data: data.optional(),
});
const order = z.strictObject({ column: text, direction: z.enum(["up", "down"]).default("up") });
export const viewInput = z.strictObject({
  name: text,
  sorts: z.array(order).optional(),
  groupbys: z.array(order).optional(),
  filters: z.array(z.strictObject({ column: text, predicate: text, value: z.unknown().optional() })).optional(),
  conjunction: z.enum(["And", "Or"]).optional(),
  hidden: z.array(text).optional(),
});
export const sheetInput = z.strictObject({
  name: text,
  columns: z.array(columnInput).min(1),
  views: z.array(viewInput).optional(),
}).superRefine((sheet, context) => {
  if (sheet.columns[0]?.column_type === "formula") {
    context.addIssue({ code: "custom", message: "首列使用原始数据字段，公式列放在依赖字段之后" });
  }
  const names = sheet.columns.map((column) => column.column_name);
  const views = (sheet.views ?? []).map((view) => view.name);
  if (new Set(names).size !== names.length || new Set(views).size !== views.length) {
    context.addIssue({ code: "custom", message: "同一工作表内字段和视图名称不能重复" });
  }
  for (const view of sheet.views ?? []) {
    const used = [...(view.sorts ?? []), ...(view.groupbys ?? []), ...(view.filters ?? [])].map((item) => item.column).concat(view.hidden ?? []);
    for (const name of used) if (!names.includes(name)) context.addIssue({ code: "custom", message: `视图引用了不存在的字段：${name}` });
  }
});
export const baseInput = z.strictObject({ tables: z.array(sheetInput).min(1) }).refine((base) => new Set(base.tables.map((sheet) => sheet.name)).size === base.tables.length, "工作表名称不能重复");
const rowInput = z.record(text, z.unknown()).refine((row) => Object.keys(row).length > 0, "行不能为空");
export const rowsInput = z.array(rowInput).min(1).max(1000);
export const updatesInput = z.array(z.strictObject({ row_id: text, row: rowInput })).min(1).max(1000)
  .refine((rows) => new Set(rows.map((row) => row.row_id)).size === rows.length, "同批次 row_id 不能重复");

export type ColumnInput = z.infer<typeof columnInput>;
export type ViewInput = z.infer<typeof viewInput>;
export type SheetInput = z.infer<typeof sheetInput>;
export type BaseInput = z.infer<typeof baseInput>;
export type RowUpdate = z.infer<typeof updatesInput>[number];

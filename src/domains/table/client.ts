import { isDeepStrictEqual } from "node:util";

import { AppError } from "../../core/errors.js";
import type { FetchLike } from "../../core/types.js";
import type { BaseInput, ColumnInput, RowUpdate, SheetInput, ViewInput } from "./schema.js";

const SITE = "https://table.nju.edu.cn";
const pathPart = encodeURIComponent;
type Cells = Record<string, unknown>;
export type TableRow = Cells & { _id: string };
export interface TableBase { uuid: string; name: string; workspace_id: number; url: string }
interface Workspace {
  id: number | string;
  name: string;
  type: string;
  table_list?: TableBase[];
  shared_table_list?: TableBase[];
  group_shared_dtables?: TableBase[];
}
export interface TableColumn { key: string; name: string; type: string; data: Cells | null }
export interface TableSheet { _id: string; name: string; columns: TableColumn[]; views: Array<Cells & { _id: string; name: string }> }
interface Metadata { tables: TableSheet[] }
export interface TableTemplate { name: string; display_name: string; description: string; category: string; link: string; card_image_url: string }
export interface TableRowsOptions { page?: number | undefined; size?: number | undefined; view?: string | undefined }
export interface TableCreateOptions {
  template?: string | undefined;
  definition?: BaseInput | undefined;
  workspace?: number | undefined;
}

export class TableClient {
  private csrf = "";
  private owner = "";
  private readonly tokens = new Map<string, string>();

  constructor(private readonly fetch: FetchLike) {}

  async restoreSession(): Promise<boolean> {
    const response = await this.fetch(`${SITE}/sso/?next=/`);
    if (!response.ok) throw new Error(`协同表格登录返回 HTTP ${response.status}`);
    const url = new URL(response.url);
    if (url.hostname !== "table.nju.edu.cn" || url.pathname.startsWith("/accounts/login")) return false;
    const html = await response.text();
    this.csrf = html.match(/\bcsrfToken:\s*["']([^"']+)["']/)?.[1] ?? "";
    this.owner = html.match(/\busername:\s*["']([^"']+)["']/)?.[1] ?? "";
    if (!this.csrf || !this.owner) throw new AppError("REMOTE_SCHEMA_CHANGED", "协同表格首页缺少会话信息");
    return true;
  }

  async workspaces(): Promise<Workspace[]> {
    return (await this.web<{ workspace_list: Workspace[] }>("/api/v2.1/workspaces/?detail=true")).workspace_list;
  }

  async bases(query = ""): Promise<TableBase[]> {
    const items = (await this.workspaces()).flatMap((workspace) =>
      [...(workspace.table_list ?? []), ...(workspace.shared_table_list ?? []), ...(workspace.group_shared_dtables ?? [])]
        .map((base) => ({ uuid: base.uuid, name: base.name, workspace_id: base.workspace_id,
          url: `${SITE}/workspace/${base.workspace_id}/dtable/${pathPart(base.name)}/` })),
    );
    return [...new Map(items.map((base) => [base.uuid, base])).values()]
      .filter((base) => base.name.toLowerCase().includes(query.toLowerCase()));
  }

  async templates(query = ""): Promise<TableTemplate[]> {
    const { template_list } = await this.web<{ template_list: TableTemplate[] }>("/api/v2.1/templates/");
    return template_list.filter((item) => `${item.display_name} ${item.category} ${item.description}`.toLowerCase().includes(query.toLowerCase()));
  }

  async show(id: string): Promise<{ base: TableBase; tables: TableSheet[] }> {
    const base = await this.base(id);
    const { metadata } = await this.gateway<{ metadata: Metadata }>(id, "metadata/");
    return { base, tables: metadata.tables };
  }

  async rows(id: string, sheet: string, options: TableRowsOptions = {}) {
    const page = options.page ?? 1, size = options.size ?? 100;
    const query = new URLSearchParams({ table_name: sheet, convert_keys: "true", start: String((page - 1) * size), limit: String(size) });
    if (options.view) query.set("view_name", options.view);
    const { rows } = await this.gateway<{ rows: TableRow[] }>(id, `rows/?${query}`);
    return { page, size, items: rows, nextPage: rows.length === size ? page + 1 : null };
  }

  row(id: string, sheet: string, rowId: string): Promise<TableRow> {
    return this.gateway(id, `rows/${pathPart(rowId)}/?${new URLSearchParams({ table_name: sheet, convert_keys: "true" })}`);
  }

  async create(name: string, options: TableCreateOptions = {}) {
    // Resolve all local choices before the first write; a partial failure leaves the created base available for repair.
    const workspaces = await this.workspaces();
    const personal = workspaces.find((workspace) => workspace.type === "personal");
    const workspace = options.workspace ?? Number(personal?.id);
    if (!workspaces.some((item) => Number(item.id) === workspace && item.id !== "")) {
      throw new AppError("INVALID_INPUT", "未找到指定工作区，请先运行 table workspaces");
    }
    if (!options.template && workspace !== Number(personal?.id)) {
      throw new AppError("INVALID_INPUT", "自定义表格在个人工作区创建；官方模板可指定目标工作区");
    }
    let template: TableTemplate | undefined;
    if (options.template) {
      template = (await this.templates()).find((item) => item.name === options.template);
      if (!template) throw new AppError("NOT_FOUND", `未找到模板：${options.template}`);
    }
    let created: TableBase;
    if (template) {
      created = (await this.web<{ dtable: TableBase }>("/api/v2.1/dtable-external-link/dtable-copy/", "POST",
        { link: template.link, dst_workspace_id: String(workspace) })).dtable;
    } else {
      created = (await this.web<{ table: TableBase }>("/api/v2.1/dtables/", "POST", { name, owner: this.owner })).table;
    }
    try {
      if (created.name !== name) await this.web(`/api/v2.1/workspace/${workspace}/dtable/`, "PUT", { name: created.name, new_name: name });
      // Locate by UUID after rename: the base name is not a stable identifier.
      let result = await this.show(created.uuid);
      if (result.base.name !== name) throw new Error("表格名称回读不一致");
      if (options.definition) {
        const defaults = result.tables;
        for (const sheet of defaults) {
          if (options.definition.tables.some((item) => item.name === sheet.name)) {
            const newName = `njucli-${created.uuid}-${sheet._id}`;
            await this.gateway(created.uuid, "tables/", "PUT", { table_name: sheet.name, new_table_name: newName });
            sheet.name = newName;
          }
        }
        for (const sheet of options.definition.tables) await this.addSheet(created.uuid, sheet);
        // Only remove the untouched default sheet of the base created by this call.
        for (const sheet of defaults) await this.gateway(created.uuid, "tables/", "DELETE", { table_name: sheet.name });
        result = await this.show(created.uuid);
      }
      return result;
    } catch (error) {
      throw new AppError("REMOTE_UNAVAILABLE", `表格已创建，后续设置未完成：${error instanceof Error ? error.message : String(error)}`, {
        details: { baseId: created.uuid, name }, hint: `使用 table show ${created.uuid} 查看并继续设置，勿重复创建`, cause: error,
      });
    }
  }

  async addSheet(id: string, input: SheetInput): Promise<TableSheet> {
    // SeaTable's bulk table creation omits formula dependencies. Insert formulas in definition order.
    const formulaIndex = input.columns.findIndex((column) => column.column_type === "formula");
    const initialCount = formulaIndex < 0 ? input.columns.length : Math.max(1, formulaIndex);
    const created = await this.gateway<TableSheet>(id, "tables/", "POST", { table_name: input.name, lang: "zh-cn", columns: input.columns.slice(0, initialCount) });
    for (const column of input.columns.slice(initialCount)) await this.addColumn(id, input.name, column);
    for (const view of input.views ?? []) {
      if (created.views.some((item) => item.name === view.name)) await this.updateView(id, input.name, view);
      else await this.addView(id, input.name, view);
    }
    const sheet = (await this.show(id)).tables.find((item) => item._id === created._id);
    if (!sheet || input.columns.some((column) => !sheet.columns.some((item) => item.name === column.column_name && item.type === column.column_type))) {
      throw new Error("工作表字段回读不一致");
    }
    return sheet;
  }

  async addColumn(id: string, sheet: string, input: ColumnInput): Promise<TableColumn> {
    const created = await this.gateway<TableColumn>(id, "columns/", "POST", { table_name: sheet, ...input });
    const column = (await this.show(id)).tables.find((item) => item.name === sheet)?.columns.find((item) => item.key === created.key);
    if (!column || column.name !== input.column_name || column.type !== input.column_type) throw new Error("字段回读不一致");
    return column;
  }

  async addView(id: string, sheet: string, input: ViewInput) {
    const config = await this.viewConfig(id, sheet, input);
    await this.gateway(id, `views/?table_name=${pathPart(sheet)}`, "POST", { name: input.name });
    return this.saveView(id, sheet, input.name, config);
  }

  async updateView(id: string, sheet: string, input: ViewInput) {
    return this.saveView(id, sheet, input.name, await this.viewConfig(id, sheet, input));
  }

  async append(id: string, sheet: string, rows: Cells[]) {
    await this.checkCells(id, sheet, rows);
    const result = await this.gateway<{ inserted_row_count: number; row_ids: Array<{ _id: string }> }>(id, "rows/", "POST", { table_name: sheet, rows });
    if (result.inserted_row_count !== rows.length || result.row_ids.length !== rows.length) {
      throw new AppError("REMOTE_UNAVAILABLE", "新增行数与提交不符；请查看表格，不要重复提交", { details: { baseId: id, sheet, rowIds: result.row_ids } });
    }
    return this.readWritten(id, sheet, result.row_ids.map((row, index) => ({ row_id: row._id, row: rows[index]! })));
  }

  async update(id: string, sheet: string, updates: RowUpdate[]) {
    await this.checkCells(id, sheet, updates.map((item) => item.row));
    await this.gateway(id, "rows/", "PUT", { table_name: sheet, updates });
    return this.readWritten(id, sheet, updates);
  }

  private async readWritten(id: string, sheet: string, updates: RowUpdate[]) {
    const rows: TableRow[] = [];
    for (const update of updates) {
      const row = await this.row(id, sheet, update.row_id);
      const different = Object.keys(update.row).filter((name) => !isDeepStrictEqual(row[name], update.row[name]) && !(update.row[name] === null && row[name] === ""));
      if (row._id !== update.row_id || different.length) throw new AppError("REMOTE_UNAVAILABLE", "填写后的回读与提交不一致；请检查指定行，不要重复提交", {
        details: { baseId: id, sheet, rowId: update.row_id, fields: different },
      });
      rows.push(row);
    }
    return { baseId: id, sheet, rows };
  }

  private async checkCells(id: string, sheetName: string, rows: Cells[]) {
    const sheet = (await this.show(id)).tables.find((item) => item.name === sheetName);
    if (!sheet) throw new AppError("NOT_FOUND", `未找到工作表：${sheetName}`);
    for (const row of rows) for (const [name, value] of Object.entries(row)) {
      const column = sheet.columns.find((item) => item.name === name);
      if (!column) throw new AppError("INVALID_INPUT", `未找到字段：${name}`);
      if (["formula", "link-formula", "auto-number", "creator", "ctime", "last-modifier", "mtime"].includes(column.type)) {
        throw new AppError("INVALID_INPUT", `${name} 由平台自动计算，请填写原始数据字段`);
      }
      if (column.type === "number" && value !== null) {
        if (typeof value !== "number" || !Number.isFinite(value)) throw new AppError("INVALID_INPUT", `${name} 需要数字或 null`);
        const data = column.data;
        if (data?.enable_check_format && ((typeof data.format_min_value === "number" && value < data.format_min_value) || (typeof data.format_max_value === "number" && value > data.format_max_value))) {
          throw new AppError("INVALID_INPUT", `${name} 超出该字段的数值范围`);
        }
      }
    }
  }

  private async viewConfig(id: string, sheetName: string, input: ViewInput) {
    const sheet = (await this.show(id)).tables.find((item) => item.name === sheetName);
    if (!sheet) throw new AppError("NOT_FOUND", `未找到工作表：${sheetName}`);
    const key = (name: string) => {
      const column = sheet.columns.find((item) => item.name === name);
      if (!column) throw new AppError("INVALID_INPUT", `视图引用了不存在的字段：${name}`);
      return column.key;
    };
    const config: Cells = {};
    if (input.sorts) config.sorts = input.sorts.map((item) => ({ column_key: key(item.column), sort_type: item.direction }));
    if (input.groupbys) config.groupbys = input.groupbys.map((item) => ({ column_key: key(item.column), sort_type: item.direction }));
    if (input.filters) config.filters = input.filters.map((item) => ({ column_key: key(item.column), filter_predicate: item.predicate, filter_term: item.value ?? null }));
    if (input.conjunction) config.filter_conjunction = input.conjunction;
    if (input.hidden) config.hidden_columns = input.hidden.map(key);
    return config;
  }

  private async saveView(id: string, sheet: string, name: string, config: Cells) {
    const path = `views/${pathPart(name)}/?table_name=${pathPart(sheet)}`;
    if (Object.keys(config).length) await this.gateway(id, path, "PUT", config);
    const view = await this.gateway<Cells>(id, path);
    if (view.name !== name || Object.keys(config).some((key) => !isDeepStrictEqual(view[key], config[key]))) throw new Error("视图设置回读不一致");
    return view;
  }

  private async base(id: string) {
    const base = (await this.bases()).find((item) => item.uuid === id);
    if (!base) throw new AppError("NOT_FOUND", `未找到可访问表格：${id}，请先运行 table bases`);
    return base;
  }

  private async gateway<T>(id: string, path: string, method = "GET", body?: unknown): Promise<T> {
    let token = this.tokens.get(id);
    if (!token) {
      const base = await this.base(id);
      const result = await this.web<{ access_token: string; dtable_uuid: string }>(`/api/v2.1/workspace/${base.workspace_id}/dtable/${pathPart(base.name)}/access-token/`);
      if (result.dtable_uuid !== id) throw new Error("表格访问令牌目标不一致");
      token = result.access_token;
      this.tokens.set(id, token);
    }
    return this.json(`${SITE}/api-gateway/api/v2/dtables/${pathPart(id)}/${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  private web<T>(path: string, method = "GET", body?: Record<string, string>): Promise<T> {
    return this.json(`${SITE}${path}`, { method,
      headers: { "X-CSRFToken": this.csrf, Referer: `${SITE}/`, "Content-Type": "application/x-www-form-urlencoded" },
      ...(body === undefined ? {} : { body: new URLSearchParams(body).toString() }),
    });
  }

  private async json<T>(url: string, init: RequestInit): Promise<T> {
    const response = await this.fetch(url, init);
    const text = await response.text();
    if (!response.ok) {
      const error = response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) as { error_message?: string } : undefined;
      throw new AppError("REMOTE_UNAVAILABLE", `协同表格 ${init.method} ${new URL(url).pathname} 返回 HTTP ${response.status}${error?.error_message ? `：${error.error_message}` : ""}`);
    }
    return JSON.parse(text) as T;
  }
}

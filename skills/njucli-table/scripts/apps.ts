import { load } from "cheerio";
import { isDeepStrictEqual } from "node:util";
import type { AuthCredentials } from "../../../src/auth/types.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { AppError } from "../../../src/core/errors.js";
import type { FetchLike } from "../../../src/core/types.js";
import type { TableColumn, TableSheet } from "./client.js";

const SITE = "https://table.nju.edu.cn";
type Cells = Record<string, unknown>;
type Row = Cells & { _id: string };
interface FormColumn {
  key: string;
  is_required: boolean;
  enable_fill_default_value: boolean;
  enable_not_change_default_value: boolean;
  default_value: unknown;
}
interface AppPage { id: string; name: string; type: string; table_id: string; columns?: FormColumn[]; shown_column_keys?: string[] }
interface RowsResult { success: boolean; error_message: string; metadata: TableColumn[]; results: Row[] }

function setting(html: string, name: string): string {
  const match = html.match(new RegExp(String.raw`\b${name}:\s*(['"])(.*?)\1`));
  if (!match) throw new AppError("REMOTE_SCHEMA_CHANGED", `应用页面缺少 ${name}`);
  return match[2]!.replace(/\\u([0-9a-f]{4})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export class TableAppClient {
  private token = "";
  private csrf = "";
  private pages: AppPage[] = [];
  private tables: TableSheet[] = [];
  private defaults: Record<string, string> = {};
  private name = "";
  readonly url: string;

  constructor(private readonly fetch: FetchLike, private readonly appId: string) {
    this.url = `${SITE}/external-apps/${appId}/`;
  }

  async open(credentials?: AuthCredentials): Promise<void> {
    let response = await this.fetch(this.url);
    if (!response.ok) throw new Error(`应用入口返回 HTTP ${response.status}`);
    if (new URL(response.url).pathname.endsWith("/login/")) {
      if (!credentials) throw new AppError("USER_ACTION_REQUIRED", "请先保存统一认证凭据，再通过 HTTP 登录协同表格应用");
      const loginUrl = `${SITE}/accounts/login/?${new URLSearchParams({ next: new URL(this.url).pathname })}`;
      const login = await this.fetch(loginUrl);
      if (!login.ok) throw new Error(`应用登录入口返回 HTTP ${login.status}`);
      const $ = load(await login.text());
      const csrf = $('input[name="csrfmiddlewaretoken"]').val();
      if (typeof csrf !== "string" || !csrf) throw new AppError("REMOTE_SCHEMA_CHANGED", "登录页缺少 CSRF 字段");
      response = await this.fetch(loginUrl, {
        method: "POST", headers: { Referer: loginUrl, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ csrfmiddlewaretoken: csrf, login: credentials.username, password: credentials.password, next: new URL(this.url).pathname }).toString(),
      });
      if (!response.ok) throw new Error(`应用登录返回 HTTP ${response.status}`);
    }
    const finalUrl = new URL(response.url);
    if (finalUrl.origin !== SITE || finalUrl.pathname !== new URL(this.url).pathname) {
      throw new AppError("USER_ACTION_REQUIRED", "应用登录需要处理，请核对统一认证凭据和应用访问权限");
    }
    const html = await response.text();
    if (setting(html, "appUuid") !== this.appId) throw new AppError("REMOTE_SCHEMA_CHANGED", "应用入口标识不一致");
    this.token = setting(html, "accessToken");
    this.csrf = setting(html, "csrfToken");
    const config = JSON.parse(setting(html, "appConfig")) as { app_name: string; settings: { pages: AppPage[] } };
    this.name = config.app_name;
    this.pages = config.settings.pages;
    this.defaults = { "{creator.id}": setting(html, "userIdInOrg"), "{creator.name}": setting(html, "name") };
    this.tables = (await this.api<{ tables: TableSheet[] }>("metadata/")).tables;
  }

  show() {
    return { appId: this.appId, name: this.name, url: this.url, pages: this.pages.map(page => ({
      id: page.id, name: page.name, type: page.type, tableId: page.table_id,
      columns: this.table(page).columns.filter(column => page.type === "form"
        ? page.columns?.some(field => field.key === column.key) : page.shown_column_keys?.includes(column.key))
        .map(column => ({ ...column, form: page.columns?.find(field => field.key === column.key) })),
    })) };
  }

  async rows(pageId: string, page = 1, size = 100) {
    this.page(pageId, "table");
    const result = await this.api<RowsResult>(`rows/?${new URLSearchParams({ page_id: pageId, start: String((page - 1) * size), limit: String(size) })}`);
    if (!result.success) throw new AppError("REMOTE_UNAVAILABLE", result.error_message || "应用记录读取失败");
    const items = result.results.map(row => {
      const item: Row = { _id: row._id };
      for (const column of result.metadata) if (Object.hasOwn(row, column.key)) item[column.name] = row[column.key];
      return item;
    });
    return { appId: this.appId, pageId, page, size, items, nextPage: items.length === size ? page + 1 : null };
  }

  async submit(pageId: string, input: Cells, readbackPageId: string) {
    const page = this.page(pageId, "form"), readback = this.page(readbackPageId, "table");
    if (page.table_id !== readback.table_id) throw new AppError("INVALID_INPUT", "回读页须与表单关联同一工作表");
    const columns = this.table(page).columns;
    const row: Cells = { ...input };
    for (const name of Object.keys(row)) {
      if (!page.columns?.some(field => columns.find(column => column.key === field.key)?.name === name)) {
        throw new AppError("INVALID_INPUT", `表单缺少字段：${name}`);
      }
    }
    for (const field of page.columns ?? []) {
      const column = columns.find(column => column.key === field.key);
      if (!column) throw new AppError("REMOTE_SCHEMA_CHANGED", `表单字段缺少列定义：${field.key}`);
      if (field.enable_fill_default_value && (!Object.hasOwn(row, column.name) || field.enable_not_change_default_value)) {
        const value = typeof field.default_value === "string" ? this.defaults[field.default_value] ?? field.default_value : field.default_value;
        if (typeof value === "string" && /\{creator\./.test(value)) throw new AppError("INVALID_INPUT", `请显式提供字段：${column.name}`);
        if (field.enable_not_change_default_value && Object.hasOwn(row, column.name) && !isDeepStrictEqual(row[column.name], value)) {
          throw new AppError("INVALID_INPUT", `${column.name} 使用当前账号的固定默认值`);
        }
        row[column.name] = value;
      }
      const value = row[column.name];
      if (value === null || value === undefined || value === "") {
        if (field.is_required) throw new AppError("INVALID_INPUT", `请填写必填字段：${column.name}`);
        continue;
      }
      if (column.type === "text" && typeof value === "string") {
        row[column.name] = value.trim();
        if (field.is_required && !row[column.name]) throw new AppError("INVALID_INPUT", `请填写必填字段：${column.name}`);
      } else if (column.type === "date" && column.data?.format === "YYYY-MM-DD" && typeof value === "string") {
        row[column.name] = parseCampusDate(value);
      } else {
        throw new AppError("INVALID_INPUT", `当前表单提交支持文本及 YYYY-MM-DD 日期：${column.name}`);
      }
    }
    for (const name of Object.keys(row)) {
      if (!columns.some(column => column.name === name && readback.shown_column_keys?.includes(column.key))) {
        throw new AppError("INVALID_INPUT", `回读页须包含提交字段：${name}`);
      }
    }
    const before = new Set((await this.allRows(readbackPageId)).map(row => row._id));
    const result = await this.api<{ success: boolean }>("form-submit/", {
      app_page_id: pageId, row_data: row, new_linked_rows: [], link_rows: [],
    });
    if (result.success !== true) throw new AppError("REMOTE_UNAVAILABLE", "表单提交结果待确认，请先读取记录", { details: { appId: this.appId, pageId, readbackPageId } });
    try {
      const matches = (await this.allRows(readbackPageId)).filter(item => !before.has(item._id) && Object.entries(row).every(([name, value]) => {
        const actual = item[name];
        if (value === null) return actual === null || actual === undefined || actual === "";
        if (columns.find(column => column.name === name)?.type === "date") return typeof actual === "string" && (actual === value || actual.startsWith(`${value}T`));
        return isDeepStrictEqual(actual, value);
      }));
      if (matches.length !== 1) throw new Error("新增记录与提交字段的匹配数须为 1");
      return { appId: this.appId, pageId, readbackPageId, url: `${this.url}?page_id=${encodeURIComponent(readbackPageId)}`, row: matches[0]! };
    } catch (cause) {
      throw new AppError("REMOTE_UNAVAILABLE", "提交已受理，回读待确认，请先读取记录", { details: { appId: this.appId, pageId, readbackPageId, submitted: true }, cause });
    }
  }

  private async allRows(pageId: string): Promise<Row[]> {
    const rows: Row[] = [];
    let page: number | null = 1;
    while (page !== null) {
      const result = await this.rows(pageId, page, 1000);
      rows.push(...result.items);
      page = result.nextPage;
    }
    return rows;
  }

  private page(id: string, type: string): AppPage {
    const page = this.pages.find(page => page.id === id && page.type === type);
    if (!page) throw new AppError("INVALID_INPUT", `应用缺少 ${type} 页面：${id}`);
    return page;
  }

  private table(page: AppPage): TableSheet {
    const table = this.tables.find(table => table._id === page.table_id);
    if (!table) throw new AppError("REMOTE_SCHEMA_CHANGED", `应用页面关联的工作表缺失：${page.id}`);
    return table;
  }

  private async api<T>(path: string, body?: unknown): Promise<T> {
    const response = await this.fetch(`${SITE}/api/v2.1/universal-apps/${this.appId}/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { Authorization: `Token ${this.token}`, "X-CSRFToken": this.csrf, Referer: this.url, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) throw new AppError("REMOTE_UNAVAILABLE", `应用 ${path.split("?")[0]} 返回 HTTP ${response.status}`);
    return JSON.parse(await response.text()) as T;
  }
}

import { AppError } from "../../core/errors.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
import { urlHostname } from "../../core/url.js";
import {
  OPAC_BASE_URL,
  OPAC_CONTRACT,
  bookInfoEnvelopeSchema,
  holdingSchema,
  holdingsEnvelopeSchema,
  loansEnvelopeSchema,
  searchEnvelopeSchema,
} from "./contract.js";
import type {
  LibraryBookDetail,
  LibraryBookSummary,
  LibraryHolding,
  LibraryLoan,
  LibrarySearchField,
  LibrarySearchPage,
} from "./types.js";

const SEARCH_FIELDS = new Set<LibrarySearchField>([
  "all",
  "title",
  "author",
  "isbn",
  "callno",
]);

/** The single remote client for NJU's Huiwen `meta-local` OPAC deployment. */
export class NjuOpacClient {
  constructor(
    private readonly fetch: FetchLike,
    private readonly baseUrl = OPAC_BASE_URL,
  ) {}

  async probe(): Promise<void> {
    await this.request("/", { method: "GET" });
  }

  async search(
    query: string,
    field: LibrarySearchField = "all",
    pageInput = 1,
    pageSizeInput = 20,
  ): Promise<LibrarySearchPage> {
    const normalizedQuery = requiredText(query, "query");
    if (!SEARCH_FIELDS.has(field)) {
      throw new AppError("INVALID_INPUT", `不支持的图书检索字段：${field}`);
    }
    const page = positiveInteger(pageInput, "page");
    const pageSize = boundedPageSize(pageSizeInput);
    const value = await this.json("/meta-local/opac/search/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        queryFieldList: [{
          logic: 0,
          field,
          operator: "*",
          values: [normalizedQuery],
        }],
        sortType: "desc",
        sortField: "relevance",
        indexName: "idx.opac",
        collapseField: "groupId",
        filterFieldList: [],
        page,
        pageSize,
      }),
    });
    const parsed = searchEnvelopeSchema.safeParse(value);
    if (!parsed.success) throw schemaChanged("search", parsed.error);
    assertBusinessCode(parsed.data.code, parsed.data.msg, "search");
    return {
      total: parsed.data.data.actualTotal,
      items: parsed.data.data.dataList.map(mapBookSummary),
    };
  }

  async holdings(bookId: string): Promise<LibraryHolding[]> {
    const id = requiredId(bookId, "bookId");
    const value = await this.json(
      `/meta-local/opac/bibs/${encodeURIComponent(id)}/holdings`,
    );
    const parsed = holdingsEnvelopeSchema.safeParse(value);
    if (!parsed.success) throw schemaChanged("holdings", parsed.error);
    assertBusinessCode(parsed.data.code, parsed.data.msg, "holdings");
    let raw: unknown;
    try {
      raw = JSON.parse(parsed.data.data.holdings);
    } catch (cause) {
      throw schemaChanged("holdings-json", cause);
    }
    const rows = holdingSchema.array().safeParse(raw);
    if (!rows.success) throw schemaChanged("holding-items", rows.error);
    return rows.data.map((row) => ({
      callNumber: row.callNo,
      library: clean(row.library),
      location: row.location,
      shelfMark: clean(row.shelfMark),
      status: row.status,
      available: row.itemsAvailable > 0,
    }));
  }

  async book(bookId: string): Promise<LibraryBookDetail> {
    const id = requiredId(bookId, "bookId");
    const [value, holdings] = await Promise.all([
      this.json(`/meta-local/opac/bibs/${encodeURIComponent(id)}/infos`),
      this.holdings(id),
    ]);
    const parsed = bookInfoEnvelopeSchema.safeParse(value);
    if (!parsed.success) throw schemaChanged("book-info", parsed.error);
    assertBusinessCode(parsed.data.code, parsed.data.msg, "book-info");

    const base = parsed.data.data.map.baseInfo.map;
    return {
      bookId: id,
      title: base.title,
      author: clean(base.author),
      callNumbers: unique(holdings.map((entry) => entry.callNumber)),
      totalCopies: holdings.length,
      availableCopies: holdings.filter((entry) => entry.available).length,
      holdings,
    };
  }

  async loans(page = 1, pageSize = 50): Promise<LibraryLoan[]> {
    positiveInteger(page, "page");
    boundedPageSize(pageSize);
    const value = await this.json(
      `/meta-local/opac/users/loans?page=${page}&pageSize=${pageSize}`,
    );
    const parsed = loansEnvelopeSchema.safeParse(value);
    if (!parsed.success) throw schemaChanged("loans", parsed.error);
    assertBusinessCode(parsed.data.code, parsed.data.msg, "loans");
    return parsed.data.data.map(mapLoan);
  }

  private async json(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.request(path, init);
    let text: string;
    try {
      text = await response.text();
      return JSON.parse(text) as unknown;
    } catch (cause) {
      throw schemaChanged(path, cause);
    }
  }

  private async request(path: string, init?: RequestInit): Promise<FetchResponse> {
    let response: FetchResponse;
    try {
      response = await this.fetch(new URL(path, this.baseUrl), init);
    } catch (cause) {
      throw new AppError("REMOTE_UNAVAILABLE", "无法连接南京大学图书馆 OPAC", {
        details: { contract: OPAC_CONTRACT },
        cause,
      });
    }

    if (response.status === 403) {
      const body = await response.text();
      if (/南大VPN|VPN/i.test(body)) {
        throw new AppError("VPN_REQUIRED", "南京大学 OPAC 当前要求校园网或南大 VPN", {
          hint: "连接校园网或南大 VPN 后重试",
          details: { contract: OPAC_CONTRACT, status: 403, bodyMatched: true },
        });
      }
      throw new AppError("AUTH_REQUIRED", "图书馆读者会话未登录或已经失效", {
        hint: "运行 njucli auth login opac",
        authCommand: "njucli auth login opac",
        details: { contract: OPAC_CONTRACT, status: 403 },
      });
    }
    if (response.status === 401 || urlHostname(response.url) === "authserver.nju.edu.cn") {
      throw new AppError("AUTH_REQUIRED", "图书馆读者会话未登录或已经失效", {
        hint: "运行 njucli auth login opac",
        authCommand: "njucli auth login opac",
      });
    }
    if (response.status === 429) {
      throw new AppError("RATE_LIMITED", "图书馆 OPAC 请求过于频繁");
    }
    if (!response.ok) {
      throw new AppError("REMOTE_UNAVAILABLE", `图书馆 OPAC 返回 HTTP ${response.status}`, {
        details: { contract: OPAC_CONTRACT, status: response.status },
      });
    }
    return response;
  }
}

function mapBookSummary(row: import("zod").infer<typeof import("./contract.js").searchBookSchema>): LibraryBookSummary {
  return {
    bookId: row.bibId,
    title: row.title,
    author: clean(row.author),
    callNumbers: row.callno ?? [],
    totalCopies: row.itemCount,
    availableCopies: row.circCount,
  };
}

function mapLoan(row: import("zod").infer<typeof import("./contract.js").loanSchema>): LibraryLoan {
  return {
    title: row.title,
    dueOn: row.dueDate.slice(0, 10),
    overdue: row.isOverdue !== 0,
  };
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new AppError("INVALID_INPUT", `${field} 不能为空`);
  return normalized;
}

function requiredId(value: string, field: string): string {
  const normalized = requiredText(value, field);
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new AppError("INVALID_INPUT", `${field} 格式无效`);
  }
  return normalized;
}

function positiveInteger(value: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new AppError("INVALID_INPUT", `${field} 必须是正整数`);
  }
  return value;
}

function boundedPageSize(value: number): number {
  positiveInteger(value, "pageSize");
  if (value > 100) throw new AppError("INVALID_INPUT", "pageSize 不能超过 100");
  return value;
}

function assertBusinessCode(code: number, message: string | null | undefined, action: string): void {
  if (code === 0 || code === 200) return;
  if (code === 401 || code === 403) {
    throw new AppError("AUTH_REQUIRED", "图书馆读者会话未登录或已经失效", {
      hint: "运行 njucli auth login opac",
      authCommand: "njucli auth login opac",
      details: { contract: OPAC_CONTRACT, action, code },
    });
  }
  throw new AppError("REMOTE_UNAVAILABLE", message?.trim() || `图书馆 ${action} 请求失败`, {
    details: { contract: OPAC_CONTRACT, action, code },
  });
}

function schemaChanged(action: string, cause?: unknown): AppError {
  return new AppError("REMOTE_SCHEMA_CHANGED", "图书馆 OPAC 响应与固定契约不一致", {
    details: { contract: OPAC_CONTRACT, action },
    cause,
  });
}

function clean(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

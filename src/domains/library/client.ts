import { AppError } from "../../core/errors.js";
import { requiredText } from "../../core/guards.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
import { urlHostname } from "../../core/url.js";
import {
  OPAC_BASE_URL,
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
    page = 1,
    pageSize = 20,
  ): Promise<LibrarySearchPage> {
    const normalizedQuery = requiredText(query, "query");
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
    const parsed = searchEnvelopeSchema.parse(value);
    assertBusinessCode(parsed.code, parsed.msg, "search");
    return {
      total: parsed.data.actualTotal,
      items: parsed.data.dataList.map(mapBookSummary),
    };
  }

  async holdings(bookId: string): Promise<LibraryHolding[]> {
    const id = requiredText(bookId, "bookId");
    const value = await this.json(
      `/meta-local/opac/bibs/${encodeURIComponent(id)}/holdings`,
    );
    const parsed = holdingsEnvelopeSchema.parse(value);
    assertBusinessCode(parsed.code, parsed.msg, "holdings");
    const rows = holdingSchema.array().parse(JSON.parse(parsed.data.holdings));
    return rows.map((row) => ({
      callNumber: row.callNo,
      library: clean(row.library),
      location: row.location,
      shelfMark: clean(row.shelfMark),
      status: row.status,
      available: row.itemsAvailable > 0,
    }));
  }

  async book(bookId: string): Promise<LibraryBookDetail> {
    const id = requiredText(bookId, "bookId");
    const [value, holdings] = await Promise.all([
      this.json(`/meta-local/opac/bibs/${encodeURIComponent(id)}/infos`),
      this.holdings(id),
    ]);
    const parsed = bookInfoEnvelopeSchema.parse(value);
    assertBusinessCode(parsed.code, parsed.msg, "book-info");

    const base = parsed.data.map.baseInfo.map;
    return {
      bookId: id,
      title: base.title,
      author: clean(base.author),
      callNumbers: [...new Set(holdings.map((entry) => entry.callNumber))],
      totalCopies: holdings.length,
      availableCopies: holdings.filter((entry) => entry.available).length,
      holdings,
    };
  }

  async loans(page = 1, pageSize = 50): Promise<LibraryLoan[]> {
    const value = await this.json(
      `/meta-local/opac/users/loans?page=${page}&pageSize=${pageSize}`,
    );
    const parsed = loansEnvelopeSchema.parse(value);
    assertBusinessCode(parsed.code, parsed.msg, "loans");
    return parsed.data.map(mapLoan);
  }

  private async json(path: string, init?: RequestInit): Promise<unknown> {
    const response = await this.request(path, init);
    return JSON.parse(await response.text()) as unknown;
  }

  private async request(path: string, init?: RequestInit): Promise<FetchResponse> {
    const response = await this.fetch(new URL(path, this.baseUrl), init);

    if (response.status === 403) {
      const body = await response.text();
      if (/南大VPN|VPN/i.test(body)) {
        throw new AppError("VPN_REQUIRED", "南京大学 OPAC 当前要求校园网或南大 VPN", {
          hint: "连接校园网或南大 VPN 后重试",
        });
      }
      throw opacAuthRequired();
    }
    if (response.status === 401 || urlHostname(response.url) === "authserver.nju.edu.cn") {
      throw opacAuthRequired();
    }
    if (!response.ok) {
      throw new Error(`图书馆 OPAC 返回 HTTP ${response.status}`);
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

function assertBusinessCode(code: number, message: string | null | undefined, action: string): void {
  if (code === 0 || code === 200) return;
  if (code === 401 || code === 403) {
    throw opacAuthRequired();
  }
  throw new Error(message?.trim() || `图书馆 ${action} 请求失败 (${code})`);
}

function opacAuthRequired(): AppError {
  return new AppError("AUTH_REQUIRED", "图书馆读者会话未登录或已经失效", {
    hint: "运行 njucli auth login opac",
    authCommand: "njucli auth login opac",
  });
}

function clean(value: string | number | null | undefined): string | null {
  if (value == null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

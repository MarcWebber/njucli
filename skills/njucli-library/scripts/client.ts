import { AppError } from "../../../src/core/errors.js";
import { requiredText } from "../../../src/core/guards.js";
import type { FetchLike, FetchResponse } from "../../../src/core/types.js";
import { OPAC_BASE_URL, type BookRow, type HoldingRow, type LoanRow } from "./contract.js";
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
    const data = await this.json<{ actualTotal: number; dataList: BookRow[] }>("/meta-local/opac/search/", {
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
    return {
      total: Number(data.actualTotal),
      items: data.dataList.map(mapBookSummary),
    };
  }

  async holdings(bookId: string): Promise<LibraryHolding[]> {
    const id = requiredText(bookId, "bookId");
    const data = await this.json<{ holdings: string }>(
      `/meta-local/opac/bibs/${encodeURIComponent(id)}/holdings`,
    );
    const rows = JSON.parse(data.holdings) as HoldingRow[];
    return rows.map((row) => ({
      callNumber: row.callNo,
      library: clean(row.library),
      location: row.location,
      shelfMark: clean(row.shelfMark),
      status: row.status,
      available: Number(row.itemsAvailable) > 0,
    }));
  }

  async book(bookId: string): Promise<LibraryBookDetail> {
    const id = requiredText(bookId, "bookId");
    const [data, holdings] = await Promise.all([
      this.json<{ map: { baseInfo: { map: { title: string; author?: string | null } } } }>(`/meta-local/opac/bibs/${encodeURIComponent(id)}/infos`),
      this.holdings(id),
    ]);
    const base = data.map.baseInfo.map;
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
    const rows = await this.json<LoanRow[]>(`/meta-local/opac/users/loans?page=${page}&pageSize=${pageSize}`);
    return rows.map(mapLoan);
  }

  private async json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.request(path, init);
    const result = JSON.parse(await response.text()) as { code: string | number; msg?: string; data: T };
    const code = Number(result.code);
    if (code === 401 || code === 403) throw opacAuthRequired();
    if (code !== 0 && code !== 200) throw new Error(result.msg || `图书馆请求失败 (${code}): ${path}`);
    return result.data;
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
    if (response.status === 401 || new URL(response.url).hostname === "authserver.nju.edu.cn") {
      throw opacAuthRequired();
    }
    if (!response.ok) {
      throw new Error(`图书馆 OPAC 返回 HTTP ${response.status}`);
    }
    return response;
  }
}

function mapBookSummary(row: BookRow): LibraryBookSummary {
  return {
    bookId: String(row.bibId),
    title: row.title,
    author: clean(row.author),
    callNumbers: row.callno ?? [],
    totalCopies: Number(row.itemCount),
    availableCopies: Number(row.circCount),
  };
}

function mapLoan(row: LoanRow): LibraryLoan {
  return {
    title: row.title,
    dueOn: row.dueDate.slice(0, 10),
    overdue: Number(row.isOverdue) !== 0,
  };
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

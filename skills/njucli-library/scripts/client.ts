import { AppError } from "../../../src/core/errors.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { requiredText } from "../../../src/core/guards.js";
import type { FetchLike } from "../../../src/core/types.js";
import { OPAC_BASE_URL, OPAC_GROUP_CODE, type BookRow, type HoldingRow, type LoanRow } from "./contract.js";
import type { LibraryBookDetail, LibraryHolding, LibraryLoan, LibrarySearchField, LibrarySearchPage } from "./types.js";

const SEARCH_FIELDS = { all: "keyWord", title: "title", author: "author", isbn: "isbn", callno: "callNo" };

export class NjuOpacClient {
  constructor(private readonly fetch: FetchLike, private readonly token?: string) {}

  async search(query: string, field: LibrarySearchField = "all", page = 1, pageSize = 20): Promise<LibrarySearchPage> {
    const data = await this.json<{ numFound: number; searchResult: BookRow[] }>("/find/unify/indexSearch", {
      searchFieldContent: requiredText(query, "query"),
      searchField: SEARCH_FIELDS[field],
      matchMode: field === "callno" ? "3" : field === "author" || field === "isbn" ? "1" : "2",
      sortField: "relevance", sortClause: "asc", page, rows: pageSize, indexSearch: 1,
    });
    const counts = data.searchResult.length === 0 ? {} : await this.json<Record<string, { pCount: number; onShelfCount: number }>>(
      "/find/unify/getPItemAndOnShelfCountAndDuxiuImageUrl",
      { items: data.searchResult.map((row) => ({ recordId: row.recordId, title: row.title, isbn: row.isbn })) },
    );
    return {
      total: data.numFound,
      items: data.searchResult.map((row) => ({
        bookId: String(row.recordId), title: row.title, author: row.author,
        callNumbers: row.callNo ?? [], totalCopies: counts[row.recordId]!.pCount, availableCopies: counts[row.recordId]!.onShelfCount,
      })),
    };
  }

  async holdings(bookId: string): Promise<LibraryHolding[]> {
    const recordId = requiredText(bookId, "bookId");
    const holdings: LibraryHolding[] = [];
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const data = await this.json<{ totalCount: number; list: HoldingRow[] }>("/find/physical/groupitems", {
        recordId, page, rows: 10, entrance: null, isUnify: true, sortType: 0, callNo: "",
      });
      pages = Math.ceil(data.totalCount / 10);
      holdings.push(...data.list.map((row) => ({
        callNumber: row.callNo, library: row.libName, location: row.locationName,
        shelfMark: row.shelfNo || null, status: row.processType,
        available: row.processTypeCode === "411" && row.circAttr === "0",
      })));
    }
    return holdings;
  }

  async book(bookId: string): Promise<LibraryBookDetail> {
    const id = requiredText(bookId, "bookId");
    const [data, holdings] = await Promise.all([
      this.json<{ clearTitle: string; authorOther: string | null }>(`/find/searchResultDetail/getDetail?recordId=${encodeURIComponent(id)}`),
      this.holdings(id),
    ]);
    return {
      bookId: id, title: data.clearTitle, author: data.authorOther,
      callNumbers: [...new Set(holdings.map((entry) => entry.callNumber))],
      totalCopies: holdings.length, availableCopies: holdings.filter((entry) => entry.available).length, holdings,
    };
  }

  async hasSession(): Promise<boolean> {
    if (!this.token) return false;
    try {
      const data = await this.json<{ userId: string }>("/oga/userinfo");
      return Boolean(data.userId);
    } catch (error) {
      if (error instanceof AppError && error.code === "AUTH_REQUIRED") return false;
      throw error;
    }
  }

  async loans(page = 1, pageSize = 50): Promise<LibraryLoan[]> {
    if (!this.token) throw opacAuthRequired();
    const data = await this.json<{ searchResult: LoanRow[] }>("/find/loanInfo/loanList", {
      page, rows: pageSize, searchType: 1, searchContent: "", sortType: 0, startDate: null, endDate: null,
    });
    const today = parseCampusDate("today");
    return data.searchResult.map((row) => {
      const dueOn = row.normReturnDate.slice(0, 10);
      return { title: row.title, dueOn, overdue: dueOn < today };
    });
  }

  private async json<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { groupCode: OPAC_GROUP_CODE };
    if (this.token) headers.jwtOpacAuth = this.token;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await this.fetch(new URL(path, OPAC_BASE_URL), {
      headers, ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    });
    if (response.status === 401 || response.status === 403 || new URL(response.url).hostname === "authserver.nju.edu.cn") throw opacAuthRequired();
    if (!response.ok) throw new Error(`图书馆 OPAC 返回 HTTP ${response.status}`);
    const result = JSON.parse(await response.text()) as { success: boolean; errCode: number; message: string; data: T };
    if (result.errCode === 401 || result.errCode === 403) throw opacAuthRequired();
    if (!result.success) throw new Error(result.message);
    return result.data;
  }
}

function opacAuthRequired(): AppError {
  return new AppError("AUTH_REQUIRED", "请完成图书馆读者登录", { authCommand: "njucli auth login opac" });
}

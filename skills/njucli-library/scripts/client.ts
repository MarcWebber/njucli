import { AppError } from "../../../src/core/errors.js";
import { parseCampusDate } from "../../../src/core/dates.js";
import { requiredText } from "../../../src/core/guards.js";
import type { FetchLike } from "../../../src/core/types.js";
import { OPAC_BASE_URL, OPAC_GROUP_CODE, type BookRow, type HoldingRow, type LoanRow, type LibraryRequestRow } from "./contract.js";
import type { LibraryRequestInput } from "./input.js";
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
      await this.json("/find/loanInfo/loanList", { page: 1, rows: 1, searchType: 1, searchContent: "", sortType: 0, startDate: null, endDate: null });
      return true;
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
      return { loanId: String(row.loanId), title: row.title, dueOn, overdue: dueOn < today };
    });
  }

  async renew(loanId: string) {
    const find = async () => {
      for (let page = 1; ; page++) {
        const loans = await this.loans(page, 100);
        const loan = loans.find(row => row.loanId === loanId);
        if (loan || loans.length < 100) return loan;
      }
    };
    const before = await find();
    if (!before) throw new AppError("NOT_FOUND", "本人在借列表中没有该 loanId");
    const result = await this.json<{ success: number; fail: number; result: unknown }>("/find/lendbook/reNew", { loanIds: [loanId] });
    if (result.fail > 0) throw new AppError("REMOTE_UNAVAILABLE", "图书馆未接受续借", { details: { result } });
    const loan = await find();
    if (!loan || loan.dueOn <= before.dueOn)
      throw new AppError("REMOTE_UNAVAILABLE", "续借已提交，应还日期回读未确认延长，请查询 loans 后再操作", { details: { loanId, result } });
    return { previousDueOn: before.dueOn, loan };
  }

  async contacts() {
    const data = await this.json<{ phone: string; phoneFlag: string; mail: string; emailFlag: string }>("/find/userInfo/getContactMess", {});
    return { phone: data.phone, phoneVerified: data.phoneFlag === "1", email: data.mail, emailVerified: data.emailFlag === "1" };
  }

  private async readerId() {
    const data = await this.json<{ user: { userId: string | number } }>("/find/userInfo/getUserInfo");
    return String(data.user.userId);
  }

  async sendPhoneCode(phone: string) {
    const query = new URLSearchParams({ groupCode: OPAC_GROUP_CODE, userId: await this.readerId(), number: phone });
    await this.json(`/find/userInfo/sendPhonenumber?${query}`);
    return { sent: true, phoneMasked: `${phone.slice(0, 3)}****${phone.slice(-4)}` };
  }

  async sendEmailVerification(email: string) {
    const query = new URLSearchParams({ userId: await this.readerId(), mail: email });
    await this.json(`/find/userInfo/checkMail?${query}`);
    return { sent: true, verification: "请在本人邮箱中打开本次图书馆验证链接，再查询 contacts 确认状态" };
  }

  async verifyPhone(phone: string, code: string) {
    const query = new URLSearchParams({ userId: await this.readerId(), number: phone, code });
    await this.json(`/find/userInfo/checkPhonenumber?${query}`);
    const contact = await this.contacts();
    if (!contact.phoneVerified) throw new AppError("REMOTE_UNAVAILABLE", "验证码已提交，回读未确认手机号已验证，请查询 contacts 后再操作");
    return { verified: true, contact };
  }

  requestOptions(bookId: string) {
    return this.json<{ totalCount: number; list: Record<string, unknown>[]; user: { userId: string | number; [key: string]: unknown } }>(
      "/find/physical/getRequestAndEnreustList", { page: 1, rows: 100, entrance: null, recordId: requiredText(bookId, "bookId") },
    );
  }

  pickupLocations(bookId: string, callNo: string) {
    const query = new URLSearchParams({ recordId: requiredText(bookId, "bookId"), callNo: requiredText(callNo, "callNo") });
    return this.json<Record<string, unknown>>(`/find/request/getVol?${query}`);
  }

  requests(page = 1, pageSize = 20) {
    if (!this.token) throw opacAuthRequired();
    return this.json<{ total: number; list: LibraryRequestRow[] }>("/find/subtenancy/requestManager", {
      requestType: null, physicaRequestType: null, page, rows: pageSize, sortType: "",
    });
  }

  private async allRequests() {
    const rows: LibraryRequestRow[] = [];
    for (let page = 1; ; page++) {
      const result = await this.requests(page, 100);
      rows.push(...result.list);
      if (rows.length >= result.total || result.list.length === 0) return rows;
    }
  }

  async request(requestId: string) {
    if (!(await this.allRequests()).some(row => String(row.requestId) === requestId))
      throw new AppError("NOT_FOUND", "本人请求列表中没有该 requestId");
    return this.json<Record<string, unknown>>(`/find/subtenancy/requestDetl?requestId=${encodeURIComponent(requestId)}`);
  }

  async submitRequest(type: 0 | 1, input: LibraryRequestInput) {
    const options = await this.requestOptions(input.recordId);
    const before = new Set((await this.allRequests()).map(row => String(row.requestId)));
    await this.json("/find/subtenancy/subscribeAndEntrust", {
      ...input, userId: options.user.userId, type, noticeType: "2", takeAddress: "", userKeepDay: null,
      forceApply: 0, hardApply: 0,
    });
    const created = (await this.allRequests()).filter(row => !before.has(String(row.requestId)));
    if (created.length !== 1)
      throw new AppError("REMOTE_UNAVAILABLE", "请求已提交，本人请求回读未唯一确认新增记录，请查询 requests 后再操作");
    return created[0]!;
  }

  async cancelRequest(requestId: string) {
    const before = (await this.allRequests()).find(row => String(row.requestId) === requestId);
    if (!before) throw new AppError("NOT_FOUND", "本人请求列表中没有该 requestId");
    await this.json(`/find/subtenancy/requestCancel?requestId=${encodeURIComponent(requestId)}`);
    const after = (await this.allRequests()).find(row => String(row.requestId) === requestId);
    if (after && JSON.stringify(after) === JSON.stringify(before))
      throw new AppError("REMOTE_UNAVAILABLE", "取消已提交，本人请求回读未确认变化，请查询 requests 后再操作");
    return { requestId, cancelled: true, request: after ?? null };
  }

  private async json<T>(path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { groupCode: OPAC_GROUP_CODE };
    if (this.token) headers.jwtOpacAuth = this.token;
    if (body !== undefined) headers["content-type"] = "application/json";
    const response = await this.fetch(new URL(path, OPAC_BASE_URL), {
      headers, ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
    });
    const text = await response.text();
    if (response.status === 403 && text.includes("请使用南大VPN访问")) {
      throw new AppError("VPN_REQUIRED", "当前网络无法访问图书馆，请连接校园网或学校官方 VPN", {
        details: { url: "https://vpn.nju.edu.cn/" },
      });
    }
    if (response.status === 401 || response.status === 403 || new URL(response.url).hostname === "authserver.nju.edu.cn") throw opacAuthRequired();
    if (!response.ok) throw new Error(`图书馆 OPAC 返回 HTTP ${response.status}`);
    const result = JSON.parse(text) as { success: boolean; errCode: number; message: string; data: T };
    if (result.errCode === 401 || result.errCode === 403) throw opacAuthRequired();
    if (!result.success) throw new AppError(/验证手机号|验证.*邮箱|验证通知方式/.test(result.message) ? "USER_ACTION_REQUIRED" : "REMOTE_UNAVAILABLE", result.message, {
      details: { remoteCode: result.errCode, url: `${OPAC_BASE_URL}/#/personalCenter` },
    });
    return result.data;
  }
}

function opacAuthRequired(): AppError {
  return new AppError("AUTH_REQUIRED", "请完成图书馆读者登录", { authCommand: "njucli auth login opac" });
}

import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { LibraryServices } from './services.js';
import { LIBRARY_SEARCH_FIELDS } from './types.js';
import { libraryRequestInput, libraryPhone, libraryPhoneCode } from './input.js';

export function registerLibraryTools(tool: McpTool, service: LibraryServices): void {
  tool("library_search", "Search the NJU library catalog and report copy availability.", {
    query: z.string().min(1).describe("Title, author, ISBN, call number, or keywords"),
    field: z.enum(LIBRARY_SEARCH_FIELDS).optional().describe("Catalog field to search; omit for all fields"),
    page: z.number().int().min(1).optional().describe("One-based result page"),
    pageSize: z.number().int().min(1).optional().describe("Results per page"),
  }, ({ query, field, page, pageSize }) => service.search(query, field, page, pageSize));
  tool("library_holdings", "List call numbers, locations, and availability for a catalog book.", { bookId: z.string().min(1).describe("Stable book ID returned by library_search") }, ({ bookId }) => service.holdings(bookId));
  tool("library_book", "读取指定图书详情。", { bookId: z.string().min(1) }, ({ bookId }) => service.book(bookId));
  tool("library_loans", "分页查询本人借阅。", {
    page: z.number().int().positive().optional(), pageSize: z.number().int().positive().optional(),
  }, ({ page, pageSize }) => service.loans(page, pageSize));
  const id = z.string().min(1);
  tool("library_contacts", "查询图书馆本人联系信息和官方验证状态。", {}, () => service.contacts());
  tool("library_phone_code", "向 profile.phone 或用户明确指定的本人手机号发送一次官方验证码。", { phone: libraryPhone }, args => service.sendPhoneCode(args.phone), { destructiveHint: false });
  tool("library_phone_verify", "提交用户输入的本次官方验证码，保存并回读本人手机号验证状态。", { phone: libraryPhone, code: libraryPhoneCode }, args => service.verifyPhone(args.phone, args.code), { destructiveHint: true });
  tool("library_email_verification", "向 profile.email 或用户指定的本人邮箱发送图书馆验证链接，由用户打开链接完成验证。", { email: z.email() }, args => service.sendEmailVerification(args.email), { destructiveHint: false });
  tool("library_renew", "续借本人在借的一本图书，并回读延长后的应还日期。", { loanId: id }, args => service.renew(args.loanId), { destructiveHint: false });
  tool("library_request_options", "读取可申请馆藏、本人预约和委托资格及联系方式。", { bookId: id }, args => service.requestOptions(args.bookId));
  tool("library_pickup_locations", "读取指定书目索书号的预约、委托取书地点及分卷。", { bookId: id, callNo: id }, args => service.pickupLocations(args.bookId, args.callNo));
  tool("library_requests", "分页查询本人图书请求。", { page: z.number().int().positive().optional(), pageSize: z.number().int().positive().optional() }, args => service.requests(args.page, args.pageSize));
  tool("library_request", "读取本人指定图书请求详情。", { requestId: id }, args => service.request(args.requestId));
  tool("library_reserve", "预约一本指定图书，取书地点由调用者指定；需要图书馆认可的已验证联系方式。", libraryRequestInput.shape, args => service.submitRequest(1, args), { destructiveHint: false });
  tool("library_entrust", "提交一次指定图书的跨校区委托，来源与取书地点由调用者指定。", libraryRequestInput.shape, args => service.submitRequest(0, args), { destructiveHint: false });
  tool("library_cancel_request", "取消本人指定图书请求并回读。", { requestId: id }, args => service.cancelRequest(args.requestId), { destructiveHint: true });
}

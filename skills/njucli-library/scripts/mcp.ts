import { z } from 'zod';
import type { McpTool } from '../../../src/mcp/tools.js';
import type { LibraryServices } from './services.js';
import { LIBRARY_SEARCH_FIELDS } from './types.js';

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
}

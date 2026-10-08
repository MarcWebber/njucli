import { z } from 'zod';
import type { ReadTool } from '../../../src/mcp/read.js';
import type { LibraryServices } from './services.js';
import { LIBRARY_SEARCH_FIELDS } from './types.js';

export function registerLibraryTools(read: ReadTool, service: LibraryServices): void {
  read("library_search", "Search the NJU library catalog and report copy availability.", {
    query: z.string().min(1).describe("Title, author, ISBN, call number, or keywords"),
    field: z.enum(LIBRARY_SEARCH_FIELDS).optional().describe("Catalog field to search; omit for all fields"),
    page: z.number().int().min(1).optional().describe("One-based result page"),
    pageSize: z.number().int().min(1).optional().describe("Results per page"),
  }, ({ query, field, page, pageSize }) => service.search(query, field, page, pageSize));
  read("library_holdings", "List call numbers, locations, and availability for a catalog book.", { bookId: z.string().min(1).describe("Stable book ID returned by library_search") }, ({ bookId }) => service.holdings(bookId));
}

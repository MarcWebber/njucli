import { type SkillRuntime } from "../../../src/app/runtime.js";
import { NjuOpacClient } from "./client.js";
import { OPAC_BASE_URL } from "./contract.js";

export type LibraryServices = Pick<NjuOpacClient, "search" | "book" | "holdings" | "loans">;

export function createLibraryServices(runtime: SkillRuntime): LibraryServices {
  const client = new NjuOpacClient(globalThis.fetch);
  return {
    search: (query, field, page, pageSize) => client.search(query, field, page, pageSize),
    book: (bookId) => client.book(bookId),
    holdings: (bookId) => client.holdings(bookId),
    loans: (page, pageSize) => runtime.withBrowser("opac", async (session) =>
      new NjuOpacClient(session.request, await session.cookie(OPAC_BASE_URL, "jwt")).loans(page, pageSize)),
  };
}

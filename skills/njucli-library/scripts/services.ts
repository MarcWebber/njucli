import { type SkillRuntime } from "../../../src/app/runtime.js";
import { NjuOpacClient } from "./client.js";

export type LibraryServices = Pick<NjuOpacClient, "search" | "book" | "holdings" | "loans">;

export function createLibraryServices(runtime: SkillRuntime): LibraryServices {
  const { withBrowser } = runtime;
  const OPAC_WEBVPN_BASE_URL = "https://opac-nju-edu-cn.atrust.nju.edu.cn";
  const withLibrary = <T>(capability: "vpn" | "opac", operation: (client: NjuOpacClient) => Promise<T>): Promise<T> => withBrowser(capability, (session) => operation(new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL)));
  return {
    search: (query, field, page, pageSize) => withLibrary("vpn", (client) => client.search(query, field, page, pageSize)),
    book: (bookId) => withLibrary("vpn", (client) => client.book(bookId)),
    holdings: (bookId) => withLibrary("vpn", (client) => client.holdings(bookId)),
    loans: (page, pageSize) => withLibrary("opac", (client) => client.loans(page, pageSize)),
  };
}

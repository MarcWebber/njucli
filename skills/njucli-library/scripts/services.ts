import { type SkillRuntime } from "../../../src/app/runtime.js";
import { NjuOpacClient } from "./client.js";
import { withBrowserSession } from "../../../src/auth/browser-session.js";
import { opacTransport } from "../../../src/auth/opac-transport.js";

export type LibraryServices = Pick<NjuOpacClient, "search" | "book" | "holdings" | "loans" | "renew" | "contacts" | "sendPhoneCode" | "verifyPhone" | "sendEmailVerification" | "requestOptions" | "pickupLocations" | "requests" | "request" | "submitRequest" | "cancelRequest">;

export function createLibraryServices(runtime: SkillRuntime): LibraryServices {
  const withPublic = async <T>(operation: (client: NjuOpacClient) => Promise<T>) =>
    withBrowserSession(await runtime.accountStore.current(), true, async session => {
      const transport = await opacTransport(session);
      return operation(new NjuOpacClient(transport.request));
    });
  const withReader = <T>(operation: (client: NjuOpacClient) => Promise<T>) => runtime.withBrowser("opac", async session => {
    const transport = await opacTransport(session);
    return operation(new NjuOpacClient(transport.request, await session.cookie(transport.site, "jwt")));
  });
  return {
    search: (query, field, page, pageSize) => withPublic(client => client.search(query, field, page, pageSize)),
    book: bookId => withPublic(client => client.book(bookId)),
    holdings: bookId => withPublic(client => client.holdings(bookId)),
    loans: (page, pageSize) => withReader(client => client.loans(page, pageSize)),
    renew: loanId => withReader(client => client.renew(loanId)),
    contacts: () => withReader(client => client.contacts()),
    sendPhoneCode: phone => withReader(client => client.sendPhoneCode(phone)),
    verifyPhone: (phone, code) => withReader(client => client.verifyPhone(phone, code)),
    sendEmailVerification: email => withReader(client => client.sendEmailVerification(email)),
    requestOptions: bookId => withReader(client => client.requestOptions(bookId)),
    pickupLocations: (bookId, callNo) => withReader(client => client.pickupLocations(bookId, callNo)),
    requests: (page, pageSize) => withReader(client => client.requests(page, pageSize)),
    request: requestId => withReader(client => client.request(requestId)),
    submitRequest: (type, input) => withReader(client => client.submitRequest(type, input)),
    cancelRequest: requestId => withReader(client => client.cancelRequest(requestId)),
  };
}

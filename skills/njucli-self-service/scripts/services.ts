import type { SkillRuntime } from "../../../src/app/runtime.js";
import { MailClient } from "../../njucli-mail/scripts/client.js";
import { SelfServiceClient } from "./client.js";

export type SelfServiceServices = Omit<SelfServiceClient, "hasSession">;

export function createSelfServiceServices({ withBrowser }: SkillRuntime): SelfServiceServices {
  const withSelfService = async <T>(operation: (client: SelfServiceClient) => Promise<T>): Promise<T> => {
    return withBrowser("self-service", async (session, account) => {
      const { address } = await new MailClient(account.configDir).status();
      return operation(new SelfServiceClient(session.request, address));
    }, (session) => new SelfServiceClient(session.request).hasSession());
  };
  return {
    profile: () => withSelfService((client) => client.profile()),
    items: (query) => withSelfService((client) => client.items(query)),
    show: (id) => withSelfService((client) => client.show(id)),
    quote: (id, delivery, copies) => withSelfService((client) => client.quote(id, delivery, copies)),
    orders: (state) => withSelfService((client) => client.orders(state)),
    order: (id) => withSelfService((client) => client.order(id)),
    create: (id, delivery, copies, email) => withSelfService((client) => client.create(id, delivery, copies, email)),
    send: (id, email) => withSelfService((client) => client.send(id, email)),
    terminals: () => withSelfService((client) => client.terminals()),
  };
}

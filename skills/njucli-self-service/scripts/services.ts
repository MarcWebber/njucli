import type { SkillRuntime } from "../../../src/app/runtime.js";
import { MailClient } from "../../njucli-mail/scripts/client.js";
import { SelfServiceClient } from "./client.js";

export function createSelfServiceServices({ withBrowser }: SkillRuntime) {
  return <T>(operation: (client: SelfServiceClient) => Promise<T>): Promise<T> => {
    return withBrowser("self-service", async (session, account) => {
      return operation(new SelfServiceClient(session.request, async () => (await new MailClient(account.configDir).status()).address));
    }, (session) => new SelfServiceClient(session.request).hasSession());
  };
}

export type SelfServiceServices = ReturnType<typeof createSelfServiceServices>;

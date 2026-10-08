import { AccountStore } from "../account/store.js";
import type { AccountRecord } from "../account/types.js";
import { type BrowserSession, withBrowserSession } from "../auth/browser-session.js";
import { createAuthCoordinator } from "../auth/create.js";
import type { AuthCapability } from "../auth/types.js";

export function createRuntime() {
  const accountStore = new AccountStore();
  const auth = createAuthCoordinator();
  const withBrowser = async <T>(
    capability: AuthCapability,
    operation: (session: BrowserSession, account: AccountRecord) => Promise<T>,
    probe?: (session: BrowserSession) => Promise<boolean>,
  ): Promise<T> => {
    const account = await accountStore.current();
    return withBrowserSession(account, false, async (session) => {
      await auth.ensureSession(account, capability, probe && (() => probe(session)));
      return operation(session, account);
    });
  };
  return { accountStore, auth, withBrowser };
}

export type SkillRuntime = ReturnType<typeof createRuntime>;

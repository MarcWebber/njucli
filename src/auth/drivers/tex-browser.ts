import type { AccountRecord } from "../../account/types.js";
import { AppError } from "../../core/errors.js";
import { texRequest } from "../../domains/tex/client.js";
import { withBrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const ORIGIN = "https://tex.nju.edu.cn";

export class TexBrowserSessionDriver implements AuthSessionDriver {
  login(account: AccountRecord): Promise<boolean> {
    return this.observe(account, true);
  }

  probe(account: AccountRecord): Promise<boolean> {
    return this.observe(account, false);
  }

  private observe(account: AccountRecord, interactive: boolean): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      const page = await session.page();
      await page.goto(`${ORIGIN}/console`, { waitUntil: "domcontentloaded" });
      if (new URL(page.url()).pathname.includes("login")) {
        await page.goto(`${ORIGIN}/oauth/login`, { waitUntil: "domcontentloaded" });
      }
      if (interactive) {
        await session.waitForLogin((url) => url.origin === ORIGIN && url.pathname === "/console");
      }
      try {
        await texRequest(session.request, "/api/user/info");
        return true;
      } catch (error) {
        if (error instanceof AppError && error.code === "AUTH_REQUIRED") return false;
        throw error;
      }
    });
  }
}

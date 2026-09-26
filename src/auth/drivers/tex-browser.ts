import type { AccountRecord } from "../../account/types.js";
import { AppError } from "../../core/errors.js";
import { texRequest } from "../../domains/tex/client.js";
import { withBrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const ORIGIN = "https://tex.nju.edu.cn";

export const texSessionDriver = {
  login: (account: AccountRecord) => openConsoleAndCheckSession(account, 180_000),
  probe: (account: AccountRecord) => openConsoleAndCheckSession(account, 15_000),
} satisfies AuthSessionDriver;

function openConsoleAndCheckSession(account: AccountRecord, timeout: number): Promise<boolean> {
  return withBrowserSession(account, false, async (session) => {
    const page = await session.page();
    try {
      await page.goto(`${ORIGIN}/console`, { waitUntil: "domcontentloaded" });
      if (new URL(page.url()).pathname.includes("login")) {
        await page.goto(`${ORIGIN}/oauth/login`, { waitUntil: "domcontentloaded" });
      }
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
    }
    try {
      await session.completeLogin(
        (url) => url.origin === ORIGIN && url.pathname === "/console",
        timeout,
      );
    } catch (error) {
      if (!(error instanceof Error) ||
        (error.name !== "TimeoutError" && !error.message.includes("net::ERR_ABORTED"))) throw error;
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

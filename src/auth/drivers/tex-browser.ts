import { load } from "cheerio";
import type { AccountRecord } from "../../account/types.js";
import { AppError } from "../../core/errors.js";
import { texRequest } from "../../../skills/njucli-tex/scripts/client.js";
import { type BrowserSession, withBrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const ORIGIN = "https://tex.nju.edu.cn";

export const texSessionDriver = {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      if (await restoreSession(session, true)) return true;
      await session.login(`${ORIGIN}/oauth/login`, (url) => url.origin === ORIGIN && url.pathname === "/console");
      return hasSession(session);
    });
  },
  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, (session) => restoreSession(session));
  },
} satisfies AuthSessionDriver;

async function restoreSession(session: BrowserSession, authorize = false): Promise<boolean> {
  if (await hasSession(session)) return true;
  const response = await session.request(`${ORIGIN}/oauth/login`);
  if (!response.ok) throw new Error(`TeX 登录恢复返回 HTTP ${response.status}`);
  const url = new URL(response.url);
  if (authorize && url.hostname === "authserver.nju.edu.cn" && url.pathname === "/authserver/oauth2.0/authorize") {
    const $ = load(await response.text());
    if ($('.oauth-form input[type="hidden"][name="scope"][value="user_profile"]').length) {
      const granted = await session.request(url.href, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ scope: "user_profile" }).toString(),
      });
      if (!granted.ok) throw new Error(`TeX 授权返回 HTTP ${granted.status}`);
    }
  }
  return hasSession(session);
}

async function hasSession(session: BrowserSession): Promise<boolean> {
  try {
    await texRequest(session.request, "/api/user/info");
    return true;
  } catch (error) {
    if (error instanceof AppError && error.code === "AUTH_REQUIRED") return false;
    throw error;
  }
}

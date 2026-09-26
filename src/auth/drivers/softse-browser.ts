import { load } from "cheerio";

import type { AccountRecord } from "../../account/types.js";
import {
  type BrowserSession,
  withBrowserSession,
} from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const HOST = "selearning.nju.edu.cn";
const HOME_URL = `https://${HOST}/my/`;
const LOGIN_URL = `https://${HOST}/login/index.php?authCAS=CAS`;

export const softSeSessionDriver = {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      await session.login(LOGIN_URL, isLoggedInPage);
      return hasSoftSeSession(session);
    });
  },

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, async (session) => {
      const current = await hasSoftSeSession(session);
      if (current) return current;
      await (await session.page()).goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
      return hasSoftSeSession(session);
    });
  },
} satisfies AuthSessionDriver;

function isLoggedInPage(url: URL): boolean {
  return url.hostname === HOST && url.pathname !== "/login/index.php";
}

async function hasSoftSeSession(session: BrowserSession): Promise<boolean> {
  const response = await session.request(HOME_URL);
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error(`SoftSE 登录检查返回 HTTP ${response.status}`);
  const url = new URL(response.url);
  const $ = load(await response.text());
  return url.hostname === HOST && url.pathname === "/my/" && $('a[href*="/login/logout.php"]').length > 0;
}

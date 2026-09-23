import { load } from "cheerio";

import type { AccountRecord } from "../../account/types.js";
import { parseUrl } from "../../core/url.js";
import {
  type BrowserSession,
  withBrowserSession,
} from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const HOST = "selearning.nju.edu.cn";
const HOME_URL = `https://${HOST}/my/`;
const LOGIN_URL = `https://${HOST}/login/index.php?authCAS=CAS`;

export class SoftSeBrowserSessionDriver implements AuthSessionDriver {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      await session.login(LOGIN_URL, (url) => isHome(url.href));
      return observeHome(session);
    });
  }

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, async (session) => {
      const current = await observeHome(session);
      if (current) return current;
      await (await session.page()).goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
      return observeHome(session);
    });
  }

}

function isHome(value: string): boolean {
  const url = parseUrl(value);
  return url?.hostname === HOST && url.pathname !== "/login/index.php";
}

async function observeHome(session: BrowserSession): Promise<boolean> {
  const response = await session.request(HOME_URL);
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error(`SoftSE 登录检查返回 HTTP ${response.status}`);
  const url = parseUrl(response.url);
  const $ = load(await response.text());
  return url?.hostname === HOST && url.pathname === "/my/" && $('a[href*="/login/logout.php"]').length > 0;
}

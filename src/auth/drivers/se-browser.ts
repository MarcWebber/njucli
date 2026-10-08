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

export const seSessionDriver = {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, restoreSession);
  },

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, restoreSession);
  },
} satisfies AuthSessionDriver;

async function restoreSession(session: BrowserSession): Promise<boolean> {
  if (await hasSeSession(session)) return true;
  const response = await session.request(LOGIN_URL);
  if (!response.ok) throw new Error(`SE 登录恢复返回 HTTP ${response.status}`);
  return hasSeSession(session);
}

async function hasSeSession(session: BrowserSession): Promise<boolean> {
  const response = await session.request(HOME_URL);
  if (response.status === 401 || response.status === 403) return false;
  if (!response.ok) throw new Error(`SE 登录检查返回 HTTP ${response.status}`);
  const url = new URL(response.url);
  const $ = load(await response.text());
  return url.hostname === HOST && url.pathname === "/my/" && $('a[href*="/login/logout.php"]').length > 0;
}

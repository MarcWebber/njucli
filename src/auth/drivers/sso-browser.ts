import type { AccountRecord } from "../../account/types.js";
import {
  withBrowserSession,
} from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

const AUTH_HOST = "authserver.nju.edu.cn";
const LANDING_URL = "https://ehall.nju.edu.cn/new/index.html";
const LANDING_HOST = "ehall.nju.edu.cn";
const LOGIN_URL = `https://${AUTH_HOST}/authserver/login?service=${encodeURIComponent(LANDING_URL)}`;
const LOGOUT_URL = `https://${AUTH_HOST}/authserver/logout`;

export const ssoSessionDriver = {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      await session.login(LOGIN_URL, isLandingPage);
      return true;
    });
  },

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, async (session) => {
      const page = await session.page();
      await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
      const url = new URL(page.url());
      if (url.hostname === AUTH_HOST) return false;
      if (!isLandingPage(url)) throw new Error("SSO 状态探测返回了未知页面");
      return true;
    });
  },

  logout(account: AccountRecord): Promise<void> {
    return withBrowserSession(account, true, async (session) => {
      const page = await session.page();
      try {
        await page.goto(LOGOUT_URL, { waitUntil: "domcontentloaded" });
      } finally {
        await session.clearCookies();
      }
    });
  },
} satisfies AuthSessionDriver;

function isLandingPage(url: URL): boolean {
  return url.hostname === LANDING_HOST && url.pathname === new URL(LANDING_URL).pathname;
}

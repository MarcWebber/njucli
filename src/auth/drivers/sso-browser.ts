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
      const response = await session.request(LOGIN_URL);
      if (!response.ok) throw new Error(`SSO 登录返回 HTTP ${response.status}`);
      if (isLandingPage(new URL(response.url))) return true;
      await session.login(LOGIN_URL, isLandingPage);
      return true;
    });
  },

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, async (session) => {
      const response = await session.request(LOGIN_URL);
      if (!response.ok) throw new Error(`SSO 状态探测返回 HTTP ${response.status}`);
      const url = new URL(response.url);
      if (url.hostname === AUTH_HOST) return false;
      if (!isLandingPage(url)) throw new Error("SSO 状态探测返回了未知页面");
      return true;
    });
  },

  logout(account: AccountRecord): Promise<void> {
    return withBrowserSession(account, true, async (session) => {
      try {
        await session.request(LOGOUT_URL);
      } finally {
        await session.clearCookies();
      }
    });
  },
} satisfies AuthSessionDriver;

function isLandingPage(url: URL): boolean {
  return url.hostname === LANDING_HOST && url.pathname === new URL(LANDING_URL).pathname;
}

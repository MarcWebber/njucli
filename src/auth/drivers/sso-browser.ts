import type { AccountRecord } from "../../account/types.js";
import {
  withBrowserSession,
} from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";
import { EHallPortalClient } from "../../../skills/njucli-ehall/scripts/client.js";

const AUTH_HOST = "authserver.nju.edu.cn";
const LANDING_URL = "https://ehall.nju.edu.cn/ywtb-portal/official/index.html";
const LANDING_HOST = "ehall.nju.edu.cn";
export const EHALL_LOGIN_URL = `https://${LANDING_HOST}/login?service=${encodeURIComponent(LANDING_URL)}`;
const LOGIN_URL = `https://${AUTH_HOST}/authserver/login?service=${encodeURIComponent(EHALL_LOGIN_URL)}`;
const LOGOUT_URL = `https://${AUTH_HOST}/authserver/logout`;

export const ssoSessionDriver = {
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      const response = await session.request(LOGIN_URL);
      if (!response.ok) throw new Error(`SSO 登录返回 HTTP ${response.status}`);
      if (!isLandingPage(new URL(response.url))) await session.login(LOGIN_URL, isLandingPage);
      return new EHallPortalClient(session.request).hasSession();
    });
  },

  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, async (session) => {
      const response = await session.request(LOGIN_URL);
      if (!response.ok) throw new Error(`SSO 状态探测返回 HTTP ${response.status}`);
      const url = new URL(response.url);
      if (url.hostname === AUTH_HOST) return false;
      if (!isLandingPage(url)) throw new Error("SSO 状态探测返回了未知页面");
      return new EHallPortalClient(session.request).hasSession();
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

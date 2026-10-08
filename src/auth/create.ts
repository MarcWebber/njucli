import { setTimeout as delay } from "node:timers/promises";
import type { AccountRecord } from "../account/types.js";
import { withBrowserSession } from "./browser-session.js";
import { AuthCoordinator } from "./coordinator.js";
import { softSeSessionDriver } from "./drivers/softse-browser.js";
import { boxSessionDriver } from "./drivers/box-browser.js";
import { ssoSessionDriver } from "./drivers/sso-browser.js";
import { selectionSessionDriver } from "./drivers/selection-browser.js";
import { texSessionDriver } from "./drivers/tex-browser.js";
import { SessionStore } from "./session-store.js";
import { exchangeSportsAccessToken } from "./sports-token.js";
import { AppError, asAppError } from "../core/errors.js";
import { EHallPortalClient } from "../../skills/njucli-ehall/scripts/client.js";
import { EHallTimetableClient } from "../../skills/njucli-course/scripts/client.js";
import { NjuOpacClient } from "../../skills/njucli-library/scripts/client.js";

const EHALL_URL = "https://ehall.nju.edu.cn/new/index.html";

const VPN_TEST_URL = "https://www-nju-edu-cn-s.atrust.nju.edu.cn/";

const OPAC_WEBVPN_BASE_URL = "https://opac-nju-edu-cn.atrust.nju.edu.cn";

export function createAuthCoordinator(): AuthCoordinator {
  const restoreEhallSession = (account: AccountRecord): Promise<boolean> => withBrowserSession(account, true, async (session) => {
    const client = new EHallPortalClient(session.request);
    if (await client.hasSession())
      return true;
    const response = await session.request(`https://ehall.nju.edu.cn/login?service=${encodeURIComponent(EHALL_URL)}`);
    if (!response.ok)
      throw new Error(`EHall 登录返回 HTTP ${response.status}`);
    return client.hasSession();
  });
  const probeTimetable = (account: AccountRecord): Promise<boolean> => withBrowserSession(account, true, async (session) => {
    await new EHallTimetableClient(session.request).currentTerm();
    return true;
  });
  const probeSports = (account: AccountRecord): Promise<boolean> => withBrowserSession(account, true, async (session) => {
    await exchangeSportsAccessToken(session.request);
    return true;
  });
  const probeVpn = (account: AccountRecord): Promise<boolean> => withBrowserSession(account, true, async (session) => {
    const response = await session.request(VPN_TEST_URL);
    return response.ok && new URL(response.url).hostname === new URL(VPN_TEST_URL).hostname;
  });
  const probeOpac = (account: AccountRecord): Promise<boolean> => withBrowserSession(account, true, async (session) => {
    await new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL).loans(1, 1);
    return true;
  });
  return new AuthCoordinator({
    sessions: new SessionStore(),
    drivers: {
      sso: ssoSessionDriver,
      selection: selectionSessionDriver,
      softse: softSeSessionDriver,
      tex: texSessionDriver,
      box: boxSessionDriver,
      ehall: { login: restoreEhallSession, probe: restoreEhallSession },
      timetable: { login: probeTimetable, probe: probeTimetable },
      sports: { login: probeSports, probe: probeSports },
      vpn: { login: interactiveVpnLogin, probe: probeVpn },
      opac: { login: interactiveOpacLogin, probe: probeOpac },
    },
  });
}

async function interactiveVpnLogin(account: AccountRecord): Promise<boolean> {
  return withBrowserSession(account, false, async (session) => {
    const successHost = new URL(VPN_TEST_URL).hostname;
    await session.login(VPN_TEST_URL, (url) => url.hostname === successHost);
    return true;
  });
}

async function interactiveOpacLogin(account: AccountRecord): Promise<boolean> {
  return withBrowserSession(account, false, async (session) => {
    const page = await session.page();
    await page.goto(`${OPAC_WEBVPN_BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const deadline = Date.now() + 180000;
    while (true) {
      try {
        await new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL).loans(1, 1);
        return true;
      }
      catch (error) {
        const code = asAppError(error).code;
        if (code !== "AUTH_REQUIRED" && code !== "AUTH_EXPIRED")
          throw error;
        if (Date.now() >= deadline) {
          throw new AppError("USER_ACTION_REQUIRED", "图书馆读者登录尚未完成", {
            hint: "请在已经打开的学校图书馆页面完成官方登录",
            authCommand: "njucli auth login opac",
            cause: error,
          });
        }
        await delay(1000);
      }
    }
  });
}

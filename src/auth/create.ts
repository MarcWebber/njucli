import type { AccountRecord } from "../account/types.js";
import { withBrowserSession } from "./browser-session.js";
import { AuthCoordinator } from "./coordinator.js";
import { seSessionDriver } from "./drivers/se-browser.js";
import { boxSessionDriver } from "./drivers/box-browser.js";
import { EHALL_LOGIN_URL, ssoSessionDriver } from "./drivers/sso-browser.js";
import { selectionSessionDriver } from "./drivers/selection-browser.js";
import { texSessionDriver } from "./drivers/tex-browser.js";
import { SessionStore } from "./session-store.js";
import { exchangeSportsAccessToken } from "./sports-token.js";
import { EHallPortalClient } from "../../skills/njucli-ehall/scripts/client.js";
import { EHallTimetableClient } from "../../skills/njucli-ehall/scripts/timetable-client.js";
import { opacSessionDriver } from "./drivers/opac-browser.js";
import { YouthClient } from "../../skills/njucli-youth/scripts/client.js";
import { TableClient } from "../../skills/njucli-table/scripts/client.js";

const VPN_TEST_URL = "https://www-nju-edu-cn-s.atrust.nju.edu.cn/";

export function createAuthCoordinator(): AuthCoordinator {
  const restoreYouthSession = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, (session) => new YouthClient(session.request).restoreSession());
  const restoreTableSession = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, (session) => new TableClient(session.request).restoreSession());
  const restoreEhallSession = (account: AccountRecord): Promise<boolean> => withBrowserSession(account, true, async (session) => {
    const client = new EHallPortalClient(session.request);
    if (await client.hasSession())
      return true;
    const response = await session.request(EHALL_LOGIN_URL);
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
  return new AuthCoordinator({
    sessions: new SessionStore(),
    drivers: {
      sso: ssoSessionDriver,
      selection: selectionSessionDriver,
      se: seSessionDriver,
      tex: texSessionDriver,
      box: boxSessionDriver,
      ehall: { login: restoreEhallSession, probe: restoreEhallSession },
      timetable: { login: probeTimetable, probe: probeTimetable },
      sports: { login: probeSports, probe: probeSports },
      youth: { login: restoreYouthSession, probe: restoreYouthSession },
      table: { login: restoreTableSession, probe: restoreTableSession },
      vpn: { login: interactiveVpnLogin, probe: probeVpn },
      opac: opacSessionDriver,
    },
  });
}

async function interactiveVpnLogin(account: AccountRecord): Promise<boolean> {
  return withBrowserSession(account, false, async (session) => {
    const successHost = new URL(VPN_TEST_URL).hostname;
    const response = await session.request(VPN_TEST_URL);
    if (!response.ok) throw new Error(`WebVPN 登录恢复返回 HTTP ${response.status}`);
    if (new URL(response.url).hostname === successHost) return true;
    await session.login(VPN_TEST_URL, (url) => url.hostname === successHost);
    return true;
  });
}


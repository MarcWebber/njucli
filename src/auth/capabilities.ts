import { SelfServiceClient, SELF_SERVICE_BASE, SELF_SERVICE_HEADERS } from "../../skills/njucli-self-service/scripts/client.js";
import type { AccountRecord } from "../account/types.js";
import { withBrowserSession } from "./browser-session.js";
import { seSessionDriver } from "./drivers/se-browser.js";
import { boxSessionDriver } from "./drivers/box-browser.js";
import { EHALL_LOGIN_URL, ssoSessionDriver } from "./drivers/sso-browser.js";
import { selectionSessionDriver } from "./drivers/selection-browser.js";
import { texSessionDriver } from "./drivers/tex-browser.js";
import { exchangeSportsAccessToken } from "./sports-token.js";
import { EHallPortalClient } from "../../skills/njucli-ehall/scripts/client.js";
import { EHallTimetableClient } from "../../skills/njucli-ehall/scripts/timetable-client.js";
import { opacSessionDriver } from "./drivers/opac-browser.js";
import { YouthClient } from "../../skills/njucli-youth/scripts/client.js";
import { TableClient } from "../../skills/njucli-table/scripts/client.js";
import { LmsClient } from "../../skills/njucli-lms/scripts/client.js";
import type { AuthCapability, AuthSessionDriver } from "./types.js";

const VPN_TEST_URL = "https://www-nju-edu-cn-s.atrust.nju.edu.cn/";

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

const restoreLmsSession = (account: AccountRecord): Promise<boolean> =>
  withBrowserSession(account, true, session => new LmsClient(session.request).restoreSession());

const selfServiceSessionDriver: AuthSessionDriver = {
  probe: (account) => withBrowserSession(account, true, (session) => new SelfServiceClient(session.request).hasSession()),
  login: (account) => withBrowserSession(account, true, async (session) => {
    const response = await session.request(`${SELF_SERVICE_BASE}/app/login/IDS?${new URLSearchParams({ type: "2", returnUrl: "/mobile/itemList" })}`, { headers: SELF_SERVICE_HEADERS });
    if (!response.ok) throw new Error(`自助服务登录返回 HTTP ${response.status}`);
    return new SelfServiceClient(session.request).hasSession();
  }),
};

export const AUTH_SITES = {
  sso: { dependencies: [], driver: ssoSessionDriver },
  selection: { dependencies: [], driver: selectionSessionDriver },
  vpn: { dependencies: ["sso"], driver: { login: interactiveVpnLogin, probe: probeVpn } },
  ehall: { dependencies: ["sso"], driver: { login: restoreEhallSession, probe: restoreEhallSession } },
  se: { dependencies: ["sso"], driver: seSessionDriver },
  lms: { dependencies: ["sso"], driver: { login: restoreLmsSession, probe: restoreLmsSession } },
  tex: { dependencies: ["sso"], driver: texSessionDriver },
  box: { dependencies: [], driver: boxSessionDriver },
  timetable: { dependencies: ["ehall"], driver: { login: probeTimetable, probe: probeTimetable } },
  sports: { dependencies: ["sso"], driver: { login: probeSports, probe: probeSports } },
  youth: { dependencies: ["sso"], driver: { login: restoreYouthSession, probe: restoreYouthSession } },
  table: { dependencies: ["sso"], driver: { login: restoreTableSession, probe: restoreTableSession } },
  opac: { dependencies: ["sso"], driver: opacSessionDriver },
  "self-service": { dependencies: ["sso"], driver: selfServiceSessionDriver },
} as const satisfies Record<string, { dependencies: readonly string[]; driver: AuthSessionDriver }>;

export const AUTH_CAPABILITIES = Object.keys(AUTH_SITES) as readonly AuthCapability[];

export function dependsOn(capability: AuthCapability, ancestor: AuthCapability): boolean {
  return AUTH_SITES[capability].dependencies.some(parent => parent === ancestor || dependsOn(parent, ancestor));
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

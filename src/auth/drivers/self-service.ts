import { SelfServiceClient, SELF_SERVICE_BASE, SELF_SERVICE_HEADERS } from "../../../skills/njucli-self-service/scripts/client.js";
import { withBrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

export const selfServiceSessionDriver: AuthSessionDriver = {
  probe: (account) => withBrowserSession(account, true, (session) => new SelfServiceClient(session.request).hasSession()),
  login: (account) => withBrowserSession(account, true, async (session) => {
    const response = await session.request(`${SELF_SERVICE_BASE}/app/login/IDS?${new URLSearchParams({ type: "2", returnUrl: "/mobile/itemList" })}`, { headers: SELF_SERVICE_HEADERS });
    if (!response.ok) throw new Error(`自助服务登录返回 HTTP ${response.status}`);
    return new SelfServiceClient(session.request).hasSession();
  }),
};

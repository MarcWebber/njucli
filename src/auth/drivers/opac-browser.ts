import { NjuOpacClient } from "../../../skills/njucli-library/scripts/client.js";
import { OPAC_BASE_URL, OPAC_LOGIN_URL } from "../../../skills/njucli-library/scripts/contract.js";
import { withBrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";

export const opacSessionDriver: AuthSessionDriver = {
  probe: (account) => withBrowserSession(account, true, async (session) =>
    new NjuOpacClient(session.request, await session.cookie(OPAC_BASE_URL, "jwt")).hasSession()),
  login: (account) => withBrowserSession(account, false, async (session) => {
    const page = await session.page();
    await session.login(OPAC_LOGIN_URL, (url) => url.hostname === new URL(OPAC_BASE_URL).hostname);
    // 官网在 CAS 回跳后通过页面脚本把 JWT 写入 Cookie。
    await page.waitForFunction(() => document.cookie.split(";").some((entry) => entry.trim().startsWith("jwt=")), undefined, { timeout: 30_000 });
    return new NjuOpacClient(session.request, await session.cookie(OPAC_BASE_URL, "jwt")).hasSession();
  }),
};

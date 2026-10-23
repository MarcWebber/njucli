import { NjuOpacClient } from "../../../skills/njucli-library/scripts/client.js";
import { OPAC_LOGIN_URL } from "../../../skills/njucli-library/scripts/contract.js";
import { withBrowserSession } from "../browser-session.js";
import type { AuthSessionDriver } from "../types.js";
import { opacTransport } from "../opac-transport.js";
import { campusVpnUrl } from "../webvpn.js";
import { AppError } from "../../core/errors.js";

export const opacSessionDriver: AuthSessionDriver = {
  probe: (account) => withBrowserSession(account, true, async (session) => {
    const transport = await opacTransport(session);
    return new NjuOpacClient(transport.request, await session.cookie(transport.site, "jwt")).hasSession();
  }),
  login: (account) => withBrowserSession(account, false, async (session) => {
    const transport = await opacTransport(session);
    const page = await session.page();
    const login = transport.vpn ? campusVpnUrl("http://opac.nju.edu.cn:8081/CASSSO2/caslogin.jsp").href : OPAC_LOGIN_URL;
    const hosts = [new URL(transport.site).hostname];
    if (transport.vpn) hosts.push(campusVpnUrl("http://opac.nju.edu.cn").hostname);
    await session.login(login, url => hosts.includes(url.hostname));
    const external = new URL(page.url()).hash.match(/^#\/loginExternal\/([^/]+)\/([^/?]+)/);
    const token = external?.[2] === "jwtOpacAuth" ? decodeURIComponent(external[1]!) : await session.cookie(transport.site, "jwt");
    if (token && external) {
      // The official CAS callback carries this token before the SPA stores it.
      await page.context().addCookies([{ name: "jwt", value: token, url: transport.site, sameSite: "Lax", secure: true }]);
    }
    if (!token) throw new AppError("AUTH_RESTORE_FAILED", "图书馆回调未返回读者票据");
    return new NjuOpacClient(transport.request, token).hasSession();
  }),
};

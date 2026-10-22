import type { BrowserSession } from "./browser-session.js";
import { createCampusVpnFetch, campusVpnUrl } from "./webvpn.js";
import { OPAC_BASE_URL } from "../../skills/njucli-library/scripts/contract.js";
import { AppError } from "../core/errors.js";

export async function opacTransport(session: BrowserSession) {
  try {
    const response = await session.request(OPAC_BASE_URL);
    const text = await response.text();
    if (response.ok && !text.includes("请使用南大VPN访问")) return { request: session.request, site: OPAC_BASE_URL, vpn: false };
  } catch { /* A protected VPN route uses its own valid TLS endpoint. */ }
  const site = campusVpnUrl(OPAC_BASE_URL).href;
  const response = await session.request(site);
  if (!response.ok || new URL(response.url).hostname !== new URL(site).hostname)
    throw new AppError("VPN_REQUIRED", "请先登录南大 VPN 后访问图书馆", { details: { url: "https://vpn.nju.edu.cn/" } });
  return { request: createCampusVpnFetch(session.request, ["opac.nju.edu.cn"]), site, vpn: true };
}

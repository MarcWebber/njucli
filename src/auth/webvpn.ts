import { AppError } from "../core/errors.js";
import type { FetchLike } from "../core/types.js";

/** URL encoding used by the current official ALLWEB portal. */
export function campusVpnUrl(input: string | URL): URL {
  const source = new URL(input);
  if (!["http:", "https:"].includes(source.protocol)
    || !(source.hostname === "nju.edu.cn" || source.hostname.endsWith(".nju.edu.cn")))
    throw new AppError("INVALID_INPUT", "校园 VPN 仅接受南京大学 HTTP/HTTPS 地址");
  let hostname = source.hostname.replace(/-/g, "--").replace(/\./g, "-");
  if (source.port) hostname += `-${source.port}-p`;
  if (source.protocol === "https:") hostname += "-s";
  const target = new URL(`https://${hostname}.atrust.nju.edu.cn`);
  target.pathname = source.pathname;
  target.search = source.search;
  target.hash = source.hash;
  return target;
}

/** Route only the selected business hosts, retaining their original response URL. */
export function createCampusVpnFetch(request: FetchLike, hosts: readonly string[]): FetchLike {
  const routed = new Set(hosts);
  return async (input, init) => {
    const source = new URL(input);
    if (!routed.has(source.hostname)) return request(input, init);
    const target = campusVpnUrl(source);
    const response = await request(target, init);
    const landed = new URL(response.url);
    if (landed.origin !== target.origin) return response;
    landed.protocol = source.protocol;
    landed.host = source.host;
    return { ...response, url: landed.href };
  };
}

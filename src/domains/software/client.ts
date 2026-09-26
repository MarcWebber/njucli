import { load } from "cheerio";

import { AppError } from "../../core/errors.js";
import { saveFile } from "../../core/fs.js";

const CATALOG = "https://itsc.nju.edu.cn/zbrj/list.htm";
const ADOBE_OFFLINE = "https://itsc.nju.edu.cn/0e/53/c50138a593491/page.htm";
const ADOBE_CC = "https://helpx.adobe.com/cn/download-install/apps/download-install-apps/creative-cloud-apps/download-creative-cloud-desktop-app-using-direct-links.html";

export class SoftwareClient {
  async list(query = "") {
    const $ = load(await (await this.request(CATALOG)).text());
    const items = $(".wp_listcolumn > .wp_column > a").toArray().slice(1).map((a) => {
      const name = $(a).text().trim();
      return {
        id: name.replace(/^微软/, "").toLowerCase().replace(/\s+/g, "-"),
        name,
        url: new URL($(a).attr("href")!, CATALOG).href,
      };
    });
    if (!items.length) throw new Error("官方软件目录为空，请核对页面结构");
    items.push({ id: "adobe-cc", name: "Adobe Creative Cloud（在线安装入口）", url: ADOBE_CC });
    const keyword = query.trim().toLowerCase();
    return items.filter((item) => `${item.id} ${item.name}`.toLowerCase().includes(keyword));
  }

  async show(id: string) {
    const item = (await this.list()).find((entry) => entry.id === id);
    if (!item) throw new AppError("NOT_FOUND", "软件 ID 不存在，请从 software list 选择");
    const pages = id === "adobe" ? [item.url, ADOBE_OFFLINE] : [item.url];
    const links = new Map<string, { name: string; url: string }>();
    for (const url of pages) {
      const $ = load(await (await this.request(url)).text());
      for (const a of $(".wp_articlecontent a[href], table.dexter-Table a[href]").toArray()) {
        const name = $(a).text().trim();
        const target = new URL($(a).attr("href")!, url);
        if (name && /^https?:$/.test(target.protocol)) links.set(target.href, { name, url: target.href });
      }
    }
    const files = [...links.values()].filter((link) => {
      const url = new URL(link.url);
      return url.protocol === "https:" && ["download.nju.edu.cn", "ccmdl.adobe.com", "ccmdls.adobe.com"].includes(url.hostname);
    }).map((link) => ({ ...link, id: decodeURIComponent(new URL(link.url).pathname.split("/").slice(-2).join("/")) }));
    return { ...item, links: [...links.values()].filter((link) => !files.some((file) => file.url === link.url)), files };
  }

  async download(id: string, fileId: string, output: string) {
    const file = (await this.show(id)).files.find((entry) => entry.id === fileId);
    if (!file) throw new AppError("NOT_FOUND", "安装包 ID 不存在，请从 software show 的 files 选择");
    const response = await this.request(file.url);
    if (!response.body || response.headers.get("content-type")?.includes("text/html")) {
      throw new Error("下载入口返回页面而非安装包，请按官方说明连接校园网或 VPN");
    }
    return saveFile(output, response.body);
  }

  private async request(url: string) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`软件下载服务返回 HTTP ${response.status}`);
    return response;
  }
}

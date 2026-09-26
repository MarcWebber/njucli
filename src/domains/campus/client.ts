import { load } from "cheerio";
import { AppError } from "../../core/errors.js";
import type { FetchLike } from "../../core/types.js";
import type { CampusSectionContract, CampusSourceContract } from "./contracts.js";
import { decodeArticleId, schemaChanged } from "./parser-utils.js";
import { getCampusSourceContract } from "./sources/registry.js";
import type {
  CampusArticle,
  CampusArticlePage,
  CampusCanteenDirectory,
} from "./types.js";

export class CampusClient {
  constructor(private readonly fetch: FetchLike) {}

  async canteens(query = ""): Promise<CampusCanteenDirectory> {
    const url = new URL("https://www.nju.edu.cn/xyfw/hqfw.htm");
    const $ = load(await this.fetchHtml(url, getCampusSourceContract("nju"), false));
    const department = $("td[rowspan]").filter((_, cell) => $(cell).text().trim() === "膳食中心");
    const count = Number(department.attr("rowspan"));
    if (department.length !== 1 || !Number.isInteger(count) || count < 1) {
      throw schemaChanged("nju", "canteens", "膳食中心表格");
    }
    const rows = department.parent().nextAll("tr").slice(0, count - 1);
    const items = rows.toArray().flatMap((row) => {
      const cells = $(row).children("td");
      const name = cells.eq(0).text().trim();
      if (!name.endsWith("食堂")) return [];
      const phone = cells.eq(1).text().trim();
      if (cells.length !== 2 || !phone) throw schemaChanged("nju", "canteens", "食堂名称和电话");
      return [{ name, phone }];
    });
    if (items.length === 0) throw schemaChanged("nju", "canteens", "学生食堂条目");
    return { sourceUrl: url.toString(), items: items.filter((item) => item.name.includes(query.trim())) };
  }

  async articles(source: string, sectionId: string, page = 1): Promise<CampusArticlePage> {
    const contract = getCampusSourceContract(source);
    const section = getSection(contract, sectionId);
    const requestUrl = section.listUrl(page);
    const html = await this.fetchHtml(requestUrl, contract, false);
    return contract.parser.parseArticles(html, {
      source: contract,
      section,
      requestUrl,
      page,
    });
  }

  async article(source: string, sectionId: string, articleId: string): Promise<CampusArticle> {
    const contract = getCampusSourceContract(source);
    const section = getSection(contract, sectionId);
    const requestUrl = decodeArticleId(articleId, contract, section.id);

    const html = await this.fetchHtml(requestUrl, contract, true);
    return contract.parser.parseArticle(html, {
      source: contract,
      articleId,
      requestUrl,
    });
  }

  private async fetchHtml(
    requestUrl: URL,
    contract: CampusSourceContract,
    notFoundIsKnown: boolean,
  ): Promise<string> {
    const response = await this.fetch(requestUrl, {
      method: "GET",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "njucli/0.1 (+https://www.nju.edu.cn/)",
      },
    });

    if (new URL(response.url).hostname === "authserver.nju.edu.cn") {
      throw new AppError("AUTH_REQUIRED", `${contract.name} 的该内容需要统一认证登录`, {
        details: { source: contract.id, url: requestUrl.href },
      });
    }
    if (!response.ok) {
      if (notFoundIsKnown && response.status === 404) {
        throw new AppError("NOT_FOUND", "没有找到该校园文章", {
          details: { source: contract.id, status: response.status },
        });
      }
      throw new Error(`${contract.name} 返回 HTTP ${response.status}`);
    }

    const html = await response.text();
    if (html.includes("您当前ip并非校内地址")) {
      throw new AppError("VPN_REQUIRED", `${contract.name} 的该内容仅允许校内网络访问`, {
        hint: "连接南京大学校园网或官方 VPN 后重试",
        details: { source: contract.id },
      });
    }
    return html;
  }
}

function getSection(contract: CampusSourceContract, sectionId: string): CampusSectionContract {
  const section = contract.sections.find((section) => section.id === sectionId);
  if (!section) {
    throw new AppError("INVALID_INPUT", `${contract.id} 不支持栏目 ${sectionId}`, {
      details: { allowed: contract.sections.map((section) => section.id) },
    });
  }
  return section;
}

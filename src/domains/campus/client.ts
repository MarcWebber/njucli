import { AppError } from "../../core/errors.js";
import type { FetchLike, FetchResponse } from "../../core/types.js";
import { parseUrl } from "../../core/url.js";
import type { CampusSectionContract, CampusSourceContract } from "./contracts.js";
import { decodeArticleId, schemaChanged } from "./parser-utils.js";
import { getCampusSourceContract } from "./sources/registry.js";
import type {
  CampusArticle,
  CampusArticlePage,
} from "./types.js";

export class CampusClient {
  constructor(private readonly fetch: FetchLike) {}

  async articles(source: string, sectionId: string, page = 1): Promise<CampusArticlePage> {
    const contract = getCampusSourceContract(source);
    const section = getSection(contract, sectionId);
    const requestUrl = section.listUrl(page);
    const html = await this.fetchHtml(requestUrl, contract, false);
    const result = contract.parser.parseArticles(html, {
      source: contract.source,
      section,
      requestUrl,
      page,
    });
    for (const article of result.items) {
      const articleUrl = new URL(article.url);
      if (!contract.articlePathPattern.test(articleUrl.pathname)) {
        throw schemaChanged(contract.source.id, "article-list", "source article path");
      }
    }
    return result;
  }

  async article(source: string, sectionId: string, articleId: string): Promise<CampusArticle> {
    const contract = getCampusSourceContract(source);
    const section = getSection(contract, sectionId);
    const requestUrl = decodeArticleId(articleId, contract.source, section.id);
    if (!contract.articlePathPattern.test(requestUrl.pathname)) {
      throw new AppError("INVALID_INPUT", `文章 ID 不符合 ${contract.source.id} 的路径契约`);
    }

    const html = await this.fetchHtml(requestUrl, contract, true);
    return contract.parser.parseArticle(html, {
      source: contract.source,
      section,
      articleId,
      requestUrl,
    });
  }

  private async fetchHtml(
    requestUrl: URL,
    contract: CampusSourceContract,
    notFoundIsKnown: boolean,
  ): Promise<string> {
    let response: FetchResponse;
    try {
      response = await this.fetch(requestUrl, {
        method: "GET",
        headers: {
          accept: "text/html,application/xhtml+xml",
          "user-agent": "njucli/0.1 (+https://www.nju.edu.cn/)",
        },
      });
    } catch (cause) {
      throw new AppError("REMOTE_UNAVAILABLE", `${contract.source.name} 暂时不可访问`, {
        details: { source: contract.source.id, url: requestUrl.href },
        cause,
      });
    }

    assertResponseStayedOnSource(response, contract);
    if (response.status === 429) {
      throw new AppError("RATE_LIMITED", `${contract.source.name} 请求过于频繁`, {
        details: { source: contract.source.id, status: response.status },
      });
    }
    if (!response.ok) {
      if (notFoundIsKnown && response.status === 404) {
        throw new AppError("NOT_FOUND", "没有找到该校园文章", {
          details: { source: contract.source.id, status: response.status },
        });
      }
      throw new AppError("REMOTE_UNAVAILABLE", `${contract.source.name} 返回 HTTP ${response.status}`, {
        details: { source: contract.source.id, status: response.status },
      });
    }

    let html: string;
    try {
      html = await response.text();
    } catch (cause) {
      throw new AppError("REMOTE_UNAVAILABLE", `${contract.source.name} 响应读取失败`, { cause });
    }
    if (html.includes("您当前ip并非校内地址")) {
      throw new AppError("VPN_REQUIRED", `${contract.source.name} 的该内容仅允许校内网络访问`, {
        hint: "连接南京大学校园网或官方 VPN 后重试",
        details: { source: contract.source.id },
      });
    }
    return html;
  }
}

function getSection(contract: CampusSourceContract, sectionId: string): CampusSectionContract {
  const section = contract.sections.get(sectionId);
  if (!section) {
    throw new AppError("INVALID_INPUT", `${contract.source.id} 不支持栏目 ${sectionId}`, {
      details: { allowed: [...contract.sections.keys()] },
    });
  }
  return section;
}

function assertResponseStayedOnSource(
  response: FetchResponse,
  contract: CampusSourceContract,
): void {
  const responseUrl = parseUrl(response.url);
  if (!responseUrl) {
    throw new AppError("REMOTE_UNAVAILABLE", `${contract.source.name} 返回了无效响应地址`);
  }
  if (responseUrl.protocol !== "https:" || responseUrl.host !== new URL(contract.source.origin).host) {
    throw new AppError("REMOTE_UNAVAILABLE", `${contract.source.name} 将请求重定向到了非允许站点`, {
      details: { source: contract.source.id, redirectedHost: responseUrl.hostname },
    });
  }
}

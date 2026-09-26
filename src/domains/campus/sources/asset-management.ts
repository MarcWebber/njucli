import { AppError } from "../../../core/errors.js";
import type { ArticleListParserContext } from "../contracts.js";
import {
  encodeArticleId,
  parseHtmlArticle,
  parsePublishedOn,
  resolveListedArticleUrl,
  schemaChanged,
} from "../parser-utils.js";
import { defineCampusSource } from "../source-definition.js";
import type { CampusArticlePage, CampusArticleSummary } from "../types.js";

const firstPage = "https://zcc.nju.edu.cn/sy/tzzhxx/index.html";

export const assetManagementSource = defineCampusSource({
  id: "asset-management",
  name: "南京大学资产管理处",
  origin: "https://zcc.nju.edu.cn",
  sections: [
    {
      id: "notifications",
      name: "通知公告",
      path: "/sy/tzzhxx/index.html",
      listUrl: () => new URL(firstPage),
    },
  ],
  parser: {
    parseArticles: parseAssetArticles,
    parseArticle: (html, context) =>
      parseHtmlArticle(html, context, {
        title: ".content h2.title",
        date: ".content .msg .time",
        publisher: "meta[name='ContentSource']",
        body: ".content .words#word",
      }),
  },
});

function parseAssetArticles(html: string, context: ArticleListParserContext): CampusArticlePage {
  const pages = parseAssignedJson(html, "var dataList=", "var pagesData=") as {
    infolist: { title: string; url: string; daytime: string }[];
  }[];
  const embeddedPageCount = pages.length;
  const pageData = pages[context.page - 1];
  if (!pageData) {
    throw new AppError("INVALID_INPUT", `asset-management 页面只公开了前 ${embeddedPageCount} 页数据`);
  }
  const { pageTotal } = parseAssignedJson(html, "var pagesData=", "var pageTotal=") as { pageTotal: number };
  const items: CampusArticleSummary[] = [];
  pageData.infolist.forEach((raw) => {
    const articleUrl = resolveListedArticleUrl(raw.url, context.requestUrl, context.source);
    if (!articleUrl) return;
    items.push({
      articleId: encodeArticleId("asset-management", context.section.id, articleUrl),
      title: raw.title.replace(/\s+/g, " ").trim(),
      publishedOn: parsePublishedOn(raw.daytime, "asset-management", "article-list"),
      url: articleUrl.href,
    });
  });

  return {
    items,
    nextPage: context.page < Math.min(pageTotal, embeddedPageCount) ? context.page + 1 : null,
  };
}

function parseAssignedJson(html: string, startMarker: string, endMarker: string): unknown {
  const start = html.indexOf(startMarker);
  const end = start < 0 ? -1 : html.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw schemaChanged("asset-management", "article-list", startMarker);
  const serialized = html.slice(start + startMarker.length, end).replace(/;\s*$/, "").trim();
  return JSON.parse(serialized) as unknown;
}

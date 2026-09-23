import { load, type CheerioAPI } from "cheerio";

import { AppError } from "../../core/errors.js";
import { parseUrl } from "../../core/url.js";
import type {
  ArticleListParserContext,
  ArticleParserContext,
  CampusSourceParser,
} from "./contracts.js";
import type {
  CampusArticle,
  CampusArticlePage,
  CampusArticleSummary,
  CampusAttachment,
  CampusSource,
  CampusSourceId,
} from "./types.js";

const DATE_PATTERN = /(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})日?/;
const ATTACHMENT_PATH_PATTERN = /(?:\/_upload\/article\/|\/__local\/|\/DFS\/file\/)/i;
const ATTACHMENT_EXTENSION_PATTERN = /\.(?:pdf|docx?|xlsx?|pptx?|zip|rar)(?:$|[?#])/i;

interface HtmlListSelectors {
  container: string;
  item: string;
  link: string;
  title?: string;
  titleRemove?: string;
  date: string;
  next?: string;
  readDate?: (item: ReturnType<CheerioAPI>) => string;
}

interface HtmlArticleSelectors {
  title: string;
  date: string;
  body: string;
  publisher?: string;
}

interface HtmlParserSelectors {
  list: HtmlListSelectors;
  article: HtmlArticleSelectors;
}

export function createHtmlSourceParser(selectors: HtmlParserSelectors): CampusSourceParser {
  return {
    parseArticles(html, context) {
      return parseHtmlArticleList(html, context, selectors.list);
    },
    parseArticle(html, context) {
      return parseHtmlArticle(html, context, selectors.article);
    },
  };
}

export const standardWebPlusParser = createHtmlSourceParser({
  list: {
    container: ".col_news_list ul.news_list",
    item: "li.news",
    link: ".news_title a",
    date: ".news_meta",
    next: ".wp_paging a.next[href]",
  },
  article: {
    title: "h1.arti_title",
    date: ".arti_metas .arti_update",
    publisher: ".arti_metas .arti_publisher",
    body: ".wp_articlecontent",
  },
});

function parseHtmlArticleList(
  html: string,
  context: ArticleListParserContext,
  selectors: HtmlListSelectors,
): CampusArticlePage {
  const $ = load(html);
  const container = $(selectors.container).first();
  if (container.length === 0) {
    throw schemaChanged(context.source.id, "article-list", "list container");
  }

  const items: CampusArticleSummary[] = [];
  container.find(selectors.item).each((index, element) => {
    const item = $(element);
    const link = item.find(selectors.link).first();
    const href = link.attr("href")?.trim();
    const titleElement = selectors.title ? item.find(selectors.title).first() : link;
    const titleClone = titleElement.clone();
    if (selectors.titleRemove) titleClone.find(selectors.titleRemove).remove();
    const title = normalizeInlineText(titleElement.attr("title") ?? titleClone.text());
    const dateText = selectors.readDate
      ? selectors.readDate(item)
      : item.find(selectors.date).first().text();

    if (!href || !title) {
      throw schemaChanged(context.source.id, "article-list", `item ${index + 1} link`);
    }

    const articleUrl = resolveListedArticleUrl(href, context.requestUrl, context.source);
    if (!articleUrl) return;
    items.push({
      articleId: encodeArticleId(context.source.id, context.section.id, articleUrl),
      title,
      publishedOn: parsePublishedOn(dateText, context.source.id, "article-list"),
      url: articleUrl.href,
    });
  });

  const hasNext = selectors.next ? $(selectors.next).length > 0 : false;
  return {
    items,
    nextPage: hasNext ? context.page + 1 : null,
  };
}

export function parseHtmlArticle(
  html: string,
  context: ArticleParserContext,
  selectors: HtmlArticleSelectors,
): CampusArticle {
  const $ = load(html);
  const titleElement = $(selectors.title).first();
  const body = $(selectors.body).first();
  const dateElement = $(selectors.date).first();
  const title = normalizeInlineText(titleElement.text() || titleElement.attr("content") || "");

  if (!title) throw schemaChanged(context.source.id, "article-detail", "title");
  if (dateElement.length === 0) throw schemaChanged(context.source.id, "article-detail", "published date");
  if (body.length === 0) throw schemaChanged(context.source.id, "article-detail", "content container");

  const content = extractReadableText($, selectors.body);
  const publisherElement = selectors.publisher ? $(selectors.publisher).first() : null;
  const publisherText = publisherElement ? (publisherElement.attr("content") ?? publisherElement.text()) : "";
  return {
    articleId: context.articleId,
    title,
    publishedOn: parsePublishedOn(dateElement.attr("content") ?? dateElement.text(), context.source.id, "article-detail"),
    publisher: parsePublisher(publisherText),
    content,
    attachments: extractAttachments($, selectors.body, context),
    url: context.requestUrl.href,
  };
}

function normalizeInlineText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

export function parsePublishedOn(value: string, source: CampusSourceId, contract: string): string {
  const match = normalizeInlineText(value).match(DATE_PATTERN);
  if (!match?.[1] || !match[2] || !match[3]) {
    throw schemaChanged(source, contract, "published date");
  }
  const month = match[2].padStart(2, "0");
  const day = match[3].padStart(2, "0");
  const normalized = `${match[1]}-${month}-${day}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw schemaChanged(source, contract, "valid published date");
  }
  return normalized;
}

function resolveOfficialUrl(value: string, base: URL, source: CampusSource): URL {
  const url = parseUrl(value, base);
  if (!url) throw schemaChanged(source.id, "article-link", "valid URL");

  if (url.host !== new URL(source.origin).host) {
    throw schemaChanged(source.id, "article-link", "allowlisted host");
  }
  url.protocol = "https:";
  url.username = "";
  url.password = "";
  url.hash = "";
  return url;
}

export function resolveListedArticleUrl(
  value: string,
  base: URL,
  source: CampusSource,
): URL | null {
  const url = parseUrl(value, base);
  if (!url) throw schemaChanged(source.id, "article-link", "valid URL");
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw schemaChanged(source.id, "article-link", "HTTP URL");
  }
  if (url.host !== new URL(source.origin).host) return null;
  return resolveOfficialUrl(value, base, source);
}

export function encodeArticleId(source: CampusSourceId, section: string, url: URL): string {
  const path = `${url.pathname}${url.search}`;
  return `article:${source}:${section}:${Buffer.from(path, "utf8").toString("base64url")}`;
}

export function decodeArticleId(articleId: string, source: CampusSource, section: string): URL {
  const prefix = `article:${source.id}:${section}:`;
  if (!articleId.startsWith(prefix)) {
    throw new AppError("INVALID_INPUT", `文章 ID 不属于 source ${source.id}`);
  }

  const path = Buffer.from(articleId.slice(prefix.length), "base64url").toString("utf8");
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new AppError("INVALID_INPUT", "文章 ID 中的路径无效");
  }
  return new URL(path, source.origin);
}

export function schemaChanged(
  source: CampusSourceId,
  contract: string,
  missing: string,
): AppError {
  return new AppError("REMOTE_SCHEMA_CHANGED", `${source} 的页面结构与 ${contract} 契约不一致`, {
    details: { source, contract, missing },
  });
}

function parsePublisher(value: string): string | null {
  const publisher = normalizeInlineText(value)
    .replace(/^(?:发布者|作者|来源)\s*[：:]\s*/, "")
    .trim();
  return publisher || null;
}

function extractReadableText($: CheerioAPI, selector: string): string {
  const body = $(selector).first().clone();
  body.find("script, style, noscript").remove();
  body.find("br").replaceWith("\n");
  body.find("p, li, h1, h2, h3, h4, tr").each((_index, element) => {
    $(element).append("\n");
  });
  return body
    .text()
    .replace(/\u00a0/g, " ")
    .split(/\n+/)
    .map((line) => normalizeInlineText(line))
    .filter(Boolean)
    .join("\n");
}

function extractAttachments(
  $: CheerioAPI,
  bodySelector: string,
  context: ArticleParserContext,
): CampusAttachment[] {
  const attachments: CampusAttachment[] = [];
  const seen = new Set<string>();

  $(bodySelector)
    .first()
    .find("a[href]")
    .each((_index, element) => {
      const link = $(element);
      const href = link.attr("href")?.trim();
      if (!href || (!ATTACHMENT_PATH_PATTERN.test(href) && !ATTACHMENT_EXTENSION_PATTERN.test(href))) return;

      const url = resolveOfficialUrl(href, context.requestUrl, context.source);
      if (seen.has(url.href)) return;
      seen.add(url.href);

      const title = normalizeInlineText(link.attr("title") ?? link.text()) || decodeURIComponent(url.pathname.split("/").at(-1) ?? "附件");
      attachments.push({
        title,
        url: url.href,
      });
    });

  $(bodySelector)
    .first()
    .find("[pdfsrc]")
    .each((_index, element) => {
      const node = $(element);
      const href = node.attr("pdfsrc")?.trim();
      if (!href) return;
      const url = resolveOfficialUrl(href, context.requestUrl, context.source);
      if (seen.has(url.href)) return;
      seen.add(url.href);
      const title = normalizeInlineText(node.attr("id") ?? "") || decodeURIComponent(url.pathname.split("/").at(-1) ?? "附件");
      attachments.push({
        title,
        url: url.href,
      });
    });

  return attachments;
}

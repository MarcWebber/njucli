import type { CampusArticle, CampusArticlePage, CampusSource } from "./types.js";

const NONE = "无";

export function campusSourcesText(sources: CampusSource[]): string {
  return sources.map((source) => {
    const sections = source.sections.map((section) => section.id).join(", ");
    return `${source.id}\t${source.name}\t${sections}`;
  }).join("\n");
}

export function campusArticlesText(page: CampusArticlePage): string {
  if (page.items.length === 0)
    return NONE;
  return page.items.map((article) => `${article.publishedOn}\t${article.title}\t${article.articleId}`).join("\n");
}

export function campusArticleText(article: CampusArticle): string {
  const publisher = article.publisher === null ? "" : `\n发布方：${article.publisher}`;
  const attachments = article.attachments.length === 0
    ? ""
    : `\n附件：\n${article.attachments.map((item) => `- ${item.title}: ${item.url}`).join("\n")}`;
  return `${article.title}\n发布日期：${article.publishedOn}${publisher}\n${article.content}${attachments}`;
}

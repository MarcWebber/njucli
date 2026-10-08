import type {
  CampusArticle,
  CampusArticlePage,
  CampusSection,
  CampusSource,
} from "./types.js";

export interface ArticleListParserContext {
  source: CampusSource;
  section: CampusSection;
  requestUrl: URL;
  page: number;
}

export interface ArticleParserContext {
  source: CampusSource;
  articleId: string;
  requestUrl: URL;
}

export interface CampusSourceParser {
  parseArticles(html: string, context: ArticleListParserContext): CampusArticlePage;
  parseArticle(html: string, context: ArticleParserContext): CampusArticle;
}

export interface CampusSectionContract extends CampusSection {
  listUrl(page: number): URL;
}

export interface CampusSourceContract extends CampusSource {
  sections: CampusSectionContract[];
  parser: CampusSourceParser;
}

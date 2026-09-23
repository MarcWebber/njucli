export const CAMPUS_SOURCE_IDS = [
  "nju",
  "academic-affairs",
  "graduate-school",
  "graduate-admission",
  "itsc",
  "youth-league",
  "research",
  "asset-management",
] as const;

export type CampusSourceId = (typeof CAMPUS_SOURCE_IDS)[number];

export interface CampusSection {
  id: string;
  name: string;
  url: string;
}

export interface CampusSource {
  id: CampusSourceId;
  name: string;
  origin: string;
  sections: CampusSection[];
}

export interface CampusArticleSummary {
  articleId: string;
  title: string;
  publishedOn: string;
  url: string;
}

export interface CampusAttachment {
  title: string;
  url: string;
}

export interface CampusArticle extends CampusArticleSummary {
  publisher: string | null;
  content: string;
  attachments: CampusAttachment[];
}

export interface CampusArticlePage {
  items: CampusArticleSummary[];
  nextPage: number | null;
}
export interface CampusCanteenDirectory {
  sourceUrl: string;
  items: Array<{ name: string; phone: string }>;
}

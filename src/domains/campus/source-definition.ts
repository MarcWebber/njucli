import { AppError } from "../../core/errors.js";
import type {
  CampusSectionContract,
  CampusSourceContract,
  CampusSourceParser,
} from "./contracts.js";
import type { CampusSection, CampusSource, CampusSourceId } from "./types.js";

interface SectionDefinition {
  id: string;
  name: string;
  path: string;
  listUrl?: (page: number) => URL;
}

interface SourceDefinition {
  id: CampusSourceId;
  name: string;
  origin: string;
  sections: readonly SectionDefinition[];
  articlePathPattern: RegExp;
  parser: CampusSourceParser;
}

export function defineCampusSource(definition: SourceDefinition): CampusSourceContract {
  const origin = normalizeOrigin(definition.origin);
  const resolvedSections = definition.sections.map((section) => {
    const publicSection: CampusSection = {
      id: section.id,
      name: section.name,
      url: new URL(section.path, origin).href,
    };
    const contract: CampusSectionContract = {
      ...publicSection,
      listUrl: section.listUrl ?? ((page) => webPlusPageUrl(publicSection.url, page)),
    };
    return { publicSection, contract };
  });
  const source: CampusSource = {
    id: definition.id,
    name: definition.name,
    origin,
    sections: resolvedSections.map(({ publicSection }) => publicSection),
  };
  const sections = new Map(
    resolvedSections.map(({ publicSection, contract }) => [publicSection.id, contract]),
  );

  return {
    source,
    sections,
    articlePathPattern: definition.articlePathPattern,
    parser: definition.parser,
  };
}

function webPlusPageUrl(firstPageUrl: string, page: number): URL {
  assertPage(page);
  if (page === 1) return new URL(firstPageUrl);
  const url = new URL(firstPageUrl);
  if (!/\.htm$/.test(url.pathname)) {
    throw new AppError("INVALID_INPUT", "该栏目没有可用的分页 URL 契约");
  }
  url.pathname = url.pathname.replace(/\.htm$/, `${page}.htm`);
  return url;
}

export function firstPageOnly(firstPageUrl: string, page: number): URL {
  assertPage(page);
  if (page !== 1) {
    throw new AppError("INVALID_INPUT", "该栏目当前仅支持读取第一页");
  }
  return new URL(firstPageUrl);
}

export function sameDocumentForEmbeddedPages(firstPageUrl: string, page: number): URL {
  assertPage(page);
  return new URL(firstPageUrl);
}

function assertPage(page: number): void {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new AppError("INVALID_INPUT", "page 必须是大于等于 1 的整数");
  }
}

function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`Campus source must use HTTPS: ${value}`);
  return `${url.origin}/`;
}

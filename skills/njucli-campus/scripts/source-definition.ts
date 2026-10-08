import { AppError } from "../../../src/core/errors.js";
import type { CampusSourceContract } from "./contracts.js";

type SourceDefinition = Omit<CampusSourceContract, "sections"> & {
  sections: Array<{ id: string; name: string; path: string; listUrl?: (page: number) => URL }>;
};

export function defineCampusSource(definition: SourceDefinition): CampusSourceContract {
  const origin = `${new URL(definition.origin).origin}/`;
  return {
    ...definition,
    origin,
    sections: definition.sections.map(({ id, name, path, listUrl }) => {
      const url = new URL(path, origin).href;
      return { id, name, url, listUrl: listUrl ?? ((page) => webPlusPageUrl(url, page)) };
    }),
  };
}

function webPlusPageUrl(firstPageUrl: string, page: number): URL {
  const url = new URL(firstPageUrl);
  if (page !== 1) url.pathname = url.pathname.replace(/\.htm$/, `${page}.htm`);
  return url;
}

export function firstPageOnly(firstPageUrl: string, page: number): URL {
  if (page !== 1) throw new AppError("INVALID_INPUT", "该栏目当前仅支持读取第一页");
  return new URL(firstPageUrl);
}

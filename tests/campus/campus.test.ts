import { readFile } from "node:fs/promises";

import { describe, expect, it, vi } from "vitest";

import type { FetchLike, FetchResponse } from "../../src/core/types.js";
import { CampusClient } from "../../src/domains/campus/client.js";
import { listCampusSources } from "../../src/domains/campus/sources/registry.js";
import { CAMPUS_SOURCE_IDS, type CampusSourceId } from "../../src/domains/campus/types.js";

interface SourceCase {
  source: CampusSourceId;
  section: string;
  title: string;
  publishedOn: string;
  content: string;
  publisher: string | null;
  attachmentCount: number;
}

const sourceCases: SourceCase[] = [
  {
    source: "nju",
    section: "news",
    title: "我校召开巡视工作会议",
    publishedOn: "2026-09-04",
    content: "会议听取工作汇报。\n会议研究下一阶段安排。",
    publisher: "党委巡视工作办公室",
    attachmentCount: 0,
  },
  {
    source: "academic-affairs",
    section: "notifications",
    title: "秋季学期本科教务事项",
    publishedOn: "2026-08-21",
    content: "请同学们按时报到。\n下载附件",
    publisher: "本科生院",
    attachmentCount: 1,
  },
  {
    source: "graduate-school",
    section: "notifications",
    title: "研究生网上选课通知",
    publishedOn: "2026-08-31",
    content: "研究生选课按通知时间进行。",
    publisher: null,
    attachmentCount: 0,
  },
  {
    source: "graduate-admission",
    section: "master",
    title: "推荐免试研究生报名通知",
    publishedOn: "2026-08-05",
    content: "报名材料应当真实、准确。",
    publisher: "研究生招生办公室",
    attachmentCount: 0,
  },
  {
    source: "itsc",
    section: "notifications",
    title: "校园网出口调整通知",
    publishedOn: "2026-08-31",
    content: "调整期间网络可能短时中断。",
    publisher: "信息化中心",
    attachmentCount: 0,
  },
  {
    source: "youth-league",
    section: "notifications",
    title: "研究生支教团选拔通知",
    publishedOn: "2026-09-03",
    content: "报名安排详见通知正文。",
    publisher: "校团委",
    attachmentCount: 0,
  },
  {
    source: "research",
    section: "notifications",
    title: "科研项目申报通知",
    publishedOn: "2026-07-08",
    content: "",
    publisher: null,
    attachmentCount: 1,
  },
  {
    source: "asset-management",
    section: "notifications",
    title: "研究生新生宿舍查询通知",
    publishedOn: "2026-08-16",
    content: "新生可在网上办事大厅查询宿舍。\n查询指南.pdf",
    publisher: "资产管理处",
    attachmentCount: 1,
  },
];

describe("campus public sources", () => {
  it("exposes exactly the design allowlist and explicit HTTPS sections", () => {
    const sources = listCampusSources();

    expect(sources.map((source) => source.id)).toEqual(CAMPUS_SOURCE_IDS);
    expect(sources).toHaveLength(8);
    for (const source of sources) {
      expect(new URL(source.origin).protocol).toBe("https:");
      expect(source.sections.length).toBeGreaterThan(0);
      for (const section of source.sections) {
        expect(new URL(section.url).hostname).toBe(new URL(source.origin).hostname);
      }
    }
  });

  it.each(sourceCases)("parses $source list and detail through its fixed contract", async (sourceCase) => {
    const listHtml = await fixture(`${sourceCase.source}-articles.html`);
    const detailHtml = await fixture(`${sourceCase.source}-article.html`);
    const fetch = vi.fn<FetchLike>(async (input) => {
      const url = input.toString();
      const html = fetch.mock.calls.length === 1 ? listHtml : detailHtml;
      return htmlResponse(url, html);
    });
    const useCases = new CampusClient(fetch);

    const page = await useCases.articles(sourceCase.source, sourceCase.section);
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      title: sourceCase.title,
      publishedOn: sourceCase.publishedOn,
    });
    expect(page.items[0]?.articleId).toMatch(
      new RegExp(`^article:${sourceCase.source}:${sourceCase.section}:`),
    );
    expect(new URL(page.items[0]?.url ?? "").protocol).toBe("https:");

    const article = await useCases.article(
      sourceCase.source,
      sourceCase.section,
      page.items[0]?.articleId ?? "",
    );
    expect(article).toMatchObject({
      title: sourceCase.title,
      publishedOn: sourceCase.publishedOn,
      content: sourceCase.content,
      publisher: sourceCase.publisher,
    });
    expect(article.attachments).toHaveLength(sourceCase.attachmentCount);
    for (const attachment of article.attachments) {
      expect(new URL(attachment.url).protocol).toBe("https:");
    }
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("uses each source's deterministic page URL without probing alternatives", async () => {
    const html = await fixture("academic-affairs-articles.html");
    const fetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), html));
    const useCases = new CampusClient(fetch);

    await useCases.articles("academic-affairs", "notifications", 2);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0].toString()).toBe("https://jw.nju.edu.cn/ggtz/list2.htm");
  });

  it("reads a later embedded asset page without a second client or request", async () => {
    const html = await fixture("asset-management-articles.html");
    const fetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), html));
    const useCases = new CampusClient(fetch);

    const page = await useCases.articles("asset-management", "notifications", 2);

    expect(page.items[0]?.title).toBe("第二页公告");
    expect(page.nextPage).toBeNull();
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("accepts a present but empty list container", async () => {
    const html = await fixture("empty-articles.html");
    const useCases = new CampusClient(async (input) => htmlResponse(input.toString(), html));

    const page = await useCases.articles("academic-affairs", "notifications");

    expect(page.items).toEqual([]);
  });

  it("rejects unknown sources and sections before network access", async () => {
    const fetch = vi.fn<FetchLike>();
    const useCases = new CampusClient(fetch);

    await expect(useCases.articles("unknown", "notifications")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(useCases.articles("itsc", "unknown")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("fails clearly on schema drift after one request", async () => {
    const html = await fixture("schema-drift.html");
    const fetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), html));
    const useCases = new CampusClient(fetch);

    await expect(useCases.articles("itsc", "notifications")).rejects.toMatchObject({
      code: "REMOTE_SCHEMA_CHANGED",
      details: { source: "itsc", contract: "article-list" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("counts and skips cross-host list entries without following them", async () => {
    const html = await fixture("academic-affairs-articles.html");
    const fetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), html));
    const useCases = new CampusClient(fetch);

    const page = await useCases.articles("academic-affairs", "notifications");

    expect(page.items).toHaveLength(1);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects cross-source article IDs without fetching", async () => {
    const html = await fixture("academic-affairs-articles.html");
    const firstFetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), html));
    const page = await new CampusClient(firstFetch).articles("academic-affairs", "notifications");
    const detailFetch = vi.fn<FetchLike>();

    await expect(
      new CampusClient(detailFetch).article(
        "itsc",
        "notifications",
        page.items[0]?.articleId ?? "",
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(detailFetch).not.toHaveBeenCalled();
  });

  it("rejects an off-allowlist redirect", async () => {
    const html = await fixture("itsc-articles.html");
    const useCases = new CampusClient(async () => htmlResponse("https://example.com/login", html));

    await expect(useCases.articles("itsc", "notifications")).rejects.toMatchObject({
      code: "REMOTE_UNAVAILABLE",
    });
  });

  it("maps network and rate-limit failures to stable errors", async () => {
    const networkFailure = new CampusClient(async () => {
      throw new Error("offline");
    });
    await expect(networkFailure.articles("itsc", "notifications")).rejects.toMatchObject({
      code: "REMOTE_UNAVAILABLE",
    });

    const rateLimited = new CampusClient(async (input) => htmlResponse(input.toString(), "", 429));
    await expect(rateLimited.articles("itsc", "notifications")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });

  it("reports an explicit VPN requirement for campus-network-only articles", async () => {
    const listHtml = await fixture("youth-league-articles.html");
    const denialHtml = await fixture("campus-network-required.html");
    const listFetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), listHtml));
    const page = await new CampusClient(listFetch).articles("youth-league", "notifications");
    const detailFetch = vi.fn<FetchLike>(async (input) => htmlResponse(input.toString(), denialHtml));

    await expect(
      new CampusClient(detailFetch).article(
        "youth-league",
        "notifications",
        page.items[0]?.articleId ?? "",
      ),
    ).rejects.toMatchObject({ code: "VPN_REQUIRED" });
    expect(detailFetch).toHaveBeenCalledOnce();
  });

  it("does not guess main-site reverse pagination URLs", async () => {
    const fetch = vi.fn<FetchLike>();
    const useCases = new CampusClient(fetch);

    await expect(useCases.articles("nju", "news", 2)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

function unusedFetch(): FetchLike {
  return async () => {
    throw new Error("network access is not expected");
  };
}

function htmlResponse(url: string, html: string, status = 200): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => html,
  };
}

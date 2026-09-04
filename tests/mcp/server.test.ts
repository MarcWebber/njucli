import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NjuServices } from "../../src/app/services.js";
import { AppError } from "../../src/core/errors.js";
import { createMcpServer } from "../../src/mcp/server.js";

const connections: Array<{
  client: Client;
  server: ReturnType<typeof createMcpServer>;
}> = [];

afterEach(async () => {
  const pending = connections.splice(0);
  await Promise.allSettled(pending.map(({ client }) => client.close()));
  await Promise.allSettled(pending.map(({ server }) => server.close()));
});

describe("NjuCLI MCP server", () => {
  it("exposes only the nine intended read-only tools", async () => {
    const { client } = await connect(createFakeServices());
    const result = await client.listTools();

    expect(result.tools.map(({ name }) => name).sort()).toEqual([
      "campus_articles",
      "course_next",
      "course_today",
      "course_week",
      "library_holdings",
      "library_search",
      "nju_today",
      "sports_slots",
      "sports_venues",
    ]);
    for (const tool of result.tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      });
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it("routes every tool to the shared service with validated arguments", async () => {
    const services = createFakeServices();
    const { client } = await connect(services);
    const calls = [
      ["course_today", { date: "2026-09-04", termId: "2026-1" }, { kind: "course-today" }],
      ["course_week", { date: "tomorrow", termId: "2026-1" }, { kind: "course-week" }],
      ["course_next", { termId: "2026-1" }, { kind: "course-next" }],
      [
        "library_search",
        { query: "算法", field: "title", page: 2, pageSize: 10 },
        { kind: "library-search" },
      ],
      ["library_holdings", { bookId: "bib-1" }, { kind: "library-holdings" }],
      ["sports_venues", { sportTypeId: "7" }, { kind: "sports-venues" }],
      [
        "sports_slots",
        { venueSiteId: "site-1", date: "2026-09-05" },
        { kind: "sports-slots" },
      ],
      [
        "campus_articles",
        { source: "nju", section: "news", page: 3 },
        { kind: "campus-articles" },
      ],
      ["nju_today", { date: "2026-09-04" }, { kind: "nju-today" }],
    ] as const;

    for (const [name, args, expected] of calls) {
      const result = await client.callTool({ name, arguments: args });
      expect(result.isError).not.toBe(true);
      expect(result.structuredContent).toEqual({ data: expected });
      expect(JSON.parse(textContent(result))).toEqual({ ok: true, data: expected });
    }

    expect(services.course.today).toHaveBeenCalledWith("2026-09-04", "2026-1");
    expect(services.course.week).toHaveBeenCalledWith("tomorrow", "2026-1");
    expect(services.course.next).toHaveBeenCalledWith("2026-1");
    expect(services.library.search).toHaveBeenCalledWith("算法", "title", 2, 10);
    expect(services.library.holdings).toHaveBeenCalledWith("bib-1");
    expect(services.sports.venues).toHaveBeenCalledWith("7");
    expect(services.sports.slots).toHaveBeenCalledWith("site-1", "2026-09-05");
    expect(services.campus.articles).toHaveBeenCalledWith("nju", "news", 3);
    expect(services.today).toHaveBeenCalledWith("2026-09-04");
  });

  it("rejects invalid input before a service call", async () => {
    const services = createFakeServices();
    const { client } = await connect(services);

    const result = await client.callTool({
      name: "library_search",
      arguments: { query: "", page: 0 },
    });

    expect(result.isError).toBe(true);
    expect(services.library.search).not.toHaveBeenCalled();
  });

  it("preserves application error codes in tool errors", async () => {
    const services = createFakeServices();
    services.course.today = vi.fn(async () => {
      throw new AppError("AUTH_REQUIRED", "需要登录", {
        hint: "先登录统一身份认证",
        authCommand: "njucli auth login sso",
      });
    });
    const { client } = await connect(services);

    const result = await client.callTool({ name: "course_today", arguments: {} });

    expect(result.isError).toBe(true);
    expect(JSON.parse(textContent(result))).toEqual({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "需要登录",
        hint: "先登录统一身份认证",
        auth_command: "njucli auth login sso",
      },
    });
  });
});

async function connect(services: NjuServices) {
  const server = createMcpServer(services);
  const client = new Client({ name: "njucli-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  connections.push({ client, server });
  return { client, server };
}

function textContent(result: Awaited<ReturnType<Client["callTool"]>>): string {
  if (!("content" in result)) throw new Error("Expected a direct tool result");
  const item = result.content[0];
  if (item?.type !== "text") throw new Error("Expected text content");
  return item.text;
}

function createFakeServices(): NjuServices {
  return {
    account: {
      current: vi.fn(),
      list: vi.fn(),
      add: vi.fn(),
      use: vi.fn(),
      remove: vi.fn(),
    },
    auth: {
      capabilities: vi.fn(() => []),
      status: vi.fn(),
      login: vi.fn(),
      refresh: vi.fn(),
      logout: vi.fn(),
    },
    campus: {
      sources: vi.fn(() => []),
      articles: vi.fn(async () => ({ kind: "campus-articles" })) as NjuServices["campus"]["articles"],
      article: vi.fn(),
    },
    course: {
      terms: vi.fn(),
      currentTerm: vi.fn(),
      schedule: vi.fn(),
      today: vi.fn(async () => ({ kind: "course-today" })) as NjuServices["course"]["today"],
      week: vi.fn(async () => ({ kind: "course-week" })) as NjuServices["course"]["week"],
      next: vi.fn(async () => ({ kind: "course-next" })) as NjuServices["course"]["next"],
      export: vi.fn(),
    },
    library: {
      search: vi.fn(async () => ({ kind: "library-search" })) as NjuServices["library"]["search"],
      book: vi.fn(),
      holdings: vi.fn(async () => ({ kind: "library-holdings" })) as NjuServices["library"]["holdings"],
      loans: vi.fn(),
    },
    sports: {
      venues: vi.fn(async () => ({ kind: "sports-venues" })) as NjuServices["sports"]["venues"],
      venue: vi.fn(),
      slots: vi.fn(async () => ({ kind: "sports-slots" })) as NjuServices["sports"]["slots"],
      bookings: vi.fn(),
      booking: vi.fn(),
    },
    today: vi.fn(async () => ({ kind: "nju-today" })) as NjuServices["today"],
    doctor: vi.fn(),
  };
}

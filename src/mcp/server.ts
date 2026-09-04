import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import type { NjuServices } from "../app/services.js";
import { errorEnvelope } from "../core/output.js";
import { redact } from "../core/redaction.js";

const VERSION = "0.1.0";

const READ_ONLY_TOOL = {
  outputSchema: {
    data: z.unknown().describe("The result returned by the corresponding NjuCLI service"),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
} as const;

const CAMPUS_DATE = z
  .string()
  .min(1)
  .describe("Campus-local date: today, tomorrow, or YYYY-MM-DD");

const OPTIONAL_TERM = z
  .string()
  .min(1)
  .optional()
  .describe("Academic term ID; omit to use the current term");

export function createMcpServer(services: NjuServices): McpServer {
  const server = new McpServer({
    name: "njucli",
    version: VERSION,
  });

  server.registerTool(
    "course_today",
    {
      title: "Today's courses",
      description: "List the signed-in student's courses on one date.",
      inputSchema: {
        date: CAMPUS_DATE.optional(),
        termId: OPTIONAL_TERM,
      },
      ...READ_ONLY_TOOL,
    },
    ({ date, termId }) => mcpRead(() => services.course.today(date, termId)),
  );

  server.registerTool(
    "course_week",
    {
      title: "Weekly courses",
      description: "List the signed-in student's courses for the week containing a date.",
      inputSchema: {
        date: CAMPUS_DATE.optional(),
        termId: OPTIONAL_TERM,
      },
      ...READ_ONLY_TOOL,
    },
    ({ date, termId }) => mcpRead(() => services.course.week(date, termId)),
  );

  server.registerTool(
    "course_next",
    {
      title: "Next course",
      description: "Get the signed-in student's next scheduled course.",
      inputSchema: { termId: OPTIONAL_TERM },
      ...READ_ONLY_TOOL,
    },
    ({ termId }) => mcpRead(() => services.course.next(termId)),
  );

  server.registerTool(
    "library_search",
    {
      title: "Search the library catalog",
      description: "Search the NJU library catalog and report copy availability.",
      inputSchema: {
        query: z.string().min(1).describe("Title, author, ISBN, call number, or keywords"),
        field: z
          .enum(["all", "title", "author", "isbn", "callno"])
          .optional()
          .describe("Catalog field to search; omit for all fields"),
        page: z.number().int().min(1).optional().describe("One-based result page"),
        pageSize: z.number().int().min(1).max(100).optional().describe("Results per page"),
      },
      ...READ_ONLY_TOOL,
    },
    ({ query, field, page, pageSize }) =>
      mcpRead(() => services.library.search(query, field, page, pageSize)),
  );

  server.registerTool(
    "library_holdings",
    {
      title: "Library holdings",
      description: "List call numbers, locations, and availability for a catalog book.",
      inputSchema: {
        bookId: z.string().min(1).describe("Stable book ID returned by library_search"),
      },
      ...READ_ONLY_TOOL,
    },
    ({ bookId }) => mcpRead(() => services.library.holdings(bookId)),
  );

  server.registerTool(
    "sports_venues",
    {
      title: "Sports venues",
      description: "List NJU sports venues and reservable venue sites.",
      inputSchema: {
        sportTypeId: z.string().min(1).optional().describe("Optional numeric sport type ID"),
      },
      ...READ_ONLY_TOOL,
    },
    ({ sportTypeId }) => mcpRead(() => services.sports.venues(sportTypeId)),
  );

  server.registerTool(
    "sports_slots",
    {
      title: "Sports venue slots",
      description: "List current availability for one sports venue site and date.",
      inputSchema: {
        venueSiteId: z.string().min(1).describe("Venue-site ID returned by sports_venues"),
        date: CAMPUS_DATE,
      },
      ...READ_ONLY_TOOL,
    },
    ({ venueSiteId, date }) => mcpRead(() => services.sports.slots(venueSiteId, date)),
  );

  server.registerTool(
    "campus_articles",
    {
      title: "Campus announcements",
      description: "List announcements from one explicit NJU public source and section.",
      inputSchema: {
        source: z.string().min(1).describe("Source ID returned by the campus sources command"),
        section: z.string().min(1).describe("Section ID from that source"),
        page: z.number().int().min(1).optional().describe("One-based article page"),
      },
      ...READ_ONLY_TOOL,
    },
    ({ source, section, page }) =>
      mcpRead(() => services.campus.articles(source, section, page)),
  );

  server.registerTool(
    "nju_today",
    {
      title: "NJU daily overview",
      description: "Aggregate courses, library loans, and sports bookings for one date.",
      inputSchema: { date: CAMPUS_DATE.optional() },
      ...READ_ONLY_TOOL,
    },
    ({ date }) => mcpRead(() => services.today(date)),
  );

  return server;
}

export async function startMcpServer(services: NjuServices): Promise<McpServer> {
  const server = createMcpServer(services);
  await server.connect(new StdioServerTransport());
  return server;
}

async function mcpRead<T>(operation: () => Promise<T>) {
  try {
    const data = redact(await operation());
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ ok: true, data }, null, 2) }],
      structuredContent: { data },
    };
  } catch (error) {
    const payload = errorEnvelope(error);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
      isError: true as const,
    };
  }
}

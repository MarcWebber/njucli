import type { Command } from "commander";
import { describe, expect, it } from "vitest";

import type { NjuServices } from "../../src/app/services.js";
import { createCli } from "../../src/commands/index.js";
import type { CommandRuntime } from "../../src/core/command.js";

interface RecordedCall {
  method: string;
  args: unknown[];
}

interface Harness {
  program: Command;
  calls: RecordedCall[];
  stdout: string[];
  stderr: string[];
  exitCodes: number[];
}

function createHarness(environment: NodeJS.ProcessEnv = {}): Harness {
  const calls: RecordedCall[] = [];
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCodes: number[] = [];
  const account = "default";
  const session = {
    capability: "sso" as const,
    refreshAfter: null,
    status: "valid" as const,
  };
  const term = {
    id: "2026-1",
    name: "2026-2027-1",
    startsOn: "2026-09-01",
  };
  const occurrence = {
    occurrenceId: "occ-1",
    name: "操作系统",
    teachers: ["教师甲"],
    date: "2026-09-07",
    startTime: "08:00",
    endTime: "09:40",
    location: "仙林教学楼",
    campus: "仙林",
  };
  const book = {
    bookId: "book-1",
    title: "操作系统",
    author: "作者甲",
    callNumbers: ["TP316"],
    totalCopies: 2,
    availableCopies: 1,
  };
  const holding = {
    callNumber: "TP316",
    library: "仙林图书馆",
    location: "仙林图书馆三楼",
    shelfMark: "A-1",
    status: "可借",
    available: true,
  };
  const loan = {
    title: "操作系统",
    dueOn: "2026-09-30",
    overdue: false,
  };
  const venue = {
    siteId: "site-1",
    campus: "仙林",
    venue: "方肇周体育馆",
    name: "羽毛球场",
    sportId: "badminton",
    sport: "羽毛球",
    openStart: "08:00",
    openEnd: "22:00",
  };
  const booking = {
    bookingId: "booking-1",
    campus: "仙林",
    venue: "方肇周体育馆",
    site: "羽毛球场",
    reservationDate: "2026-09-07",
    status: "active" as const,
  };
  const asyncResult = <T>(method: string, value: T) => async (...args: unknown[]): Promise<T> => {
    calls.push({ method, args });
    return value;
  };
  const syncResult = <T>(method: string, value: T) => (...args: unknown[]): T => {
    calls.push({ method, args });
    return value;
  };

  const services = {
    account: {
      current: asyncResult("account.current", account),
      list: asyncResult("account.list", [account]),
      add: asyncResult("account.add", account),
      use: asyncResult("account.use", account),
      remove: asyncResult("account.remove", undefined),
    },
    auth: {
      capabilities: syncResult("auth.capabilities", ["sso"]),
      status: asyncResult("auth.status", [session]),
      login: asyncResult("auth.login", session),
      refresh: asyncResult("auth.refresh", [session]),
      logout: asyncResult("auth.logout", ["sso"]),
    },
    campus: {
      sources: syncResult("campus.sources", [{
        id: "nju",
        name: "南京大学",
        origin: "https://www.nju.edu.cn",
        sections: [{ id: "news", name: "新闻", url: "https://www.nju.edu.cn/news" }],
      }]),
      articles: asyncResult("campus.articles", {
        items: [],
        nextPage: null,
      }),
      article: asyncResult("campus.article", {
        articleId: "article-1",
        title: "校园新闻",
        publishedOn: "2026-09-04",
        url: "https://www.nju.edu.cn/article-1",
        publisher: "南京大学",
        content: "正文",
        attachments: [],
      }),
    },
    course: {
      terms: asyncResult("course.terms", [term]),
      currentTerm: asyncResult("course.currentTerm", term),
      schedule: asyncResult("course.schedule", { term, courses: [] }),
      today: asyncResult("course.today", [occurrence]),
      week: asyncResult("course.week", [occurrence]),
      next: asyncResult("course.next", occurrence),
      export: asyncResult("course.export", { path: "/tmp/schedule.ics", eventCount: 1 }),
    },
    library: {
      search: asyncResult("library.search", {
        total: 1,
        items: [book],
      }),
      book: asyncResult("library.book", { ...book, holdings: [holding] }),
      holdings: asyncResult("library.holdings", [holding]),
      loans: asyncResult("library.loans", [loan]),
    },
    sports: {
      venues: asyncResult("sports.venues", [venue]),
      venue: asyncResult("sports.venue", venue),
      slots: asyncResult("sports.slots", {
        date: "2026-09-07",
        slots: [],
      }),
      bookings: asyncResult("sports.bookings", [booking]),
      booking: asyncResult("sports.booking", booking),
    },
    today: asyncResult("today", {
      date: "2026-09-07",
      course: { ok: true, data: [occurrence] },
      library: { ok: true, data: [loan] },
      sports: { ok: true, data: [booking] },
    }),
    doctor: asyncResult("doctor", {
      account: "default",
      authCapabilities: ["sso"],
      checks: [{ name: "nju-home", ok: true, status: 200 }],
    }),
  } as unknown as NjuServices;

  const runtime: CommandRuntime = {
    environment,
    output: {
      stdout: (value) => stdout.push(value),
      stderr: (value) => stderr.push(value),
    },
    setExitCode: (code) => exitCodes.push(code),
  };
  const program = createCli(services, runtime);
  configureOutput(program, stdout, stderr);
  return { program, calls, stdout, stderr, exitCodes };
}

function configureOutput(command: Command, stdout: string[], stderr: string[]): void {
  command.configureOutput({
    writeOut: (value) => stdout.push(value),
    writeErr: (value) => stderr.push(value),
  });
  for (const child of command.commands) configureOutput(child, stdout, stderr);
}

async function run(harness: Harness, argv: string[]): Promise<void> {
  await harness.program.parseAsync(["node", "njucli", ...argv]);
}

describe("CLI command tree", () => {
  it("exposes stable domain-action commands", () => {
    const { program } = createHarness();
    const expected: Record<string, string[]> = {
      account: ["current", "list", "add", "use", "remove"],
      auth: ["status", "login", "refresh", "logout"],
      campus: ["sources", "articles", "article"],
      course: ["terms", "current-term", "schedule", "today", "week", "next", "export"],
      library: ["search", "book", "holdings", "loans"],
      sports: ["venues", "venue", "slots", "bookings", "booking"],
    };

    for (const [domain, leafNames] of Object.entries(expected)) {
      const group = program.commands.find((command) => command.name() === domain);
      expect(group, domain).toBeDefined();
      expect(group?.commands.map((command) => command.name())).toEqual(leafNames);
      for (const leaf of group?.commands ?? []) {
        expect(leaf.options.some((option) => option.long === "--format"), `${domain} ${leaf.name()}`).toBe(true);
      }
    }

    for (const name of ["today", "doctor"]) {
      const leaf = program.commands.find((command) => command.name() === name);
      expect(leaf?.options.some((option) => option.long === "--format")).toBe(true);
    }

    const mcp = program.commands.find((command) => command.name() === "mcp");
    expect(mcp).toBeDefined();
    expect(mcp?.options.some((option) => option.long === "--format")).toBe(false);
  });

  it("does not expose format, json, profile, or account routing at root", () => {
    const rootOptions = createHarness().program.options.map((option) => option.long);
    expect(rootOptions).not.toContain("--format");
    expect(rootOptions).not.toContain("--json");
    expect(rootOptions).not.toContain("--profile");
    expect(rootOptions).not.toContain("--account");
  });

  it("shows domain help instead of selecting an implicit action", async () => {
    const harness = createHarness();
    await run(harness, ["sports"]);
    expect(harness.calls).toEqual([]);
    expect(harness.stdout.join("")).toContain("Commands:");
    expect(harness.stdout.join("")).toContain("slots");
  });
});

describe("CLI service routing", () => {
  const cases: Array<{ argv: string[]; method: string; args: unknown[] }> = [
    { argv: ["account", "current"], method: "account.current", args: [] },
    { argv: ["account", "list"], method: "account.list", args: [] },
    { argv: ["account", "add", "second"], method: "account.add", args: ["second"] },
    { argv: ["account", "use", "second"], method: "account.use", args: ["second"] },
    { argv: ["account", "remove", "second", "--yes"], method: "account.remove", args: ["second"] },
    { argv: ["auth", "status"], method: "auth.status", args: [undefined] },
    { argv: ["auth", "login", "sports"], method: "auth.login", args: ["sports"] },
    { argv: ["auth", "refresh", "vpn"], method: "auth.refresh", args: ["vpn"] },
    { argv: ["auth", "logout", "opac"], method: "auth.logout", args: ["opac"] },
    { argv: ["campus", "sources"], method: "campus.sources", args: [] },
    {
      argv: ["campus", "articles", "--source", "nju", "--section", "news", "--page", "2"],
      method: "campus.articles",
      args: ["nju", "news", 2],
    },
    {
      argv: ["campus", "article", "article-1", "--source", "nju", "--section", "news"],
      method: "campus.article",
      args: ["nju", "news", "article-1"],
    },
    { argv: ["course", "terms"], method: "course.terms", args: [] },
    { argv: ["course", "current-term"], method: "course.currentTerm", args: [] },
    { argv: ["course", "schedule", "--term", "2026-1"], method: "course.schedule", args: ["2026-1"] },
    { argv: ["course", "today", "tomorrow", "--term", "2026-1"], method: "course.today", args: ["tomorrow", "2026-1"] },
    { argv: ["course", "week", "--term", "2026-1"], method: "course.week", args: [undefined, "2026-1"] },
    { argv: ["course", "next", "--term", "2026-1"], method: "course.next", args: ["2026-1"] },
    { argv: ["course", "export", "schedule.ics", "--term", "2026-1"], method: "course.export", args: ["schedule.ics", "2026-1"] },
    {
      argv: ["library", "search", "操作系统", "--field", "title", "--page", "1", "--page-size", "10"],
      method: "library.search",
      args: ["操作系统", "title", 1, 10],
    },
    { argv: ["library", "book", "book-1"], method: "library.book", args: ["book-1"] },
    { argv: ["library", "holdings", "book-1"], method: "library.holdings", args: ["book-1"] },
    { argv: ["library", "loans", "--page", "1", "--page-size", "10"], method: "library.loans", args: [1, 10] },
    { argv: ["sports", "venues", "--sport-id", "7"], method: "sports.venues", args: ["7"] },
    { argv: ["sports", "venue", "site-1"], method: "sports.venue", args: ["site-1"] },
    { argv: ["sports", "slots", "--venue-site", "site-1", "--date", "tomorrow"], method: "sports.slots", args: ["site-1", "tomorrow"] },
    { argv: ["sports", "bookings", "--page", "0", "--size", "10"], method: "sports.bookings", args: [0, 10] },
    { argv: ["sports", "booking", "booking-1"], method: "sports.booking", args: ["booking-1"] },
    { argv: ["today"], method: "today", args: [undefined] },
    { argv: ["doctor"], method: "doctor", args: [] },
  ];

  it("routes every leaf command through exactly one service path", async () => {
    for (const testCase of cases) {
      const harness = createHarness();
      await run(harness, [...testCase.argv, "--format", "json"]);
      expect(harness.calls).toEqual([{ method: testCase.method, args: testCase.args }]);
      expect(harness.exitCodes).toEqual([0]);
      expect(JSON.parse(harness.stdout.join(""))).toMatchObject({ ok: true });
    }
  });
});

describe("CLI output and validation", () => {
  it("renders one stable JSON envelope from a leaf command", async () => {
    const harness = createHarness();
    await run(harness, [
      "sports",
      "slots",
      "--venue-site",
      "site-1",
      "--date",
      "2026-09-07",
      "--format",
      "json",
    ]);
    expect(harness.stdout).toHaveLength(1);
    expect(JSON.parse(harness.stdout[0] ?? "")).toEqual({
      ok: true,
      data: {
        date: "2026-09-07",
        slots: [],
      },
    });
  });

  it("honors NJUCLI_FORMAT without adding a root option", async () => {
    const harness = createHarness({ NJUCLI_FORMAT: "json" });
    await run(harness, ["course", "terms"]);
    expect(JSON.parse(harness.stdout.join(""))).toMatchObject({ ok: true });
  });

  it("validates paging before calling the service", async () => {
    for (const paging of [["--page", "0"], ["--page-size", "0"]]) {
      const harness = createHarness();
      await run(harness, ["library", "loans", ...paging, "--format", "json"]);
      expect(harness.calls).toEqual([]);
      expect(harness.exitCodes).toEqual([2]);
      expect(JSON.parse(harness.stdout.join(""))).toMatchObject({
        ok: false,
        error: { code: "INVALID_INPUT" },
      });
    }
  });

  it("validates the sports type ID before calling the service", async () => {
    const harness = createHarness();
    await run(harness, ["sports", "venues", "--sport-id", "羽毛球", "--format", "json"]);
    expect(harness.calls).toEqual([]);
    expect(harness.exitCodes).toEqual([2]);
    expect(JSON.parse(harness.stdout.join(""))).toMatchObject({
      ok: false,
      error: { code: "INVALID_INPUT" },
    });
  });

  it("does not execute account removal without confirmation", async () => {
    const harness = createHarness();
    await run(harness, ["account", "remove", "second", "--format", "json"]);
    expect(harness.calls).toEqual([]);
    expect(harness.exitCodes).toEqual([4]);
    expect(JSON.parse(harness.stdout.join(""))).toMatchObject({
      ok: false,
      error: { code: "CONFIRMATION_REQUIRED" },
    });
  });

  it("rejects unsupported global output and profile flags", async () => {
    for (const flag of ["--json", "--profile"]) {
      const harness = createHarness();
      harness.program.exitOverride();
      await expect(run(harness, [flag])).rejects.toMatchObject({
        code: "commander.unknownOption",
      });
      expect(harness.calls).toEqual([]);
    }
  });
});

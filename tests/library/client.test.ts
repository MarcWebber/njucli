import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import type { FetchLike, FetchResponse } from "../../src/core/types.js";
import { NjuOpacClient } from "../../src/domains/library/client.js";

const fixtureRoot = new URL("./fixtures/", import.meta.url);

async function fixture(name: string): Promise<string> {
  return readFile(fileURLToPath(new URL(name, fixtureRoot)), "utf8");
}

function response(body: string, url: string, status = 200): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => body,
  };
}

describe("NjuOpacClient", () => {
  it("uses the fixed meta-local search request and maps stable fields", async () => {
    const body = await fixture("search.json");
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: FetchLike = async (input, init) => {
      calls.push(init === undefined ? { url: input.toString() } : { url: input.toString(), init });
      return response(body, input.toString());
    };

    const page = await new NjuOpacClient(fetch).search(" 操作系统 ", "title");

    expect(page).toEqual({
      total: 1,
      items: [{
        bookId: "m-book-1",
        title: "操作系统",
        author: "王老师 主编",
        callNumbers: ["TP316/1"],
        totalCopies: 2,
        availableCopies: 1,
      }],
    });
    expect(calls[0]?.url).toBe("https://opac.nju.edu.cn/meta-local/opac/search/");
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      queryFieldList: [{ logic: 0, field: "title", operator: "*", values: ["操作系统"] }],
      page: 1,
      pageSize: 20,
    });
  });

  it("returns precise holding location, call number, shelf and state", async () => {
    const body = await fixture("holdings.json");
    const fetch: FetchLike = async (input) => response(body, input.toString());

    const holdings = await new NjuOpacClient(fetch).holdings("m-book-1");

    expect(holdings).toEqual([
      {
        callNumber: "TP316/1",
        library: "仙林图书馆",
        location: "仙林图书馆三楼中文图书借阅区",
        shelfMark: "A-12-3",
        status: "可借",
        available: true,
      },
      expect.objectContaining({ status: "借出", available: false }),
    ]);
  });

  it("combines book metadata with holdings through one client", async () => {
    const [book, holdings] = await Promise.all([
      fixture("book.json"),
      fixture("holdings.json"),
    ]);
    const fetch: FetchLike = async (input) => response(
      input.toString().endsWith("/infos") ? book : holdings,
      input.toString(),
    );

    const detail = await new NjuOpacClient(fetch).book("m-book-1");

    expect(detail).toMatchObject({
      title: "操作系统",
      totalCopies: 2,
      availableCopies: 1,
      holdings: expect.any(Array),
    });
  });

  it("maps the authenticated loan list without exposing session data", async () => {
    const body = await fixture("loans.json");
    const fetch: FetchLike = async (input) => response(body, input.toString());

    const loans = await new NjuOpacClient(fetch).loans();

    expect(loans).toEqual([expect.objectContaining({
      dueOn: "2026-10-01",
      overdue: false,
    })]);
  });

  it("turns the observed off-campus gate into VPN_REQUIRED", async () => {
    const fetch: FetchLike = async (input) => response(
      "<title>请使用南大VPN访问!</title>",
      input.toString(),
      403,
    );

    await expect(new NjuOpacClient(fetch).search("操作系统")).rejects.toMatchObject({
      code: "VPN_REQUIRED",
    });
  });

  it("maps an OPAC business authentication response to the explicit login command", async () => {
    const fetch: FetchLike = async (input) => response(
      JSON.stringify({ code: 401, msg: "请登录", data: [] }),
      input.toString(),
    );

    await expect(new NjuOpacClient(fetch).loans()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      authCommand: "njucli auth login opac",
    });
  });

  it("distinguishes an authenticated-endpoint 403 from the observed VPN gate", async () => {
    const fetch: FetchLike = async (input) => response(
      "forbidden",
      input.toString(),
      403,
    );

    await expect(new NjuOpacClient(fetch).loans()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      authCommand: "njucli auth login opac",
    });
  });
});

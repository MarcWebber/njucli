import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { AccountStore } from "../../src/account/store.js";
import { createProductionServices } from "../../src/app/production.js";
import type { BrowserSessionFactory } from "../../src/auth/browser-session.js";
import { SPORTS_SSO_URL } from "../../src/auth/sports-token.js";
import type { FetchLike, FetchResponse } from "../../src/core/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

describe("production service composition", () => {
  it("keeps public campus discovery independent from browser authentication", async () => {
    const browserSessions = unusedBrowserFactory();
    const services = await servicesForTest(browserSessions);

    expect(services.campus.sources()).toHaveLength(8);
    expect(browserSessions.open).not.toHaveBeenCalled();
  });

  it("requires an explicit login before a protected service opens a browser", async () => {
    const browserSessions = unusedBrowserFactory();
    const services = await servicesForTest(browserSessions);

    await expect(services.library.search("操作系统")).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
      authCommand: "njucli auth login vpn",
    });
    expect(browserSessions.open).not.toHaveBeenCalled();
  });

  it("reports every failed source in today instead of presenting an empty result", async () => {
    const browserSessions = unusedBrowserFactory();
    const services = await servicesForTest(browserSessions);

    const result = await services.today("2026-09-04");

    expect(result.date).toBe("2026-09-04");
    expect(result.course).toMatchObject({ ok: false, error: { code: "AUTH_REQUIRED" } });
    expect(result.library).toMatchObject({ ok: false, error: { code: "AUTH_REQUIRED" } });
    expect(result.sports).toMatchObject({ ok: false, error: { code: "AUTH_REQUIRED" } });
    expect(browserSessions.open).not.toHaveBeenCalled();
  });

  it("turns the direct OPAC network gate into a doctor check without hiding it", async () => {
    const browserSessions = unusedBrowserFactory();
    const fetch = vi.fn<FetchLike>(async (input) => {
      const url = input.toString();
      return url.startsWith("https://opac.nju.edu.cn")
        ? response(url, 403, "<title>请使用南大VPN访问!</title>")
        : response(url, 200, "ok");
    });
    const services = await servicesForTest(browserSessions, fetch);

    const result = await services.doctor();

    expect(result.account).toBe("default");
    expect(result.checks).toEqual([
      { name: "nju-home", ok: true, status: 200 },
      expect.objectContaining({ name: "opac-direct", ok: false, code: "VPN_REQUIRED" }),
    ]);
    expect(browserSessions.open).not.toHaveBeenCalled();
  });

  it("refreshes one expired derived session and replays an idempotent read once", async () => {
    let venueRequests = 0;
    const request: FetchLike = async (input) => {
      const url = input.toString();
      if (url === SPORTS_SSO_URL) {
        return response(
          "https://ggtypt.nju.edu.cn/venue-server/sso/manageLogin?oauth_token=once",
          200,
          "{}",
        );
      }
      if (url.endsWith("/api/login")) {
        return jsonResponse(url, {
          code: 200,
          data: { token: { access_token: "process-only-token" }, roles: [] },
        });
      }
      if (url.includes("/api/reservation/campus/venue/info")) {
        venueRequests += 1;
        return jsonResponse(url, venueRequests === 1
          ? { code: 401, message: "expired" }
          : {
              code: 200,
              data: {
                advanceReservationDays: 7,
                reservationNumMax: 2,
                venueInfo: {},
                venueSiteInfo: {},
              },
            });
      }
      throw new Error(`unexpected URL: ${url}`);
    };
    const browserSessions: BrowserSessionFactory = {
      open: vi.fn(async () => ({
        request,
        page: async () => ({
          navigate: async () => undefined,
          currentUrl: () => "https://ehall.nju.edu.cn/new/index.html",
          waitForUrl: async () => undefined,
        }),
        clearCookies: async () => undefined,
        close: async () => undefined,
      })),
    };
    const services = await servicesForTest(browserSessions);
    await services.auth.login("sports");

    await expect(services.sports.venues()).resolves.toEqual([]);
    expect(venueRequests).toBe(2);
  });
});

async function servicesForTest(
  browserSessions: BrowserSessionFactory,
  publicFetch: FetchLike = async (input) => response(input.toString(), 200, "ok"),
) {
  const root = await mkdtemp(join(tmpdir(), "njucli-production-"));
  temporaryDirectories.push(root);
  const accountStore = new AccountStore({
    configRoot: join(root, "config"),
    dataRoot: join(root, "data"),
    env: {},
  });
  return createProductionServices({ accountStore, browserSessions, publicFetch });
}

function unusedBrowserFactory(): BrowserSessionFactory {
  return {
    open: vi.fn(async () => {
      throw new Error("browser authentication must not run");
    }),
  };
}

function response(url: string, status: number, body: string): FetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: async () => body,
  };
}

function jsonResponse(url: string, value: unknown): FetchResponse {
  return response(url, 200, JSON.stringify(value));
}

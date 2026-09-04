import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { AccountStore } from "../account/store.js";
import type { AccountRecord } from "../account/types.js";
import {
  PlaywrightBrowserSessionFactory,
  type BrowserSession,
  type BrowserSessionFactory,
} from "../auth/browser-session.js";
import { AuthCoordinator } from "../auth/coordinator.js";
import { SsoBrowserSessionDriver } from "../auth/drivers/sso-browser.js";
import { JsonSessionMetadataStore } from "../auth/session-store.js";
import { exchangeSportsAccessToken } from "../auth/sports-token.js";
import {
  SESSION_REFRESH_MILLISECONDS,
  type AuthCapability,
  type AuthSessionDriver,
  type SessionObservation,
} from "../auth/types.js";
import { parseCampusDate } from "../core/dates.js";
import { AppError, asAppError } from "../core/errors.js";
import type { FetchLike } from "../core/types.js";
import { urlHostname } from "../core/url.js";
import { CampusClient } from "../domains/campus/client.js";
import { listCampusSources } from "../domains/campus/sources/registry.js";
import { EHallTimetableClient } from "../domains/course/client.js";
import { scheduleToIcs } from "../domains/course/ics.js";
import { CourseService } from "../domains/course/service.js";
import { NjuOpacClient } from "../domains/library/client.js";
import { OPAC_BASE_URL } from "../domains/library/contract.js";
import { SportsClient } from "../domains/sports/client.js";
import type { DoctorResult, NjuServices, SourceResult, TodayResult } from "./services.js";

const EHALL_URL = "https://ehall.nju.edu.cn/new/index.html";
const VPN_TEST_URL = "https://www-nju-edu-cn-s.atrust.nju.edu.cn/";
const OPAC_WEBVPN_BASE_URL = webVpnUrl(OPAC_BASE_URL);

export function createProductionServices(
  options: {
    accountStore?: AccountStore;
    browserSessions?: BrowserSessionFactory;
    publicFetch?: FetchLike;
  } = {},
): NjuServices {
  const accountStore = options.accountStore ?? new AccountStore();
  const browserSessions = options.browserSessions ?? new PlaywrightBrowserSessionFactory();
  const publicFetch = options.publicFetch ?? nativeFetch;
  const auth = createAuthCoordinator(browserSessions);
  const campus = new CampusClient(publicFetch);

  const withBrowser = async <T>(
    capability: AuthCapability,
    operation: (session: BrowserSession) => Promise<T>,
  ): Promise<T> => {
    const account = await accountStore.current();
    await auth.forRead(account, capability);
    const execute = async (): Promise<T> => {
      const session = await browserSessions.open(account, { headless: true });
      try {
        return await operation(session);
      } finally {
        await session.close();
      }
    };

    try {
      return await execute();
    } catch (error) {
      const code = asAppError(error).code;
      if (code !== "AUTH_REQUIRED" && code !== "AUTH_EXPIRED") throw error;
      await auth.refresh(account, capability);
      return execute();
    }
  };

  const withCourse = <T>(operation: (service: CourseService) => Promise<T>): Promise<T> =>
    withBrowser("timetable", (session) =>
      operation(new CourseService(new EHallTimetableClient(session.request))),
    );

  const withLibrary = <T>(
    capability: "vpn" | "opac",
    operation: (client: NjuOpacClient) => Promise<T>,
  ): Promise<T> => withBrowser(capability, (session) =>
    operation(new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL)),
  );

  const withSports = <T>(operation: (client: SportsClient) => Promise<T>): Promise<T> =>
    withBrowser("sports", async (session) => operation(new SportsClient(
      session.request,
      await exchangeSportsAccessToken(session.request),
    )));

  const services: NjuServices = {
    account: {
      current: async () => (await accountStore.current()).name,
      list: async () => (await accountStore.list()).map((account) => account.name),
      add: async (name) => (await accountStore.add(name)).name,
      use: async (name) => (await accountStore.use(name)).name,
      remove: (name) => accountStore.remove(name),
    },
    auth: {
      capabilities: () => auth.capabilities(),
      status: async (capability) => auth.status(await accountStore.current(), capability),
      login: async (capability) => auth.login(await accountStore.current(), capability),
      refresh: async (capability) => auth.refresh(await accountStore.current(), capability),
      logout: async (capability) => auth.logout(await accountStore.current(), capability),
    },
    campus: {
      sources: () => listCampusSources(),
      articles: (source, section, page) => campus.articles(source, section, page),
      article: (source, section, articleId) => campus.article(source, section, articleId),
    },
    course: {
      terms: () => withCourse((service) => service.terms()),
      currentTerm: () => withCourse((service) => service.currentTerm()),
      schedule: (termId) => withCourse((service) => service.schedule(termId)),
      today: (date, termId) => withCourse((service) => service.onDate(date, termId)),
      week: (date, termId) => withCourse((service) => service.week(date, termId)),
      next: (termId) => withCourse((service) => service.next(termId)),
      export: (path, termId) => withCourse(async (service) => {
        const schedule = await service.schedule(termId);
        const target = resolve(path);
        const occurrences = service.expand(schedule);
        await writeFile(target, scheduleToIcs(service, schedule), { mode: 0o600 });
        return { path: target, eventCount: occurrences.length };
      }),
    },
    library: {
      search: (query, field, page, pageSize) => withLibrary("vpn", (client) =>
        client.search(query, field, page, pageSize)),
      book: (bookId) => withLibrary("vpn", (client) => client.book(bookId)),
      holdings: (bookId) => withLibrary("vpn", (client) => client.holdings(bookId)),
      loans: (page, pageSize) => withLibrary("opac", (client) => client.loans(page, pageSize)),
    },
    sports: {
      venues: (sportTypeId) => withSports((client) => client.listVenues(sportTypeId)),
      venue: (venueSiteId) => withSports((client) => client.getVenue(venueSiteId)),
      slots: (venueSiteId, date) => withSports((client) =>
        client.listSlots(venueSiteId, date)),
      bookings: (page, size) => withSports((client) =>
        client.listBookings(page, size)),
      booking: (bookingId) => withSports((client) => client.getBooking(bookingId)),
    },
    today: async (date) => {
      const targetDate = parseCampusDate(date);
      const courseResult = await capture(() => services.course.today(targetDate));
      const libraryResult = await capture(() => services.library.loans());
      const sportsResult = await capture(async () => {
        const bookings = await services.sports.bookings(0, 20);
        return bookings.filter((booking) => booking.reservationDate === targetDate);
      });
      return {
        date: targetDate,
        course: courseResult,
        library: libraryResult,
        sports: sportsResult,
      } satisfies TodayResult;
    },
    doctor: async () => {
      const account = await accountStore.current();
      const checks: DoctorResult["checks"] = [];
      checks.push(await httpCheck(publicFetch, "nju-home", "https://www.nju.edu.cn/"));
      try {
        await new NjuOpacClient(publicFetch).probe();
        checks.push({ name: "opac-direct", ok: true });
      } catch (error) {
        const appError = asAppError(error);
        checks.push({
          name: "opac-direct",
          ok: false,
          code: appError.code,
          message: appError.message,
        });
      }
      return {
        account: account.name,
        authCapabilities: auth.capabilities(),
        checks,
      };
    },
  };
  return services;
}

function createAuthCoordinator(browserSessions: BrowserSessionFactory): AuthCoordinator {
  const probeEhall = (account: AccountRecord): Promise<SessionObservation> =>
    withRawBrowser(browserSessions, account, async (session) => {
      const response = await session.request(EHALL_URL);
      return sessionObservation(response.url, response.ok, "ehall.nju.edu.cn");
    });
  const probeTimetable = (account: AccountRecord): Promise<SessionObservation> =>
    withRawBrowser(browserSessions, account, async (session) => {
      await new EHallTimetableClient(session.request).currentTerm();
      return freshObservation();
    });
  const probeSports = (account: AccountRecord): Promise<SessionObservation> =>
    withRawBrowser(browserSessions, account, async (session) => {
      await exchangeSportsAccessToken(session.request);
      return freshObservation();
    });
  const probeVpn = (account: AccountRecord): Promise<SessionObservation> =>
    withRawBrowser(browserSessions, account, async (session) => {
      const response = await session.request(VPN_TEST_URL);
      return sessionObservation(response.url, response.ok, new URL(VPN_TEST_URL).hostname);
    });
  const probeOpac = (account: AccountRecord): Promise<SessionObservation> =>
    withRawBrowser(browserSessions, account, async (session) => {
      await new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL).loans(1, 1);
      return freshObservation();
    });

  return new AuthCoordinator({
    sessions: new JsonSessionMetadataStore(),
    drivers: [
      new SsoBrowserSessionDriver({
        browserSessions,
      }),
      derivedDriver("ehall", probeEhall),
      derivedDriver("timetable", probeTimetable),
      derivedDriver("sports", probeSports),
      derivedDriver(
        "vpn",
        probeVpn,
        (account) => interactiveVpnLogin(browserSessions, account),
      ),
      derivedDriver(
        "opac",
        probeOpac,
        (account) => interactiveOpacLogin(
          browserSessions,
          account,
        ),
      ),
    ],
  });
}

function derivedDriver(
  capability: AuthCapability,
  probe: (account: AccountRecord) => Promise<SessionObservation>,
  login: (account: AccountRecord) => Promise<SessionObservation> = probe,
): AuthSessionDriver {
  return {
    capability,
    login,
    probe,
  };
}

async function interactiveVpnLogin(
  factory: BrowserSessionFactory,
  account: AccountRecord,
): Promise<SessionObservation> {
  const session = await factory.open(account, { headless: false });
  try {
    const page = await session.page();
    await page.navigate(VPN_TEST_URL);
    const successHost = new URL(VPN_TEST_URL).hostname;
    if (urlHostname(page.currentUrl()) !== successHost) {
      try {
        await page.waitForUrl((candidate) => candidate.hostname === successHost, 180_000);
      } catch (cause) {
        throw new AppError("USER_ACTION_REQUIRED", "Web VPN 登录尚未完成", {
          hint: "请在学校原始页面完成短信或其他官方验证",
          authCommand: "njucli auth login vpn",
          cause,
        });
      }
    }
    return freshObservation();
  } finally {
    await session.close();
  }
}

async function interactiveOpacLogin(
  factory: BrowserSessionFactory,
  account: AccountRecord,
): Promise<SessionObservation> {
  const session = await factory.open(account, { headless: false });
  try {
    const page = await session.page();
    await page.navigate(`${OPAC_WEBVPN_BASE_URL}/`);
    const deadline = Date.now() + 180_000;
    while (true) {
      try {
        await new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL).loans(1, 1);
        return freshObservation();
      } catch (error) {
        const code = asAppError(error).code;
        if (code !== "AUTH_REQUIRED" && code !== "AUTH_EXPIRED") throw error;
        if (Date.now() >= deadline) {
          throw new AppError("USER_ACTION_REQUIRED", "图书馆读者登录尚未完成", {
            hint: "请在已经打开的学校图书馆页面完成官方登录",
            authCommand: "njucli auth login opac",
            cause: error,
          });
        }
        await delay(1_000);
      }
    }
  } finally {
    await session.close();
  }
}

async function withRawBrowser<T>(
  factory: BrowserSessionFactory,
  account: AccountRecord,
  operation: (session: BrowserSession) => Promise<T>,
): Promise<T> {
  const session = await factory.open(account, { headless: true });
  try {
    return await operation(session);
  } finally {
    await session.close();
  }
}

function freshObservation(): SessionObservation {
  return {
    status: "valid",
    refreshAfter: new Date(Date.now() + SESSION_REFRESH_MILLISECONDS),
  };
}

function sessionObservation(
  url: string,
  ok: boolean,
  expectedHost: string,
): SessionObservation {
  const host = urlHostname(url);
  if (ok && host === expectedHost) return freshObservation();
  return { status: "expired", refreshAfter: null };
}

function webVpnUrl(value: string): string {
  const url = new URL(value);
  url.hostname = `${url.hostname.replaceAll("-", "--").replaceAll(".", "-")}.atrust.nju.edu.cn`;
  return url.origin;
}

async function capture<T>(operation: () => Promise<T>): Promise<SourceResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    const appError = asAppError(error);
    return { ok: false, error: { code: appError.code, message: appError.message } };
  }
}

async function httpCheck(
  fetch: FetchLike,
  name: string,
  url: string,
): Promise<DoctorResult["checks"][number]> {
  try {
    const response = await fetch(url, { method: "GET" });
    return { name, ok: response.ok, status: response.status };
  } catch (error) {
    return { name, ok: false, code: "REMOTE_UNAVAILABLE", message: asAppError(error).message };
  }
}

const nativeFetch: FetchLike = async (input, init) => globalThis.fetch(input, init);

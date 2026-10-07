import { readFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { AccountStore } from "../account/store.js";
import type { AccountRecord } from "../account/types.js";
import {
  type BrowserSession,
  withBrowserSession,
} from "../auth/browser-session.js";
import { AuthCoordinator } from "../auth/coordinator.js";
import { softSeSessionDriver } from "../auth/drivers/softse-browser.js";
import { ssoSessionDriver } from "../auth/drivers/sso-browser.js";
import { selectionSessionDriver } from "../auth/drivers/selection-browser.js";
import { texSessionDriver } from "../auth/drivers/tex-browser.js";
import { SessionStore } from "../auth/session-store.js";
import { exchangeSportsAccessToken } from "../auth/sports-token.js";
import { AUTH_CAPABILITIES, type AuthCapability, type AuthCredentials, type AuthMaintenance } from "../auth/types.js";
import { parseCampusDate } from "../core/dates.js";
import { AppError, asAppError } from "../core/errors.js";
import { readJsonFile, saveFile, writeJsonFile } from "../core/fs.js";
import { CampusClient } from "../domains/campus/client.js";
import { listCampusSources } from "../domains/campus/sources/registry.js";
import { GraduateAcademicClient } from "../domains/academic/client.js";
import { EHallTimetableClient } from "../domains/course/client.js";
import { scheduleToIcs } from "../domains/course/ics.js";
import { GraduateCourseSelectionClient } from "../domains/course/selection-client.js";
import { CourseService } from "../domains/course/service.js";
import { EHallPortalClient } from "../domains/ehall/client.js";
import { EHallTripClient } from "../domains/ehall/trip.js";
import { NjuOpacClient } from "../domains/library/client.js";
import { MailClient } from "../domains/mail/client.js";
import { bindMail } from "../domains/mail/bind.js";
import { SoftwareClient } from "../domains/software/client.js";
import { SportsClient } from "../domains/sports/client.js";
import { SoftSeClient } from "../domains/softse/client.js";
import { TexClient } from "../domains/tex/client.js";
import { TableClient } from "../domains/table/client.js";
import { YouthClient } from "../domains/youth/client.js";
import { compileTexFile, uploadTexFile, writeTexFile } from "../domains/tex/editor.js";
import type { DoctorResult, NjuServices, TodayResult } from "./services.js";

const EHALL_URL = "https://ehall.nju.edu.cn/new/index.html";
const VPN_TEST_URL = "https://www-nju-edu-cn-s.atrust.nju.edu.cn/";
const OPAC_WEBVPN_BASE_URL = "https://opac-nju-edu-cn.atrust.nju.edu.cn";

export function createProductionServices(): NjuServices {
  const accountStore = new AccountStore();
  const auth = createAuthCoordinator();
  const campus = new CampusClient(fetch);
  const mail = async () => new MailClient((await accountStore.current()).configDir);

  const withBrowser = async <T>(
    capability: AuthCapability,
    operation: (session: BrowserSession, account: AccountRecord) => Promise<T>,
    probe?: (session: BrowserSession) => Promise<boolean>,
  ): Promise<T> => {
    const account = await accountStore.current();
    return withBrowserSession(account, false, async (session) => {
      await auth.ensureSession(account, capability, probe && (() => probe(session)));
      return operation(session, account);
    });
  };

  const withCourse = <T>(operation: (service: CourseService) => Promise<T>): Promise<T> => {
    let client: EHallTimetableClient;
    return withBrowser("timetable", () => operation(new CourseService(client)), async (session) => {
      client = new EHallTimetableClient(session.request);
      await client.currentTerm();
      return true;
    });
  };

  const withSelection = <T>(
    operation: (client: GraduateCourseSelectionClient) => Promise<T>,
  ): Promise<T> => withBrowser("selection", (session) =>
    operation(new GraduateCourseSelectionClient(session.request)),
  );

  const withAcademic = <T>(operation: (client: GraduateAcademicClient) => Promise<T>): Promise<T> =>
    withBrowser("ehall", (session) => operation(new GraduateAcademicClient(session.request)));

  const withEHall = <T>(operation: (client: EHallPortalClient) => Promise<T>): Promise<T> =>
    withBrowser("ehall", (session) => operation(new EHallPortalClient(session.request)));

  const withSoftSe = <T>(operation: (client: SoftSeClient) => Promise<T>): Promise<T> =>
    withBrowser("softse", (session) => operation(new SoftSeClient(session.request)));

  const withTex = <T>(operation: (client: TexClient) => Promise<T>): Promise<T> =>
    withBrowser("tex", (session) => operation(new TexClient(session.request)));

  const withTable = <T>(operation: (client: TableClient) => Promise<T>): Promise<T> => {
    let client: TableClient;
    return withBrowser("table", () => operation(client), async (session) => {
      client = new TableClient(session.request);
      return client.restoreSession();
    });
  };

  const withYouth = <T>(operation: (client: YouthClient) => Promise<T>): Promise<T> => {
    let client: YouthClient;
    return withBrowser("youth", () => operation(client), async (session) => {
      client = new YouthClient(session.request);
      return client.restoreSession();
    });
  };

  const withLibrary = <T>(
    capability: "vpn" | "opac",
    operation: (client: NjuOpacClient) => Promise<T>,
  ): Promise<T> => withBrowser(capability, (session) =>
    operation(new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL)),
  );

  const withSports = <T>(operation: (client: SportsClient) => Promise<T>): Promise<T> => {
    let client: SportsClient;
    return withBrowser("sports", () => operation(client), async (session) => {
      client = new SportsClient(session.request, await exchangeSportsAccessToken(session.request));
      return true;
    });
  };

  const services: NjuServices = {
    table: {
      workspaces: () => withTable((client) => client.workspaces()),
      bases: (query) => withTable((client) => client.bases(query)),
      templates: (query) => withTable((client) => client.templates(query)),
      show: (id) => withTable((client) => client.show(id)),
      rows: (id, sheet, options) => withTable((client) => client.rows(id, sheet, options)),
      row: (id, sheet, rowId) => withTable((client) => client.row(id, sheet, rowId)),
      create: (name, options) => withTable((client) => client.create(name, options)),
      addSheet: (id, input) => withTable((client) => client.addSheet(id, input)),
      addColumn: (id, sheet, input) => withTable((client) => client.addColumn(id, sheet, input)),
      addView: (id, sheet, input) => withTable((client) => client.addView(id, sheet, input)),
      updateView: (id, sheet, input) => withTable((client) => client.updateView(id, sheet, input)),
      append: (id, sheet, rows) => withTable((client) => client.append(id, sheet, rows)),
      update: (id, sheet, updates) => withTable((client) => client.update(id, sheet, updates)),
    },
    youth: {
      profile: () => withYouth((client) => client.profile()),
      menus: () => withYouth((client) => client.menus()),
      years: () => withYouth((client) => client.years()),
      hours: (year) => withYouth((client) => client.hours(year)),
      activities: (options) => withYouth((client) => client.activities(options)),
      activity: (id) => withYouth((client) => client.activity(id)),
      enroll: (id, input) => withYouth((client) => client.enroll(id, input)),
      cancel: (id) => withYouth((client) => client.cancel(id)),
      rate: (id, stars, comment) => withYouth((client) => client.rate(id, stars, comment)),
      teams: (options) => withYouth((client) => client.teams(options)),
      team: (id) => withYouth((client) => client.team(id)),
      trainings: (options) => withYouth((client) => client.trainings(options)),
      enrollTraining: (id) => withYouth((client) => client.enrollTraining(id)),
      cancelTraining: (id) => withYouth((client) => client.cancelTraining(id)),
      categories: (options) => withYouth((client) => client.categories(options)),
      applications: (options) => withYouth((client) => client.applications(options)),
      application: (id) => withYouth((client) => client.application(id)),
      transcript: (options) => withYouth((client) => client.transcript(options)),
      exportTranscript: (output) => withYouth((client) => client.exportTranscript(output)),
      courses: (options) => withYouth((client) => client.courses(options)),
      course: (id) => withYouth((client) => client.course(id)),
      courseGrades: (options) => withYouth((client) => client.courseGrades(options)),
      practices: (options) => withYouth((client) => client.practices(options)),
      practice: (id) => withYouth((client) => client.practice(id)),
      practiceTeams: (options) => withYouth((client) => client.practiceTeams(options)),
      practiceTeam: (id) => withYouth((client) => client.practiceTeam(id)),
      practiceResources: (options) => withYouth((client) => client.practiceResources(options)),
      practiceResource: (id) => withYouth((client) => client.practiceResource(id)),
      practiceJournals: (options) => withYouth((client) => client.practiceJournals(options)),
      clubs: (options) => withYouth((client) => client.clubs(options)),
      club: (id) => withYouth((client) => client.club(id)),
      jobs: (options) => withYouth((client) => client.jobs(options)),
      recruitments: (options) => withYouth((client) => client.recruitments(options)),
      tickets: (options) => withYouth((client) => client.tickets(options)),
      awards: (kind, options) => withYouth((client) => client.awards(kind, options)),
      projects: (options) => withYouth((client) => client.projects(options)),
      complaints: (options) => withYouth((client) => client.complaints(options)),
    },
    software: new SoftwareClient(),
    mail: {
      bind: async (credentials) => {
        const account = await accountStore.current();
        const client = new MailClient(account.configDir);
        if (credentials) {
          const username = credentials.address ?? (await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json")))?.username;
          if (!username) throw new AppError("INVALID_INPUT", "请提供 --address 或先保存统一认证账号");
          return client.bind(username.includes("@") ? username : `${username}@smail.nju.edu.cn`, credentials.password);
        }
        const status = await client.status();
        if (status.bound) {
          await client.folders();
          return { bound: true, address: status.address! };
        }
        return withBrowserSession(account, false, (session) => bindMail(session, client));
      },
      accounts: async () => (await mail()).accounts(),
      use: async (address) => (await mail()).use(address),
      status: async () => (await mail()).status(),
      unbind: async (address) => (await mail()).unbind(address),
      folders: async () => (await mail()).folders(),
      list: async (options) => (await mail()).list(options),
      search: async (query, options) => (await mail()).search(query, options),
      read: async (id) => (await mail()).read(id),
      download: async (id, attachment, output) => (await mail()).download(id, attachment, output),
    },
    account: {
      current: async () => (await accountStore.current()).name,
      list: async () => (await accountStore.list()).map((account) => account.name),
      add: async (name) => (await accountStore.add(name)).name,
      use: async (name) => (await accountStore.use(name)).name,
      remove: (name) => accountStore.remove(name),
    },
    auth: {
      maintain: async () => {
        const account = await accountStore.current();
        return withBrowserSession(account, true, async () => {
          const [current] = await auth.status(account, "sso");
          const action = current!.status === "valid" ? "kept-alive" : "restored";
          if (action === "restored") {
            const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
            if (!credentials) throw new AppError("AUTH_REQUIRED", "请保存统一认证账号密码，以便自动恢复会话");
            await auth.login(account, "sso");
          }
          const result: AuthMaintenance = { checkedAt: new Date().toISOString(), action, status: "valid" };
          await writeJsonFile(join(account.configDir, "auth-maintenance.json"), result);
          return result;
        });
      },
      status: async (capability) => {
        const account = await accountStore.current();
        return withBrowserSession(account, true, () => auth.status(account, capability));
      },
      login: async (capability, credentials) => {
        const account = await accountStore.current();
        return withBrowserSession(account, false, async (session) => {
          if (credentials) {
            const path = join(account.configDir, "auth.json");
            const previous = await readJsonFile<AuthCredentials>(path);
            await writeJsonFile(path, credentials);
            if (previous?.username !== credentials.username) await session.clearCookies();
          }
          return auth.login(account, capability);
        });
      },
      logout: async (capability) => {
        const account = await accountStore.current();
        return withBrowserSession(account, true, () => auth.logout(account, capability));
      },
    },
    campus: {
      canteens: (query) => campus.canteens(query),
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
        const occurrences = service.expand(schedule);
        const saved = await saveFile(path, scheduleToIcs(occurrences));
        return { path: saved.path, eventCount: occurrences.length };
      }),
      available: (kind, query, page, pageSize) => withSelection((client) =>
        client.listAvailable(kind, query, page, pageSize)),
      selected: () => withSelection((client) => client.listSelected()),
      withdraw: (classId) => withSelection((client) => client.withdraw(classId)),
      select: (classId, kind) => withSelection((client) =>
        client.select(classId, kind)),
    },
    academic: {
      grades: (termId) => withAcademic((client) => client.grades(termId)),
      exams: (termId) => withAcademic((client) => client.exams(termId)),
      schedule: (termId) => withAcademic((client) => client.schedule(termId)),
      plan: () => withAcademic((client) => client.plan()),
    },
    ehall: {
      trip: () => withBrowser("ehall", (session, account) => new EHallTripClient(session.request, account.configDir).trip()),
      submitTrip: (input, dryRun) => withBrowser("ehall", (session, account) => new EHallTripClient(session.request, account.configDir).submitTrip(input, dryRun)),
      services: (query) => withEHall((client) => client.services(query)),
      tasks: (kind, page, pageSize) => withEHall((client) =>
        client.tasks(kind, page, pageSize)),
      applications: (state, page, pageSize) => withEHall((client) =>
        client.applications(state, page, pageSize)),
      serviceLink: (appId) => new EHallPortalClient(fetch).serviceLink(appId),
    },
    softse: {
      courses: () => withSoftSe((client) => client.courses()),
      catalog: () => withSoftSe((client) => client.catalog()),
      participants: (courseId, page) => withSoftSe((client) => client.participants(courseId, page)),
      search: (query, page) => withSoftSe((client) => client.search(query, page)),
      course: (courseId) => withSoftSe((client) => client.course(courseId)),
      assignments: (courseId, pending) => withSoftSe((client) => client.assignments(courseId, pending)),
      assignment: (activityId) => withSoftSe((client) => client.assignment(activityId)),
      download: async (activityId, fileName, path, submitted) => {
        const bytes = await withSoftSe((client) => client.download(activityId, fileName, submitted));
        return saveFile(path, bytes);
      },
      grades: (courseId) => withSoftSe((client) => client.grades(courseId)),
      enroll: (courseId, enrolmentKey) => withSoftSe((client) =>
        client.enroll(courseId, enrolmentKey)),
      submissionLink: (activityId) => withSoftSe((client) =>
        client.submissionLink(activityId)),
    },
    tex: {
      templates: (page) => withTex((client) => client.templates(page)),
      projects: (query, page) => withTex((client) => client.projects(query, page)),
      create: (name) => withTex((client) => client.create(name)),
      createFromTemplate: (templateKey) => withTex((client) => client.createFromTemplate(templateKey)),
      rename: (projectKey, name) => withTex((client) => client.rename(projectKey, name)),
      download: async (projectKey, versionNo, path) => {
        const bytes = await withTex((client) => client.download(projectKey, versionNo));
        return saveFile(path, bytes);
      },
      pdf: async (projectKey, versionNo, output) =>
        saveFile(output, await withTex(async (client) => client.pdf(
          projectKey, versionNo, await client.compileResult(projectKey, versionNo),
        ))),
      log: (projectKey, versionNo) => withTex((client) => client.log(projectKey, versionNo)),
      compile: (projectKey, versionNo, path, output) => withBrowser("tex", async (session) => {
        const client = new TexClient(session.request);
        const result = await compileTexFile(client, await session.page(), projectKey, versionNo, path);
        return saveFile(output, await client.pdf(projectKey, versionNo, result));
      }),
      files: (projectKey, versionNo) => withTex((client) => client.files(projectKey, versionNo)),
      upload: async (projectKey, versionNo, inputLocalPath) => {
        const path = resolve(inputLocalPath);
        const content = await readFile(path);
        return withBrowser("tex", async (session) => uploadTexFile(
          new TexClient(session.request), await session.page(), projectKey, versionNo, basename(path), content,
        ));
      },
      read: (projectKey, versionNo, fileKey) => withTex((client) => client.read(projectKey, versionNo, fileKey)),
      write: async (projectKey, versionNo, path, inputLocalPath) => {
        const content = new TextDecoder("utf-8", { fatal: true }).decode(await readFile(resolve(inputLocalPath)));
        return withBrowser("tex", async (session) => writeTexFile(
          new TexClient(session.request),
          await session.page(),
          projectKey,
          versionNo,
          path,
          content,
        ));
      },
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
      reservationLink: async (venueSiteId, date) => ({
        url: `https://ggtypt.nju.edu.cn/venue/venue-reservation/${encodeURIComponent(venueSiteId)}`,
        venueSiteId,
        date: parseCampusDate(date),
      }),
      cancellationLink: async (bookingId) => ({
        url: "https://ggtypt.nju.edu.cn/venue/orders",
        bookingId,
      }),
    },
    today: async (date) => {
      const targetDate = parseCampusDate(date);
      const course = await services.course.today(targetDate);
      const library = await services.library.loans();
      const bookings = await services.sports.bookings(0, 20);
      return {
        date: targetDate,
        course,
        library,
        sports: bookings.filter((booking) => booking.reservationDate === targetDate),
      } satisfies TodayResult;
    },
    doctor: async () => {
      const account = await accountStore.current();
      const checks: DoctorResult["checks"] = [];
      try {
        const response = await fetch("https://www.nju.edu.cn/");
        checks.push({ name: "nju-home", ok: response.ok, status: response.status });
      } catch (error) {
        checks.push({ name: "nju-home", ok: false, code: "REMOTE_UNAVAILABLE", message: asAppError(error).message });
      }
      try {
        await new NjuOpacClient(fetch).probe();
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
        authCapabilities: [...AUTH_CAPABILITIES],
        checks,
      };
    },
  };
  return services;
}

function createAuthCoordinator(): AuthCoordinator {
  const restoreTableSession = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, (session) => new TableClient(session.request).restoreSession());
  const restoreYouthSession = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, (session) => new YouthClient(session.request).restoreSession());
  const restoreEhallSession = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, async (session) => {
      const client = new EHallPortalClient(session.request);
      if (await client.hasSession()) return true;
      const response = await session.request(`https://ehall.nju.edu.cn/login?service=${encodeURIComponent(EHALL_URL)}`);
      if (!response.ok) throw new Error(`EHall 登录返回 HTTP ${response.status}`);
      return client.hasSession();
    });
  const probeTimetable = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, async (session) => {
      await new EHallTimetableClient(session.request).currentTerm();
      return true;
    });
  const probeSports = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, async (session) => {
      await exchangeSportsAccessToken(session.request);
      return true;
    });
  const probeVpn = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, async (session) => {
      const response = await session.request(VPN_TEST_URL);
      return response.ok && new URL(response.url).hostname === new URL(VPN_TEST_URL).hostname;
    });
  const probeOpac = (account: AccountRecord): Promise<boolean> =>
    withBrowserSession(account, true, async (session) => {
      await new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL).loans(1, 1);
      return true;
    });

  return new AuthCoordinator({
    sessions: new SessionStore(),
    drivers: {
      sso: ssoSessionDriver,
      selection: selectionSessionDriver,
      softse: softSeSessionDriver,
      tex: texSessionDriver,
      ehall: { login: restoreEhallSession, probe: restoreEhallSession },
      timetable: { login: probeTimetable, probe: probeTimetable },
      sports: { login: probeSports, probe: probeSports },
      youth: { login: restoreYouthSession, probe: restoreYouthSession },
      table: { login: restoreTableSession, probe: restoreTableSession },
      vpn: { login: loginVpn, probe: probeVpn },
      opac: { login: interactiveOpacLogin, probe: probeOpac },
    },
  });
}

async function loginVpn(
  account: AccountRecord,
): Promise<boolean> {
  return withBrowserSession(account, false, async (session) => {
    const successHost = new URL(VPN_TEST_URL).hostname;
    const response = await session.request(VPN_TEST_URL);
    if (!response.ok) throw new Error(`WebVPN 登录恢复返回 HTTP ${response.status}`);
    if (new URL(response.url).hostname === successHost) return true;
    await session.login(VPN_TEST_URL, (url) => url.hostname === successHost);
    return true;
  });
}

async function interactiveOpacLogin(
  account: AccountRecord,
): Promise<boolean> {
  return withBrowserSession(account, false, async (session) => {
    const page = await session.page();
    await page.goto(`${OPAC_WEBVPN_BASE_URL}/`, { waitUntil: "domcontentloaded" });
    const deadline = Date.now() + 180_000;
    while (true) {
      try {
        await new NjuOpacClient(session.request, OPAC_WEBVPN_BASE_URL).loans(1, 1);
        return true;
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
  });
}

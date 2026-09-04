import { describe, expect, it } from "vitest";

import type { AccountRecord } from "../../src/account/types.js";
import type {
  BrowserPageSession,
  BrowserSession,
  BrowserSessionFactory,
} from "../../src/auth/browser-session.js";
import { SsoBrowserSessionDriver } from "../../src/auth/drivers/sso-browser.js";
import type { Clock } from "../../src/core/types.js";

const account: AccountRecord = {
  name: "default",
  configDir: "/tmp/njucli-test/config",
  browserDataDir: "/tmp/njucli-test/data/browser",
};
const clock: Clock = { now: () => new Date("2026-09-04T12:00:00.000Z") };

describe("SsoBrowserSessionDriver", () => {
  it("opens only the original school login page and waits for a school landing page", async () => {
    const page = new FakePage("https://ehall.nju.edu.cn/new/index.html");
    const factory = new FakeBrowserFactory(page);
    const driver = new SsoBrowserSessionDriver({
      browserSessions: factory,
      clock,
      loginTimeoutMilliseconds: 5_000,
    });

    const result = await driver.login(account);

    const login = new URL(page.navigations[0] as string);
    expect(login.hostname).toBe("authserver.nju.edu.cn");
    expect(new URL(login.searchParams.get("service") as string).hostname).toBe(
      "ehall.nju.edu.cn",
    );
    expect(page.waitCalls).toBe(1);
    expect(factory.headlessModes).toEqual([false]);
    expect(factory.sessions[0]?.closed).toBe(true);
    expect(result).toEqual({
      status: "valid",
      refreshAfter: new Date("2026-09-04T12:15:00.000Z"),
    });
  });

  it("reports expiry when the official probe redirects to authserver", async () => {
    const page = new FakePage(
      "https://ehall.nju.edu.cn/new/index.html",
      "https://authserver.nju.edu.cn/authserver/login",
    );
    const factory = new FakeBrowserFactory(page);
    const driver = new SsoBrowserSessionDriver({ browserSessions: factory });

    await expect(driver.probe(account)).resolves.toEqual({
      status: "expired",
      refreshAfter: null,
    });
    expect(factory.headlessModes).toEqual([true]);
  });

  it("logs out on the school endpoint and clears only the isolated context", async () => {
    const page = new FakePage("https://authserver.nju.edu.cn/authserver/logout");
    const factory = new FakeBrowserFactory(page);
    const driver = new SsoBrowserSessionDriver({ browserSessions: factory });

    await driver.logout(account);

    expect(new URL(page.navigations[0] as string).hostname).toBe(
      "authserver.nju.edu.cn",
    );
    expect(factory.sessions[0]?.cookiesCleared).toBe(true);
    expect(factory.sessions[0]?.closed).toBe(true);
  });

  it("returns a user-action error when interactive login is not completed", async () => {
    const page = new FakePage(null);
    const driver = new SsoBrowserSessionDriver({
      browserSessions: new FakeBrowserFactory(page),
      loginTimeoutMilliseconds: 10,
    });

    await expect(driver.login(account)).rejects.toMatchObject({
      code: "USER_ACTION_REQUIRED",
      authCommand: "njucli auth login",
    });
  });
});

class FakePage implements BrowserPageSession {
  readonly navigations: string[] = [];
  waitCalls = 0;
  private url = "about:blank";

  constructor(
    private readonly loginSuccessUrl: string | null,
    private readonly navigationResultUrl?: string,
  ) {}

  async navigate(url: string): Promise<void> {
    this.navigations.push(url);
    this.url = this.navigationResultUrl ?? url;
  }

  currentUrl(): string {
    return this.url;
  }

  async waitForUrl(
    predicate: (url: URL) => boolean,
    _timeoutMilliseconds: number,
  ): Promise<void> {
    this.waitCalls += 1;
    if (!this.loginSuccessUrl || !predicate(new URL(this.loginSuccessUrl))) {
      throw new Error("timeout");
    }
    this.url = this.loginSuccessUrl;
  }
}

class FakeBrowserFactory implements BrowserSessionFactory {
  readonly headlessModes: boolean[] = [];
  readonly sessions: FakeBrowserSession[] = [];

  constructor(private readonly pageValue: FakePage) {}

  async open(
    _account: AccountRecord,
    options: { headless: boolean },
  ): Promise<BrowserSession> {
    this.headlessModes.push(options.headless);
    const session = new FakeBrowserSession(this.pageValue);
    this.sessions.push(session);
    return session;
  }
}

class FakeBrowserSession implements BrowserSession {
  cookiesCleared = false;
  closed = false;
  readonly request = async (): Promise<never> => {
    throw new Error("not used by the SSO driver");
  };

  constructor(private readonly pageValue: FakePage) {}

  async page(): Promise<BrowserPageSession> {
    return this.pageValue;
  }

  async clearCookies(): Promise<void> {
    this.cookiesCleared = true;
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

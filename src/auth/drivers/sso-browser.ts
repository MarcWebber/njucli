import type { AccountRecord } from "../../account/types.js";
import { AppError } from "../../core/errors.js";
import { systemClock, type Clock } from "../../core/types.js";
import { parseUrl } from "../../core/url.js";
import {
  PlaywrightBrowserSessionFactory,
  type BrowserPageSession,
  type BrowserSessionFactory,
} from "../browser-session.js";
import {
  SESSION_REFRESH_MILLISECONDS,
  type AuthSessionDriver,
  type SessionObservation,
} from "../types.js";

const AUTH_HOST = "authserver.nju.edu.cn";
const DEFAULT_LANDING_URL = "https://ehall.nju.edu.cn/new/index.html";
const LANDING_HOST = "ehall.nju.edu.cn";
const DEFAULT_LOGIN_URL =
  "https://authserver.nju.edu.cn/authserver/login?service=" +
  encodeURIComponent(DEFAULT_LANDING_URL);
const DEFAULT_LOGOUT_URL = "https://authserver.nju.edu.cn/authserver/logout";

export class SsoBrowserSessionDriver implements AuthSessionDriver {
  readonly capability = "sso" as const;

  private readonly browserSessions: BrowserSessionFactory;
  private readonly clock: Clock;
  private readonly loginTimeoutMilliseconds: number;

  constructor(options: {
    browserSessions?: BrowserSessionFactory;
    clock?: Clock;
    loginTimeoutMilliseconds?: number;
  } = {}) {
    this.browserSessions =
      options.browserSessions ?? new PlaywrightBrowserSessionFactory();
    this.clock = options.clock ?? systemClock;
    this.loginTimeoutMilliseconds = options.loginTimeoutMilliseconds ?? 180_000;

    if (this.loginTimeoutMilliseconds <= 0) {
      throw new AppError("INVALID_INPUT", "SSO 登录等待时间必须大于 0");
    }
  }

  async login(account: AccountRecord): Promise<SessionObservation> {
    const session = await this.browserSessions.open(account, { headless: false });
    try {
      const page = await session.page();
      await page.navigate(DEFAULT_LOGIN_URL);
      if (!this.isAuthenticatedUrl(page.currentUrl())) {
        try {
          await page.waitForUrl(
            (url) => this.isAuthenticatedUrl(url.toString()),
            this.loginTimeoutMilliseconds,
          );
        } catch (error) {
          throw new AppError(
            "USER_ACTION_REQUIRED",
            "统一身份认证尚未完成",
            {
              hint: "请在学校登录页面完成扫码、动态码、FIDO 或密码验证",
              authCommand: "njucli auth login",
              cause: error,
            },
          );
        }
      }
      return this.validObservation();
    } finally {
      await session.close();
    }
  }

  async probe(account: AccountRecord): Promise<SessionObservation> {
    return this.withBackgroundSession(account, async (page) => {
      await page.navigate(DEFAULT_LANDING_URL);
      return this.observeUrl(page.currentUrl());
    });
  }

  async refresh(account: AccountRecord): Promise<SessionObservation> {
    const observation = await this.probe(account);
    if (observation.status !== "valid") {
      throw new AppError("AUTH_EXPIRED", "统一身份认证会话已失效", {
        hint: "运行 njucli auth login",
        authCommand: "njucli auth login",
      });
    }
    return observation;
  }

  async logout(account: AccountRecord): Promise<void> {
    const session = await this.browserSessions.open(account, { headless: true });
    try {
      const page = await session.page();
      await page.navigate(DEFAULT_LOGOUT_URL);
      await session.clearCookies();
    } finally {
      await session.close();
    }
  }

  private async withBackgroundSession<T>(
    account: AccountRecord,
    run: (page: BrowserPageSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.browserSessions.open(account, { headless: true });
    try {
      return await run(await session.page());
    } finally {
      await session.close();
    }
  }

  private observeUrl(value: string): SessionObservation {
    const url = parseUrl(value);
    if (!url || url.protocol !== "https:") {
      throw new AppError("AUTH_CAPABILITY_UNKNOWN", "SSO 状态探测返回了无效页面");
    }
    if (url.hostname === AUTH_HOST) {
      return { status: "expired", refreshAfter: null };
    }
    if (url.hostname !== LANDING_HOST) {
      throw new AppError(
        "AUTH_CAPABILITY_UNKNOWN",
        "SSO 状态探测返回了未配置的学校页面",
        { details: { host: url.hostname } },
      );
    }
    return this.validObservation();
  }

  private isAuthenticatedUrl(value: string): boolean {
    const url = parseUrl(value);
    return url !== null &&
      url.protocol === "https:" &&
      url.hostname === LANDING_HOST;
  }

  private validObservation(): SessionObservation {
    return {
      status: "valid",
      refreshAfter: new Date(
        this.clock.now().getTime() + SESSION_REFRESH_MILLISECONDS,
      ),
    };
  }
}

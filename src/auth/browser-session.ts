import { mkdir } from "node:fs/promises";

import {
  chromium,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "playwright-core";

import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import type { FetchLike, FetchResponse } from "../core/types.js";

export interface BrowserPageSession {
  navigate(url: string): Promise<void>;
  currentUrl(): string;
  waitForUrl(
    predicate: (url: URL) => boolean,
    timeoutMilliseconds: number,
  ): Promise<void>;
}

export interface BrowserSession {
  page(): Promise<BrowserPageSession>;
  request: FetchLike;
  clearCookies(): Promise<void>;
  close(): Promise<void>;
}

export interface BrowserSessionFactory {
  open(
    account: AccountRecord,
    options: { headless: boolean },
  ): Promise<BrowserSession>;
}

export class PlaywrightBrowserSessionFactory implements BrowserSessionFactory {
  async open(
    account: AccountRecord,
    options: { headless: boolean },
  ): Promise<BrowserSession> {
    await mkdir(account.browserDataDir, { recursive: true, mode: 0o700 });
    const context = await chromium.launchPersistentContext(
      account.browserDataDir,
      { headless: options.headless, channel: "chrome" },
    );
    return new PlaywrightBrowserSession(context);
  }
}

class PlaywrightBrowserSession implements BrowserSession {
  constructor(private readonly context: BrowserContext) {}

  readonly request: FetchLike = async (input, init = {}) => {
    init.signal?.throwIfAborted();
    const options: NonNullable<
      Parameters<BrowserContext["request"]["fetch"]>[1]
    > = {
      failOnStatusCode: false,
    };
    if (init.method !== undefined) options.method = init.method;
    if (init.headers !== undefined) options.headers = requestHeaders(init.headers);
    const data = requestData(init.body);
    if (data !== undefined) options.data = data;
    if (init.redirect === "manual") options.maxRedirects = 0;

    const response = await this.context.request.fetch(input.toString(), options);
    return playwrightResponse(response);
  };

  async page(): Promise<BrowserPageSession> {
    const page = this.context.pages()[0] ?? (await this.context.newPage());
    return new PlaywrightBrowserPageSession(page);
  }

  async clearCookies(): Promise<void> {
    await this.context.clearCookies();
  }

  async close(): Promise<void> {
    await this.context.close();
  }
}

function requestHeaders(headers: HeadersInit): Record<string, string> {
  const result: Record<string, string> = {};
  new Headers(headers).forEach((value, name) => {
    if (name.toLowerCase() === "cookie") {
      throw new AppError(
        "INVALID_INPUT",
        "browser session request 不接受手工 Cookie header",
      );
    }
    result[name] = value;
  });
  return result;
}

function requestData(body: RequestInit["body"]): string | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string") return body;
  throw new AppError("INVALID_INPUT", "browser session request 只接受字符串 body");
}

function playwrightResponse(response: APIResponse): FetchResponse {
  return {
    ok: response.ok(),
    status: response.status(),
    url: response.url(),
    text: () => response.text(),
  };
}

class PlaywrightBrowserPageSession implements BrowserPageSession {
  constructor(private readonly pageValue: Page) {}

  async navigate(url: string): Promise<void> {
    await this.pageValue.goto(url, { waitUntil: "domcontentloaded" });
  }

  currentUrl(): string {
    return this.pageValue.url();
  }

  async waitForUrl(
    predicate: (url: URL) => boolean,
    timeoutMilliseconds: number,
  ): Promise<void> {
    await this.pageValue.waitForURL(predicate, { timeout: timeoutMilliseconds });
  }
}

import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

import {
  chromium,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "playwright-core";

import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import type { FetchLike, FetchResponse } from "../core/types.js";

const browserScope = new AsyncLocalStorage<{
  directory: string;
  headless: boolean;
  session: BrowserSession;
}>();

export async function withBrowserSession<T>(
  account: AccountRecord,
  headless: boolean,
  operation: (session: BrowserSession) => Promise<T>,
): Promise<T> {
  const current = browserScope.getStore();
  if (current?.directory === account.browserDataDir && current.headless === headless) {
    return operation(current.session);
  }
  const session = await openBrowserSession(account, headless);
  try {
    return await browserScope.run(
      { directory: account.browserDataDir, headless, session },
      () => operation(session),
    );
  } finally {
    await session.close();
  }
}

async function openBrowserSession(account: AccountRecord, headless: boolean): Promise<BrowserSession> {
  await mkdir(account.browserDataDir, { recursive: true, mode: 0o700 });
  const context = await chromium.launchPersistentContext(account.browserDataDir, { headless, channel: "chrome" });
  const cookiePath = join(account.configDir, "session-cookies.json");
  try {
    const cookies = await readJsonFile<Parameters<BrowserContext["addCookies"]>[0]>(cookiePath);
    if (cookies) await context.addCookies(cookies);
    return new BrowserSession(context, cookiePath);
  } catch (error) {
    await context.close();
    if (error instanceof SyntaxError) throw new Error("CLI 会话 Cookie 缓存格式无效");
    throw error;
  }
}

export class BrowserSession {
  constructor(
    private readonly context: BrowserContext,
    private readonly cookiePath: string,
  ) {}

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

  async page(): Promise<Page> {
    return this.context.pages()[0] ?? this.context.newPage();
  }

  async login(url: string, isAuthenticated: (url: URL) => boolean): Promise<void> {
    const page = await this.page();
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await this.waitForLogin(isAuthenticated);
  }

  async waitForLogin(isAuthenticated: (url: URL) => boolean): Promise<void> {
    // 用户在官方页面完成账号、扫码或验证码认证，CLI 等待成功落地。
    await (await this.page()).waitForURL(isAuthenticated, { timeout: 180_000, waitUntil: "domcontentloaded" });
  }

  async clearCookies(): Promise<void> {
    await this.context.clearCookies();
  }

  async close(): Promise<void> {
    try {
      await writeJsonFile(this.cookiePath, (await this.context.cookies()).filter((cookie) => cookie.expires === -1));
    } finally {
      await this.context.close();
    }
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
    headers: new Headers(Object.entries(response.headers()).filter(([name]) => name.toLowerCase() !== "set-cookie")),
    text: () => response.text(),
    arrayBuffer: async () => Uint8Array.from(await response.body()).buffer,
  };
}

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

import {
  chromium,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "playwright-core";

import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import type { AuthCredentials } from "./types.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import type { FetchLike, FetchResponse } from "../core/types.js";

const browserScope = new AsyncLocalStorage<{
  directory: string;
  session: BrowserSession;
}>();

export async function withBrowserSession<T>(
  account: AccountRecord,
  headless: boolean,
  operation: (session: BrowserSession) => Promise<T>,
): Promise<T> {
  const current = browserScope.getStore();
  if (current?.directory === account.browserDataDir) {
    return operation(current.session);
  }
  const session = await openBrowserSession(account, headless);
  try {
    return await browserScope.run(
      { directory: account.browserDataDir, session },
      () => operation(session),
    );
  } finally {
    await session.close();
  }
}

async function openBrowserSession(account: AccountRecord, headless: boolean): Promise<BrowserSession> {
  await mkdir(account.browserDataDir, { recursive: true });
  const context = await chromium.launchPersistentContext(account.browserDataDir, { headless, channel: "chrome" });
  const cookiePath = join(account.configDir, "session-cookies.json");
  try {
    const cookies = await readJsonFile<Parameters<BrowserContext["addCookies"]>[0]>(cookiePath);
    if (cookies) await context.addCookies(cookies);
    return new BrowserSession(context, cookiePath);
  } catch (error) {
    await context.close();
    throw error;
  }
}

export class BrowserSession {
  constructor(
    private readonly context: BrowserContext,
    private readonly cookiePath: string,
  ) {}

  readonly request: FetchLike = async (input, init = {}) => {
    const options: NonNullable<
      Parameters<BrowserContext["request"]["fetch"]>[1]
    > = {
      failOnStatusCode: false,
    };
    if (init.method !== undefined) options.method = init.method;
    if (init.headers !== undefined) {
      const headers: Record<string, string> = {};
      new Headers(init.headers).forEach((value, name) => { headers[name] = value; });
      options.headers = headers;
    }
    if (init.body instanceof FormData) {
      const multipart: NonNullable<typeof options.multipart> = {};
      const fields: Array<[string, FormDataEntryValue]> = [];
      init.body.forEach((value, name) => fields.push([name, value]));
      for (const [name, value] of fields) {
        multipart[name] = typeof value === "string" ? value : {
          name: value.name,
          mimeType: value.type || "application/octet-stream",
          buffer: Buffer.from(await value.arrayBuffer()),
        };
      }
      options.multipart = multipart;
    } else if (init.body !== undefined && init.body !== null) {
      options.data = init.body as string;
    }
    if (init.redirect === "manual") options.maxRedirects = 0;

    const response = await this.context.request.fetch(input.toString(), options);
    return playwrightResponse(response);
  };

  async page(): Promise<Page> {
    return this.context.pages()[0] ?? this.context.newPage();
  }

  async cookie(url: string, name: string): Promise<string | undefined> {
    return (await this.context.cookies(url)).find((cookie) => cookie.name === name)?.value;
  }

  async login(url: string, isAuthenticated: (url: URL) => boolean): Promise<void> {
    const page = await this.page();
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
    }
    try {
      await this.completeLogin(isAuthenticated);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new AppError("USER_ACTION_REQUIRED", "学校登录尚未完成，请重新执行命令并在官方页面完成验证");
      }
      throw error;
    }
  }

  async completeLogin(isAuthenticated: (url: URL) => boolean, timeout = 180_000): Promise<void> {
    const page = await this.page();
    const credentials = await readJsonFile<AuthCredentials>(join(dirname(this.cookiePath), "auth.json"));
    if (credentials && new URL(page.url()).hostname === "authserver.nju.edu.cn") {
      await page.locator("#userNameLogin_a").click();
      const form = page.locator("#pwdFromId:visible");
      await form.locator('input[name="username"]').fill(credentials.username);
      await form.locator('#password').fill(credentials.password);
      await form.locator("#login_submit").click();
    }
    await page.waitForURL(isAuthenticated, { timeout, waitUntil: "commit" });
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

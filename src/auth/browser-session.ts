import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";

import {
  chromium,
  request,
  type APIRequestContext,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "playwright-core";

import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import type { AuthCredentials } from "./types.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import type { FetchLike, FetchResponse } from "../core/types.js";
import { dragLoginSlider } from "./slider.js";
import { lockAccount } from "./account-lock.js";

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
  const unlock = await lockAccount(account.configDir);
  try {
    const session = await openBrowserSession(account, headless);
    try {
      return await browserScope.run(
        { directory: account.browserDataDir, session },
        () => operation(session),
      );
    } finally {
      await session.close();
    }
  } finally {
    await unlock();
  }
}

async function openBrowserSession(account: AccountRecord, headless: boolean): Promise<BrowserSession> {
  const cookiePath = join(account.configDir, "session-cookies.json");
  const cookies = await readJsonFile<Awaited<ReturnType<BrowserContext["cookies"]>>>(cookiePath) ?? [];
  const context = await request.newContext({ storageState: { cookies, origins: [] } });
  return new BrowserSession(context, cookiePath, { directory: account.browserDataDir, headless });
}

export class BrowserSession {
  private browserHeadless = false;
  constructor(
    private context: BrowserContext | APIRequestContext,
    private readonly cookiePath: string,
    private readonly browser?: { directory: string; headless: boolean },
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
    const data = init.body as string | undefined;
    if (data !== undefined) options.data = data;
    if (init.redirect === "manual") options.maxRedirects = 0;

    const context = "pages" in this.context ? this.context.request : this.context;
    const response = await context.fetch(input.toString(), options);
    return playwrightResponse(response);
  };

  async page(headless = this.browser?.headless ?? false): Promise<Page> {
    if ("pages" in this.context && this.browser && this.browserHeadless !== headless) {
      const cookies = await this.context.cookies();
      await this.context.close();
      this.context = await request.newContext({ storageState: { cookies, origins: [] } });
    }
    if (!("pages" in this.context)) {
      const previous = this.context;
      const { cookies } = await previous.storageState();
      const { directory } = this.browser!;
      await mkdir(directory, { recursive: true });
      const context = await chromium.launchPersistentContext(directory, { headless, channel: "chrome" });
      try {
        // The current HTTP session is authoritative, including logout and account changes.
        await context.clearCookies();
        await context.addCookies(cookies);
      } catch (error) {
        await context.close();
        throw error;
      }
      this.context = context;
      this.browserHeadless = headless;
      await previous.dispose();
    }
    return this.context.pages()[0] ?? this.context.newPage();
  }

  async login(url: string, isAuthenticated: (url: URL) => boolean): Promise<void> {
    const credentials = await readJsonFile<AuthCredentials>(join(dirname(this.cookiePath), "auth.json"));
    const page = "pages" in this.context
      ? this.context.pages()[0] ?? await this.context.newPage()
      : await this.page(Boolean(credentials));
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("net::ERR_ABORTED")) throw error;
    }
    try {
      await this.completeLogin(isAuthenticated);
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw credentials
          ? new AppError("AUTH_RESTORE_FAILED", "学校登录恢复超时，请检查网络或更新已保存的统一认证凭据")
          : new AppError("USER_ACTION_REQUIRED", "学校登录尚未完成，请在官方页面完成验证");
      }
      throw error;
    }
  }

  async completeLogin(isAuthenticated: (url: URL) => boolean, timeout = 180_000): Promise<void> {
    const page = "pages" in this.context
      ? this.context.pages()[0] ?? await this.context.newPage()
      : await this.page();
    const url = new URL(page.url());
    if (isAuthenticated(url)) return;
    const credentials = await readJsonFile<AuthCredentials>(join(dirname(this.cookiePath), "auth.json"));
    if (credentials && url.hostname === "authserver.nju.edu.cn" && url.pathname === "/authserver/login") {
      await page.locator("#userNameLogin_a").click();
      const form = page.locator("#pwdFromId:visible");
      await form.locator('input[name="username"]').fill(credentials.username);
      await form.locator('#password').fill(credentials.password);
      await form.locator("#login_submit").click();
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await loginResult(page, true);
        if (result !== "slider") break;
        const image = await page.locator("#slider-img1").getAttribute("src");
        if (await dragLoginSlider(page)) {
          await loginResult(page, false);
          break;
        }
        if (attempt === 2) throw new AppError("AUTH_CHALLENGE_FAILED", "学校滑块验证未通过，已自动尝试三张验证图");
        await page.waitForFunction((previous) => {
          const image = document.querySelector<HTMLImageElement>("#slider-img1");
          return image?.getAttribute("src") !== previous
            && !document.querySelector("#sliderDiv .sliderContainer_fail");
        }, image, { timeout: 10_000 });
      }
      await page.waitForURL(isAuthenticated, { timeout: 30_000, waitUntil: "commit" });
      return;
    }
    await page.waitForURL(isAuthenticated, { timeout, waitUntil: "commit" });
  }

  async clearCookies(): Promise<void> {
    if ("pages" in this.context) await this.context.clearCookies();
    else {
      await this.context.dispose();
      this.context = await request.newContext();
    }
  }

  async close(): Promise<void> {
    try {
      const cookies = "pages" in this.context ? await this.context.cookies() : (await this.context.storageState()).cookies;
      await writeJsonFile(this.cookiePath, cookies);
    } finally {
      if ("pages" in this.context) await this.context.close();
      else await this.context.dispose();
    }
  }
}

async function loginResult(page: Page, slider: boolean): Promise<string> {
  const handle = await page.waitForFunction((allowSlider) => {
    if (location.hostname !== "authserver.nju.edu.cn" || location.pathname !== "/authserver/login") return "redirect";
    const message = document.querySelector("#pwdFromId #showErrorTip")?.textContent?.trim();
    if (message) return message;
    const knob = document.querySelector<HTMLElement>("#sliderDiv .slider");
    if (allowSlider && knob?.offsetParent) return "slider";
    return false;
  }, slider, { timeout: 30_000 });
  const result = await handle.jsonValue() as string;
  await handle.dispose();
  if (result !== "slider" && result !== "redirect") throw new AppError("AUTH_REJECTED", `学校拒绝登录：${result}`);
  return result;
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

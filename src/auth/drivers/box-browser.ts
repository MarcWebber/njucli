import { join } from "node:path";
import type { AccountRecord } from "../../account/types.js";
import { AppError } from "../../core/errors.js";
import { readJsonFile } from "../../core/fs.js";
import { BoxClient, BOX_URL } from "../../../skills/njucli-box/scripts/client.js";
import { withBrowserSession } from "../browser-session.js";
import type { AuthCredentials, AuthSessionDriver } from "../types.js";

export const boxSessionDriver = {
  probe(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, true, (session) => new BoxClient(session.request).hasSession());
  },
  login(account: AccountRecord): Promise<boolean> {
    return withBrowserSession(account, false, async (session) => {
      const client = new BoxClient(session.request);
      if (await client.hasSession()) return true;
      const page = await session.page();
      await page.goto(`${BOX_URL}/accounts/login/`, { waitUntil: "domcontentloaded" });
      const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
      if (credentials && new URL(page.url()).pathname === "/accounts/login/") {
        await page.locator('input[name="login"]').fill(credentials.username);
        await page.locator('input[name="password"]').fill(credentials.password);
        await Promise.all([
          page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30_000 }),
          page.locator('#login-form button[type="submit"]').click(),
        ]);
        await page.waitForLoadState("domcontentloaded");
        if (new URL(page.url()).pathname === "/accounts/login/") {
          const message = await page.locator("#login-form .error").innerText();
          if (message.trim()) throw new AppError("AUTH_REQUIRED", `南大云盘登录：${message.trim()}`);
        }
      }
      try {
        await session.completeLogin((url) => url.hostname === "box.nju.edu.cn" && !url.pathname.startsWith("/accounts/"));
      } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") throw new AppError("USER_ACTION_REQUIRED", "南大云盘登录需在官方页面完成验证");
        throw error;
      }
      return client.hasSession();
    });
  },
} satisfies AuthSessionDriver;

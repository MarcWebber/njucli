import { join } from "node:path";
import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { readJsonFile } from "../core/fs.js";
import { withBrowserSession, type BrowserSession } from "./browser-session.js";
import type { AuthCredentials } from "./types.js";
import { MailClient, type MailBinding } from "../../skills/njucli-mail/scripts/client.js";

const MAIL_URL = "https://mail.nju.edu.cn/";

export async function bindMailAccount(account: AccountRecord, credentials?: MailBinding) {
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
}

export async function bindMail(session: BrowserSession, client: MailClient) {
  await session.login(MAIL_URL, (url) => url.origin === new URL(MAIL_URL).origin && url.pathname === "/cgi-bin/frame_html");
  const page = await session.page();
  const address = (await page.locator("#useraddr").innerText()).trim();
  if (!/^[^\s@]+@(?:smail\.)?nju\.edu\.cn$/i.test(address)) throw new Error("邮箱页面未返回完整南大邮箱地址");

  const settings = page.frameLocator("#mainFrame");
  await page.getByRole("link", { name: "设置", exact: true }).click();
  await settings.getByRole("link", { name: "客户端设置", exact: true }).click();
  const imap = settings.locator("#openimap");
  if (!await imap.isChecked()) {
    await imap.check();
    const [response] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.origin === new URL(MAIL_URL).origin && url.pathname === "/cgi-bin/setting4" && response.request().method() === "POST";
      }),
      settings.locator("#sendbtn").click(),
    ]);
    if (!response.ok()) throw new Error(`保存邮箱客户端设置失败：HTTP ${response.status()}`);
    await response.finished();
    // 重新读取官方设置，确认服务端已保存；其余选项沿用原表单。
    await page.getByRole("link", { name: "设置", exact: true }).click();
    await settings.getByRole("link", { name: "客户端设置", exact: true }).click();
    if (!await imap.isChecked()) throw new Error("IMAP 服务开启后回读未生效");
  }

  await page.getByRole("link", { name: "微信绑定", exact: true }).click();
  const [generated] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      const request = response.request();
      return url.origin === new URL(MAIL_URL).origin && url.pathname === "/cgi-bin/wx_token"
        && request.method() === "POST" && new URLSearchParams(request.postData() ?? "").get("act") === "add_spwd";
    }, { timeout: 30_000 }),
    settings.getByRole("link", { name: "生成新密码", exact: true }).click(),
  ]);
  if (!generated.ok()) throw new Error(`生成邮箱专用密码失败：HTTP ${generated.status()}`);
  const result = await generated.json() as { errcode: string | number; data?: { passwd?: string } };
  if (String(result.errcode) !== "0" || !result.data?.passwd) throw new Error("官方邮箱未返回专用密码，请查看官方页面的安全验证提示");
  return client.bind(address, result.data.passwd);
}

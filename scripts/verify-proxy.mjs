import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withBrowserSession } from "../dist/src/auth/browser-session.js";

if (!process.env.NJUCLI_PROXY_URL) throw new Error("请通过 NJUCLI_PROXY_URL 指定实际 HTTP 代理");
let secrets;
try {
  const proxy = new URL(process.env.NJUCLI_PROXY_URL);
  const username = decodeURIComponent(proxy.username), password = decodeURIComponent(proxy.password);
  secrets = [proxy.href, process.env.NJUCLI_PROXY_URL, username, password, Buffer.from(`${username}:${password}`).toString("base64")].filter(Boolean);
}
catch { throw new Error("NJUCLI_PROXY_URL 须为有效的 HTTP 代理 URL"); }
const target = new URL(process.env.NJUCLI_PROXY_VERIFY_URL || "https://mirror.nju.edu.cn/configs/tunasync.json");
assert.equal(target.protocol, "https:");
assert.ok(!target.username && !target.password, "验证目标须为无需登录的公开 JSON");
const directory = await mkdtemp(join(tmpdir(), "njucli-proxy-verify-"));
const account = { name: "proxy-verification", configDir: join(directory, "config"), browserDataDir: join(directory, "browser") };
const checks = [];
try {
  await withBrowserSession(account, true, async session => {
    const checkRequest = async phase => {
      const response = await session.request(target.href);
      assert.ok(response.ok, `${phase}: HTTP ${response.status}`);
      JSON.parse(await response.text());
      checks.push({ phase, status: response.status });
    };
    const checkPage = async headless => {
      const page = await session.page(headless);
      const response = await page.goto(target.href, { waitUntil: "domcontentloaded", timeout: 45_000 });
      assert.ok(response?.ok(), `browser-${headless ? "headless" : "headed"}: HTTP ${response?.status()}`);
      JSON.parse(await response.text());
      checks.push({ phase: headless ? "browser-headless" : "browser-headed", status: response.status() });
    };
    await checkRequest("http");
    await session.clearCookies();
    await checkRequest("http-after-clear");
    await checkPage(true);
    await checkPage(false);
    await session.clearCookies();
    await checkRequest("browser-request-after-clear");
  });
  console.log(JSON.stringify({ ok: true, target: target.origin + target.pathname, checks }));
} catch (error) {
  let message = String(error?.message ?? error);
  for (const secret of secrets) {
    message = message.replaceAll(secret, "[redacted]");
  }
  console.error(JSON.stringify({ ok: false, checks, error: error?.name || "Error", message }));
  process.exitCode = 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}

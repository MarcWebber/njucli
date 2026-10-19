import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright-core";
import { withBrowserSession } from "../dist/src/auth/browser-session.js";

test("认证会话：代理认证、清空 Cookie 后继续代理与浏览器配置", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-proxy-"));
  const previous = process.env.NJUCLI_PROXY_URL;
  const sockets = new Set();
  const targetRequests = [], proxyRequests = [];
  const username = "test user", password = "synthetic@password:/";
  const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
  const target = createServer((req, res) => {
    targetRequests.push({ path: req.url, cookie: req.headers.cookie, proxyAuthorization: req.headers["proxy-authorization"] });
    if (req.url === "/seed") res.setHeader("set-cookie", "session=synthetic; Path=/");
    res.end("local target reached through proxy");
  });
  const proxy = createServer();
  for (const server of [target, proxy]) {
    server.on("connection", socket => {
      sockets.add(socket);
      socket.once("close", () => sockets.delete(socket));
    });
  }
  t.after(async () => {
    if (previous === undefined) delete process.env.NJUCLI_PROXY_URL;
    else process.env.NJUCLI_PROXY_URL = previous;
    for (const socket of sockets) socket.destroy();
    await Promise.all([target, proxy].map(server => new Promise(resolve => server.close(resolve))));
    await rm(directory, { recursive: true, force: true });
  });
  target.listen(0, "127.0.0.1");
  proxy.listen(0, "127.0.0.1");
  await Promise.all([once(target, "listening"), once(proxy, "listening")]);
  const address = `proxy-target.invalid:${target.address().port}`;
  proxy.on("connect", (req, socket, head) => {
    proxyRequests.push({ address: req.url, authorization: req.headers["proxy-authorization"] });
    if (req.url !== address || req.headers["proxy-authorization"] !== authorization) {
      socket.end("HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic\r\n\r\n");
      return;
    }
    const upstream = connect(target.address().port, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length) upstream.write(head);
      socket.pipe(upstream);
      upstream.pipe(socket);
    });
    sockets.add(upstream);
    upstream.once("close", () => sockets.delete(upstream));
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  const server = `http://127.0.0.1:${proxy.address().port}`;
  process.env.NJUCLI_PROXY_URL = `http://${encodeURIComponent(username)}:${encodeURIComponent(password)}@127.0.0.1:${proxy.address().port}`;
  let browserOptions;
  t.mock.method(chromium, "launchPersistentContext", async (_directory, options) => {
    browserOptions = options;
    return { pages: () => [{}], clearCookies: async () => {}, addCookies: async () => {}, cookies: async () => [], close: async () => {} };
  });
  const account = { name: "proxy", configDir: join(directory, "config"), browserDataDir: join(directory, "browser") };
  await withBrowserSession(account, true, async session => {
    assert.equal(await (await session.request(`http://${address}/seed`)).text(), "local target reached through proxy");
    await session.request(`http://${address}/before-clear`);
    await session.clearCookies();
    assert.equal(await (await session.request(`http://${address}/after-clear`)).text(), "local target reached through proxy");
    await session.page();
  });
  assert.deepEqual(targetRequests, [
    { path: "/seed", cookie: undefined, proxyAuthorization: undefined },
    { path: "/before-clear", cookie: "session=synthetic", proxyAuthorization: undefined },
    { path: "/after-clear", cookie: undefined, proxyAuthorization: undefined },
  ]);
  assert.ok(proxyRequests.length >= 2, "clearing cookies must recreate an authenticated proxy connection");
  for (const request of proxyRequests) assert.deepEqual(request, { address, authorization });
  assert.deepEqual(browserOptions.proxy, { server, username, password });
  assert.equal(browserOptions.headless, true);
});

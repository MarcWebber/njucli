import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Command } from "commander";
import { AuthCoordinator } from "../dist/auth/coordinator.js";
import { BrowserSession } from "../dist/auth/browser-session.js";
import { SessionStore } from "../dist/auth/session-store.js";
import { AUTH_CAPABILITIES } from "../dist/auth/types.js";
import { registerCampusCommands } from "../dist/commands/campus.js";
import { registerTexCommands } from "../dist/commands/tex.js";
import { CampusClient } from "../dist/domains/campus/client.js";
import { listCampusSources } from "../dist/domains/campus/sources/registry.js";
import { TexClient } from "../dist/domains/tex/client.js";

async function command(register, service, args) {
  let stdout = "", stderr = "", code;
  const program = new Command().exitOverride();
  register(program, service, {
    environment: { NJUCLI_FORMAT: "json" },
    output: { stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; } },
    setExitCode: (value) => { code = value; },
  });
  await program.parseAsync(args, { from: "user" });
  assert.equal(stderr, "");
  return { code, ...JSON.parse(stdout) };
}

async function localHttp(t, handler) {
  const server = createServer(handler).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  return async (input, init) => {
    const url = new URL(input);
    const response = await fetch(origin + url.pathname + url.search, init);
    // 请求仅访问本机，响应地址保留远端契约，供 client 解析。
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  };
}

test("认证：登录交接、依赖顺序、刷新落盘与主动退出", async (t) => {
  const configDir = await mkdtemp(join(tmpdir(), "njucli-auth-"));
  t.after(() => rm(configDir, { recursive: true, force: true }));
  const account = { name: "integration", configDir, browserDataDir: join(configDir, "browser") };
  const calls = [];
  const browserCalls = [];
  const page = {
    goto: async (url) => { browserCalls.push(url); },
    waitForURL: async (ready, options) => {
      assert.equal(ready(new URL("https://login.example/verification")), false);
      assert.equal(ready(new URL("https://login.example/home")), true);
      assert.equal(options.timeout, 180_000);
      browserCalls.push("认证完成");
    },
  };
  const session = new BrowserSession({ pages: () => [page] }, join(configDir, "session-cookies.json"));
  let valid = true;
  const drivers = Object.fromEntries(AUTH_CAPABILITIES.map((capability) => [capability, {
    login: async () => { calls.push(`login:${capability}`); return true; },
    probe: async () => { calls.push(`probe:${capability}`); return valid; },
    logout: async () => { calls.push(`logout:${capability}`); },
  }]));
  drivers.sso.login = async () => {
    calls.push("login:sso");
    await session.login("https://login.example/", (url) => url.pathname === "/home");
    return true;
  };
  let auth = new AuthCoordinator({ drivers, sessions: new SessionStore() });
  await auth.login(account, "timetable");
  assert.deepEqual(calls.splice(0), ["login:sso", "login:ehall", "login:timetable"]);
  assert.deepEqual(browserCalls, ["https://login.example/", "认证完成"]);

  auth = new AuthCoordinator({ drivers, sessions: new SessionStore() });
  assert.equal((await auth.ensureSession(account, "timetable")).status, "valid");
  assert.deepEqual(calls.splice(0), ["probe:timetable"]);
  valid = false;
  await assert.rejects(auth.ensureSession(account, "timetable"), { code: "AUTH_REFRESH_FAILED" });
  assert.equal((await new SessionStore().get(account, "timetable")).status, "expired");
  valid = true;
  assert.equal((await auth.refresh(account, "timetable"))[0].status, "valid");
  calls.length = 0;

  await auth.logout(account, "sso");
  assert.deepEqual(calls.splice(0), ["logout:timetable", "logout:ehall", "logout:sso"]);
  await assert.rejects(auth.ensureSession(account, "timetable"), { code: "AUTH_REQUIRED" });
  assert.deepEqual(await auth.refresh(account), []);
  assert.deepEqual(calls, []);
  const path = join(configDir, "sessions.json");
  assert.ok(JSON.parse(await readFile(path, "utf8")).every((s) => s.status === "logged-out"));
  if (process.platform !== "win32") assert.equal((await stat(path)).mode & 0o777, 0o600);
});

test("校园信息：命令、栏目配置、分页与正文解析", async (t) => {
  const requests = [];
  const request = await localHttp(t, (req, res) => {
    requests.push(req.url);
    res.setHeader("content-type", "text/html");
    res.end(req.url.startsWith("/ggtz/")
      ? '<div class="col_news_list"><ul class="news_list"><li class="news"><span class="news_title"><a href="/aa/bb/c1a2/page.htm">选课通知</a></span><span class="news_meta">2026-09-22</span></li></ul></div>'
      : '<h1 class="arti_title">选课通知</h1><div class="arti_metas"><span class="arti_update">2026-09-22</span></div><div class="wp_articlecontent"><p>下周开始选课。</p></div>');
  });
  const service = Object.assign(new CampusClient(request), { sources: listCampusSources });
  const sources = await command(registerCampusCommands, service, ["campus", "sources"]);
  assert.equal(sources.code, 0);
  assert.equal(sources.data.length, 8);
  assert.deepEqual(Object.keys(sources.data[0].sections[0]), ["id", "name", "url"]);
  const scope = ["--source", "academic-affairs", "--section", "notifications"];
  const list = await command(registerCampusCommands, service, ["campus", "articles", ...scope, "--page", "2"]);
  assert.equal(list.code, 0);
  assert.equal(list.data.items[0].publishedOn, "2026-09-22");
  const article = await command(registerCampusCommands, service, ["campus", "article", list.data.items[0].articleId, ...scope]);
  assert.equal(article.code, 0);
  assert.equal(article.data.content, "下周开始选课。");
  assert.deepEqual(requests, ["/ggtz/list2.htm", "/aa/bb/c1a2/page.htm"]);
});

test("TeX：确认创建、单次提交回读、HTTP 失败与编译日志", async (t) => {
  const requests = [];
  let submitted;
  const request = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    requests.push(`${req.method} ${url.pathname}`);
    if (url.pathname === "/build.log") {
      res.setHeader("content-type", "text/plain");
      res.end("! Undefined control sequence.\nNo pages of output.\n");
      return;
    }
    if (url.searchParams.get("projectName") === "unavailable") {
      res.writeHead(503).end();
      return;
    }
    const row = { projectKey: "test-project", projectName: "论文", selectedVersion: { versionNo: "v1" } };
    let result;
    if (req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      submitted = JSON.parse(body);
      result = { projectKey: row.projectKey };
    } else {
      result = { list: [row], pinnedList: [row], hasMore: false };
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ status: { code: 1 }, result }));
  });
  const client = new TexClient(request);
  const missingConfirmation = await command(registerTexCommands, client, ["tex", "create", "论文"]);
  assert.equal(missingConfirmation.code, 4);
  assert.equal(missingConfirmation.error.code, "CONFIRMATION_REQUIRED");
  assert.deepEqual(requests, []);
  const created = await command(registerTexCommands, client, ["tex", "create", " 论文 ", "--yes"]);
  assert.equal(created.code, 0);
  assert.equal(created.data.projectKey, "test-project");
  assert.equal(created.data.versionNo, "v1");
  assert.deepEqual(submitted, { projectName: "论文" });
  assert.deepEqual(requests.splice(0), ["POST /api/project", "GET /api/project"]);
  const failure = await command(registerTexCommands, client, ["tex", "projects", "unavailable"]);
  assert.equal(failure.ok, false);
  assert.equal(failure.code, 1);
  assert.match(failure.error.message, /503/);
  assert.deepEqual(requests.splice(0), ["GET /api/project"]);
  await assert.rejects(client.pdf("test-project", "v1", {
    logUrl: "https://latex-file.texpageusercontent.com/build.log",
    pdfUrl: "https://latex-file.texpageusercontent.com/old.pdf",
  }), /TeX 编译失败/);
  assert.deepEqual(requests, ["GET /build.log"]);
});

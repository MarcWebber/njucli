import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readlink, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import { Command } from "commander";
import { AccountStore } from "../dist/account/store.js";
import { createProductionServices } from "../dist/app/production.js";
import { AuthCoordinator } from "../dist/auth/coordinator.js";
import { BrowserSession, withBrowserSession } from "../dist/auth/browser-session.js";
import { texSessionDriver } from "../dist/auth/drivers/tex-browser.js";
import { ssoSessionDriver } from "../dist/auth/drivers/sso-browser.js";
import { SessionStore } from "../dist/auth/session-store.js";
import { AUTH_CAPABILITIES } from "../dist/auth/types.js";
import { registerCampusCommands } from "../dist/commands/campus.js";
import { registerAuthCommands } from "../dist/commands/auth.js";
import { registerTexCommands } from "../dist/commands/tex.js";
import { registerMailCommands } from "../dist/commands/mail.js";
import { registerSoftSeCommands } from "../dist/commands/softse.js";
import { registerYouthCommands } from "../dist/commands/youth.js";
import { YouthClient } from "../dist/domains/youth/client.js";
import { registerEHallCommands } from "../dist/commands/ehall.js";
import { CampusClient } from "../dist/domains/campus/client.js";
import { listCampusSources } from "../dist/domains/campus/sources/registry.js";
import { TexClient } from "../dist/domains/tex/client.js";
import { MailClient } from "../dist/domains/mail/client.js";
import { SoftSeClient } from "../dist/domains/softse/client.js";
import { EHallTripClient } from "../dist/domains/ehall/trip.js";
import { bindMail } from "../dist/domains/mail/bind.js";
import { registerSoftwareCommands } from "../dist/commands/software.js";
import { SoftwareClient } from "../dist/domains/software/client.js";
import { saveFile, writeJsonFile } from "../dist/core/fs.js";
import { AppError } from "../dist/core/errors.js";
import { installSkills } from "../scripts/install-skills.mjs";
import { registerUpgradeCommand } from "../dist/commands/upgrade.js";

async function command(register, service, args) {
  let stdout = "", stderr = "", code;
  const program = new Command().exitOverride();
  register(program, service, {
    environment: { NJUCLI_FORMAT: "json" },
    output: { stdout: (s) => { stdout += s; }, stderr: (s) => { stderr += s; } },
    setExitCode: (value) => { code = value; },
  });
  await program.parseAsync(args, { from: "user" });
  return { code, stderr, ...JSON.parse(stdout) };
}

async function localHttp(t, handler) {
  const server = createServer(handler).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = globalThis.fetch;
  return async (input, init) => {
    const url = new URL(input);
    const response = await request(origin + url.pathname + url.search, init);
    // 请求仅访问本机，响应地址保留远端契约，供 client 解析。
    Object.defineProperty(response, "url", { value: url.href });
    return response;
  };
}

test("青年平台：站点会话、学年时长、本人活动与不同账号隔离", async (t) => {
  const calls = [];
  const activity = { id: 7, mc: "校园服务", xn: { id: "2025-2026" }, xm: { ssxy: { mc: "学院" } }, hddd: "校园", hdks: null, hdjs: null, bmks: null, bmjs: null, currentState: { id: "99" } };
  const registration = { id: 12, hd: activity, shzt: { label: "审核通过" }, fwzsc: 10, fwsc: 8, jtsc: 2, pxsc: 2 };
  let identity = "student-one";
  const http = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://youth.nju.edu.cn");
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    calls.push({ path: url.pathname, query: url.searchParams, method: req.method, body: Buffer.concat(buffers).toString() });
    res.setHeader("content-type", "application/json");
    const send = (data, extra = {}) => res.end(JSON.stringify({ code: 0, data, extend: {}, pageIndex: Number(url.searchParams.get("page") || 1), pageSize: Number(url.searchParams.get("limit") || 20), ...extra }));
    if (url.pathname === "/tw/") return res.end("<title>学生第二课堂</title>");
    if (url.pathname === "/tw/ctx") return send(Buffer.from(JSON.stringify({ userId: identity, name: "学生", departmentName: "学院", anonymous: false, menus: [{ id: `menu-${identity}`, type: "PC", name: "我的活动", urlN: "/zyz/wdhd" }] })).toString("base64"));
    assert.equal(url.searchParams.get(".me"), Buffer.from(`menu-${identity}`).toString("base64"));
    if (url.pathname === "/tw/zyz/wdhd/fwsc") {
      assert.equal(req.method, "POST");
      assert.equal(url.searchParams.get("xnid"), "2025-2026");
      return send(null, { extend: { fwzsc: "10.0", cjhds: "1" } });
    }
    if (url.pathname === "/tw/zyz/wdhd/ajaxList") {
      assert.equal(url.searchParams.get("queryType"), "all");
      return send([registration, { ...registration, id: 13, hd: { ...activity, id: 8, xn: null, currentState: null } }], { count: 2 });
    }
    if (url.pathname === "/tw/common/selector") return send([{ value: "2025-2026", label: "2025-2026学年" }]);
    res.statusCode = 404; res.end();
  });
  const first = new YouthClient(http);
  assert.equal(await first.restoreSession(), true);
  assert.deepEqual(calls.slice(0, 2).map((call) => [call.method, call.path]), [["GET", "/tw/"], ["POST", "/tw/ctx"]]);
  assert.deepEqual(await first.hours("2025-2026"), { year: "2025-2026", hours: 10, activities: 1 });
  const page = await first.activities({ mine: true, year: "2025-2026", page: 2, size: 5 });
  assert.equal(page.page, 2); assert.equal(page.total, 2);
  assert.equal(page.items[0].registrationId, "12");
  assert.equal(page.items[0].hours, 10); assert.equal(page.items[0].serviceHours, 8);
  assert.equal(page.items[1].hours, null); assert.equal(page.items[1].year, null);
  assert.deepEqual(await first.years(), [{ id: "2025-2026", name: "2025-2026学年" }]);
  identity = "student-two";
  const second = new YouthClient(http);
  await second.restoreSession();
  await second.hours("2025-2026");
  assert.equal(calls.filter((call) => call.path === "/tw/ctx").length, 2);
});

test("青年平台：报名单次提交、跨页回读、培训状态与远端错误", async (t) => {
  let enrolled = false, trainingEnrolled = false, reject = false;
  const writes = [];
  const http = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://youth.nju.edu.cn");
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = new URLSearchParams(Buffer.concat(buffers).toString());
    const send = (data, extra = {}) => res.end(JSON.stringify({ code: 0, data, extend: {}, pageIndex: Number(url.searchParams.get("page") || 1), pageSize: Number(url.searchParams.get("limit") || 20), ...extra }));
    if (url.pathname === "/tw/ctx") return send(Buffer.from(JSON.stringify({ anonymous: false, userId: "one", menus: [] })).toString("base64"));
    if (req.method === "POST") {
      writes.push(url.pathname);
      if (reject) return res.end(JSON.stringify({ code: 1, msg: "报名已截止" }));
      if (url.pathname === "/tw/zyz/hdzx/bm") {
        assert.equal(url.searchParams.get("hdid"), "42");
        assert.equal(url.searchParams.get("mm"), "event-password");
        assert.equal(body.get("bhdrs"), "校园服务");
        assert.equal(body.get("zwys"), "有经验");
        assert.equal(body.get("qq"), "12345");
        enrolled = true;
      } else if (url.pathname.endsWith("/qxbm")) enrolled = false;
      else if (url.pathname.endsWith("/saveBm")) trainingEnrolled = true;
      else if (url.pathname.endsWith("/qxBm")) trainingEnrolled = false;
      return send(null);
    }
    if (url.pathname === "/tw/zyz/wdhd/ajaxList") {
      const target = { id: 25, hd: { id: 42, mc: "活动", xn: { id: "2025-2026" }, xm: { ssxy: { mc: "学院" } }, hddd: "校园", currentState: { id: "1" } }, shzt: { label: "待审核" } };
      return send(enrolled && url.searchParams.get("page") === "2" ? [target] : [], { count: enrolled ? 21 : 0 });
    }
    if (url.pathname === "/tw/zyz/pxgl/bm/ajaxList") return send([{ id: 9, mc: "培训", bmzt: trainingEnrolled }], { count: 1 });
    res.statusCode = 404; res.end();
  });
  const client = new YouthClient(http);
  const result = await client.enroll("42", { understanding: "校园服务", strengths: "有经验", qq: "12345", password: "event-password" });
  assert.equal(result.registrationId, "25");
  assert.deepEqual(await client.cancel("25"), { registrationId: "25", cancelled: true });
  assert.equal((await client.enrollTraining("9")).bmzt, true);
  assert.equal((await client.cancelTraining("9")).bmzt, false);
  assert.equal(writes.length, 4);
  reject = true;
  await assert.rejects(client.enrollTraining("9"), /报名已截止/);
  assert.equal(writes.length, 5);
  const forbidden = new YouthClient(async () => ({ status: 403, ok: false, url: "https://youth.nju.edu.cn/tw/", text: async () => "" }));
  await assert.rejects(forbidden.restoreSession(), /HTTP 403/);
  const redirected = new YouthClient(async () => ({ status: 200, ok: true, url: "https://authserver.nju.edu.cn/authserver/login", text: async () => "login" }));
  assert.equal(await redirected.restoreSession(), false);
});

test("青年平台：CLI 分页筛选、文档详情与成绩单文件保存", async (t) => {
  const calls = [];
  const service = {
    activities: async (options) => { calls.push(["activities", options]); return { page: 1, total: 0, items: [] }; },
    practiceTeams: async (options) => { calls.push(["practiceTeams", options]); return { page: 2, total: 0, items: [] }; },
    clubs: async (options) => { calls.push(["clubs", options]); return { page: 1, total: 0, items: [] }; },
    tickets: async (options) => { calls.push(["tickets", options]); return { page: 1, total: 0, items: [] }; },
    recruitments: async (options) => { calls.push(["recruitments", options]); return { page: 1, total: 0, items: [] }; },
  };
  assert.equal((await command(registerYouthCommands, service, ["youth", "activities", "服务", "--mine", "--year", "2025-2026"])).code, 0);
  assert.equal(calls[0][1].query, "服务"); assert.equal(calls[0][1].mine, true);
  await command(registerYouthCommands, service, ["youth", "practice-teams", "乡村", "--page", "2", "--size", "5"]);
  assert.equal(calls[1][1].page, 2); assert.equal(calls[1][1].query, "乡村");
  await command(registerYouthCommands, service, ["youth", "clubs", "--mine", "--category", "3"]);
  assert.equal(calls[2][1].mine, true); assert.equal(calls[2][1].category, "3");
  await command(registerYouthCommands, service, ["youth", "tickets", "音乐", "--mine"]);
  assert.equal(calls[3][1].query, "音乐");
  await command(registerYouthCommands, service, ["youth", "recruitments", "--mine"]);
  assert.equal(calls[4][1].mine, true);
  const invalid = await command(registerYouthCommands, service, ["youth", "activities", "--page", "0"]);
  assert.equal(invalid.error.code, "INVALID_INPUT"); assert.equal(calls.length, 5);

  const directory = await mkdtemp(join(tmpdir(), "njucli-youth-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const http = await localHttp(t, (req, res) => {
    if (req.url.startsWith("/tw/ctx")) return res.end(JSON.stringify({ code: 0, data: Buffer.from(JSON.stringify({ userId: "self", anonymous: false, menus: [] })).toString("base64") }));
    if (req.url.startsWith("/tw/zyz/hdzx/7/update")) return res.end('<body><div class="layui-inline"><label class="layui-form-label">活动地点</label><input value="校园"></div><p>活动说明</p><a href="attachment.pdf">附件</a><script>secret-script</script></body>');
    assert.match(req.url, /xh=self/);
    res.setHeader("content-disposition", 'attachment; filename="transcript.pdf"'); res.end("%PDF-synthetic");
  });
  const client = new YouthClient(http);
  const detail = await client.activity("7");
  assert.deepEqual(detail.fields, [{ label: "活动地点", value: "校园" }]);
  assert.equal(detail.links[0].url, "https://youth.nju.edu.cn/tw/zyz/hdzx/7/attachment.pdf");
  assert.doesNotMatch(detail.text, /secret-script/);
  const output = join(directory, "transcript.pdf");
  assert.equal((await client.exportTranscript(output)).bytes, 14);
  assert.equal((await stat(output)).mode & 0o777, 0o600);
});

test("安装：全局 Skill 链接、重复安装与同名内容保护", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-install-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packageRoot = join(directory, "package");
  const skillsRoot = join(directory, "codex", "skills");
  for (const name of ["njucli-auth", "njucli-tex"]) {
    await mkdir(join(packageRoot, "skills", name), { recursive: true });
    await writeFile(join(packageRoot, "skills", name, "SKILL.md"), "first version");
  }
  assert.deepEqual(await installSkills(packageRoot, skillsRoot), ["njucli-auth", "njucli-tex"]);
  await installSkills(packageRoot, skillsRoot);
  assert.equal(await readlink(join(skillsRoot, "njucli-auth")), join(await realpath(packageRoot), "skills", "njucli-auth"));
  await writeFile(join(packageRoot, "skills", "njucli-auth", "SKILL.md"), "upgraded version");
  assert.equal(await readFile(join(skillsRoot, "njucli-auth", "SKILL.md"), "utf8"), "upgraded version");
  const occupiedRoot = join(directory, "occupied");
  await mkdir(join(occupiedRoot, "njucli-tex"), { recursive: true });
  await writeFile(join(occupiedRoot, "njucli-tex", "SKILL.md"), "user content");
  await assert.rejects(installSkills(packageRoot, occupiedRoot), /已被其他内容占用/);
  assert.equal(await readFile(join(occupiedRoot, "njucli-tex", "SKILL.md"), "utf8"), "user content");
  await assert.rejects(stat(join(occupiedRoot, "njucli-auth")), { code: "ENOENT" });
});

test("升级：远端 main、JSON 输出、失败退出码与临时目录清理", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-upgrade-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const log = join(directory, "calls.json");
  await writeFile(join(directory, "bash"), `#!${process.execPath}\n
import fs from 'node:fs';
fs.writeFileSync(process.env.UPGRADE_TEST_LOG, JSON.stringify({args:process.argv.slice(2),cwd:process.cwd()}));
console.log('install progress');
process.exit(Number(process.env.UPGRADE_TEST_EXIT));
`, { mode: 0o755 });
  const run = (exit) => command((program, _, runtime) => registerUpgradeCommand(program, {
    ...runtime,
    environment: { ...process.env, NJUCLI_FORMAT: "json", PATH: directory, UPGRADE_TEST_LOG: log, UPGRADE_TEST_EXIT: String(exit) },
  }), {}, ["upgrade"]);
  const success = await run(0);
  assert.equal(success.code, 0);
  assert.equal(success.data.source, "https://github.com/MarcWebber/njucli/tree/main");
  assert.match(success.stderr, /install progress/);
  const call = JSON.parse(await readFile(log, "utf8"));
  assert.deepEqual(call.args, [join(process.cwd(), "scripts", "install.sh")]);
  await assert.rejects(stat(call.cwd), { code: "ENOENT" });
  const failure = await run(9);
  assert.equal(failure.code, 1);
  assert.match(failure.error.message, /退出码 9/);
});

test("认证：本地凭据、自动恢复与普通网络错误", async (t) => {
  const configDir = await mkdtemp(join(tmpdir(), "njucli-auth-"));
  t.after(() => rm(configDir, { recursive: true, force: true }));
  const account = { name: "integration", configDir, browserDataDir: join(configDir, "browser") };
  const credentials = { username: "sso-student", password: "synthetic-sso-secret" };
  await writeJsonFile(join(configDir, "auth.json"), credentials);
  assert.equal((await stat(join(configDir, "auth.json"))).mode & 0o777, 0o600);
  const calls = [], fills = [];
  const form = { locator: (selector) => ({
    fill: async (value) => { fills.push([selector, value]); },
    click: async () => { calls.push("submit:sso"); },
  }) };
  const page = {
    goto: async () => {},
    url: () => "https://authserver.nju.edu.cn/authserver/login",
    locator: (selector) => selector === "#pwdFromId:visible" ? form : {
      click: async () => {}, waitFor: () => new Promise(() => {}), isVisible: async () => false,
    },
    waitForURL: async (ready) => { assert.equal(ready(new URL("https://ehall.nju.edu.cn/new/index.html")), true); },
    waitForFunction: async () => ({ jsonValue: async () => "redirect", dispose: async () => {} }),
  };
  const session = new BrowserSession({ pages: () => [page] }, join(configDir, "session-cookies.json"));
  const valid = new Set();
  const drivers = Object.fromEntries(AUTH_CAPABILITIES.map((capability) => [capability, {
    login: async () => { calls.push(`login:${capability}`); valid.add(capability); return true; },
    probe: async () => { calls.push(`probe:${capability}`); return valid.has(capability); },
    logout: async () => { calls.push(`logout:${capability}`); valid.delete(capability); },
  }]));
  drivers.sso.login = async () => {
    await session.login("https://authserver.nju.edu.cn/authserver/login", (url) => url.hostname === "ehall.nju.edu.cn");
    valid.add("sso");
    return true;
  };
  const auth = new AuthCoordinator({ drivers, sessions: new SessionStore() });
  assert.equal((await auth.ensureSession(account, "timetable")).status, "valid");
  assert.deepEqual(fills, [['input[name="username"]', credentials.username], ["#password", credentials.password]]);
  assert.equal(calls.filter((c) => c === "login:timetable").length, 1);
  calls.length = 0;
  await auth.ensureSession(account, "timetable");
  assert.deepEqual(calls, ["probe:timetable"]);
  await auth.logout(account, "sso");
  assert.equal((await new SessionStore().list(account)).find((s) => s.capability === "timetable").status, "logged-out");
  assert.equal((await auth.ensureSession(account, "timetable")).status, "valid");
  calls.length = 0;
  await assert.rejects(auth.ensureSession(account, "timetable", async () => { throw new Error("network down"); }), /network down/);
  assert.deepEqual(calls, []);
  page.waitForURL = async () => { throw Object.assign(new Error("login timeout"), { name: "TimeoutError" }); };
  await assert.rejects(session.login("https://authserver.nju.edu.cn/authserver/login", (url) => url.hostname === "ehall.nju.edu.cn"), { code: "AUTH_RESTORE_FAILED" });
  page.waitForFunction = async () => ({ jsonValue: async () => "账号或密码错误", dispose: async () => {} });
  await assert.rejects(session.login("https://authserver.nju.edu.cn/authserver/login", (url) => url.hostname === "ehall.nju.edu.cn"), { code: "AUTH_REJECTED", message: "学校拒绝登录：账号或密码错误" });
});

test("认证：跨进程调用使用最新 Cookie，崩溃后恢复，账号相互独立", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-auth-lock-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: "lock", configDir: directory, browserDataDir: join(directory, "browser") };
  const server = createServer((req, res) => {
    if (req.url === "/rotate") res.setHeader("set-cookie", "session=synthetic-new; Path=/; HttpOnly");
    res.end(req.headers.cookie ?? "");
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const module = new URL("../dist/auth/browser-session.js", import.meta.url).href;
  const child = (body, expectedSignal = null) => {
    const process = spawn(globalThis.process.execPath, ["--input-type=module", "-e", `
      import { withBrowserSession } from ${JSON.stringify(module)};
      const account = ${JSON.stringify(account)};
      const origin = ${JSON.stringify(origin)};
      ${body}
    `]);
    let output = "", errors = "";
    t.after(() => { if (process.exitCode === null && process.signalCode === null) process.kill("SIGKILL"); });
    process.stdout.on("data", (chunk) => { output += chunk; });
    process.stderr.on("data", (chunk) => { errors += chunk; });
    const completed = once(process, "close").then(([code, signal]) => {
      assert.equal(signal, expectedSignal, errors);
      assert.equal(code, expectedSignal ? null : 0, errors); return output;
    });
    return { process, completed };
  };
  let reader;
  await withBrowserSession(account, false, async (session) => {
    await session.request(`${origin}/rotate`);
    reader = child('console.log("starting"); await withBrowserSession(account, true, async (session) => { console.log(await (await session.request(origin + "/check")).text()); });');
    await once(reader.process.stdout, "data");
    await delay(250);
    assert.equal(reader.process.exitCode, null);
    const second = { ...account, configDir: join(directory, "second"), browserDataDir: join(directory, "second-browser") };
    await withBrowserSession(second, true, async (session) => {
      assert.equal(await (await session.request(`${origin}/check`)).text(), "");
    });
  });
  assert.match(await reader.completed, /session=synthetic-new/);
  const crashed = child('await withBrowserSession(account, true, async () => { console.log("locked"); setInterval(() => {}, 1000); await new Promise(() => {}); });', "SIGKILL");
  await once(crashed.process.stdout, "data");
  crashed.process.kill("SIGKILL");
  await crashed.completed;
  await withBrowserSession(account, true, async (session) => {
    assert.match(await (await session.request(`${origin}/check`)).text(), /session=synthetic-new/);
  });
  await assert.rejects(stat(join(directory, "session.lock")), { code: "ENOENT" });
  await assert.rejects(withBrowserSession(account, true, async () => { throw new Error("business failed once"); }), /business failed once/);
  await assert.rejects(stat(join(directory, "session.lock")), { code: "ENOENT" });
});

test("认证：定时维护自动恢复失效会话并保存，后续调用复用且不重复登录", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-maintain-"));
  const variables = ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "NJUCLI_ACCOUNT"];
  const previous = Object.fromEntries(variables.map((name) => [name, process.env[name]]));
  t.after(async () => {
    for (const name of variables) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    await rm(directory, { recursive: true, force: true });
  });
  process.env.XDG_CONFIG_HOME = directory;
  process.env.XDG_DATA_HOME = directory;
  delete process.env.NJUCLI_ACCOUNT;
  const server = createServer((req, res) => {
    if (req.url === "/login") res.setHeader("set-cookie", "session=synthetic-maintained; Path=/; HttpOnly");
    res.end(req.headers.cookie?.includes("synthetic-maintained") ? "valid" : "expired");
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  let logins = 0;
  t.mock.method(ssoSessionDriver, "probe", (account) => withBrowserSession(account, true, async (session) =>
    await (await session.request(`${origin}/check`)).text() === "valid"));
  t.mock.method(ssoSessionDriver, "login", (account) => withBrowserSession(account, true, async (session) => {
    assert.equal(JSON.parse(await readFile(join(account.configDir, "auth.json"), "utf8")).password, "synthetic-secret");
    logins++;
    await session.request(`${origin}/login`);
    return true;
  }));
  const services = createProductionServices();
  const missing = await command(registerAuthCommands, services.auth, ["auth", "maintain"]);
  assert.equal(missing.error.code, "AUTH_REQUIRED");
  assert.equal(logins, 0);
  const account = await new AccountStore().current();
  await writeJsonFile(join(account.configDir, "auth.json"), { username: "synthetic-user", password: "synthetic-secret" });
  const recovered = await command(registerAuthCommands, services.auth, ["auth", "maintain"]);
  assert.equal(recovered.data.action, "restored");
  assert.equal(recovered.data.status, "valid");
  const kept = await services.auth.maintain();
  assert.equal(kept.action, "kept-alive");
  assert.equal(logins, 1);
  assert.deepEqual(JSON.parse(await readFile(join(account.configDir, "auth-maintenance.json"), "utf8")), kept);
  assert.equal((await stat(join(account.configDir, "auth-maintenance.json"))).mode & 0o777, 0o600);
});

test("认证：纯 HTTP 查询跨调用保存会话与持久 Cookie，清除后不恢复旧身份", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-http-session-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: "http", configDir: directory, browserDataDir: join(directory, "browser") };
  const server = createServer((req, res) => {
    if (req.url === "/login") res.setHeader("set-cookie", [
      "session=synthetic-current; Path=/; HttpOnly",
      "remember=synthetic-durable; Path=/; Max-Age=3600; HttpOnly",
    ]);
    res.end(JSON.stringify({ cookie: req.headers.cookie ?? "" }));
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  await withBrowserSession(account, false, async (session) => {
    await session.request(`${origin}/login`);
    await withBrowserSession(account, true, async (nested) => {
      assert.equal(nested, session);
      assert.match((await nested.request(`${origin}/check`)).url, /check$/);
    });
  });
  const path = join(directory, "session-cookies.json");
  const cookies = JSON.parse(await readFile(path, "utf8"));
  assert.equal(cookies.find((cookie) => cookie.name === "session").expires, -1);
  assert.ok(cookies.find((cookie) => cookie.name === "remember").expires > Date.now() / 1000);
  assert.equal((await stat(path)).mode & 0o777, 0o600);
  await withBrowserSession(account, false, async (session) => {
    const result = JSON.parse(await (await session.request(`${origin}/check`)).text());
    assert.match(result.cookie, /session=synthetic-current/);
    assert.match(result.cookie, /remember=synthetic-durable/);
    await session.clearCookies();
    assert.equal(JSON.parse(await (await session.request(`${origin}/check`)).text()).cookie, "");
  });
  assert.deepEqual(JSON.parse(await readFile(path, "utf8")), []);
  await assert.rejects(stat(account.browserDataDir), { code: "ENOENT" });
});

test("认证：失效状态检查不读密码或启动浏览器，TeX 登录完成 OAuth 授权", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-auth-probe-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: "probe", configDir: directory, browserDataDir: join(directory, "browser") };
  await writeFile(join(directory, "auth.json"), "not a credential document");
  const authorize = "https://authserver.nju.edu.cn/authserver/oauth2.0/authorize?client_id=synthetic&redirect_uri=https%3A%2F%2Ftex.nju.edu.cn%2Foauth%2Fcallback";
  let grants = 0;
  const http = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://tex.nju.edu.cn");
    if (url.pathname === "/api/user/info") return res.end(JSON.stringify({ status: { code: grants ? 1 : 1003 }, result: grants ? { id: "synthetic-user" } : null }));
    if (url.pathname === "/oauth/login") {
      res.setHeader("x-test-url", authorize);
      return res.end('<form class="oauth-form" method="post"><input type="hidden" name="scope" value="user_profile"></form>');
    }
    if (url.pathname === "/authserver/oauth2.0/authorize") {
      assert.equal(req.method, "POST");
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).toString(), "scope=user_profile");
      grants++; return res.end("authorized");
    }
    if (url.pathname === "/authserver/login") {
      res.setHeader("x-test-url", "https://authserver.nju.edu.cn/authserver/login");
      return res.end("login form");
    }
    res.statusCode = 404; res.end();
  });
  await withBrowserSession(account, false, async (session) => {
    session.page = async () => { throw new Error("probe must not open a browser"); };
    session.request = async (input, init) => {
      const response = await http(input, init);
      return { ok: response.ok, status: response.status, headers: response.headers,
        url: response.headers.get("x-test-url") ?? response.url,
        text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
    };
    assert.equal(await ssoSessionDriver.probe(account), false);
    assert.equal(await texSessionDriver.probe(account), false);
    assert.equal(grants, 0);
    assert.equal(await texSessionDriver.login(account), true);
    assert.equal(grants, 1);
    assert.equal(await texSessionDriver.probe(account), true);
    assert.equal(grants, 1);
  });
});

test("认证：登录失败与后置探测失败保持失效状态", async (t) => {
  const configDir = await mkdtemp(join(tmpdir(), "njucli-login-"));
  t.after(() => rm(configDir, { recursive: true, force: true }));
  const account = { name: "login", configDir, browserDataDir: join(configDir, "browser") };
  const sessions = new SessionStore();
  const drivers = Object.fromEntries(AUTH_CAPABILITIES.map((capability) => [capability, {
    probe: async () => capability === "softse",
    login: async () => { throw new Error("login unavailable"); },
  }]));
  const auth = new AuthCoordinator({ drivers, sessions });
  await sessions.put(account, { capability: "sso", status: "valid" });
  await assert.rejects(auth.ensureSession(account, "sso"), /login unavailable/);
  assert.equal((await sessions.list(account)).find((s) => s.capability === "sso").status, "expired");
  assert.deepEqual(await auth.ensureSession(account, "softse"), { capability: "softse", status: "valid" });
  drivers.sso.login = async () => true;
  for (const failure of [false, new AppError("AUTH_REQUIRED", "post-login session expired"), new Error("post-login probe unavailable")]) {
    await sessions.put(account, { capability: "sso", status: "valid" });
    let probes = 0;
    await assert.rejects(auth.ensureSession(account, "sso", async () => {
      if (++probes === 1) return false;
      if (failure instanceof Error) throw failure;
      return failure;
    }));
    assert.equal(probes, 2);
    assert.equal((await sessions.list(account)).find((s) => s.capability === "sso").status, "expired");
  }
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

test("软件：官网目录、安装包去重、流式下载与本地覆盖", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-software-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, "installer.zip");
  let downloads = 0, blocked = false;
  const payload = Buffer.from([0x50, 0x4b, 3, 4, 0xff, 0, 1]);
  const request = await localHttp(t, (req, res) => {
    if (req.url.endsWith(".zip")) {
      downloads++;
      res.setHeader("content-type", blocked ? "text/html" : "application/zip");
      res.write(blocked ? "<html>校园网访问</html>" : payload.subarray(0, 3));
      res.end(blocked ? "" : payload.subarray(3));
    } else {
      res.setHeader("content-type", "text/html");
      res.end(req.url === "/zbrj/list.htm"
        ? '<ul class="wp_listcolumn"><li class="wp_column"><a href="/intro">正版软件介绍</a></li><li class="wp_column"><a href="/adobe/list.htm">Adobe</a><ul><li><a href="/training">培训</a></li></ul></li></ul>'
        : req.url.includes("using-direct-links")
          ? '<nav><a href="https://example.com">无关导航</a></nav><table class="dexter-Table"><tr><td><a href="https://ccmdls.adobe.com/win64/CC.zip">下载</a><a href="https://ccmdls.adobe.com/macarm64/CC.zip">下载</a></td></tr></table>'
          : '<div class="wp_articlecontent"><a href="javascript:void(0)">回到顶端</a><a href="https://download.nju.edu.cn/WIN/CC.zip">Windows</a><a href="https://download.nju.edu.cn/WIN/CC.zip"></a></div>');
    }
  });
  t.mock.method(globalThis, "fetch", request);
  const service = new SoftwareClient();
  const list = await command(registerSoftwareCommands, service, ["software", "list", "adobe"]);
  assert.deepEqual(list.data.map((item) => item.id), ["adobe", "adobe-cc"]);
  const detail = await command(registerSoftwareCommands, service, ["software", "show", "adobe"]);
  assert.equal(detail.data.files.length, 1);
  assert.equal(detail.data.files[0].id, "WIN/CC.zip");
  const cc = await service.show("adobe-cc");
  assert.deepEqual(cc.files.map((file) => file.id), ["win64/CC.zip", "macarm64/CC.zip"]);
  assert.equal(cc.links.length, 0);
  const args = ["software", "download", "adobe", "WIN/CC.zip", "--output", output];
  assert.equal((await saveFile(output, "旧文件")).bytes, 9);
  const result = await command(registerSoftwareCommands, service, args);
  assert.equal(result.code, 0);
  assert.equal(result.data.bytes, payload.length);
  assert.deepEqual(await readFile(output), payload);
  blocked = true;
  assert.equal((await command(registerSoftwareCommands, service, args)).ok, false);
  assert.deepEqual(await readFile(output), payload);
  await assert.rejects(service.download("adobe", "missing.zip", output), { code: "NOT_FOUND" });
  assert.equal(downloads, 2);
  await saveFile(output, payload);
  assert.deepEqual(await readFile(output), payload);
});

test("SoftSE：课程目录遍历与空分类", async (t) => {
  const requests = [];
  const pages = {
    "/course/index.php": `<div class="course_category_tree">
      <h3 class="categoryname"><a href="/course/index.php?categoryid=8">分类</a></h3>
      <h3 class="categoryname"><a href="/course/index.php?categoryid=9">空分类</a></h3></div>`,
    "/course/index.php?categoryid=8": `<div class="course_category_tree">
      <div class="coursebox"><h3 class="coursename"><a href="/course/view.php?id=901">课程甲</a></h3></div>
      <div class="pagination"><a href="/course/index.php?page=1&categoryid=8">下一页</a></div></div>`,
    "/course/index.php?categoryid=8&page=1": `<div class="course_category_tree">
      <div class="coursebox"><h3 class="coursename"><a href="/course/view.php?id=901">课程甲</a></h3></div>
      <div class="coursebox"><h3 class="coursename"><a href="/course/view.php?id=902">课程乙</a></h3></div>
      <div class="pagination"><a href="/course/index.php?page=0&categoryid=8#courses">上一页</a></div></div>`,
    "/course/index.php?categoryid=9": `<body id="page-course-index-category"><form id="switchcategory">
      <select name="categoryid"><option value="9" selected>空分类</option></select></form></body>`,
  };
  const request = await localHttp(t, (req, res) => {
    requests.push(req.url);
    res.end(pages[req.url] ?? "<h1>未知页面</h1>");
  });
  const result = await command(registerSoftSeCommands, new SoftSeClient(request), ["softse", "catalog"]);
  assert.equal(result.code, 0);
  assert.deepEqual(result.data.map(course => course.courseId), ["901", "902"]);
  assert.equal(requests.length, 4);
});

test("SoftSE：课程成员分页与末页补齐行", async (t) => {
  const request = await localHttp(t, (req, res) => {
    const page = new URL(req.url, "http://localhost").searchParams.get("page");
    res.end(`<table id="participants"><tbody><tr>
      <th class="c0"><a href="/user/view.php?id=${page === "0" ? "9001" : "9002"}&course=370">合成昵称</a></th>
      <td class="c1">学生</td><td class="c2">小组</td></tr>
      <tr class="emptyrow"><th class="c0"></th><td class="c1"></td><td class="c2"></td></tr></tbody></table>
      ${page === "0" ? '<div class="pagination"><a href="/user/index.php?id=370&page=1">下一页</a></div>' : ""}`);
  });
  const client = new SoftSeClient(request);
  const first = await command(registerSoftSeCommands, client, ["softse", "participants", "370"]);
  const last = await command(registerSoftSeCommands, client, ["softse", "participants", "370", "--page", "2"]);
  assert.equal(first.code, 0);
  assert.equal(last.code, 0);
  assert.equal(first.data.nextPage, 2);
  assert.equal(last.data.nextPage, null);
  assert.deepEqual(first.data.items.map(member => member.userId), ["9001"]);
  assert.deepEqual(last.data.items.map(member => member.userId), ["9002"]);
});

test("EHall：行程预览、表单提交、本人编号回读与失败不重试", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-trip-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const inputPath = join(directory, "trip.json");
  const base = "/xxfw/sys/yjsjjrlfxappnju/";
  const holiday = { JJRDM: "holiday-test", JJRMC: "合成假期", XN: "2026", JJRKSRQ: "2026-10-01", JJRJSRQ: "2026-10-07", DJJSRQ: "2026-10-03" };
  const basic = { XH: "student-test", YL3: "", JJLXR: "", JJLXRDH: "", YL5: "", YL6: "" };
  const contacts = { YL3: "13800000000", JJLXR: "合成联系人", JJLXRDH: "13900000000", YL5: "1" };
  const history = [
    { WID: "history-old", XSBH: basic.XH, DJRQ: "2026-01-01 08:00:00" },
    { WID: "history-new", XSBH: basic.XH, DJRQ: "2026-09-01 08:00:00" },
  ];
  const stop = { from: "2026-10-02", to: "2026-10-04", destination: "甲市", address: "合成路一号", transport: "火车", serviceNumber: "G123" };
  const leave = { holidayId: holiday.JJRDM, stayOnCampus: false, trips: [{ stops: [stop], returnTransport: "火车" }] };
  let details = [], parents = [], writes = [], fault = "", generated = 0, historyReads = 0;
  const detailReads = [];
  const request = await localHttp(t, async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    if (path === "/appShow") {
      assert.equal(new URL(req.url, "http://localhost").searchParams.get("appId"), "6092355728536569");
      res.end(`<script>var pageMeta = {"params":{"userId":"${basic.XH}"}};</script>`);
      return;
    }
    assert.equal(req.method, "POST");
    assert.match(req.headers["content-type"], /^application\/x-www-form-urlencoded/);
    let body = "";
    for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);
    let result;
    if (path.endsWith("/getAppConfig.do")) result = { HEADER: { dropMenu: [{ id: "1", active: true }] } };
    else if (path.includes("/changeAppRole/")) result = { success: true };
    else if (path.endsWith("/setXgCommonAppRole.do")) result = { code: "0" };
    else if (path === base + "modules/apply/getStuIndexPage.do") {
      assert.deepEqual(JSON.parse(form.get("data")), {});
      result = { code: "0", data: { PAGE: parents.length ? "YDJ" : "WDJ", SZOBJ: holiday, SQOBJ: { WID: "saved-1" } } };
    } else if (path === base + "modules/register.do") result = { models: [{ name: "xsdjqxmxbd", controls: [
      { name: "BY1", url: "/xxfw/code/transport.do" }, { name: "BY3", url: "/xxfw/code/regions.do" },
    ] }] };
    else if (path === "/xxfw/code/transport.do") result = { datas: { code: { rows: [{ id: "train", name: "火车" }] } } };
    else if (path === "/xxfw/code/regions.do") result = { datas: { code: { rows: [
      { id: "city-a", name: "测试省/甲市", isParent: 1, pId: "province-test" },
      { id: "district-a", name: "测试省/甲市/甲区", isParent: 0 }, { id: "district-b", name: "测试省/乙市/乙区", isParent: 0 },
    ] } } };
    else if (path === base + "modules/register/cxxsjbxxdz.do") {
      assert.equal(form.get("XSBH"), basic.XH);
      result = { datas: { cxxsjbxxdz: { rows: [basic] } } };
    } else if (path === base + "modules/register/xsdjlsjlbg.do") {
      historyReads++;
      result = { datas: { xsdjlsjlbg: { rows: history, totalSize: 2 } } };
    }
    else if (path.includes("/commoncall/")) {
      const params = JSON.parse(form.get("requestParams"));
      const action = form.get("actionName");
      assert.equal(path, base + (action === "T_JJR_DJ_MX" ? "commoncall/call/T_JJR_DJ_MX-DATAMODEL-ADD.do" : `commoncall/callQuery/${action}-MINE-QUERY.do`));
      assert.equal(form.get("actionType"), action === "T_JJR_DJ_MX" ? "DATAMODEL" : "MINE");
      assert.equal(form.get("dataModelAction"), action === "T_JJR_DJ_MX" ? "ADD" : "QUERY");
      if (action === "zdscwid") result = { resultCode: "00000", data: [{ WID: `registration-${++generated}` }] };
      else if (action === "T_JJR_DJ_MX") {
        writes.push("detail");
        details.push({ ...params, WID: "detail-1" });
        result = { resultCode: "00000" };
      } else {
        assert.equal(action, "xsdjqxmxbd");
        result = { resultCode: "00000", data: details.filter(row => row.DJBH === params.DJBH) };
      }
    } else if (path === base + "modules/holiday/SaveRegister.do") {
      writes.push("submit");
      assert.deepEqual([...form.keys()], ["data"]);
      const value = JSON.parse(form.get("data"));
      assert.deepEqual(Object.keys(value), ["data"]);
      assert.ok(Array.isArray(value.data));
      parents = value.data.map((row, i) => ({ ...row, XSBH: basic.XH, WID: `saved-${i + 1}` }));
      result = fault === "submit" ? { code: "1", msg: "合成提交失败" } : { code: "0" };
    } else if (path === base + "modules/apply/getCurStuApply.do") {
      const { WID } = JSON.parse(form.get("data"));
      detailReads.push(WID);
      const parent = parents.find(row => row.WID === WID) ?? history.find(row => row.WID === WID);
      assert.ok(parent);
      result = { code: "0", data: { DATA: { ...parent, ...(WID === "history-new" ? contacts : {}),
        ...(!WID.startsWith("history-") && (fault === "identity" || (fault === "second-identity" && WID === "saved-2")) ? { XSBH: "other-student" } : {}),
      } } };
    } else if (path === base + "modules/register/cxxsdjjjrbddz.do") {
      assert.deepEqual(Object.fromEntries(form), { JJRDM: holiday.JJRDM, DJXN: holiday.XN, XSBH: basic.XH });
      result = { datas: { cxxsdjjjrbddz: { rows: parents.map(row => ({
        YL4: row.YL4, YJFXRQ: row.YJFXRQ, YL4_DISPLAY: "火车", WID: row.WID, YL10: "",
        DJXN_DISPLAY: "2026", DJBH: fault === "registration" ? "old-registration" : row.DJBH, DJXN: row.DJXN, YL1: row.YL1,
      })) } } };
    } else assert.fail(`未知行程请求：${path}`);
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(result));
  });
  const client = new EHallTripClient(async (url, init) => {
    const response = await request(url, init);
    return new URL(url).pathname === "/appShow"
      ? { ok: response.ok, status: response.status, url: `https://ehallapp.nju.edu.cn${base}*default/index.do`, text: () => response.text() }
      : response;
  }, directory);
  const run = async (input, preview = false) => {
    await writeJsonFile(inputPath, input);
    return command(registerEHallCommands, client, ["ehall", "trip-submit", "--input", inputPath, ...(preview ? ["--dry-run"] : [])]);
  };
  const current = await command(registerEHallCommands, client, ["ehall", "trip"]);
  assert.equal(current.data.status, "open");
  assert.deepEqual(current.data.missing, []);
  const profilePath = join(directory, "ehall.json");
  assert.equal((await stat(profilePath)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await readFile(profilePath, "utf8")).userId, basic.XH);
  const direct = ["--from", stop.from, "--to", stop.to, "--destination", stop.destination,
    "--address", stop.address, "--transport", stop.transport, "--service-number", stop.serviceNumber, "--return-transport", "火车"];
  const preview = await command(registerEHallCommands, client, ["ehall", "trip-submit", ...direct, "--dry-run"]);
  assert.equal(preview.data.submitted, false);
  assert.deepEqual(preview.data.plan.contacts, { phone: contacts.YL3, emergencyContact: contacts.JJLXR,
    emergencyPhone: contacts.JJLXRDH, onCampus: true, residence: null });
  assert.equal(preview.data.plan.trips[0].stops[0].destination.id, "city-a");
  assert.deepEqual(writes, []);
  assert.equal(generated, 0);
  assert.equal(historyReads, 1);
  const overridden = await command(registerEHallCommands, client, ["ehall", "trip-submit", "--stay", "--phone", "13700000000", "--dry-run"]);
  assert.equal(overridden.data.plan.contacts.phone, "13700000000");
  assert.equal(JSON.parse(await readFile(profilePath, "utf8")).contacts.phone, contacts.YL3);
  for (const invalid of [
    { ...leave, holidayId: "old-holiday" },
    { ...leave, trips: [{ stops: [{ ...stop, from: "2026-10-05" }] }] },
    { ...leave, trips: [{ stops: [{ ...stop, destination: "测试省" }] }] },
  ]) assert.equal((await run(invalid)).error.code, "INVALID_INPUT");
  assert.deepEqual(writes, []);
  for (const scenario of ["leave", "multiple", "stay", "submit", "identity", "second-identity", "registration"]) {
    details = []; parents = []; writes = []; generated = 0; fault = scenario; detailReads.length = 0;
    const multiple = scenario === "multiple" || scenario === "second-identity";
    const input = multiple ? { ...leave, trips: [...leave.trips, { stops: [{ ...stop, from: "2026-10-05", to: "2026-10-06" }] }] } : leave;
    const result = scenario === "stay"
      ? await command(registerEHallCommands, client, ["ehall", "trip-submit", "--stay"])
      : scenario === "leave" ? await command(registerEHallCommands, client, ["ehall", "trip-submit", ...direct]) : await run(input);
    const ids = scenario === "stay" ? [] : multiple ? ["registration-1", "registration-2"] : ["registration-1"];
    assert.deepEqual(writes, [...ids.map(() => "detail"), "submit"]);
    if (scenario === "leave" || scenario === "multiple" || scenario === "stay") {
      assert.equal(result.data.submitted, true);
      assert.equal(result.data.recordId, "saved-1");
      assert.deepEqual(result.data.registrationIds, ids);
      assert.equal(parents[0].YL2, scenario === "stay" ? "1" : "0");
      assert.equal(parents[0].YL6, "");
      if (scenario !== "stay") assert.deepEqual(details[0], { DJBH: "registration-1", KSRQ: stop.from, JSRQ: stop.to,
        BY3: "city-a", XXDZ: stop.address, BY1: "train", BY2: "G123", WID: "detail-1" });
      else assert.equal(generated, 0);
      const readback = await command(registerEHallCommands, client, ["ehall", "trip"]);
      assert.equal(readback.data.status, "submitted");
      assert.deepEqual(readback.data.records.map(row => row.registrationId), scenario === "stay" ? [null] : ids);
    } else {
      assert.equal(result.error.code, "REMOTE_UNAVAILABLE");
      assert.deepEqual(result.error.details.registrationIds, ids);
      assert.equal(result.error.details.stage, scenario === "submit" ? "提交总登记" : "回读总登记");
      if (scenario === "submit") assert.deepEqual(detailReads, []);
    }
  }
  basic.XH = "another-student";
  parents = []; details = []; fault = "";
  const other = await command(registerEHallCommands, client, ["ehall", "trip"]);
  assert.equal(other.data.defaults.phone, null);
  assert.ok(other.data.missing.includes("phone"));
  assert.equal(JSON.parse(await readFile(profilePath, "utf8")).userId, basic.XH);
});

test("EHall：非法 JSON、日期与未知字段在调用业务前拒绝", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-trip-input-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "trip.json");
  let called = 0;
  const service = { submitTrip: async () => { called++; throw new Error("不应调用业务"); } };
  for (const value of ["{", JSON.stringify({ holidayId: "test", stayOnCampus: true, unknown: true }), JSON.stringify({
    holidayId: "test", stayOnCampus: false, trips: [{ stops: [{ from: "2026-02-30", to: "2026-03-01", destination: "测试区", address: "合成地址", transport: "火车" }] }],
  })]) {
    await writeFile(input, value);
    const result = await command(registerEHallCommands, service, ["ehall", "trip-submit", "--input", input]);
    assert.equal(result.code, 2);
    assert.equal(result.error.code, "INVALID_INPUT");
  }
  for (const args of [[], ["--stay", "--from", "2026-10-01"], ["--from", "2026-10-01"],
    ["--stay", "--on-campus", "--off-campus"], ["--stay", "--input", input]]) {
    const result = await command(registerEHallCommands, service, ["ehall", "trip-submit", ...args]);
    assert.equal(result.code, 2);
  }
  assert.equal(called, 0);
});

test("TeX：直接创建、单次提交回读、HTTP 失败与编译日志", async (t) => {
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
  const created = await command(registerTexCommands, client, ["tex", "create", " 论文 "]);
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

test("邮箱：文件绑定与复用、网页单次生成、失败保留原凭据", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-mail-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const savedPath = join(directory, "mail.json");
  const calls = [];
  let enabled = false, persistImap = true, imapError = false, generationError = false;
  const client = new MailClient(directory);
  // 隔离远端浏览器和 IMAP，文件保存与重新读取使用真实实现。
  client.connect = async (credentials, run) => {
    assert.equal(credentials.password, "synthetic-mail-secret");
    calls.push("验证 IMAP");
    if (imapError) throw new Error("IMAP 认证失败");
    return run({ mailboxOpen: async (folder, options) => {
      assert.equal(folder, "INBOX");
      assert.deepEqual(options, { readOnly: true });
    } });
  };
  const settings = {
    getByRole: (_, { name }) => ({
      click: async () => { calls.push(name); },
    }),
    locator: (selector) => {
      if (selector === "#openimap") return {
        isChecked: async () => enabled,
        check: async () => { enabled = true; calls.push("勾选 IMAP"); },
      };
      assert.equal(selector, "#sendbtn");
      return { click: async () => { enabled = persistImap; calls.push("保存设置"); } };
    },
  };
  const page = {
    goto: async () => { calls.push("打开邮箱"); },
    url: () => "https://mail.nju.edu.cn/cgi-bin/frame_html",
    waitForURL: async (ready) => { assert.equal(ready(new URL("https://mail.nju.edu.cn/cgi-bin/frame_html")), true); },
    frameLocator: (selector) => { assert.equal(selector, "#mainFrame"); return settings; },
    getByRole: (_, { name }) => ({ click: async () => { calls.push(name); } }),
    waitForResponse: async (matches) => {
      const settingsResponse = { url: () => "https://mail.nju.edu.cn/cgi-bin/setting4", request: () => ({ method: () => "POST" }), ok: () => true, finished: async () => {} };
      if (matches(settingsResponse)) return settingsResponse;
      const response = {
        url: () => "https://mail.nju.edu.cn/cgi-bin/wx_token",
        request: () => ({ method: () => "POST", postData: () => "act=add_spwd" }),
        ok: () => true,
        json: async () => {
          calls.push("接收凭据");
          return generationError ? { errcode: 1 } : { errcode: "0", data: { passwd: "synthetic-mail-secret" } };
        },
      };
      assert.equal(matches(response), true);
      assert.equal(matches({ ...response, request: () => ({ method: () => "POST", postData: () => "act=other" }) }), false);
      assert.equal(matches({ ...response, url: () => "https://example.invalid/cgi-bin/wx_token" }), false);
      return response;
    },
    locator: (selector) => {
      assert.equal(selector, "#useraddr");
      return { innerText: async () => "integration@smail.nju.edu.cn" };
    },
  };
  const session = new BrowserSession({ pages: () => [page] }, "unused-cookie-path");
  const service = { bind: (credentials) => credentials ? client.bind(credentials.address, credentials.password) : bindMail(session, client) };
  const input = join(directory, "input.json");
  await writeJsonFile(input, { address: "integration@smail.nju.edu.cn", password: "synthetic-mail-secret" });
  const imported = await command(registerMailCommands, service, ["mail", "bind", "--credentials", input]);
  assert.equal(imported.code, 0);
  assert.equal(imported.stderr, "");
  assert.deepEqual(calls.splice(0), ["验证 IMAP"]);
  assert.deepEqual(await new MailClient(directory).status(), { bound: true, address: "integration@smail.nju.edu.cn" });
  assert.equal(JSON.stringify(imported).includes("synthetic-mail-secret"), false);
  const second = await command(registerMailCommands, service, ["mail", "bind", "--address", "second@smail.nju.edu.cn", "--password", "synthetic-mail-secret"]);
  assert.equal(second.data.address, "second@smail.nju.edu.cn");
  assert.equal((await client.accounts()).length, 2);
  await client.use("integration@smail.nju.edu.cn");
  assert.equal((await client.status()).address, "integration@smail.nju.edu.cn");
  assert.deepEqual(await client.unbind("second@smail.nju.edu.cn"), { removed: true });
  calls.length = 0;
  const result = await command(registerMailCommands, service, ["mail", "bind"]);
  const saved = JSON.parse(await readFile(savedPath, "utf8")).mailboxes[0];
  assert.equal(result.code, 0);
  assert.equal(result.data.address, saved.address);
  assert.equal(JSON.stringify(result).includes(saved.password), false);
  assert.deepEqual(calls.splice(0), ["打开邮箱", "设置", "客户端设置", "勾选 IMAP", "保存设置", "设置", "客户端设置", "微信绑定", "生成新密码", "接收凭据", "验证 IMAP"]);

  imapError = true;
  const previous = await readFile(savedPath, "utf8");
  const failed = await command(registerMailCommands, service, ["mail", "bind"]);
  assert.equal(failed.code, 1);
  assert.equal(await readFile(savedPath, "utf8"), previous);
  assert.equal(calls.includes("保存设置"), false);
  assert.equal(calls.filter((call) => call === "生成新密码").length, 1);
  calls.length = 0;
  imapError = false;
  generationError = true;
  const rejected = await command(registerMailCommands, service, ["mail", "bind"]);
  assert.equal(rejected.code, 1);
  assert.equal(await readFile(savedPath, "utf8"), previous);
  assert.equal(calls.includes("验证 IMAP"), false);
  assert.equal(calls.filter((call) => call === "生成新密码").length, 1);
  calls.length = 0;
  enabled = false;
  persistImap = false;
  await assert.rejects(bindMail(session, client), /回读未生效/);
  assert.equal(calls.includes("生成新密码"), false);
  assert.deepEqual(await client.unbind(), { removed: true });
  assert.deepEqual(await new MailClient(directory).status(), { bound: false, address: null });
  assert.deepEqual(await client.unbind(), { removed: false });
});

test("邮箱：多邮箱选择、分页、正文附件与未读标记", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-mail-read-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const client = new MailClient(directory);
  const seen = new Set();
  const searches = [];
  const mailboxes = ["first@smail.nju.edu.cn", "second@smail.nju.edu.cn"];
  client.connect = async (credentials, operation) => {
    const row = (uid) => ({ uid, flags: new Set(), envelope: { subject: `${credentials.address}:${uid}` },
      source: Buffer.from([
        'MIME-Version: 1.0', 'Content-Type: multipart/mixed; boundary="test"', '',
        '--test', 'Content-Type: text/plain; charset=utf-8', '', '中文正文',
        '--test', 'Content-Type: text/plain', 'Content-Disposition: attachment; filename="sample.txt"',
        'Content-Transfer-Encoding: base64', '', 'aGVsbG8=', '--test--', '',
      ].join('\r\n')),
    });
    seen.add(credentials.address);
    return operation({
      mailboxOpen: async (path, options) => { assert.equal(options.readOnly, true); return { path, uidValidity: 42n }; },
      search: async (query, options) => { assert.equal(options.uid, true); searches.push(query); return [1, 2, 3]; },
      fetchAll: async (uids) => uids.map(row),
      fetchOne: async (uid) => row(uid),
    });
  };
  for (const address of mailboxes) await client.bind(address, "synthetic-secret");
  assert.equal((await client.status()).address, mailboxes[1]);
  assert.equal((await command(registerMailCommands, client, ["mail", "accounts"])).data.length, 2);
  const selected = await command(registerMailCommands, client, ["mail", "use", mailboxes[0]]);
  assert.equal(selected.data.address, mailboxes[0]);
  const page = await client.list({ unread: true, limit: 2 });
  assert.equal(page.nextBefore, 2);
  assert.equal(searches.at(-1).seen, false);
  assert.equal((await client.list({ before: page.nextBefore })).items.length, 1);
  await client.search("奖学金");
  assert.equal(searches.at(-1).text, "奖学金");
  await client.use(mailboxes[1]);
  seen.clear();
  const message = await client.read(page.items[0].id);
  assert.equal(message.unread, true);
  assert.match(message.subject, /^first@/);
  assert.match(message.text, /中文正文/);
  assert.equal(message.attachments[0].bytes, 5);
  const output = join(directory, "attachment.txt");
  await client.download(page.items[0].id, 1, output);
  assert.equal(await readFile(output, "utf8"), "hello");
  assert.deepEqual([...seen], [mailboxes[0]]);
  assert.equal((await client.status()).address, mailboxes[1]);
  assert.equal((await command(registerMailCommands, client, ["mail", "unbind"])).data.removed, true);
  assert.equal((await client.status()).address, mailboxes[0]);
});


test("账号装配：默认邮箱与统一认证同号，独立邮箱保留全部绑定", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-accounts-"));
  const names = ["XDG_CONFIG_HOME", "XDG_DATA_HOME", "NJUCLI_ACCOUNT"];
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  t.after(async () => {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
    await rm(directory, { recursive: true, force: true });
  });
  process.env.XDG_CONFIG_HOME = directory;
  process.env.XDG_DATA_HOME = directory;
  delete process.env.NJUCLI_ACCOUNT;
  const account = await new AccountStore().current();
  const authPath = join(account.configDir, "auth.json");
  const credentials = { username: "sso-student", password: "synthetic-sso-secret" };
  await writeJsonFile(authPath, credentials);
  t.mock.method(MailClient.prototype, "connect", async (_credentials, run) => run({
    mailboxOpen: async () => {}, list: async () => [],
  }));
  const services = createProductionServices();
  const first = await command(registerMailCommands, services.mail, ["mail", "bind", "--password", "synthetic-mail-secret"]);
  assert.equal(first.data.address, "sso-student@smail.nju.edu.cn");
  const second = await command(registerMailCommands, services.mail, ["mail", "bind", "--address", "different@smail.nju.edu.cn", "--password", "synthetic-mail-secret"]);
  assert.equal(second.data.address, "different@smail.nju.edu.cn");
  assert.equal((await services.mail.accounts()).length, 2);
  assert.deepEqual(JSON.parse(await readFile(authPath, "utf8")), credentials);
  assert.equal((await services.mail.bind()).address, second.data.address);
  await services.account.remove("default");
  assert.equal((await services.mail.status()).bound, false);
});

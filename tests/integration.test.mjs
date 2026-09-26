import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { once } from "node:events";
import { test } from "node:test";
import { Command } from "commander";
import { AccountStore } from "../dist/account/store.js";
import { createProductionServices } from "../dist/app/production.js";
import { AuthCoordinator } from "../dist/auth/coordinator.js";
import { BrowserSession } from "../dist/auth/browser-session.js";
import { SessionStore } from "../dist/auth/session-store.js";
import { AUTH_CAPABILITIES } from "../dist/auth/types.js";
import { registerCampusCommands } from "../dist/commands/campus.js";
import { registerTexCommands } from "../dist/commands/tex.js";
import { registerMailCommands } from "../dist/commands/mail.js";
import { registerSoftSeCommands } from "../dist/commands/softse.js";
import { CampusClient } from "../dist/domains/campus/client.js";
import { listCampusSources } from "../dist/domains/campus/sources/registry.js";
import { TexClient } from "../dist/domains/tex/client.js";
import { MailClient } from "../dist/domains/mail/client.js";
import { SoftSeClient } from "../dist/domains/softse/client.js";
import { bindMail } from "../dist/domains/mail/bind.js";
import { registerSoftwareCommands } from "../dist/commands/software.js";
import { SoftwareClient } from "../dist/domains/software/client.js";
import { saveFile, writeJsonFile } from "../dist/core/fs.js";

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
    locator: (selector) => selector === "#pwdFromId:visible" ? form : { click: async () => {} },
    waitForURL: async (ready) => { assert.equal(ready(new URL("https://ehall.nju.edu.cn/new/index.html")), true); },
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
  await assert.rejects(session.login("https://authserver.nju.edu.cn/authserver/login", () => true), { code: "USER_ACTION_REQUIRED" });
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

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
import { AccountStore } from "../dist/src/account/store.js";
import { createProductionServices } from "../dist/src/app/production.js";
import { AuthCoordinator } from "../dist/src/auth/coordinator.js";
import { SessionStore } from "../dist/src/auth/session-store.js";
import { AUTH_CAPABILITIES } from "../dist/src/auth/types.js";
import { registerCampusCommands } from "../dist/skills/njucli-campus/scripts/commands.js";
import { registerCourseCommands } from "../dist/skills/njucli-course/scripts/commands.js";
import { createCourseServices } from "../dist/skills/njucli-course/scripts/services.js";
import { registerTexCommands } from "../dist/skills/njucli-tex/scripts/commands.js";
import { registerMailCommands } from "../dist/skills/njucli-mail/scripts/commands.js";
import { registerSoftSeCommands } from "../dist/skills/njucli-softse/scripts/commands.js";
import { registerEHallCommands } from "../dist/skills/njucli-ehall/scripts/commands.js";
import { CampusClient } from "../dist/skills/njucli-campus/scripts/client.js";
import { TexClient } from "../dist/skills/njucli-tex/scripts/client.js";
import { MailClient } from "../dist/skills/njucli-mail/scripts/client.js";
import { SoftSeClient } from "../dist/skills/njucli-softse/scripts/client.js";
import { EHallTripClient } from "../dist/skills/njucli-ehall/scripts/trip.js";
import { registerSoftwareCommands } from "../dist/skills/njucli-software/scripts/commands.js";
import { SoftwareClient } from "../dist/skills/njucli-software/scripts/client.js";
import { saveFile, writeJsonFile } from "../dist/src/core/fs.js";
import { AppError } from "../dist/src/core/errors.js";
import { BrowserSession, withBrowserSession } from "../dist/src/auth/browser-session.js";
import { texSessionDriver } from "../dist/src/auth/drivers/tex-browser.js";
import { ssoSessionDriver } from "../dist/src/auth/drivers/sso-browser.js";
import { registerAuthCommands } from "../dist/src/auth/commands.js";
import { registerYouthCommands } from "../dist/skills/njucli-youth/scripts/commands.js";
import { TableClient } from "../dist/skills/njucli-table/scripts/client.js";
import { registerTableCommands } from "../dist/skills/njucli-table/scripts/commands.js";
import { YouthClient } from "../dist/skills/njucli-youth/scripts/client.js";
import { bindMail } from "../dist/src/auth/mail-bind.js";
import { installSkills } from "../scripts/install-skills.mjs";
import { registerUpgradeCommand } from "../dist/src/commands/upgrade.js";
import { registerBoxCommands } from "../dist/skills/njucli-box/scripts/commands.js";
import { BoxClient } from "../dist/skills/njucli-box/scripts/client.js";
import { exchangeSportsAccessToken } from "../dist/src/auth/sports-token.js";
import { SportsClient } from "../dist/skills/njucli-sports/scripts/client.js";

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

test("课表：认证与业务共用查询、学期日期展开和 ICS 导出", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-course-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const terms = [{ DM: "2026-2027-1", MC: "秋季" }, { DM: "2025-2026-2", MC: "春季" }];
  const dates = [
    { XN: "2026-2027", XQ: "1", XQKSRQ: "2026-08-31 00:00:00" },
    { XN: "2025-2026", XQ: "2", XQKSRQ: "2026-02-23 00:00:00" },
  ];
  const rows = [
    { JXBID: "class-1", KCM: "程序设计", SKJS: "张老师，李老师", KSJC: "3", JSJC: "4", SKXQ: "2", SKZC: "1010", JASMC: " 教室 A ", XXXQDM_DISPLAY: "仙林" },
    { JXBID: "class-2", KCM: "实验", KSJC: "1", JSJC: "2", SKXQ: "5", SKZC: "0100" },
    { JXBID: "class-3", KCM: "无固定时段", KSJC: "0", JSJC: "0", SKXQ: "0", SKZC: "1111" },
  ];
  const calls = [];
  const request = await localHttp(t, async (req, res) => {
    const path = new URL(req.url, "https://ehallapp.nju.edu.cn").pathname;
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const form = new URLSearchParams(Buffer.concat(chunks).toString());
    const name = path.split("/").at(-1);
    calls.push({ name, form });
    const json = (key, data) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: "0", datas: { [key]: { rows: data } } }));
    };
    if (["appShow", "index.do", "20230211151103310.do"].includes(name)) {
      assert.equal(req.method, "GET");
      return res.end("ready");
    }
    if (name === "cxjcs.do") {
      assert.equal(req.method, "GET");
      return json("cxjcs", dates);
    }
    assert.equal(req.method, "POST");
    if (name === "dqxnxq.do") return json("dqxnxq", [terms[0]]);
    if (name === "xnxqcx.do") {
      assert.equal(form.get("*order"), "-DM");
      return json("xnxqcx", terms);
    }
    if (name === "cxxszhxqkb.do") {
      assert.equal(form.get("pageSize"), "999");
      assert.equal(form.get("pageNumber"), "1");
      return json("cxxszhxqkb", rows);
    }
    res.writeHead(404); res.end("unknown route");
  });
  const account = { name: "course", configDir: directory, browserDataDir: join(directory, "browser") };
  const auth = new AuthCoordinator({ drivers: {}, sessions: new SessionStore() });
  const service = createCourseServices({ withBrowser: async (capability, operation, probe) => {
    assert.equal(capability, "timetable");
    const session = { request };
    await auth.ensureSession(account, capability, () => probe(session));
    return operation(session, account);
  } });
  const run = async (...args) => {
    calls.length = 0;
    const result = await command(registerCourseCommands, service, ["course", ...args]);
    for (const name of ["appShow", "index.do", "20230211151103310.do", "dqxnxq.do"]) {
      assert.equal(calls.filter((call) => call.name === name).length, 1, `${args[0]}: ${name}`);
    }
    return result;
  };

  assert.deepEqual((await run("terms")).data.map((term) => term.startsOn), ["2026-08-31", "2026-02-23"]);
  assert.deepEqual((await run("current-term")).data, { id: terms[0].DM, name: "秋季", startsOn: "2026-08-31" });
  const current = await run("schedule");
  assert.equal(current.data.term.id, terms[0].DM);
  assert.equal(calls.find((call) => call.name === "cxxszhxqkb.do").form.get("XNXQDM"), terms[0].DM);
  assert.equal(calls.some((call) => call.name === "xnxqcx.do"), false);
  assert.deepEqual(current.data.courses[0].teachers, ["张老师", "李老师"]);
  assert.deepEqual(current.data.courses[0].arrangements[0].weeks, [1, 3]);
  assert.deepEqual(current.data.courses[2].arrangements, []);
  const previous = await run("schedule", "--term", terms[1].DM);
  assert.equal(previous.data.term.startsOn, "2026-02-23");
  assert.equal(calls.find((call) => call.name === "cxxszhxqkb.do").form.get("XNXQDM"), terms[1].DM);
  assert.equal(calls.filter((call) => call.name === "xnxqcx.do").length, 1);

  const today = await run("today", "2026-09-01");
  assert.deepEqual(today.data.map(({ date, startTime, endTime, location }) => ({ date, startTime, endTime, location })), [
    { date: "2026-09-01", startTime: "10:10", endTime: "12:00", location: "教室 A" },
  ]);
  assert.deepEqual((await run("today", "2026-09-08")).data, []);
  assert.deepEqual((await run("week", "2026-09-09")).data.map((entry) => [entry.name, entry.date]), [["实验", "2026-09-11"]]);

  const path = join(directory, "schedule.ics");
  const exported = await run("export", path);
  assert.deepEqual(exported.data, { path, eventCount: 3 });
  const calendar = await readFile(path, "utf8");
  assert.equal((calendar.match(/BEGIN:VEVENT/g) ?? []).length, 3);
  assert.match(calendar, /DTSTART;TZID=Asia\/Shanghai:20260901T101000\r\n/);
  assert.match(calendar, /DTSTART;TZID=Asia\/Shanghai:20260915T101000\r\n/);
  assert.match(calendar, /DTEND;TZID=Asia\/Shanghai:20260911T095000\r\n/);
  assert.doesNotMatch(calendar, /无固定时段/);
  const missing = await run("schedule", "--term", "missing-term");
  assert.equal(missing.code, 1);
  assert.equal(missing.error.code, "NOT_FOUND");
  assert.match(missing.error.message, /missing-term/);
  assert.equal(calls.some((call) => call.name === "cxxszhxqkb.do"), false);
});

test("云盘：命令、递归传输、分享回读与失败单次提交", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-box-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const bytes = Buffer.from([0, 255, 42, 10]);
  await mkdir(join(directory, "materials", "nested"), { recursive: true });
  await writeFile(join(directory, "materials", "nested", "数据.bin"), bytes);
  let repos = [{ id: "repo", name: "测试资料库", size: 4, permission: "rw", encrypted: false, type: "repo" }];
  const items = new Map([["/original.bin", { id: "original", name: "original.bin", type: "file", size: 4, is_locked: false, content: bytes }]]);
  const shareLinks = new Map(), uploadLinks = new Map();
  const stars = new Set();
  let uploads = 0, sharePosts = 0, mode = "success";
  const request = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://box.nju.edu.cn");
    const path = url.pathname, p = url.searchParams.get("p");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const raw = Buffer.concat(chunks);
    const form = new URLSearchParams(raw.toString());
    const json = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.method !== "GET") assert.equal(req.headers["x-csrftoken"], "test-csrf");
    if (path === "/api2/account/info/") return json({ name: "测试用户", usage: 4, total: 100, space_usage: "4%" });
    if (path === "/api2/repos/") {
      if (req.method === "POST") {
        repos.push({ ...repos[0], id: "new-repo", name: form.get("name") });
        return json({ repo_id: "new-repo", token: "private-sync-token" });
      }
      return json(repos);
    }
    if (path === "/api2/repos/new-repo/" && req.method === "POST") { repos.find((r) => r.id === "new-repo").name = form.get("repo_name"); return json("success"); }
    if (path === "/api/v2.1/repos/new-repo/" && req.method === "DELETE") { repos = repos.filter((r) => r.id !== "new-repo"); return json({ success: true }); }
    if (path === "/api2/repos/repo/dir/") {
      if (req.method === "POST") {
        assert.equal(form.get("operation"), "mkdir");
        items.set(p, { id: p, name: p.split("/").at(-1), type: "dir", is_locked: false });
        return json("success", 301);
      }
      const entries = [...items.entries()].filter(([key]) => url.searchParams.get("recursive") === "1" ? key.startsWith(p === "/" ? "/" : p + "/") : key.slice(0, key.lastIndexOf("/")) === (p === "/" ? "" : p));
      return json(entries.map(([key, value]) => ({ ...value, parent_dir: key.slice(0, key.lastIndexOf("/")) || "/", content: undefined })));
    }
    if (path === "/api2/repos/repo/upload-link/") return json("https://box.nju.edu.cn/seafhttp/upload-api/test");
    if (path === "/seafhttp/upload-api/test") {
      uploads++;
      assert.equal(url.searchParams.get("ret-json"), "1");
      const multipart = await new Request("http://localhost", { method: "POST", headers: req.headers, body: raw }).formData();
      const file = multipart.get("file");
      const content = Buffer.from(await file.arrayBuffer());
      assert.deepEqual(content, bytes);
      const name = file.name, parent = multipart.get("parent_dir");
      const remote = (parent === "/" ? "" : parent) + "/" + name;
      const item = { id: "uploaded", name, type: "file", size: content.length, is_locked: false, content };
      items.set(remote, item);
      return json([{ id: item.id, name, size: item.size }]);
    }
    if (path === "/api2/repos/repo/file/" && req.method === "GET") return json("https://box.nju.edu.cn/seafhttp/files/test?path=" + encodeURIComponent(p));
    if (path === "/seafhttp/files/test") return res.end(items.get(url.searchParams.get("path")).content);
    if (path === "/api/v2.1/repos/repo/file/") {
      if (req.method === "DELETE") { items.delete(p); return json({ success: true }); }
      if (req.method === "PUT") { items.get(p).is_locked = form.get("operation") === "lock"; return json("success"); }
      if (req.method === "POST") {
        const current = items.get(p); items.delete(p); current.name = form.get("newname");
        items.set(p.slice(0, p.lastIndexOf("/")) + "/" + current.name, current); return json("success");
      }
    }
    if (path.includes("sync-batch-")) {
      const input = JSON.parse(raw);
      const source = (input.src_parent_dir === "/" ? "" : input.src_parent_dir) + "/" + input.src_dirents[0];
      const dest = (input.dst_parent_dir === "/" ? "" : input.dst_parent_dir) + "/" + input.src_dirents[0];
      items.set(dest, { ...items.get(source) });
      if (path.includes("-move-")) items.delete(source);
      return json({ success: true });
    }
    if (path === "/api/v2.1/starred-items/") {
      if (req.method === "POST") { stars.add(form.get("path")); return json({ success: true }); }
      if (req.method === "DELETE") { stars.delete(url.searchParams.get("path")); return json({ success: true }); }
      return json({ starred_item_list: [...stars].map((path) => ({ repo_id: "repo", path, obj_name: path.split("/").at(-1), is_dir: false })) });
    }
    if (path === "/api2/search/") return json({ total: 1, has_more: false, results: [{ repo_id: "repo", repo_name: "测试资料库", name: "original.bin", fullpath: "/original.bin", is_dir: false, size: 4 }] });
    if (path === "/api/v2.1/smart-link/") return json({ smart_link: "https://box.nju.edu.cn/smart-link/test/original.bin" });
    for (const [prefix, storage] of [["share-links", shareLinks], ["upload-links", uploadLinks]]) {
      const base = `/api/v2.1/${prefix}/`;
      if (path === base) {
        if (req.method === "POST") {
          if (prefix === "share-links") sharePosts++;
          if (mode === "failure") return json({ detail: "denied" }, 500);
          const link = { token: prefix + "-id", link: `https://box.nju.edu.cn/${prefix === "share-links" ? "f" : "u/d"}/public-id/`, repo_id: form.get("repo_id"), path: form.get("path"), is_dir: false, password: form.get("password") || "", expire_date: form.get("expiration_time") || "", permissions: form.has("permissions") ? JSON.parse(form.get("permissions")) : undefined };
          storage.set(link.token, link); return json(link);
        }
        return json([...storage.values()]);
      }
      if (path.startsWith(base)) {
        const linkId = path.slice(base.length).replace(/\/$/, "");
        if (req.method === "DELETE") { storage.delete(linkId); return json({ success: true }); }
        return storage.has(linkId) ? json(storage.get(linkId)) : json({ detail: "not found" }, 404);
      }
    }
    if (path === "/api/v2.1/repos/repo/history/") return json({ more: false, data: [{ commit_id: "version-id", time: "2026-10-08T00:00:00Z", description: "更新文件" }] });
    if (path === "/api/v2.1/repos/repo/trash/") return json({ more: false, scan_stat: null, data: [] });
    return json({ detail: "unknown route" }, 404);
  });
  const client = new BoxClient(request, "test-csrf");
  assert.equal((await command(registerBoxCommands, client, ["box", "info"])).data.usedBytes, 4);
  assert.equal((await client.search("资料 + &")).total, 1);
  assert.equal((await client.link("repo", "/original.bin")).url, "https://box.nju.edu.cn/smart-link/test/original.bin");
  assert.equal((await client.createRepo("新资料库")).name, "新资料库");
  assert.equal((await client.renameRepo("new-repo", "新名称")).name, "新名称");
  await client.removeRepo("new-repo");
  const result = await command(registerBoxCommands, client, ["box", "upload", "repo", join(directory, "materials")]);
  assert.equal(result.data[0].path, "/materials/nested/数据.bin");
  assert.equal(uploads, 1);
  assert.equal((await client.scan("repo")).directories, 2);
  const output = join(directory, "downloaded");
  assert.equal((await client.download("repo", "/materials", output)).files, 1);
  assert.deepEqual(await readFile(join(output, "nested", "数据.bin")), bytes);
  assert.equal((await stat(join(output, "nested", "数据.bin"))).mode & 0o777, 0o600);
  const link = await command(registerBoxCommands, client, ["box", "share", "repo", "/original.bin", "--password", "private-password", "--expire-days", "2", "--preview-only"]);
  assert.equal(link.data.url, "https://box.nju.edu.cn/f/public-id/");
  assert.equal(link.data.id, "share-links-id");
  assert.equal(link.data.protected, true);
  assert.equal(link.data.permissions.can_download, false);
  assert.doesNotMatch(JSON.stringify(link), /private-password|private-sync-token/);
  await client.unshare(link.data.id);
  assert.equal((await client.shares()).length, 0);
  const uploadLink = await client.uploadLink("repo", "/materials", { password: "private-upload-password" });
  assert.match(uploadLink.url, /\/u\/d\//);
  await client.revokeUploadLink(uploadLink.id);
  await client.star("repo", "/original.bin"); await client.unstar("repo", "/original.bin");
  assert.equal((await client.lock("repo", "/original.bin")).locked, true);
  await client.unlock("repo", "/original.bin");
  assert.equal((await client.copy("repo", "/original.bin", "repo", "/materials")).path, "/materials/original.bin");
  assert.equal((await client.move("repo", "/materials/original.bin", "repo", "/materials/nested")).path, "/materials/nested/original.bin");
  await client.rename("repo", "/materials/nested/original.bin", "renamed.bin");
  await client.remove("repo", "/materials/nested/renamed.bin");
  assert.equal((await client.history("repo")).entries[0].commitId, "version-id");
  assert.equal((await client.trash("repo")).cursor, null);
  mode = "failure";
  await assert.rejects(client.share("repo", "/original.bin"), { code: "REMOTE_UNAVAILABLE" });
  assert.equal(sharePosts, 2);
  const invalid = await command(registerBoxCommands, client, ["box", "share", "repo", "/original.bin", "--expire-days", "0"]);
  assert.equal(invalid.error.code, "INVALID_INPUT");
  assert.equal(sharePosts, 2);
  await assert.rejects(client.list("repo", "/../outside"), { code: "INVALID_INPUT" });
});

test("云盘：浏览器二进制 multipart 与响应异常边界", async () => {
  const form = new FormData(); form.set("parent_dir", "/");
  form.set("file", new Blob([new Uint8Array([0, 255, 1])]), "二进制.bin");
  const http = { fetch: async (_url, options) => {
    assert.equal(options.data, undefined);
    assert.equal(options.multipart.parent_dir, "/");
    assert.equal(options.multipart.file.name, "二进制.bin");
    assert.deepEqual(options.multipart.file.buffer, Buffer.from([0, 255, 1]));
    return { ok: () => true, status: () => 200, url: () => "https://box.nju.edu.cn/upload", headers: () => ({}), text: async () => "[]", body: async () => Buffer.from("[]") };
  } };
  for (const context of [http, { pages: () => [], request: http }]) {
    const session = new BrowserSession(context, "unused");
    await session.request("https://box.nju.edu.cn/upload", { method: "POST", body: form });
  }
  for (const [status, body, code] of [[401, "{}", "AUTH_EXPIRED"], [200, "<html>error</html>", "REMOTE_SCHEMA_CHANGED"], [200, "{}", "REMOTE_SCHEMA_CHANGED"]]) {
    const client = new BoxClient(async () => ({ ok: status === 200, status, text: async () => body, headers: new Headers() }));
    await assert.rejects(client.repos(), { code });
  }
});

test("云盘：跨资料库异步任务完成后回读，失败保持单次提交", async (t) => {
  let submitted = 0, probes = 0, failed = false, finished = false;
  const file = { id: "content-id", name: "file.txt", type: "file", size: 5 };
  const request = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://box.nju.edu.cn");
    res.setHeader("content-type", "application/json");
    if (url.pathname === "/api2/repos/") return res.end(JSON.stringify(["source", "destination"].map((id) => ({ id, name: id, encrypted: false, permission: "rw", type: "repo" }))));
    if (url.pathname === "/api2/repos/source/dir/") return res.end(JSON.stringify([file]));
    if (url.pathname === "/api2/repos/destination/dir/") return res.end(JSON.stringify(finished ? [file] : []));
    if (url.pathname === "/api/v2.1/repos/async-batch-copy-item/") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      assert.equal(req.headers["content-type"], "application/json");
      assert.deepEqual(JSON.parse(Buffer.concat(chunks)), { src_repo_id: "source", src_parent_dir: "/", dst_repo_id: "destination", dst_parent_dir: "/", src_dirents: ["file.txt"] });
      submitted++;
      return res.end(JSON.stringify({ task_id: "task-id" }));
    }
    if (url.pathname === "/api/v2.1/query-copy-move-progress/") {
      assert.equal(url.searchParams.get("task_id"), "task-id");
      probes++;
      finished = !failed && probes >= 2;
      return res.end(JSON.stringify({ failed, successful: finished, canceled: false }));
    }
    res.statusCode = 404; res.end("{}");
  });
  const client = new BoxClient(request);
  assert.equal((await client.copy("source", "/file.txt", "destination", "/")).id, "content-id");
  assert.equal(submitted, 1); assert.equal(probes, 2);
  finished = false; failed = true;
  await assert.rejects(client.copy("source", "/file.txt", "destination", "/"), { code: "REMOTE_UNAVAILABLE" });
  assert.equal(submitted, 2);
});

test("体育：认证与查询共用签名头，列表和详情保持相同预约字段", async (t) => {
  const calls = [];
  const row = { id: "order-1", campusName: "仙林", venueName: "体育馆", siteName: "场地 A", reservationDate: "2026-10-08", orderStatus: 1 };
  const request = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://ggtypt.nju.edu.cn");
    calls.push(url.pathname);
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const form = new URLSearchParams(Buffer.concat(chunks).toString());
    const json = (data) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ code: 200, data }));
    };
    if (url.pathname === "/authserver/login") return res.end("ready");
    assert.equal(req.headers["app-key"], "8fceb735082b5a529312040b58ea780b");
    assert.match(req.headers.timestamp, /^\d+$/);
    assert.match(req.headers.sign, /^[0-9a-f]{32}$/);
    if (url.pathname === "/venue-server/api/login") {
      assert.equal(req.method, "POST");
      assert.equal(req.headers["oauth-token"], "test-oauth");
      assert.equal(form.size, 0);
      return json({ token: { access_token: "login-token" }, roles: [{ id: "student" }] });
    }
    if (url.pathname === "/venue-server/roleLogin") {
      assert.equal(req.method, "POST");
      assert.equal(req.headers.cgauthorization, "login-token");
      assert.equal(form.get("roleid"), "student");
      return json({ token: { access_token: "role-token" } });
    }
    assert.equal(req.method, "GET");
    assert.equal(req.headers.cgauthorization, "role-token");
    assert.equal(url.searchParams.get("nocache"), req.headers.timestamp);
    if (url.pathname === "/venue-server/api/orders/mine") {
      assert.equal(url.searchParams.get("page"), "0");
      assert.equal(url.searchParams.get("size"), "20");
      return json({ content: [row] });
    }
    assert.equal(url.pathname, "/venue-server/api/orders/order-1");
    return json({
      orderInfo: { ...row, id: "unrelated-order-field" },
      venueInfoBean: { ...row, id: "venue-1", reservationDate: "unrelated-venue-field" },
    });
  });
  const token = await exchangeSportsAccessToken(async (input, init) => {
    const response = await request(input, init);
    if (new URL(input).hostname !== "authserver.nju.edu.cn") return response;
    return {
      ok: response.ok, status: response.status, headers: response.headers,
      url: "https://ggtypt.nju.edu.cn/venue-server/sso/manageLogin?oauth_token=test-oauth",
      text: () => response.text(), arrayBuffer: () => response.arrayBuffer(),
    };
  });
  assert.equal(token, "role-token");
  const client = new SportsClient(request, token);
  const expected = { bookingId: "order-1", campus: "仙林", venue: "体育馆", site: "场地 A", reservationDate: "2026-10-08", reservationDetail: null, status: "active" };
  assert.deepEqual(await client.listBookings(), [expected]);
  assert.deepEqual(await client.getBooking("order-1"), expected);
  assert.deepEqual(calls, ["/authserver/login", "/venue-server/api/login", "/venue-server/roleLogin", "/venue-server/api/orders/mine", "/venue-server/api/orders/order-1"]);
});

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
  const module = new URL("../dist/src/auth/browser-session.js", import.meta.url).href;
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
      "scoped=synthetic-scoped; Path=/private; HttpOnly",
    ]);
    res.end(JSON.stringify({ cookie: req.headers.cookie ?? "" }));
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  await withBrowserSession(account, false, async (session) => {
    await session.request(`${origin}/login`);
    assert.equal(await session.cookie(origin, "session"), "synthetic-current");
    assert.equal(await session.cookie("https://other.example", "session"), undefined);
    assert.equal(await session.cookie(`${origin}/private/file`, "scoped"), "synthetic-scoped");
    assert.equal(await session.cookie(`${origin}/private-other`, "scoped"), undefined);
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
  for (const capability of ["sso", "softse"]) {
    await sessions.put(account, { capability, status: "valid" });
    await assert.rejects(auth.login(account, capability), /login unavailable/);
    assert.equal((await sessions.list(account)).find((s) => s.capability === capability).status, "expired");
  }
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
  const service = new CampusClient(request);
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
      assert.deepEqual(detailReads, scenario === "multiple" ? ["saved-1", "saved-2"] : ["saved-1"]);
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


test("协同表格：Cookie 认证、UUID 定位、单次填写回读与错误不重试", async (t) => {
  const writes = [];
  let tokenCalls = 0, broken = false, wrongReadback = false;
  const stored = new Map();
  const columns = [{ key: "0000", name: "学号", type: "text", data: null },
    { key: "score", name: "成绩", type: "number", data: { enable_check_format: true, format_min_value: 0, format_max_value: 100 } },
    { key: "sum", name: "总评", type: "formula", data: { formula: "{成绩}" } }];
  const http = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://table.nju.edu.cn");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const send = (data) => res.end(JSON.stringify(data));
    if (url.pathname === "/sso/") return res.end("<script>var app={csrfToken:'local-csrf',username:'local-owner'};</script>");
    if (url.pathname.endsWith("workspaces/")) return send({ workspace_list: [{ id: 7, type: "personal", name: "个人", table_list: [{ uuid: "base-1", workspace_id: 7, name: "课程成绩" }] }] });
    if (url.pathname.endsWith("access-token/")) {
      tokenCalls++; assert.equal(decodeURIComponent(url.pathname), "/api/v2.1/workspace/7/dtable/课程成绩/access-token/");
      return send({ dtable_uuid: "base-1", access_token: "base-secret" });
    }
    assert.equal(req.headers.authorization, "Bearer base-secret");
    if (url.pathname.endsWith("metadata/")) return send({ metadata: { tables: [{ _id: "sheet-1", name: "课程", columns, views: [] }] } });
    if (req.method === "POST" || req.method === "PUT") {
      const body = JSON.parse(Buffer.concat(chunks)); writes.push({ method: req.method, body });
      if (broken) { res.statusCode = 503; return send({ error: "unavailable" }); }
      if (req.method === "POST") {
        const row_ids = body.rows.map((row, index) => { const _id = `r${index}`; stored.set(_id, { _id, ...row }); return { _id }; });
        return send({ inserted_row_count: row_ids.length, row_ids });
      }
      for (const update of body.updates) stored.set(update.row_id, { ...stored.get(update.row_id), ...update.row });
      return send({ success: true });
    }
    if (url.pathname.endsWith("rows/")) {
      assert.equal(url.searchParams.get("convert_keys"), "true");
      assert.equal(url.searchParams.get("start"), "1"); assert.equal(url.searchParams.get("view_name"), "成绩排名");
      return send({ rows: [{ _id: "r1", 学号: "demo-2" }] });
    }
    const row = stored.get(url.pathname.split("/").at(-2));
    if (row) return send({ ...row, ...(wrongReadback ? { 成绩: 99 } : {}) });
    res.statusCode = 404; send({ error: "missing" });
  });
  const client = new TableClient(http);
  assert.equal(await client.restoreSession(), true);
  const bases = await client.bases("课程"); assert.equal(bases[0].uuid, "base-1");
  const appended = await client.append("base-1", "课程", [{ 学号: "demo-1", 成绩: 0 }, { 学号: "demo-2", 成绩: null }]);
  assert.equal(appended.rows[0].成绩, 0); assert.equal(appended.rows[1].成绩, null);
  const updated = await client.update("base-1", "课程", [{ row_id: "r0", row: { 成绩: 80 } }]);
  assert.equal(updated.rows[0].成绩, 80);
  assert.equal((await client.rows("base-1", "课程", { page: 2, size: 1, view: "成绩排名" })).nextPage, 3);
  assert.equal(tokenCalls, 1);
  await assert.rejects(client.append("base-1", "课程", [{ 总评: 95 }]), /自动计算/);
  await assert.rejects(client.append("base-1", "课程", [{ 成绩: 101 }]), /数值范围/);
  await assert.rejects(client.append("base-1", "课程", [{ 不存在: "x" }]), /未找到字段/);
  assert.equal(writes.length, 2);
  broken = true;
  await assert.rejects(client.append("base-1", "课程", [{ 成绩: 60 }]), /HTTP 503/);
  assert.equal(writes.length, 3);
  broken = false; wrongReadback = true;
  await assert.rejects(client.update("base-1", "课程", [{ row_id: "r0", row: { 成绩: 70 } }]), (error) => error.details.rowId === "r0" && error.details.fields[0] === "成绩");
  assert.equal(writes.length, 4);
  assert.equal(await new TableClient(async () => ({ ok: true, url: "https://authserver.nju.edu.cn/authserver/login" })).restoreSession(), false);
  await assert.rejects(new TableClient(async () => ({ ok: false, status: 500 })).restoreSession(), /HTTP 500/);
});

test("协同表格：模板复制、建表结构、视图按字段名映射与创建失败定位", async (t) => {
  let base, sheets = [], failSheet = false;
  const writes = [];
  const http = await localHttp(t, async (req, res) => {
    const url = new URL(req.url, "https://table.nju.edu.cn");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString();
    const send = (value) => res.end(JSON.stringify(value));
    if (url.pathname === "/sso/") return res.end("csrfToken:'csrf',username:'owner'");
    if (url.pathname.endsWith("workspaces/")) return send({ workspace_list: [{ id: 7, type: "personal", table_list: base ? [base] : [] }] });
    if (url.pathname.endsWith("templates/")) return send({ template_list: [{ name: "grades", display_name: "登分", category: "教育", description: "成绩登记", link: "https://table.nju.edu.cn/dtable/external-links/template/" }] });
    if (url.pathname.endsWith("access-token/")) return send({ access_token: "base-token", dtable_uuid: base.uuid });
    const isGateway = url.pathname.startsWith("/api-gateway/");
    const body = bodyText ? isGateway ? JSON.parse(bodyText) : Object.fromEntries(new URLSearchParams(bodyText)) : {};
    if (req.method !== "GET") writes.push({ method: req.method, path: url.pathname, body });
    if (!isGateway) {
      assert.equal(req.headers["x-csrftoken"], "csrf");
      if (url.pathname.endsWith("dtable-copy/")) {
        assert.equal(body.dst_workspace_id, "7");
        base = { uuid: "new-base", name: "原模板", workspace_id: 7 };
        sheets = [{ _id: "original", name: "模板表", columns: [], views: [] }];
        return send({ dtable: base });
      }
      if (url.pathname === "/api/v2.1/dtables/") {
        assert.equal(body.owner, "owner");
        base = { uuid: "new-base", name: body.name, workspace_id: 7 };
        sheets = [{ _id: "default", name: "默认", columns: [], views: [] }];
        return send({ table: base });
      }
      if (req.method === "PUT") { base.name = body.new_name; return send({ success: true }); }
    }
    assert.equal(req.headers.authorization, "Bearer base-token");
    if (url.pathname.endsWith("metadata/")) return send({ metadata: { tables: sheets } });
    if (url.pathname.endsWith("columns/")) {
      const sheet = sheets.find((item) => item.name === body.table_name);
      const column = { key: `key${sheet.columns.length}`, name: body.column_name, type: body.column_type, data: body.column_data };
      sheet.columns.push(column); return send(column);
    }
    if (url.pathname.endsWith("tables/")) {
      if (req.method === "DELETE") { sheets = sheets.filter((sheet) => sheet.name !== body.table_name); return send({ success: true }); }
      if (failSheet) { res.statusCode = 400; return send({ error: "invalid formula" }); }
      const sheet = { _id: "custom", name: body.table_name, columns: body.columns.map((col, i) => ({ key: `key${i}`, name: col.column_name, type: col.column_type })), views: [] };
      sheets.push(sheet); return send(sheet);
    }
    const sheet = sheets.find((item) => item.name === url.searchParams.get("table_name"));
    if (req.method === "POST") { const view = { _id: "view", name: body.name }; sheet.views.push(view); return send(view); }
    const view = sheet.views[0];
    if (req.method === "PUT") Object.assign(view, body);
    return send(view);
  });
  const client = new TableClient(http); await client.restoreSession();
  const copy = await client.create("我的作业表", { template: "grades" });
  assert.equal(copy.base.name, "我的作业表"); assert.equal(copy.tables[0]._id, "original");
  const definition = { tables: [{ name: "成绩", columns: [{ column_name: "分数", column_type: "number" }, { column_name: "总分", column_type: "formula", column_data: { formula: "{分数}" } }], views: [{ name: "排名", sorts: [{ column: "分数", direction: "down" }] }] }] };
  const result = await client.create("自定义", { definition });
  assert.equal(result.tables.length, 1); assert.equal(result.tables[0].name, "成绩");
  const tableWrite = writes.find((item) => item.path.includes("/api-gateway/") && item.path.endsWith("tables/") && item.method === "POST");
  assert.equal(tableWrite.body.columns.length, 1);
  assert.equal(writes.filter((item) => item.path.endsWith("columns/")).length, 1);
  assert.deepEqual(result.tables[0].views[0].sorts, [{ column_key: "key0", sort_type: "down" }]);
  const previous = writes.length;
  await assert.rejects(client.create("不存在模板", { template: "missing" }), /未找到模板/);
  await assert.rejects(client.addView("new-base", "成绩", { name: "未知列", hidden: ["不存在"] }), /不存在的字段/);
  assert.equal(writes.length, previous);
  failSheet = true;
  await assert.rejects(client.create("部分失败", { definition }), (error) => error.details.baseId === "new-base" && error.message.includes("已创建"));
  assert.equal(writes.length, previous + 2);
});

test("协同表格 CLI：模板文件、分页与写入输入在提交前校验", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-table-")); t.after(() => rm(directory, { recursive: true, force: true }));
  let calls = 0, createOptions;
  const service = { create: async (_name, options) => { calls++; createOptions = options; return {}; }, append: async () => { calls++; }, rows: async () => { calls++; } };
  assert.equal((await command(registerTableCommands, service, ["table", "create", "成绩", "--preset", "gradebook"])).code, 0);
  assert.equal(createOptions.definition.tables[0].columns.find((item) => item.column_name === "总评").column_type, "formula");
  assert.equal((await command(registerTableCommands, service, ["table", "create", "成绩", "--preset", "gradebook", "--template", "other"])).code, 2);
  assert.equal((await command(registerTableCommands, service, ["table", "rows", "base", "sheet", "--size", "1001"])).code, 2);
  const path = join(directory, "rows.json"); await writeFile(path, "[]");
  assert.equal((await command(registerTableCommands, service, ["table", "append", "base", "sheet", "--input", path])).code, 2);
  await writeFile(path, JSON.stringify({ tables: [{ name: "课程", columns: [{ column_name: "成绩", column_type: "number" }], views: [{ name: "排序", hidden: ["缺失"] }] }] }));
  assert.equal((await command(registerTableCommands, service, ["table", "create", "成绩", "--input", path])).code, 2);
  assert.equal(calls, 1);
  const output = join(directory, "preset.json");
  assert.equal((await command(registerTableCommands, service, ["table", "preset", "gradebook", "--output", output])).code, 0);
  assert.equal(JSON.parse(await readFile(output, "utf8")).tables[0].name, "课程成绩");
  assert.equal((await stat(output)).mode & 0o777, 0o600);
});

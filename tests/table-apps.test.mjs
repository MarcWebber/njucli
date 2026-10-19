import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Command } from "commander";
import { withBrowserSession } from "../dist/src/auth/browser-session.js";
import { AuthCoordinator } from "../dist/src/auth/coordinator.js";
import { SessionStore } from "../dist/src/auth/session-store.js";
import { createTableServices } from "../dist/skills/njucli-table/scripts/services.js";
import { registerTableCommands } from "../dist/skills/njucli-table/scripts/commands.js";

const appId = "11111111-1111-4111-8111-111111111111";
const appPath = `/external-apps/${appId}/`;
const apiPath = `/api/v2.1/universal-apps/${appId}/`;

test("外部应用表单：HTTP 登录、CLI 提交、分页回读及失败单次写入", async t => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-table-app-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: "test", configDir: directory, browserDataDir: join(directory, "browser") };
  await writeFile(join(directory, "auth.json"), JSON.stringify({ username: "student-demo", password: "synthetic-password" }));
  const columns = [
    { key: "0000", name: "学号", type: "text", data: null },
    { key: "name", name: "姓名", type: "text", data: null },
    { key: "addr", name: "地点", type: "text", data: null },
    { key: "start", name: "起始日期", type: "date", data: { format: "YYYY-MM-DD" } },
    { key: "end", name: "结束日期", type: "date", data: { format: "YYYY-MM-DD" } },
  ];
  const form = { id: "form", name: "填报", type: "form", table_id: "sheet", columns: columns.map(c => ({
    key: c.key, is_required: c.key !== "end", enable_fill_default_value: ["0000", "name"].includes(c.key),
    enable_not_change_default_value: ["0000", "name"].includes(c.key),
    default_value: c.key === "0000" ? "{creator.id}" : c.key === "name" ? "{creator.name}" : "",
  })) };
  const details = { id: "details", name: "详情", type: "table", table_id: "sheet", shown_column_keys: columns.map(c => c.key) };
  const input = { 地点: "示例实习单位", 起始日期: "2026-10-19", 结束日期: null };
  const row = { _id: "old", "0000": "student-demo", name: "同学", addr: input.地点, start: "2026-10-19T00:00:00+08:00", end: null };
  let rows = [row], mode = "success", writes = 0, readsSinceWrite = 0;
  const calls = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "https://table.nju.edu.cn");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    calls.push({ method: req.method, path: url.pathname });
    const send = (value, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(value)); };
    if (url.pathname === appPath) {
      if (!req.headers.cookie?.includes("session=synthetic")) { res.writeHead(302, { location: `${appPath}login/` }); return res.end(); }
      const pages = [form, mode === "hidden" ? { ...details, shown_column_keys: ["0000"] } : details];
      const config = JSON.stringify({ app_name: "示例填报", settings: { pages } }).split("").map(c => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`).join("");
      return res.end(`<script>window.app={pageOptions:{csrfToken:"synthetic-csrf",name:'同学'}};window.shared={pageOptions:{appUuid:'${appId}',appConfig:'${config}',accessToken:'synthetic-token',userIdInOrg:'student-demo'}};</script>`);
    }
    if (url.pathname === `${appPath}login/`) return res.end("login");
    if (url.pathname === "/accounts/login/") {
      if (req.method === "GET") return res.end('<form method="post"><input name="csrfmiddlewaretoken" value="login-csrf"></form>');
      const data = new URLSearchParams(body);
      assert.equal(data.get("csrfmiddlewaretoken"), "login-csrf");
      assert.equal(data.get("login"), "student-demo");
      assert.equal(data.get("password"), "synthetic-password");
      assert.equal(data.get("next"), appPath);
      res.writeHead(302, mode === "login-rejected" ? { location: "/accounts/login/" } : { "set-cookie": "session=synthetic; Path=/; HttpOnly", location: appPath });
      return res.end();
    }
    assert.equal(req.headers.authorization, "Token synthetic-token");
    assert.equal(req.headers["x-csrftoken"], "synthetic-csrf");
    assert.ok(req.headers.cookie?.includes("session=synthetic"));
    if (url.pathname === apiPath + "metadata/") return send({ tables: [{ _id: "sheet", name: "登记", columns, views: [] }] });
    if (url.pathname === apiPath + "form-submit/") {
      writes++; readsSinceWrite = 0;
      const data = JSON.parse(body);
      assert.deepEqual(data, { app_page_id: "form", row_data: { ...input, 学号: "student-demo", 姓名: "同学" }, new_linked_rows: [], link_rows: [] });
      if (mode === "post-error") return send({}, 503);
      if (mode === "rejected") return send({ success: false });
      if (mode !== "stale") rows.push({ ...row, _id: `new-${writes}`, ...(mode === "wrong-readback" ? { addr: "另一地点" } : {}) });
      if (mode === "ambiguous") rows.push({ ...row, _id: `concurrent-${writes}` });
      return send({ success: true, success_message: "" });
    }
    if (url.pathname === apiPath + "rows/") {
      readsSinceWrite++;
      assert.equal(url.searchParams.get("page_id"), "details");
      if (mode === "read-error" && readsSinceWrite === 1) return send({}, 503);
      const start = Number(url.searchParams.get("start")), limit = Number(url.searchParams.get("limit"));
      return send({ success: true, error_message: "", metadata: columns, results: rows.slice(start, start + limit) });
    }
    send({}, 404);
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const auth = new AuthCoordinator({ sessions: new SessionStore(), drivers: { table: {
    login: async () => { throw new Error("unexpected login driver"); }, probe: async () => { throw new Error("unexpected probe driver"); },
  } } });
  const services = createTableServices({ accountStore: { current: async () => account }, auth });
  const command = (...args) => withBrowserSession(account, true, async session => {
    const request = session.request;
    session.request = async (input, init) => {
      const url = new URL(input);
      assert.equal(url.origin, "https://table.nju.edu.cn");
      const response = await request(origin + url.pathname + url.search, init);
      const final = new URL(response.url);
      return { ...response, url: `https://table.nju.edu.cn${final.pathname}${final.search}` };
    };
    session.page = async () => { throw new Error("browser must remain unused"); };
    let stdout = "", code;
    const program = new Command().exitOverride();
    registerTableCommands(program, services, { environment: { NJUCLI_FORMAT: "json" }, output: { stdout: value => { stdout += value; }, stderr() {} }, setExitCode: value => { code = value; } });
    await program.parseAsync(["table", ...args], { from: "user" });
    assert.doesNotMatch(stdout, /synthetic-token|synthetic-csrf|synthetic-password/);
    return { ...JSON.parse(stdout), code };
  });
  const path = join(directory, "form.json");
  await writeFile(path, JSON.stringify(input));
  const submit = () => command("form-submit", appId, "form", "--input", path, "--readback-page", "details");
  const shown = await command("app-show", `https://table.nju.edu.cn${appPath}?page_id=form`);
  assert.equal(shown.data.pages[0].columns[0].form.default_value, "{creator.id}");
  assert.equal(calls.filter(c => c.path === "/accounts/login/" && c.method === "POST").length, 1);
  const created = await submit();
  assert.equal(created.ok, true);
  assert.equal(created.data.row._id, "new-1");
  assert.equal(created.data.row.起始日期, "2026-10-19T00:00:00+08:00");
  assert.equal(writes, 1);
  const paged = await command("app-rows", appId, "details", "--size", "1", "--page", "2");
  assert.equal(paged.data.items[0]._id, "new-1");
  assert.equal(paged.data.nextPage, 3);
  assert.equal((await command("app-rows", appId, "details", "--size", "1", "--page", "3")).data.nextPage, null);
  for (const invalid of [{ 地点: "示例" }, { ...input, 起始日期: "2026-02-30" }, { ...input, 学号: "another" }, { ...input, 意外字段: "x" }]) {
    await writeFile(path, JSON.stringify(invalid));
    assert.equal((await submit()).code, 2);
    assert.equal(writes, 1);
  }
  await writeFile(path, JSON.stringify(input));
  mode = "hidden";
  assert.equal((await submit()).code, 2);
  assert.equal(writes, 1);
  for (const failure of ["post-error", "rejected", "stale", "wrong-readback", "ambiguous", "read-error"]) {
    mode = failure; readsSinceWrite = 2;
    const before = writes;
    const result = await submit();
    assert.equal(result.ok, false, failure);
    assert.equal(writes, before + 1, failure);
    if (["stale", "wrong-readback", "ambiguous", "read-error"].includes(failure)) assert.equal(result.error.details.submitted, true);
  }
  const previous = calls.length;
  assert.equal((await command("app-show", "https://example.com/external-apps/" + appId)).code, 2);
  assert.equal((await command("app-rows", appId, "details", "--page", "0")).code, 2);
  assert.equal(calls.length, previous);
  await writeFile(join(directory, "session-cookies.json"), "[]");
  mode = "login-rejected";
  assert.equal((await command("app-show", appId)).error.code, "USER_ACTION_REQUIRED");
  await rm(join(directory, "auth.json"));
  assert.equal((await command("app-show", appId)).error.code, "USER_ACTION_REQUIRED");
  assert.equal((await readFile(join(directory, "sessions.json"), "utf8")).includes('"capability": "table"'), true);
});

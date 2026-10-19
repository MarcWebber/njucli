import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRuntime } from "../dist/src/app/runtime.js";
import { withBrowserSession } from "../dist/src/auth/browser-session.js";
import { ssoSessionDriver } from "../dist/src/auth/drivers/sso-browser.js";
import { createAuthServices } from "../dist/src/auth/service.js";
import { AppError } from "../dist/src/core/errors.js";
import { createYouthServices } from "../dist/skills/njucli-youth/scripts/services.js";

test("认证入口：标准输入凭据、JSON 校验与输出脱敏", async () => {
  const commands = new URL("../dist/src/auth/commands.js", import.meta.url).href;
  const runtime = new URL("../dist/src/core/command.js", import.meta.url).href;
  const run = async (action, input) => {
    const child = spawn(process.execPath, [...process.execArgv.filter((value) => !value.startsWith("--test")), "--input-type=module", "-e", `
      import { registerAuthCommands } from ${JSON.stringify(commands)};
      import { createProgram, createCommandRuntime } from ${JSON.stringify(runtime)};
      const program = createProgram('test');
      const check = credentials => {
        if (credentials.username !== 'student' || credentials.password !== ' secret ') throw new Error('credential boundary mismatch');
      };
      registerAuthCommands(program, {
        authenticate: async credentials => { check(credentials); return { studentId: 'school-student' }; },
        login: async (_, credentials) => { check(credentials); return { capability: 'sso', status: 'valid' }; },
      }, createCommandRuntime());
      await program.parseAsync(['auth', ${JSON.stringify(action)}, '--credentials', '-', '--format', 'json'], { from: 'user' });
    `], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.stdin.end(input);
    const [code] = await once(child, "close");
    assert.equal(stderr, "");
    assert.equal(stdout.includes("secret"), false);
    return { code, ...JSON.parse(stdout) };
  };
  const credentials = JSON.stringify({ username: " student ", password: " secret " });
  const verified = await run("authenticate", credentials);
  assert.equal(verified.code, 0);
  assert.deepEqual(verified.data, { studentId: "school-student" });
  assert.equal((await run("login", credentials)).data.status, "valid");
  for (const input of ["{", "null", "[]", '{"username":"student","password":1}', '{"username":"","password":" secret "}']) {
    const result = await run("authenticate", input);
    assert.equal(result.code, 2);
    assert.equal(result.error.code, "INVALID_INPUT");
  }
});

test("认证服务：新会话校验密码、远端学号回读与失败清理", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-authenticate-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: "authentication", configDir: directory, browserDataDir: join(directory, "browser") };
  const credentials = { username: "input-student", password: "synthetic-secret" };
  let identity = { anonymous: false, userId: "school-student", name: "学生", departmentName: "学院", menus: [] };
  let logins = 0, identityReads = 0;
  const server = createServer(async (req, res) => {
    if (req.url === "/seed") {
      res.setHeader("set-cookie", "session=old-valid; Path=/; HttpOnly");
      return res.end("valid");
    }
    if (req.url === "/login") {
      logins++;
      assert.equal(req.headers.cookie, undefined, "password validation must start with empty cookies");
      let body = "";
      for await (const chunk of req) body += chunk;
      if (JSON.parse(body).password !== credentials.password) {
        res.statusCode = 401;
        return res.end("rejected");
      }
      res.setHeader("set-cookie", "session=new-valid; Path=/; HttpOnly");
      return res.end("valid");
    }
    assert.equal(req.headers.cookie, "session=new-valid");
    if (req.url === "/tw/") return res.end("青年平台");
    assert.equal(req.url, "/tw/ctx");
    assert.equal(req.method, "POST");
    identityReads++;
    res.end(JSON.stringify({ code: 0, data: Buffer.from(JSON.stringify(identity)).toString("base64") }));
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const context = createRuntime();
  t.mock.method(context.accountStore, "current", async () => account);
  t.mock.method(ssoSessionDriver, "login", () => withBrowserSession(account, true, async session => {
    const request = session.request;
    session.request = (input, init) => {
      const url = new URL(input);
      return request(origin + url.pathname + url.search, init);
    };
    const input = JSON.parse(await readFile(join(directory, "auth.json"), "utf8"));
    const response = await session.request(`${origin}/login`, { method: "POST", body: JSON.stringify(input) });
    if (response.status === 401) throw new AppError("AUTH_REJECTED", "学校拒绝登录");
    return response.ok;
  }));
  const service = createAuthServices(context, createYouthServices(context).identity);
  await withBrowserSession(account, true, async session => { await session.request(`${origin}/seed`); });
  assert.deepEqual(await service.authenticate(credentials), { studentId: "school-student" });
  assert.equal(logins, 1);
  assert.equal(identityReads, 1);
  assert.deepEqual(JSON.parse(await readFile(join(directory, "auth.json"), "utf8")), credentials);
  assert.equal((await stat(join(directory, "auth.json"))).mode & 0o777, 0o600);
  await assert.rejects(service.authenticate({ ...credentials, password: "wrong-password" }), { code: "AUTH_REJECTED" });
  assert.equal(logins, 2);
  assert.equal(identityReads, 1);
  assert.deepEqual(JSON.parse(await readFile(join(directory, "auth.json"), "utf8")), credentials);
  assert.deepEqual(JSON.parse(await readFile(join(directory, "session-cookies.json"), "utf8")), []);
  identity = { ...identity, userId: "" };
  await assert.rejects(service.authenticate(credentials), { code: "REMOTE_SCHEMA_CHANGED" });
  assert.equal(logins, 3);
  assert.equal(identityReads, 2);
  assert.deepEqual(JSON.parse(await readFile(join(directory, "session-cookies.json"), "utf8")), []);
  await rm(join(directory, "auth.json"));
  await assert.rejects(service.authenticate({ ...credentials, password: "wrong-password" }), { code: "AUTH_REJECTED" });
  await assert.rejects(stat(join(directory, "auth.json")), { code: "ENOENT" });
});

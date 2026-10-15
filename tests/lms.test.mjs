import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Command } from "commander";
import { withBrowserSession } from "../dist/src/auth/browser-session.js";
import { AUTH_SITES } from "../dist/src/auth/capabilities.js";
import { createLmsServices } from "../dist/skills/njucli-lms/scripts/client.js";
import { registerLmsCommands } from "../dist/skills/njucli-lms/scripts/commands.js";

test("智汇南雍：共享 Cookie、课程分页、作业与测试、创建回读与单次写入", async t => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-lms-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: "lms", configDir: directory, browserDataDir: join(directory, "browser") };
  const course = { id: 12, name: "接口测试课", course_code: "TEST", url: "https://lms.nju.edu.cn/course/12/index",
    is_instructor: true, instructors: [], instructor_assistants: [{ id: 3, name: "助教" }], start_date: "2026-09-01", end_date: null,
    academic_year: { id: 4, name: "2026-2027" }, semester: { id: 8, name: "第一学期" } };
  const sample = { id: 21, course_id: 12, title: "草稿", type: "homework", published: false, start_time: null,
    end_time: "2026-10-22T15:59:00Z", created_at: "2026-10-15T00:00:00Z", updated_at: null, data: { description: "<p>练习</p>" }, uploads: [] };
  const inputPath = join(directory, "assignment.json");
  const input = { title: "练习", description: "<p>练习</p>", endTime: "2026-10-22T23:59:00+08:00" };
  await writeFile(inputPath, JSON.stringify(input));
  const calls = [];
  let mode = "success", current = sample;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "https://lms.nju.edu.cn");
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
    calls.push({ path: url.pathname, method: req.method, body, cookie: req.headers.cookie });
    const send = (data, status = 200) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
    if (url.pathname === "/user/index") {
      if (mode === "expired") { res.writeHead(302, { location: "/authserver/login" }); return res.end(); }
      if (mode === "unavailable") { res.writeHead(503); return res.end(); }
      res.setHeader("set-cookie", "session=synthetic-lms; Path=/; HttpOnly");
      return res.end('<script>var globalData = { user: { id: 3, name: "助教" } };</script>');
    }
    if (url.pathname === "/authserver/login") return res.end("login form");
    assert.match(req.headers.cookie, /session=synthetic-lms/);
    if (url.pathname === "/api/my-courses") {
      assert.equal(req.method, "POST");
      assert.equal(body.page_size, 20);
      const courses = body.conditions.keyword === "空" ? [] : [course];
      return send({ courses, page: courses.length ? body.page : 0, page_size: 20, pages: courses.length ? 2 : 0, total: courses.length ? 21 : 0 });
    }
    if (url.pathname === "/api/courses/12") return send(course);
    if (url.pathname === "/api/courses/12/homework-activities") {
      const { course_id, ...listItem } = current;
      return send({ homework_activities: [listItem], page: 1, page_size: 20, pages: 1, total: 1 });
    }
    if (url.pathname === "/api/courses/12/activities" && req.method === "GET") return send({ activities: [{ ...sample, type: "material" }] });
    if (url.pathname === "/api/courses/12/exams") return send({ exams: [{ ...sample, id: 9, title: "书面作业一" }] });
    if (url.pathname === "/api/todos") return send({ todo_list: [] });
    if (url.pathname === "/api/courses/12/activities") {
      assert.equal(req.method, "POST");
      assert.equal(body.end_time, "2026-10-22T15:59:00Z");
      if (mode === "post-error") return send({ message: "unavailable" }, 503);
      if (mode === "rejected") return send({ errors: { end_time: ["必填"] } }, 400);
      current = { ...sample, title: body.title, data: { description: body.description }, published: body.published,
        end_time: new Date(body.end_time).toISOString(), start_time: body.start_time };
      return send({ id: sample.id }, 201);
    }
    if (url.pathname === "/api/activities/21") {
      if (mode === "read-error") return send({ message: "unavailable" }, 503);
      if (mode === "bad-readback") return send({ ...current, course_id: 99 });
      if (mode === "wrong-id") return send({ ...current, id: 22 });
      return send(current);
    }
    send({}, 404);
  }).listen(0, "127.0.0.1");
  t.after(() => new Promise(resolve => server.close(resolve)));
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const withSession = operation => withBrowserSession(account, true, async session => {
    const request = session.request;
    session.request = async (input, init) => {
      const target = new URL(input);
      const response = await request(origin + target.pathname + target.search, init);
      const final = new URL(response.url);
      return { ...response, url: `https://${final.pathname === "/authserver/login" ? "authserver.nju.edu.cn" : "lms.nju.edu.cn"}${final.pathname}${final.search}` };
    };
    session.page = async () => { throw new Error("HTTP session should suffice"); };
    return operation(session);
  });
  const services = createLmsServices({ withBrowser: (capability, operation) => withSession(async session => {
    assert.equal(capability, "lms");
    assert.equal(await AUTH_SITES.lms.driver.probe(account), true);
    return operation(session, account);
  }) });
  const command = async (...args) => {
    let stdout = "", code;
    const program = new Command().exitOverride();
    registerLmsCommands(program, services, { environment: { NJUCLI_FORMAT: "json" }, output: { stdout: s => { stdout += s; }, stderr: () => {} }, setExitCode: c => { code = c; } });
    await program.parseAsync(["lms", ...args], { from: "user" });
    return { ...JSON.parse(stdout), code };
  };
  assert.equal((await command("courses")).data.nextPage, 2);
  assert.equal((await command("courses", "--page", "2")).data.nextPage, null);
  assert.equal((await command("courses", "空")).data.total, 0);
  assert.equal((await command("course", "12")).data.end_date, null);
  assert.equal((await command("assignments", "12")).data.homework_activities[0].course_id, 12);
  assert.equal((await command("activities", "12")).data[0].type, "material");
  assert.equal((await command("exams", "12")).data[0].title, "书面作业一");
  assert.deepEqual((await command("todos")).data, []);

  const created = await command("create-assignment", "12", "--input", inputPath);
  assert.equal(created.ok, true);
  assert.equal(created.data.published, false);
  const writes = () => calls.filter(c => c.path.endsWith("/activities") && c.method === "POST");
  assert.equal(writes().length, 1);
  assert.equal(writes()[0].body.notify_by_email, false);
  assert.equal(writes()[0].body.notify_by_todo, false);
  assert.deepEqual(calls.slice(-3).map(c => c.path), ["/user/index", "/api/courses/12/activities", "/api/activities/21"]);
  assert.equal((await command("create-assignment", "12", "--input", inputPath, "--publish", "--notify")).data.published, true);
  assert.equal(writes().at(-1).body.notify_by_email, true);

  for (const failure of ["post-error", "rejected", "read-error", "bad-readback", "wrong-id"]) {
    mode = failure;
    const before = writes().length;
    const result = await command("create-assignment", "12", "--input", inputPath);
    assert.equal(result.ok, false);
    assert.equal(writes().length, before + 1, "one submission on errors");
    if (failure.includes("read")) assert.equal(result.error.details.activityId, 21);
  }
  mode = "success";
  const before = calls.length;
  assert.equal((await command("courses", "--page", "0")).code, 2);
  assert.equal((await command("assignment", "../21")).code, 2);
  assert.equal((await command("create-assignment", "12", "--input", inputPath, "--notify")).code, 2);
  for (const invalid of [{ ...input, endTime: "2026-02-30T00:00:00Z" }, { ...input, startTime: "2027-01-01T00:00:00Z" }, { ...input, published: true }]) {
    await writeFile(inputPath, JSON.stringify(invalid));
    assert.equal((await command("create-assignment", "12", "--input", inputPath)).code, 2);
  }
  assert.equal(calls.length, before, "validate before authentication or HTTP");
  assert.ok(JSON.parse(await readFile(join(directory, "session-cookies.json"), "utf8")).some(c => c.name === "session"));
  mode = "expired";
  assert.equal(await withSession(() => AUTH_SITES.lms.driver.probe(account)), false);
  mode = "unavailable";
  await assert.rejects(withSession(() => AUTH_SITES.lms.driver.probe(account)), { code: "REMOTE_UNAVAILABLE" });
});

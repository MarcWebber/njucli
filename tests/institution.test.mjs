import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Command } from "commander";
import { InstitutionClient } from "../dist/skills/njucli-institution/scripts/client.js";
import { registerInstitutionCommands } from "../dist/skills/njucli-institution/scripts/commands.js";
import { decodeHtml, extractText } from "../dist/skills/njucli-institution/scripts/text.js";

async function command(service, args) {
  let stdout = "", stderr = "", code;
  const program = new Command().exitOverride();
  registerInstitutionCommands(program, service, {
    environment: { NJUCLI_FORMAT: "json" },
    output: { stdout: text => { stdout += text; }, stderr: text => { stderr += text; } },
    setExitCode: value => { code = value; },
  });
  await program.parseAsync(["institution", ...args], { from: "user" });
  return { code, stderr, ...JSON.parse(stdout) };
}

test("机构知识：离线检索、同名教师、分页与 JSON/Markdown 导出", async t => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-institution-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = { url: "https://public.nju.edu.cn/teachers/1.htm", fetchedAt: "2026-10-14T00:00:00.000Z", selector: ".teacher-content" };
  const snapshot = { schemaVersion: 1, generatedAt: source.fetchedAt,
    institutions: [ { id: "public", name: "政府管理学院", category: "学院", source }, { id: "math", name: "数学学院", category: "学院", source, contact: { phone: "025-89680002", email: "office@nju.edu.cn", source } } ],
    records: [
      { id: "math-li", institutionId: "math", kind: "teacher", title: "李老师", text: "偏微分方程", source },
      { id: "public-li", institutionId: "public", kind: "teacher", title: "李老师", text: "公共治理、数字治理", phone: "025-89680001", email: "teacher@nju.edu.cn", office: "圣达楼101", source },
      { id: "public-intro", institutionId: "public", kind: "overview", title: "学院概况", text: "公共管理、政治学与数字治理。", source },
    ], services: [{ unit: "膳食中心", department: "第五食堂", phone: "89680000", source }],
    coverage: [{ institutionId: "public", notes: [] }],
  };
  const path = join(directory, "fixture.json");
  await writeFile(path, JSON.stringify(snapshot));
  const service = new InstitutionClient(() => { throw new Error("离线查询不得联网"); }, path);
  const teachers = await command(service, ["teachers", "李老师", "--limit", "1", "--offset", "1"]);
  assert.equal(teachers.data.total, 2);
  assert.equal(teachers.data.items[0].id, "math-li");
  const filtered = await command(service, ["teachers", "治理", "--institution", "政府管理学院"]);
  assert.equal(filtered.data.total, 1);
  assert.equal(filtered.data.items[0].source.url, source.url);
  assert.match(filtered.data.items[0].excerpt, /公共治理/);
  assert.equal("text" in filtered.data.items[0], false);
  assert.equal((await command(service, ["search", "数字", "--kind", "overview"])).data.total, 1);
  assert.equal((await command(service, ["search", "缺失关键词"])).data.total, 0);
  assert.equal((await command(service, ["teachers", "teacher@nju.edu.cn"])).data.total, 1);
  assert.equal((await command(service, ["teachers", "89680001"])).data.total, 1);
  assert.equal((await command(service, ["teacher", "math-li"])).data.record.text, "偏微分方程");
  const missingContact = await command(service, ["teacher", "math-li"]);
  assert.equal(missingContact.data.record.phone, undefined);
  assert.equal(missingContact.data.institution.contact.phone, "025-89680002");
  assert.equal((await command(service, ["show", "math"])).data.institution.contact.email, "office@nju.edu.cn");
  assert.equal((await command(service, ["teacher", "unknown"])).error.code, "NOT_FOUND");
  assert.equal((await command(service, ["teachers", "--institution", "unknown"])).error.code, "NOT_FOUND");
  for (const args of [["--limit", "101"], ["--offset", "-1"], ["--limit", "0"]]) assert.equal((await command(service, ["teachers", ...args])).code, 2);
  assert.equal((await command(service, ["search", "数字", "--kind", "unknown"])).code, 2);
  assert.equal((await command(service, ["services", "第五"])).data.items.length, 1);
  const output = join(directory, "dump");
  const exported = await command(service, ["dump", "--output", output]);
  assert.equal(exported.data.files.length, 5);
  assert.deepEqual(JSON.parse(await readFile(join(output, "机构资料.json"), "utf8")), snapshot);
  assert.match(await readFile(join(output, "institutions/政府管理学院.md"), "utf8"), /teacher@nju.edu.cn/);
  assert.match(await readFile(join(output, "institutions/政府管理学院.md"), "utf8"), /https:\/\/public.nju.edu.cn\/teachers\/1.htm/);
  assert.equal((await stat(join(output, "机构资料.json"))).mode & 0o777, 0o600);
  assert.match(await readFile(join(output, "机构目录.md"), "utf8"), /政府管理学院/);
  assert.match(await readFile(join(output, "后勤电话.md"), "utf8"), /第五食堂/);
});

test("机构知识：本机 HTTP 实时目录、教师正文、后勤合并单元格与错误传递", async t => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-institution-live-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let selectorMissing = false;
  let failing = false;
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    if (failing) { res.writeHead(503).end("unavailable"); return; }
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (req.url === "/xybm.htm") res.end('<div class="yxbm"><ul><h3>学院</h3><li><h4><a href="https://public.nju.edu.cn/">政府管理学院</a></h4></li><li><h4><a href="https://nubs.nju.edu.cn/">商学院</a></h4><div class="bm-er"><a href="https://njubs.nju.edu.cn/intro.php/a">经济学院</a></div></li></ul></div>');
    else if (req.url === "/xyfw/hqfw.htm") res.end('<div id="vsb_content_2"><table><tr><th>单位</th><th>部门</th><th>办公电话</th></tr><tr><td rowspan="2">膳食中心</td><td>第一食堂</td><td>1001</td></tr><tr><td>第二食堂</td><td>1002</td></tr><tr><td colspan="3"></td></tr></table></div>');
    else res.end(selectorMissing ? '<nav>导航信息</nav>' : '<nav>不能收录的导航</nav><div class="teacher-content"><p>姓名：教师 职称：教授</p><p>电话：025-89680001</p><p>邮箱：</p><p>teacher@nju.edu.cn</p><p>办公地点：圣达楼101</p><p>研究方向：数字治理</p></div><div id="research"><p>科研成果</p><div class="teacher-content">无关论文清单</div></div>');
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const source = { url: "https://public.nju.edu.cn/teacher.htm", fetchedAt: "2000-01-01T00:00:00.000Z", selector: ".teacher-content, #research" };
  const snapshot = { schemaVersion: 1, generatedAt: source.fetchedAt, institutions: [{ id: "public", name: "政府管理学院", category: "学院", source }], records: [{ id: "teacher-1", institutionId: "public", kind: "teacher", title: "教师", text: "旧资料", source }], services: [], coverage: [] };
  const path = join(directory, "fixture.json");
  await writeFile(path, JSON.stringify(snapshot));
  const service = new InstitutionClient((input, options) => { const url = new URL(input); return fetch(`http://127.0.0.1:${server.address().port}${url.pathname}`, options); }, path);
  const teachers = await command(service, ["teacher", "teacher-1", "--live"]);
  assert.equal(teachers.data.record.text, "数字治理");
  assert.equal(teachers.data.record.role, "教授");
  assert.equal(teachers.data.record.phone, "025-89680001");
  assert.equal(teachers.data.record.email, "teacher@nju.edu.cn");
  assert.equal(teachers.data.record.office, "圣达楼101");
  assert.doesNotMatch(teachers.data.record.text, /导航/);
  assert.doesNotMatch(teachers.data.record.text, /论文|成果/);
  assert.notEqual(teachers.data.record.source.fetchedAt, source.fetchedAt);
  assert.equal(JSON.parse(await readFile(path, "utf8")).records[0].text, "旧资料");
  const list = await command(service, ["list", "--live"]);
  assert.equal(list.data.items.length, 3);
  assert.equal(list.data.items[2].parentId, list.data.items[1].id);
  const services = await command(service, ["services", "--live"]);
  assert.deepEqual(services.data.items.map(({ unit, department, phone }) => ({ unit, department, phone })), [{ unit: "膳食中心", department: "第一食堂", phone: "1001" }, { unit: "膳食中心", department: "第二食堂", phone: "1002" }]);
  selectorMissing = true;
  assert.equal((await command(service, ["teacher", "teacher-1", "--live"])).error.code, "REMOTE_SCHEMA_CHANGED");
  failing = true;
  const before = requests;
  const failure = await command(service, ["services", "--live"]);
  assert.equal(failure.ok, false);
  assert.match(failure.error.message, /HTTP 503/);
  assert.equal(requests, before + 1);
  failing = false;
  snapshot.records.push({ id: "roster-only", institutionId: "public", kind: "teacher", title: "名录教师", text: "公开名单中的姓名，无独立详情", source: { url: source.url, fetchedAt: source.fetchedAt } });
  await writeFile(path, JSON.stringify(snapshot));
  const beforeRoster = requests;
  const roster = await command(service, ["teacher", "roster-only", "--live"]);
  assert.equal(roster.error.code, "NOT_FOUND");
  assert.equal(requests, beforeRoster);
});

test("机构知识：教师联系卡片、邮件别名与公开邮箱写法", async t => {
  let requests = 0;
  const server = createServer((req, res) => {
    requests++;
    res.setHeader("content-type", "text/html; charset=utf-8");
    const card = req.url === "/placeholder" ? '<p>2026-10-10</p><p>邮件：username@nju.edu.cn</p>' : '<p>邮件：teacher [at] nju dot edu dot cn</p><p>电话：025-89680001 ext.123 传真：025-89680003</p><p>办公地点：教学楼101</p>';
    const body = req.url === "/body-contact" ? '<p>邮件：bodyteacher@nju.edu.cn</p><p>电话：025-89680004</p>' : '';
    res.end(`<section class="contact-card">${req.url === "/body-contact" ? '<p>邮件：</p>' : card}</section><article class="profile"><p>研究方向：机器学习</p>${body}</article><footer><p>邮箱：service@nju.edu.cn</p><p>电话：025-89680002</p></footer>`);
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const directory = await mkdtemp(join(tmpdir(), "njucli-institution-contact-card-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = { url: `http://127.0.0.1:${server.address().port}`, fetchedAt: "2000-01-01T00:00:00.000Z", selector: ".profile", contactSelector: ".contact-card" };
  const path = join(directory, "机构资料.json");
  const snapshot = { schemaVersion: 1, generatedAt: source.fetchedAt, institutions: [{ id: "ai", name: "人工智能学院", category: "学院", source }], records: [{ id: "teacher", institutionId: "ai", kind: "teacher", title: "教师", text: "", source }], services: [], coverage: [] };
  await writeFile(path, JSON.stringify(snapshot));
  const result = await command(new InstitutionClient(fetch, path), ["teacher", "teacher", "--live"]);
  assert.equal(result.data.record.email, "teacher@nju.edu.cn");
  assert.equal(result.data.record.phone, "025-89680001 ext.123");
  assert.equal(result.data.record.office, "教学楼101");
  assert.equal(result.data.record.text, "机器学习");
  assert.equal(requests, 1);
  snapshot.records[0].source = { ...source, url: `${source.url}/placeholder` };
  await writeFile(path, JSON.stringify(snapshot));
  const placeholder = await command(new InstitutionClient(fetch, path), ["teacher", "teacher", "--live"]);
  assert.equal(placeholder.data.record.email, "");
  assert.equal(placeholder.data.record.phone, "");
  snapshot.records[0].source = { ...source, url: `${source.url}/body-contact` };
  await writeFile(path, JSON.stringify(snapshot));
  const bodyContact = await command(new InstitutionClient(fetch, path), ["teacher", "teacher", "--live"]);
  assert.equal(bodyContact.data.record.email, "bodyteacher@nju.edu.cn");
  assert.equal(bodyContact.data.record.phone, "025-89680004");
});

test("机构知识：导航分类与研究方向中的课程、联系信息统一清理", async t => {
  const fragments = ["教授课程：机器学习导论", "讲授课程：统计学", "联系邮箱：teacher@nju.edu.cn", "联系方式：13951703398", "论文：公开论文列表", "13951703398"];
  const server = createServer((req, res) => {
    const index = Number(req.url.slice(1));
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<div class="profile"><nav>当前位置：首页 师资队伍</nav><p>教授课程：</p><p>课程列表</p><p>研究方向：机器学习；因果推断；${fragments[index]}</p><p>联系方式：13951703398，teacher@nju.edu.cn</p></div>`);
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const directory = await mkdtemp(join(tmpdir(), "njucli-institution-fields-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const url = `http://127.0.0.1:${server.address().port}`;
  const source = { url, fetchedAt: "2000-01-01T00:00:00.000Z", selector: ".profile" };
  const snapshot = { schemaVersion: 1, generatedAt: source.fetchedAt,
    institutions: [{ id: "ai", name: "人工智能学院", category: "学院", source }],
    records: fragments.map((fragment, index) => ({ id: `teacher-${index}`, institutionId: "ai", kind: "teacher", title: "教师", category: "当前位置：首页\u00a0\u00a0师资队伍\u00a0\u00a0人工智能系", text: `机器学习；因果推断；${fragment}`, source: { ...source, url: `${url}/${index}` } })), services: [], coverage: [],
  };
  const path = join(directory, "机构资料.json");
  await writeFile(path, JSON.stringify(snapshot));
  const service = new InstitutionClient(fetch, path);
  for (const [index] of fragments.entries()) {
    for (const live of [false, true]) {
      const result = await service.teacher(`teacher-${index}`, live);
      assert.equal(result.record.text, "机器学习；因果推断");
      assert.equal(result.record.category, "人工智能系");
      if (live) {
        assert.equal(result.record.role, "");
        assert.equal(result.record.phone, "13951703398");
        assert.equal(result.record.email, "teacher@nju.edu.cn");
      }
    }
  }
  const output = join(directory, "dump");
  await service.dump(output);
  const markdown = await readFile(join(output, "institutions/人工智能学院.md"), "utf8");
  assert.doesNotMatch(markdown, /当前位置|教授课程|讲授课程|联系方式|13951703398/);
  assert.ok(JSON.parse(await readFile(join(output, "机构资料.json"), "utf8")).records.every(record => record.text === "机器学习；因果推断"));
});

test("机构知识：正文内部语义标签与 HTML 编码声明", async t => {
  const profile = '\ufeff<html><head><meta http-equiv="Content-Type" content="text/html; charset=charset=UTF-8" /></head><body><div class="wp_articlecontent"><header class="page-header"><h1>王其伟</h1><p>研究方向</p><p>对流启动</p><p>中尺度动力学与数值模拟</p><style>隐藏样式</style></header><footer><p>科研论文</p><p>公开成果简介</p></footer></div></body></html>';
  const legacy = Buffer.concat([Buffer.from('<html><head><script>const settings = "charset=invalid";</script><meta http-equiv="Content-Type" content="text/html; charset=GBK"></head><body><article>'), Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), Buffer.from('</article></body></html>')]);
  const server = createServer((req, res) => {
    res.setHeader("content-type", "text/html");
    if (req.url === "/legacy") res.end(legacy);
    else if (req.url === "/meta") res.end('<html><head><script>const settings = "charset=invalid";</script><meta charset="UTF-8"></head><body><article>中文资料</article></body></html>');
    else if (req.url === "/header") {
      res.setHeader("content-type", 'text/html; charset="windows-1252"');
      res.end(Buffer.concat([Buffer.from('<meta charset="UTF-8"><article>caf'), Buffer.from([0xe9]), Buffer.from('</article>')]));
    } else res.end(profile);
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  const source = { url: `${url}/profile`, fetchedAt: "2000-01-01T00:00:00.000Z", selector: ".wp_articlecontent" };
  const directory = await mkdtemp(join(tmpdir(), "njucli-institution-encoding-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "机构资料.json");
  const snapshot = { schemaVersion: 1, generatedAt: source.fetchedAt, institutions: [{ id: "as", name: "大气科学学院", category: "学院", source }], records: [{ id: "profile", institutionId: "as", kind: "teacher", title: "王其伟", text: "旧正文", source }], services: [], coverage: [] };
  await writeFile(path, JSON.stringify(snapshot));
  assert.equal((await new InstitutionClient(fetch, path).teacher("profile", true)).record.text, "对流启动；中尺度动力学与数值模拟");
  for (const [route, expected] of [["legacy", "中文"], ["meta", "中文资料"], ["header", "café"]]) {
    const response = await fetch(`${url}/${route}`);
    const html = decodeHtml(new Uint8Array(await response.arrayBuffer()), response.headers.get("content-type"));
    assert.equal(extractText(html, "article"), expected);
  }
});

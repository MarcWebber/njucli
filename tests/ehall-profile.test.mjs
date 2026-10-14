import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Command } from "commander";
import { createEHallServices } from "../dist/skills/njucli-ehall/scripts/services.js";
import { registerEHallCommands } from "../dist/skills/njucli-ehall/scripts/commands.js";
import { EHallProfileClient } from "../dist/skills/njucli-ehall/scripts/profile.js";
import { saveFile, writeJsonFile } from "../dist/src/core/fs.js";

const specs = [
  { kind: "papers", type: 10, section: "JBXXLWQK", model: "xslwqkbd", title: "LWTM", fields: ["LWTM", "FBQK", "KWJB", "YL2", "FBRQ", "YL3", "ZZWC", "YXYZ"],
    input: { title: "合成论文", journal: "合成期刊", journalLevel: "合成选项", published: true, publishedOn: "2026-10-14", authorRole: "合成选项", impactFactor: "2.8" } },
  { kind: "awards", type: 7, section: "JBXXXWJL", model: "xsjlxxbd", title: "JLMC", fields: ["JLMC", "HJRQ", "JLBM", "HJPMQK"],
    input: { title: "合成获奖", awardedOn: "2026-10-14", organization: "合成单位", ranking: "一等奖" } },
  { kind: "patents", type: 11, section: "JBXXZLQK", model: "xszlqkbd", title: "ZLMC", fields: ["ZLMC", "ZLBH", "BRPM", "ZLLX", "ZLLB", "WCQK", "HDSJ"],
    input: { title: "合成专利", number: "合成编号", inventorRank: 2, type: "合成选项", category: "合成选项", status: "合成选项", date: "2026-10-14" } },
  { kind: "books", type: 13, section: "JBXXZZQK", model: "xszzqkbd", title: "ZZM", fields: ["ZZM", "ZZLB", "ZZPM", "CBDW", "CBSJ"],
    input: { title: "合成著作", category: "合成选项", ranking: "1", publisher: "合成出版社", publishedOn: "2026-10-14" } },
  { kind: "projects", type: 14, section: "JBXXDSKYXM", model: "dskyxmqkbd", title: "XMMC", fields: ["XMMC", "CYSJ", "FBJG"],
    input: { title: "合成导师项目", participatedOn: "2026-10-14", hasPublication: false } },
];
const dates = new Set(["FBRQ", "YL3", "HJRQ", "HDSJ", "CBSJ", "CYSJ"]);
const choices = new Set(["KWJB", "ZZWC", "ZLLX", "ZLLB", "WCQK", "ZZLB"]);

async function fixture(t) {
  let fault = "", writes = [], requests = [], attachmentItems = [], review = false;
  const records = new Map(specs.map((s) => [s.type, [{ WID: `original-${s.type}`, XSBH: "student", [s.title]: "原有资料", YL1: "0", FJ: "original-token", BZ: "原有备注" }]]));
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://localhost").pathname;
    requests.push(path);
    if (path === "/appShow") {
      res.end('<script>var pageMeta = {"params":{"USERID":"student"}};</script>');
      return;
    }
    assert.equal(req.method, "POST");
    let raw = Buffer.alloc(0);
    for await (const chunk of req) raw = Buffer.concat([raw, chunk]);
    const form = new URLSearchParams(raw.toString());
    const params = JSON.parse(form.get("requestParamStr") ?? form.get("data") ?? "{}");
    let result;
    const ok = (data) => ({ returnCode: "#E000000000000", data });
    if (path.endsWith("/getAppConfig.do")) result = { HEADER: { dropMenu: [{ id: "123", active: true }] } };
    else if (path.includes("/changeAppRole/")) result = { success: true };
    else if (path.endsWith("/setXgCommonAppRole.do")) result = { returnCode: "#E000000000000" };
    else if (path.endsWith("/getStuBatchInfo.do")) result = ok({ PCDM: "batch", XSBH: "student", SFXS: "0", SHLC: "flow", ...(fault === "readonly" ? { SHZT: "1" } : {}) });
    else if (path.endsWith("/getLcslInfo.do")) {
      assert.equal(form.has("data"), true);
      result = ok(review || fault === "readonly" ? [{}, {}] : [{}]);
    } else if (path.endsWith("/getSetFzInfo.do")) result = ok([{ id: "group" }]);
    else if (path.endsWith("/getSetNrInfo.do")) result = ok(specs.map((s) => ({ NRDZ: s.section, NRDM: s.section, NRMC: s.kind, CZLX: "1", XSKWH: "1" })));
    else if (/modules\/(baseInfo|wdxx).do$/.test(path)) {
      assert.equal(form.get("*json"), "1");
      result = { code: "0", models: specs.map((s) => ({ name: s.model, controls: [
        ...s.fields.map((name) => ({ name, caption: name, required: true, dataSize: name === "BRPM" ? 5 : 200, dataType: name === "BRPM" ? "int" : "String",
          ...(dates.has(name) ? { xtype: "date-local" } : {}), ...(choices.has(name) ? { xtype: "select", url: "/xxfw/code/fixture.do" } : {}) })),
        { name: "FJ", caption: "附件", hidden: s.kind === "papers" || s.kind === "books" || s.kind === "projects" },
      ] })) };
    } else if (path === "/xxfw/code/fixture.do") result = { code: "0", datas: { code: { rows: [{ id: "0", name: "合成选项" }] } } };
    else if (path.endsWith("/getStuExtendInfo.do")) {
      assert.equal(params.XSBH, "student");
      result = ok(fault === "wrong-user" ? [{ WID: "foreign", XSBH: "other" }] : records.get(params.TYPE));
    } else if (path.endsWith("/uploadTempFile.do")) {
      const multipart = await new Request("http://localhost", { method: "POST", headers: req.headers, body: raw }).formData();
      const file = multipart.get("files[]");
      assert.equal(await file.text(), "合成附件");
      attachmentItems.push({ name: file.name, size: file.size });
      writes.push(path);
      result = { success: true, id: "attachment" };
    } else if (path.includes("/saveAttachment/")) {
      assert.deepEqual(JSON.parse(form.get("attachmentParam")), { storeId: "file", orderMap: { attachment: 1 } });
      assert.equal(form.get("authAppName"), "yjsjbxxappnju");
      assert.equal(form.get("authBeanName"), "jbxxFileOpAuthManager");
      writes.push(path); result = { success: true, successCount: attachmentItems.length };
    } else if (path.includes("/getUploadedAttachment/")) {
      assert.equal(records.get(7).length, 2);
      result = { success: true, items: attachmentItems };
    }
    else if (path.endsWith("/saveStuExtendInfo.do")) {
      assert.equal(form.has("data"), true);
      assert.equal(form.has("requestParamStr"), false);
      const original = records.get(params[0].TYPE)[0];
      assert.equal(params[0].FJ, original.FJ);
      assert.equal(params[0].BZ, original.BZ);
      writes.push(path);
      if (fault === "http") { res.statusCode = 503; res.end("一次失败"); return; }
      if (fault === "malformed") { res.end("{"); return; }
      if (fault !== "readback") records.set(params[0].TYPE, params.map((r, i) => ({ ...r, WID: r.WID ?? `new-${i}` })));
      result = ok({});
    } else if (path.endsWith("/deleteStuExtendInfo.do")) {
      assert.equal(form.has("requestParamStr"), true);
      writes.push(path);
      records.set(params.TYPE, records.get(params.TYPE).filter((r) => r.WID !== params.WID));
      result = ok({});
    } else assert.fail(`未知请求 ${path}`);
    res.setHeader("content-type", "application/json"); res.end(JSON.stringify(result));
  }).listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = async (input, init) => {
    const url = new URL(input);
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url.pathname}${url.search}`, init);
    return { ok: response.ok, status: response.status, headers: response.headers,
      url: url.pathname === "/appShow" ? "https://ehallapp.nju.edu.cn/xxfw/sys/yjsjbxxappnju/*default/index.do" : url.href,
      text: () => response.text(), arrayBuffer: () => response.arrayBuffer() };
  };
  return { request, client: new EHallProfileClient(request), records, writes, requests, fault: (value) => { fault = value; }, review: () => { review = true; } };
}

test("EHall 个人资料：五类表单、整组追加、附件保存、本人编号回读与删除", async (t) => {
  const f = await fixture(t);
  const directory = await mkdtemp(join(tmpdir(), "njucli-profile-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "record.json"), attachment = join(directory, "proof.txt");
  await saveFile(attachment, "合成附件");
  let sessions = 0;
  const service = createEHallServices({ withBrowser: async (capability, operation) => {
    assert.equal(capability, "ehall"); sessions++;
    return operation({ request: f.request }, { configDir: directory });
  } });
  const command = async (args) => {
    let output = "", exit;
    const program = new Command().exitOverride();
    registerEHallCommands(program, service, { environment: { NJUCLI_FORMAT: "json" }, output: { stdout: (s) => { output += s; }, stderr: () => {} }, setExitCode: (code) => { exit = code; } });
    await program.parseAsync(["ehall", ...args], { from: "user" });
    return { exit, ...JSON.parse(output) };
  };
  const all = await command(["profile"]);
  assert.equal(all.data.categories.length, 5);
  assert.equal(sessions, 1);
  assert.equal(f.requests.filter((path) => path.endsWith("/modules/baseInfo.do")).length, 1);
  assert.equal(f.requests.filter((path) => path.endsWith("/modules/wdxx.do")).length, 1);
  for (const spec of specs) {
    const fields = await command(["profile-fields", spec.kind]);
    assert.equal(fields.data.editable, true);
    const names = fields.data.fields.map((field) => field.name);
    assert.ok(names.includes("title"));
    await writeJsonFile(input, spec.input);
    const files = spec.kind === "awards" ? ["--attachment", attachment] : [];
    const before = f.writes.length;
    const preview = await command(["profile-add", spec.kind, "--input", input, ...files, "--dry-run"]);
    assert.equal(preview.ok, true);
    assert.equal(preview.data.submitted, false);
    assert.equal(f.writes.length, before);
    const added = await command(["profile-add", spec.kind, "--input", input, ...files]);
    assert.equal(added.ok, true);
    assert.equal(added.data.record.title, spec.input.title);
    assert.equal(f.records.get(spec.type).length, 2);
    const removed = await command(["profile-remove", spec.kind, added.data.record.id]);
    assert.equal(removed.data.removed, true);
    assert.equal(f.records.get(spec.type).length, 1);
  }
  const { publishedOn: _publishedOn, ...paper } = specs[0].input;
  const accepted = await f.client.addProfile("papers", { ...paper, published: false, acceptedOn: "2026-10-14" }, [], true);
  assert.equal(accepted.submitted, false);
  f.review();
  assert.equal((await f.client.profileFields("awards")).requiresReview, true);
});

test("EHall 个人资料：无权限、非法字段、错误身份与一次保存失败直接输出", async (t) => {
  const f = await fixture(t);
  await assert.rejects(f.client.addProfile("papers", { ...specs[0].input, publishedOn: "2026-02-30" }), { code: "INVALID_INPUT" });
  await assert.rejects(f.client.addProfile("awards", { ...specs[1].input, WID: "override" }), { code: "INVALID_INPUT" });
  await assert.rejects(f.client.addProfile("awards", { title: "缺少字段" }), { code: "INVALID_INPUT" });
  await assert.rejects(f.client.addProfile("patents", { ...specs[2].input, type: "不存在" }), { code: "INVALID_INPUT" });
  assert.equal(f.writes.length, 0);
  f.fault("readonly");
  await assert.rejects(f.client.addProfile("awards", specs[1].input), { code: "USER_ACTION_REQUIRED" });
  assert.equal(f.writes.length, 0);
  f.fault("wrong-user");
  await assert.rejects(f.client.profile("awards"), { code: "REMOTE_SCHEMA_CHANGED" });
  for (const fault of ["http", "malformed", "readback"]) {
    f.fault(fault);
    const before = f.writes.length;
    await assert.rejects(f.client.addProfile("awards", specs[1].input));
    assert.equal(f.writes.length - before, 1);
  }
  f.fault("");
  const row = f.records.get(10)[0]; row.YL1 = "1";
  const before = f.writes.length;
  await assert.rejects(f.client.removeProfile("papers", row.WID), { code: "USER_ACTION_REQUIRED" });
  assert.equal(f.writes.length, before);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScholarshipClient, scholarshipDraftSchema } from '../dist/skills/njucli-ehall/scripts/scholarship.js';
import { registerEHallCommands } from '../dist/skills/njucli-ehall/scripts/commands.js';
import { Command } from 'commander';

async function fixture(t, initial = true) {
  let record = initial ? { WID: 'draft-a', XSBH: 'student-a', SHZT: '0', PCDM: 'batch-a', PDXN: '2026', PDXQ: '1', JXJDM: 'award-a', JXJDJDM: 'level-a', SQDJ: 'level-a', JE: '1000', DZ_SFQYSQBSZ: '0', SQLY: '旧陈述', BZ5: '旧实践', FJ: 'existing-files', BZ18: '123', BZ19: '456', DZ_DZYX: 'a@example.org' } : undefined;
  const requests = []; let failSave = false; let wrongReadback = false;
  const server = createServer(async (req, res) => {
    let body = ''; for await (const c of req) body += c;
    const params = new URLSearchParams(body); const path = new URL(req.url, 'http://localhost').pathname;
    requests.push({ path, params });
    res.setHeader('Content-Type', 'application/json');
    if (path === '/appShow') return res.end('var pageMeta = {"params":{"USERID":"student-a"}};');
    if (path.endsWith('/uploadTempFile.do')) {
      assert.match(req.headers['content-type'], /multipart\/form-data/);
      assert.match(body, /name="bhFile"/); assert.match(body, /name="fileToken"/);
      return res.end(JSON.stringify({ success: true, id: 'uploaded-file' }));
    }
    if (path.includes('/getUploadedAttachment/')) return res.end(JSON.stringify({ success: true, items: [{ name: 'proof.pdf', size: 20 }] }));
    if (path.includes('/saveAttachment/')) {
      const metadata = JSON.parse(params.get('attachmentParam'));
      assert.equal(metadata.storeId, 'file'); assert.deepEqual(metadata.orderMap, { 'uploaded-file': 1 });
      return res.end(JSON.stringify({ success: true }));
    }
    const action = path.split('/').at(-1).replace('.do', '');
    if (action === 'cxxsysqjxjjl') return res.end(JSON.stringify({ code: '0', datas: { [action]: { totalSize: record ? 1 : 0, rows: record ? [{ ...record, FLDM: '3', SHZT_DISPLAY: record.SHZT === '0' ? '草稿' : '待辅导员审核', JXJMC: '测试奖', BBTOKEN: 'must-not-leak' }] : [] } } }));
    if (action === 'xsdcxjzxx2') return res.end(JSON.stringify({ code: '0', datas: { [action]: { totalSize: 1, rows: [{ JXJDM: 'award-a', JXJMC: '测试奖' }] } } }));
    if (action === 'wysqjbxxbd') return res.end(JSON.stringify({ code: '0', datas: { [action]: { rows: [{ SJH: '123', LXDH: '456', DZXX: 'a@example.org' }] } } }));
    if (action === 'studentCanApply') { assert.equal(JSON.parse(params.get('requestParamStr')).XSBH, 'student-a'); return res.end(JSON.stringify({ returnCode: '#E000000000000', data: { FLAG: 1 } })); }
    if (action === 'Applyjxj') {
      if (failSave) { res.statusCode = 503; return res.end('{}'); }
      const operation = JSON.parse(params.get('data'));
      const incoming = JSON.parse(operation.INDATA);
      assert.equal(operation.TYPE, '0'); assert.equal(operation.MODE, 'T_JXJ_PDXX');
      assert.equal(incoming.XSBH, 'student-a'); assert.equal(incoming.SHZT, undefined);
      record = { ...record, ...incoming, SHZT: '0' };
      if (wrongReadback) record.SQLY = '未保存';
      return res.end(JSON.stringify({ returnCode: '#E000000000000', data: { flag: '1' } }));
    }
    const query = params.get('actionName');
    const queryParams = JSON.parse(params.get('requestParams') || '{}');
    const queryResults = {
      T_JXJ_PDXX: record ? [record] : [],
      T_JXJ_ZL: [{ JXJDM: 'award-a', JXJMC: '测试奖', SFTT: '0', DZ_SFQYSQBSZ: '0', BBTOKEN: 'must-not-leak' }],
      cxjxjdj: [{ JXJDJDM: 'level-a', DJMC: '一等奖', JE: '1000' }],
      cxpcdydjxlxxx2: [{ JXJDM: 'award-a', PCDM: 'batch-a', PDXN: '2026', PDXQ: '1' }],
      zdscwid: [{ WID: 'new-draft' }],
    };
    if (query in queryResults) {
      if (query === 'T_JXJ_PDXX') assert.equal(queryParams.WID, record.WID);
      return res.end(JSON.stringify({ resultCode: '00000', data: queryResults[query] }));
    }
    res.statusCode = 404; res.end('{}');
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); server.close(); });
  const client = new ScholarshipClient((input, init) => fetch(`http://127.0.0.1:${server.address().port}${new URL(input).pathname}${new URL(input).search}`, init));
  return { client, requests, get record() { return record; }, set failSave(v) { failSave = v; }, set wrongReadback(v) { wrongReadback = v; } };
}

test('scholarship read, preview and draft modification preserve attachment and account boundaries', async t => {
  const f = await fixture(t);
  assert.equal((await f.client.scholarships()).items[0].awardId, 'award-a');
  assert.equal((await f.client.scholarship('award-a')).levels[0].levelId, 'level-a');
  assert.equal(JSON.stringify(await f.client.scholarshipApplications()).includes('must-not-leak'), false);
  assert.equal((await f.client.scholarshipApplication('draft-a')).values.reason, '旧陈述');
  const input = scholarshipDraftSchema.parse({ applicationId: 'draft-a', reason: '新的申请理由' });
  assert.equal((await f.client.saveScholarshipDraft(input, true)).saved, false);
  assert.equal(f.requests.some(r => r.path.endsWith('Applyjxj.do')), false);
  assert.equal((await f.client.saveScholarshipDraft(input)).saved, true);
  assert.equal(f.record.FJ, 'existing-files'); assert.equal(f.record.BZ5, '旧实践');
  const writes = f.requests.filter(r => r.path.endsWith('Applyjxj.do'));
  assert.equal(writes.length, 1); assert.equal(JSON.parse(writes[0].params.get('data')).ACTIONTYPE, 'MODIFY');
  f.record.SHZT = '20';
  await assert.rejects(f.client.saveScholarshipDraft(input), /只允许修改草稿/);
  await assert.rejects(f.client.scholarshipApplication('other-account-id'), /当前账号/);
  f.record.SHZT = '0'; f.record.XSBH = 'student-b';
  await assert.rejects(f.client.saveScholarshipDraft(input), /当前账号不一致/);
  assert.equal(f.requests.filter(r => r.path.endsWith('Applyjxj.do')).length, 1);
});

test('scholarship creation stays draft, rejects duplicate and reports ambiguous writes without retry', async t => {
  const f = await fixture(t, false);
  const dir = await mkdtemp(join(tmpdir(), 'scholarship-files-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const attachment = join(dir, 'proof.pdf'); await writeFile(attachment, '%PDF-1.4 local test');
  const input = scholarshipDraftSchema.parse({ awardId: 'award-a', levelId: 'level-a', category: '3', reason: '真实成果陈述', attachments: [attachment] });
  assert.equal((await f.client.saveScholarshipDraft(input, true)).saved, false);
  assert.equal(f.requests.some(r => r.params.get('actionName') === 'zdscwid' || r.path.includes('/file/')), false);
  const result = await f.client.saveScholarshipDraft(input);
  assert.equal(result.reviewUrl, 'https://ehall.nju.edu.cn/appShow?appId=5907343959144076'); assert.match(result.nextStep, /确认无误后自行提交/);
  assert.equal(result.application.applicationId, 'new-draft'); assert.equal(result.application.statusCode, '0');
  assert.equal(f.record.DZ_DZYX, 'a@example.org'); assert.ok(f.record.FJ);
  assert.equal(f.requests.filter(r => r.path.endsWith('/uploadTempFile.do')).length, 1);
  await assert.rejects(f.client.saveScholarshipDraft({ applicationId: 'new-draft', attachments: [attachment] }), /已有附件/);
  await assert.rejects(f.client.saveScholarshipDraft(input), /本学年已有/);
  f.failSave = true;
  await assert.rejects(f.client.saveScholarshipDraft({ applicationId: 'new-draft', reason: '修改' }), /HTTP 503/);
  assert.equal(f.requests.filter(r => r.path.endsWith('Applyjxj.do')).length, 2);
  f.failSave = false; f.wrongReadback = true;
  await assert.rejects(f.client.saveScholarshipDraft({ applicationId: 'new-draft', reason: '再次修改' }), /回读不一致/);
  assert.equal(f.requests.filter(r => r.path.endsWith('Applyjxj.do')).length, 3);
});

test('CLI rejects workflow parameters before service calls and exposes no submission command', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'scholarship-')); t.after(() => rm(dir, { recursive: true, force: true }));
  for (const extra of [{ TYPE: '1' }, { INDATA: {} }, { SHZT: '20' }, { XSBH: 'another-user' }]) {
    assert.equal(scholarshipDraftSchema.safeParse({ applicationId: 'draft-a', reason: '陈述', ...extra }).success, false);
  }
  const file = join(dir, 'input.json'); await writeFile(file, JSON.stringify({ applicationId: 'draft-a', reason: '陈述', TYPE: '1' }));
  let calls = 0; const output = [];
  const program = new Command(); program.exitOverride();
  let exitCode; const runtime = { environment: {}, output: { stdout: value => output.push(value), stderr: value => output.push(value) }, setExitCode: value => { exitCode = value; } };
  registerEHallCommands(program, { saveScholarshipDraft: () => { calls++; return { saved: true, reviewUrl: 'https://ehall.nju.edu.cn/appShow?appId=5907343959144076', nextStep: '确认无误后自行提交' }; } }, runtime);
  const cmd = program.commands.find(c => c.name() === 'ehall').commands.find(c => c.name() === 'scholarship');
  assert.deepEqual(cmd.commands.map(c => c.name()), ['list', 'applications', 'show', 'application', 'form', 'save']);
  await program.parseAsync(['ehall', 'scholarship', 'save', '--input', file, '--format', 'json'], { from: 'user' });
  assert.equal(calls, 0); assert.equal(exitCode, 2); assert.equal(JSON.parse(output[0]).error.code, "INVALID_INPUT");
  await writeFile(file, JSON.stringify({ applicationId: 'draft-a', reason: '陈述' })); output.length = 0;
  await program.parseAsync(['ehall', 'scholarship', 'save', '--input', file, '--format', 'text'], { from: 'user' });
  assert.equal(calls, 1); assert.equal(exitCode, 0);
  assert.ok(output.join('').includes('核对链接：https://ehall.nju.edu.cn/appShow'));
  assert.match(output.join(''), /确认无误后自行提交/);

});

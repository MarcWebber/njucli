import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Command } from 'commander';
import { createEHallServices } from '../dist/skills/njucli-ehall/scripts/services.js';
import { registerEHallCommands } from '../dist/skills/njucli-ehall/scripts/commands.js';

test('个人资料：字段与归属、附件绑定、整组保存与并发变更、失败单次提交', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'njucli-profile-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'award.json'), file = join(directory, 'certificate.txt');
  await writeFile(input, JSON.stringify({ title: '新增获奖' }));
  await writeFile(file, 'proof');
  const original = { WID: 'old', XSBH: 'student', JLMC: '原有获奖', BZ: '保留说明' };
  let rows = [original], mode = 'success', uploads = 0, saves = 0, token;
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString(), form = new URLSearchParams(body);
    const json = value => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); };
    const data = value => json({ returnCode: '#E000000000000', data: value });
    if (path === '/appShow') return res.end('var pageMeta = {"params":{"USERID":"student"}};');
    if (path.includes('getAppConfig.do')) return json({ HEADER: { dropMenu: [{ id: '1', active: true }] } });
    if (path.includes('changeAppRole/') || path.includes('setXgCommonAppRole.do')) return json({ success: true });
    if (path.includes('getStuBatchInfo.do')) return data({ XSBH: 'student', PCDM: 'batch', SFXS: '0', SHLC: 'flow' });
    if (path.includes('getLcslInfo.do')) return data([]);
    if (path.includes('getSetFzInfo.do')) return data([{ id: 'group' }]);
    if (path.includes('getSetNrInfo.do')) return data([{ NRDZ: 'JBXXXWJL', NRDM: 'awards', NRMC: '获奖', CZLX: '1', XSKWH: mode === 'readonly' ? '0' : '1' }]);
    if (path.endsWith('/baseInfo.do')) return json({ models: [{ name: 'xsjlxxbd', controls: [
      { name: 'JLMC', caption: '名称', required: true, dataType: 'String', dataSize: 100 }, { name: 'FJ' },
    ] }] });
    if (path.includes('getStuExtendInfo.do')) {
      assert.deepEqual(JSON.parse(form.get('requestParamStr')), { TYPE: 7, XSBH: 'student' });
      return data(mode === 'foreign' ? [{ ...original, XSBH: 'other' }] : rows);
    }
    if (path.includes('uploadTempFile.do')) {
      uploads++; assert.match(body, /certificate.txt/); assert.match(body, /proof/);
      if (mode === 'concurrent') rows.push({ ...original, WID: 'web', JLMC: '网页新增' });
      return json({ success: true, id: 'file' });
    }
    if (path.includes('/saveAttachment/')) {
      token = form.get('fileToken');
      assert.deepEqual(JSON.parse(form.get('attachmentParam')), { storeId: 'file', orderMap: { file: 1 } });
      return json({ success: true, successCount: 1 });
    }
    if (path.includes('saveStuExtendInfo.do')) {
      saves++;
      if (mode === 'http-error') { res.writeHead(503); return res.end(); }
      const submitted = JSON.parse(form.get('data'));
      assert.equal(submitted.at(-1).XSBH, 'student');
      rows = submitted.map((row, i) => ({ ...row, WID: row.WID ?? `new-${i}` }));
      return data(null);
    }
    if (path.includes('/getUploadedAttachment/')) {
      assert.ok(rows.some(row => row.FJ === token));
      return json({ success: true, items: [{ name: 'certificate.txt', size: 5 }] });
    }
    if (path.includes('deleteStuExtendInfo.do')) {
      const target = JSON.parse(form.get('requestParamStr'));
      rows = rows.filter(row => row.WID !== target.WID); return data(null);
    }
    res.writeHead(404); res.end(path);
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const service = createEHallServices({ withBrowser: async (capability, operation) => {
    assert.equal(capability, 'ehall');
    return operation({ request: async (input, init) => {
      const url = new URL(input), response = await fetch(origin + url.pathname + url.search, init);
      return { ok: response.ok, status: response.status, headers: response.headers,
        url: url.pathname === '/appShow' ? 'https://ehallapp.nju.edu.cn/xxfw/sys/yjsjbxxappnju/*default/index.do' : url.href,
        text: () => response.text() };
    } });
  } });
  const run = async (...args) => {
    let stdout = '', code;
    const program = new Command().exitOverride();
    registerEHallCommands(program, service, { environment: { NJUCLI_FORMAT: 'json' },
      output: { stdout: value => { stdout += value; }, stderr: () => {} }, setExitCode: value => { code = value; } });
    await program.parseAsync(['ehall', ...args], { from: 'user' });
    return { code, ...JSON.parse(stdout) };
  };
  assert.equal((await run('profile', 'awards')).data.categories[0].records[0].id, 'old');
  assert.equal((await run('profile-fields', 'awards')).data.fields[0].required, true);
  const add = (...args) => run('profile-add', 'awards', '--input', input, '--attachment', file, ...args);
  assert.equal((await add('--dry-run')).data.submitted, false);
  assert.equal(uploads, 0); assert.equal(saves, 0);
  const saved = await add(); assert.equal(saved.code, 0);
  assert.equal(saved.data.record.attachmentToken, "[REDACTED]");
  assert.equal(rows.at(-1).FJ, token);
  assert.equal(rows[0].BZ, original.BZ);
  assert.equal((await run('profile-remove', 'awards', saved.data.record.id)).data.removed, true);
  assert.equal(rows.length, 1);
  const before = saves;
  mode = 'readonly'; assert.equal((await add()).code, 4);
  mode = 'foreign'; assert.notEqual((await add()).code, 0);
  assert.equal(saves, before);
  mode = 'concurrent'; const conflict = await add();
  assert.equal(conflict.code, 4); assert.equal(saves, before);
  assert.ok(rows.some(row => row.WID === 'web'));
  mode = 'http-error'; assert.notEqual((await add()).code, 0);
  assert.equal(saves, before + 1);
});

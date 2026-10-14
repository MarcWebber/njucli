import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';
import { writeJsonFile } from '../dist/src/core/fs.js';
import { AuthCoordinator } from '../dist/src/auth/coordinator.js';
import { SessionStore } from '../dist/src/auth/session-store.js';
import { withBrowserSession } from '../dist/src/auth/browser-session.js';
import { selfServiceSessionDriver } from '../dist/src/auth/drivers/self-service.js';
import { createSelfServiceServices } from '../dist/skills/njucli-self-service/scripts/services.js';
import { registerSelfServiceCommands } from '../dist/skills/njucli-self-service/scripts/commands.js';

async function command(service, ...args) {
  const program = new Command().exitOverride();
  let stdout = '', code;
  registerSelfServiceCommands(program, service, {
    environment: { NJUCLI_FORMAT: 'json' },
    output: { stdout: s => { stdout += s; }, stderr: () => {} },
    setExitCode: value => { code = value; },
  });
  await program.parseAsync(['self-service', ...args], { from: 'user' });
  return { code, ...JSON.parse(stdout) };
}

for (const student of [
  { id: 'undergraduate', schoolCode: 'school-a', itemId: 'english-transcript', itemName: '英文成绩单', orderId: 'first-order', email: 'undergraduate@smail.nju.edu.cn' },
  { id: 'graduate', schoolCode: 'school-b', itemId: 'enrollment-certificate', itemName: '在校证明', orderId: 'second-order', email: 'graduate@smail.nju.edu.cn' },
]) test(`自助服务 ${student.id}：会话恢复、动态项目与本人申请、默认邮箱、单次写入`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'njucli-self-service-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const account = { name: 'student', configDir: directory, browserDataDir: join(directory, 'browser') };
  const me = { id: student.id, name: '测试同学', schoolCode: student.schoolCode, idCard: 'private-id', pass: 'private-secret' };
  const item = { id: student.itemId, parentId: '-1', name: student.itemName, pickupType: 2, hasChildren: false,
    schoolCode: me.schoolCode, state: 1, formState: 0, afterFormState: 0, takeCodeLength: 10, expireDay: 30,
    takeNote: null, chargesNotes: '按平台额度', relatedDescription: null, reportUrlPath: 'http://private-host/report' };
  const order = { orderId: student.orderId, itemId: item.id, userId: me.id, schoolCode: me.schoolCode,
    title: item.name, copies: 1, fee: 0, takeType: 2, takeCode: '0000000000', fileType: 'pdf', filePages: 2,
    createTime: '2026-01-01 12:00:00', completeTime: '2026-01-01 12:00:01', expireTime: null, authFileName: 'private-file' };
  const config = { DOWN_LOAD_TYPE: '01', MODIFY_MAIL: '1', MAIL_PATTERN: '/^[^@]+@smail\\.nju\\.edu\\.cn$/' };
  let loggedIn = false, mode = 'success', platformEmail = null;
  const calls = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace('/wec-self-print-app-console', '');
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const form = new URLSearchParams(Buffer.concat(chunks).toString());
    calls.push({ path, query: url.searchParams, form, method: req.method });
    assert.equal(req.headers.appid, '80019');
    assert.equal(req.headers.loginmode, 'MOBILE');
    const raw = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    const envelope = data => raw({ code: '0000', msg: '成功', data });
    if (path === '/mobile/isLogin') return raw({ success: loggedIn, data: loggedIn ? me : null });
    if (path === '/app/login/IDS') { loggedIn = true; assert.equal(url.searchParams.get('returnUrl'), '/mobile/itemList'); return res.end('ready'); }
    assert.ok(loggedIn);
    if (path === `/sys/sp-user/${me.id}`) return raw({ ...me, email: platformEmail });
    if (path === '/mobile/getDict/PRINT_RELATED_CONFIGURATION/ELECTRONIC_FILE_CONFIG') return envelope(JSON.stringify(config));
    if (path === '/item/sp-print-item/list/terminal') { assert.equal(form.get('rows'), '5000'); return envelope({ records: [item], total: 1 }); }
    if (path === `/item/sp-print-item/checkItemRight/${item.id}`) return envelope(true);
    if (path === `/item/sp-print-item/terminal/${item.id}`) return raw(item);
    if (path.endsWith('ChargeFee') || path.endsWith('/chargeFee')) {
      assert.equal(form.get('userId'), me.id); assert.equal(form.get('itemId'), item.id);
      return envelope({ totalFee: mode === 'paid' ? 5 : 0, price: 5, canFreeNumber: 2, curFreeNumber: 1,
        curChargeNumber: mode === 'paid' ? 1 : 0, printLimitNumber: 1, isOutOfLimitNumber: mode === 'limit', errorMsg: null });
    }
    if (path === '/order/create') {
      assert.equal(req.method, 'POST');
      assert.deepEqual(Object.fromEntries(form), { itemId: item.id, copies: '1', schoolCode: me.schoolCode,
        orderType: '5', apiType: '2', reportFormValue: '', takeType: String(order.takeType), takeCodeLength: '10' });
      if (mode === 'create-http-error') { res.writeHead(503); return res.end('unavailable'); }
      return envelope({ orderId: order.orderId });
    }
    if (path === '/order/get') {
      assert.equal(url.searchParams.get('orderId'), order.orderId);
      assert.equal(url.searchParams.get('schoolCode'), me.schoolCode);
      return envelope({ order: { ...order, userId: mode === 'foreign' ? 'other-person' : me.id,
        itemId: mode === 'wrong-item' ? 'other-item' : item.id } });
    }
    if (path === '/order/list') { assert.equal(url.searchParams.get('userId'), me.id); return envelope({ orders: [order] }); }
    if (path === `/order/downloadCheck/${order.orderId}`) return envelope('http://zzfwx.nju.edu.cn/wec-self-print-app-console');
    if (path === '/message/sendElectronicItemEmail') {
      assert.equal(req.method, 'GET'); assert.equal(url.searchParams.get('orderId'), order.orderId);
      if (mode === 'send-http-error') { res.writeHead(503); return res.end('unavailable'); }
      return envelope(null);
    }
    if (path === '/warn/sp-terminal-status/getTerminalState') return raw({ success: true, data: [{ terminalCode: 'terminal-live', address: '校园大厅',
      schoolDistrict: null, longitude: 118, latitude: 32, networkState: 1, state: 1, ip: 'private-host', macAddress: 'private-mac' }] });
    res.writeHead(404); res.end('unexpected');
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (url, init) => { const u = new URL(url); return fetch(origin + u.pathname + u.search, init); };
  await writeJsonFile(join(directory, 'mail.json'), { current: student.email, mailboxes: [{ address: student.email, password: 'local-secret' }] });
  const auth = new AuthCoordinator({ sessions: new SessionStore(), drivers: {
    sso: { probe: async () => true, login: async () => true }, 'self-service': selfServiceSessionDriver,
  } });
  await withBrowserSession(account, true, async session => {
    session.request = request;
    const service = createSelfServiceServices({ withBrowser: async (capability, operation, probe) => {
      assert.equal(capability, 'self-service');
      await auth.ensureSession(account, capability, () => probe(session));
      return operation(session, account);
    } });
    const run = (...args) => command(service, ...args);
    const profile = await run('profile');
    assert.equal(profile.data.defaultEmail, student.email);
    assert.equal(profile.data.downloadEnabled, false);
    assert.equal(calls.filter(c => c.path === '/app/login/IDS').length, 1);
    assert.ok(!JSON.stringify(profile).includes('private-'));
    assert.equal((await run('items')).data.items[0].id, item.id);
    const detail = (await run('show', item.id)).data;
    assert.ok(!JSON.stringify(detail).includes('private-'));
    assert.equal(new URL(detail.url).hash, `#/mobile/orderDetail?id=${student.itemId}`);
    assert.ok(!JSON.stringify((await run('terminals')).data).includes('private-'));
    const result = await run('create', item.id);
    assert.equal(result.code, 0); assert.equal(result.data.emailSent, true);
    assert.equal(result.data.order.orderId, order.orderId);
    assert.equal(result.data.order.userId, student.id);
    assert.equal(result.data.order.schoolCode, student.schoolCode);
    assert.equal(calls.filter(c => c.path === '/order/create').length, 1);
    assert.equal(calls.at(-1).query.get('email'), student.email);
    assert.equal((await run('orders')).data[0].orderId, order.orderId);
    assert.equal((await run('order', order.orderId)).data.orderId, order.orderId);
    platformEmail = 'platform@smail.nju.edu.cn';
    await run('send', order.orderId); assert.equal(calls.at(-1).query.get('email'), platformEmail);
    const writes = () => calls.filter(c => ['/order/create', '/message/sendElectronicItemEmail'].includes(c.path)).length;
    let before = writes();
    config.MODIFY_MAIL = '0';
    assert.equal((await run('create', item.id, '--email', 'another@smail.nju.edu.cn')).code, 4);
    config.MODIFY_MAIL = '1';
    assert.equal((await run('create', item.id, '--email', 'person@example.com')).code, 2);
    for (const next of ['paid', 'limit']) { mode = next; assert.equal((await run('create', item.id)).code, 4); }
    item.formState = 1; mode = 'success'; assert.equal((await run('create', item.id)).code, 4); item.formState = 0;
    assert.equal((await run('create', item.id, '--copies', '2')).code, 2);
    assert.equal((await run('quote', item.id, '--copies', '0')).code, 2);
    assert.equal(writes(), before);
    mode = 'foreign'; assert.equal((await run('send', order.orderId)).code, 3); assert.equal(writes(), before);
    mode = 'wrong-item';
    const mismatch = await run('create', item.id);
    assert.equal(mismatch.code, 4); assert.equal(mismatch.error.details.orderId, order.orderId); assert.equal(writes(), before + 1);
    before = writes(); mode = 'send-http-error';
    const partial = await run('create', item.id);
    assert.equal(partial.code, 4); assert.equal(partial.error.details.orderId, order.orderId); assert.equal(writes(), before + 2);
    before = writes(); mode = 'create-http-error'; assert.notEqual((await run('create', item.id)).code, 0); assert.equal(writes(), before + 1);
    mode = 'success'; item.pickupType = 1; order.takeType = 1;
    const paper = await run('create', item.id, '--delivery', 'paper');
    assert.equal(paper.data.emailSent, false); assert.equal(paper.data.order.takeCode, order.takeCode);
    assert.equal(calls.at(-1).path, '/order/get');
    assert.equal(calls.filter(c => c.path === '/app/login/IDS').length, 1);
  });
});

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
import { AUTH_SITES } from '../dist/src/auth/capabilities.js';
import { createSelfServiceServices } from '../dist/skills/njucli-self-service/scripts/client.js';
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

test('自助服务：动态目录、本人申请与默认邮箱、失败不重提、撤销回读', async t => {
  const student = { id: 'student', schoolCode: 'school', itemId: 'certificate', itemName: '在校证明', orderId: 'order', email: 'student@smail.nju.edu.cn' };
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
  let loggedIn = false, mode = 'success', pending = true;
  const calls = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname.replace('/wec-self-print-app-console', '');
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const form = new URLSearchParams(Buffer.concat(chunks).toString());
    calls.push({ path, query: url.searchParams });
    const raw = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)); };
    const envelope = data => raw({ code: '0000', msg: '成功', data });
    if (path === '/mobile/isLogin') return raw({ success: loggedIn, data: loggedIn ? me : null });
    if (path === '/app/login/IDS') { loggedIn = true; assert.equal(url.searchParams.get('returnUrl'), '/mobile/itemList'); return res.end('ready'); }
    assert.ok(loggedIn);
    if (path === `/sys/sp-user/${me.id}`) return raw({ ...me, email: null });
    if (path === '/mobile/getDict/PRINT_RELATED_CONFIGURATION/ELECTRONIC_FILE_CONFIG') return envelope(JSON.stringify(config));
    if (path === '/item/sp-print-item/list/terminal') return envelope({ records: form.has('parentId') ? [] : [item], total: form.has('parentId') ? 0 : 1 });
    if (path === `/item/sp-print-item/checkItemRight/${item.id}`) return envelope(true);
    if (path === `/item/sp-print-item/terminal/${item.id}`) return raw(item);
    if (path.endsWith('ChargeFee') || path.endsWith('/chargeFee')) {
      assert.equal(form.get('userId'), me.id); assert.equal(form.get('itemId'), item.id);
      return envelope({ totalFee: mode === 'paid' ? 5 : 0, price: 5, canFreeNumber: 2, curFreeNumber: 1,
        curChargeNumber: mode === 'paid' ? 1 : 0, printLimitNumber: 1, isOutOfLimitNumber: false, errorMsg: null });
    }
    if (path === '/order/create') {
      assert.equal(req.method, 'POST');
      assert.equal(form.get('itemId'), item.id); assert.equal(form.get('schoolCode'), me.schoolCode);
      assert.equal(form.get('takeType'), String(order.takeType));
      return envelope({ orderId: order.orderId });
    }
    if (path === '/order/get') {
      assert.equal(url.searchParams.get('orderId'), order.orderId);
      assert.equal(url.searchParams.get('schoolCode'), me.schoolCode);
      return envelope({ order: { ...order, userId: mode === 'foreign' ? 'other-person' : me.id } });
    }
    if (path === '/order/list') { assert.equal(url.searchParams.get('userId'), me.id); return envelope({ orders: pending ? [order] : [] }); }
    if (path === '/order/cancelOrders') { assert.equal(form.get('orderIds'), order.orderId); pending = false; return envelope(null); }
    if (path === '/order/cloud-print/config') return envelope({ price: '0', initFreeCopies: 5, singlePrintPages: 200, filePageLimit: '10' });
    if (path === '/order/cloud-print-list') return envelope({ records: [{ orderId: 'cloud-order', title: '作业', fileType: 'pdf' }], total: 1 });
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
    sso: { probe: async () => true, login: async () => true }, 'self-service': AUTH_SITES['self-service'].driver,
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
    assert.equal((await run('items', '--parent', item.id)).data.total, 0);
    assert.equal((await run('cloud')).data.files[0].title, '作业');
    const writes = () => calls.filter(c => ['/order/create', '/message/sendElectronicItemEmail'].includes(c.path)).length;
    const before = writes();
    mode = 'paid'; assert.equal((await run('create', item.id)).code, 4);
    mode = 'foreign'; assert.equal((await run('send', order.orderId)).code, 3);
    assert.equal(writes(), before);
    mode = 'send-http-error';
    const partial = await run('create', item.id);
    assert.equal(partial.code, 4); assert.equal(partial.error.details.orderId, order.orderId);
    assert.equal(writes(), before + 2);
    mode = 'success'; item.pickupType = 1; order.takeType = 1;
    const paper = await run('create', item.id, '--delivery', 'paper');
    assert.equal(paper.data.emailSent, false); assert.equal(paper.data.order.takeCode, order.takeCode);
    assert.equal(calls.at(-1).path, '/order/get');
    const cancelled = await run('cancel', order.orderId);
    assert.equal(cancelled.data.cancelled, true);
    assert.equal(calls.at(-1).path, '/order/list');
    assert.equal((await run('cancel', order.orderId)).code, 2);
    assert.equal(calls.filter(c => c.path === '/order/cancelOrders').length, 1);
    assert.equal(calls.filter(c => c.path === '/app/login/IDS').length, 1);
  });
});

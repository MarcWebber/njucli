import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { lockAccount } from "../dist/src/auth/account-lock.js";

test("账号锁：多个等待进程同时回收崩溃锁，临界区保持互斥", { timeout: 20_000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-lock-race-"));
  const module = new URL("../dist/src/auth/account-lock.js", import.meta.url).href;
  const workers = [];
  t.after(async () => {
    for (const worker of workers) {
      if (worker.process.exitCode === null && worker.process.signalCode === null) worker.process.kill("SIGKILL");
    }
    await Promise.all(workers.map((worker) => worker.completed));
    await rm(directory, { recursive: true, force: true });
  });
  const start = (body) => {
    const process = spawn(globalThis.process.execPath, ["--input-type=module", "-e", `
      import { lockAccount } from ${JSON.stringify(module)};
      import { open, readFile, unlink, writeFile } from 'node:fs/promises';
      import { join } from 'node:path';
      import { setTimeout as delay } from 'node:timers/promises';
      const directory = ${JSON.stringify(directory)};
      ${body}
    `]);
    let output = "", errors = "";
    const ready = new Promise((resolve, reject) => {
      process.stdout.on("data", (chunk) => {
        output += chunk;
        if (output.includes("ready\n")) resolve();
      });
      process.once("error", reject);
      process.once("close", () => { if (!output.includes("ready\n")) reject(new Error(errors)); });
    });
    process.stderr.on("data", (chunk) => { errors += chunk; });
    const completed = new Promise((resolve) => process.once("close", (code, signal) => resolve({ code, signal, errors })));
    const worker = { process, ready, completed };
    workers.push(worker);
    return worker;
  };

  await writeFile(join(directory, "count"), "0");
  const holder = start(`
    await lockAccount(directory);
    console.log('ready');
    setInterval(() => {}, 1000);
    await new Promise(() => {});
  `);
  await holder.ready;
  assert.equal((await stat(join(directory, "session.lock"))).isDirectory(), true);
  assert.equal((await readdir(join(directory, "session.lock"))).length, 1);

  const contenders = Array.from({ length: 12 }, () => start(`
    console.log('ready');
    for (let round = 0; round < 3; round++) {
      const unlock = await lockAccount(directory);
      try {
        const active = join(directory, 'active');
        const handle = await open(active, 'wx');
        try {
          const path = join(directory, 'count');
          const count = Number(await readFile(path, 'utf8'));
          await delay(5);
          await writeFile(path, String(count + 1));
        } finally {
          await handle.close();
          await unlink(active);
        }
      } finally { await unlock(); }
    }
  `));
  await Promise.all(contenders.map((worker) => worker.ready));
  assert.equal(await readFile(join(directory, "count"), "utf8"), "0");
  holder.process.kill("SIGKILL");
  assert.equal((await holder.completed).signal, "SIGKILL");

  for (const result of await Promise.all(contenders.map((worker) => worker.completed))) {
    assert.equal(result.signal, null, result.errors);
    assert.equal(result.code, 0, result.errors);
  }
  assert.equal(await readFile(join(directory, "count"), "utf8"), "36");
  assert.deepEqual((await readdir(directory)).sort(), ["count"]);
  const legacy = join(directory, "session.lock");
  await writeFile(legacy, `${process.pid}:legacy-owner`);
  await assert.rejects(lockAccount(directory), /旧版会话锁文件/);
  assert.equal(await readFile(legacy, "utf8"), `${process.pid}:legacy-owner`);
  assert.deepEqual((await readdir(directory)).sort(), ["count", "session.lock"]);
});

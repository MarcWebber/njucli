import { createInterface } from 'node:readline';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withBrowserSession, createAuthServices, createRuntime, saveFile } from './runtime.mjs';
const input = createInterface({ input: process.stdin, output: process.stdout });
const screenshot = join(tmpdir(), 'njucli-slider.png');
const runtime = createRuntime();
await withBrowserSession(await runtime.accountStore.current(), false, async (session) => {
  const page = await session.page();
  const login = createAuthServices(runtime).login('sso').then(
    result => console.log(JSON.stringify(result)),
    error => { console.error(error.message); process.exitCode = 1; },
  ).finally(() => { input.close(); process.stdin.pause(); });
  console.log('输入 shot 截图；输入 drag x y dx 从 (x,y) 向右拖动 dx 像素。');
  for await (const command of input) {
    if (command.startsWith('drag ')) {
      const [x, y, dx] = command.slice(5).split(' ').map(Number);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + dx, y, { steps: 25 });
      await page.mouse.up();
    }
    await saveFile(screenshot, await page.screenshot());
    console.log(`截图：${screenshot}`);
  }
  await login;
});

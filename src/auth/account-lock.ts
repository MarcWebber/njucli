import { mkdir, readdir, rename, rm, rmdir, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Keep an account's cookie snapshot current across CLI and MCP processes. */
export async function lockAccount(configDir: string): Promise<() => Promise<void>> {
  await mkdir(configDir, { recursive: true });
  const path = join(configDir, "session.lock");
  const owner = `${process.pid}-${randomUUID()}`;
  const candidate = `${path}.${owner}.tmp`;
  await mkdir(candidate, { mode: 0o700 });
  try {
    await writeFile(join(candidate, owner), "", { mode: 0o600 });
    while (true) {
      try {
        // A nonempty directory cannot replace another owner, and is published without an empty-lock window.
        await rename(candidate, path);
        return () => removeOwner(path, owner);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOTDIR") throw new Error("发现旧版会话锁文件，请等待旧调用结束后重试；崩溃遗留文件须在确认旧进程退出后移除");
        if (code !== "EEXIST" && code !== "ENOTEMPTY") throw error;
      }
      let current: string | undefined;
      try { [current] = await readdir(path); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (!current) continue;
      try { process.kill(Number(current.split("-")[0]), 0); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        await removeOwner(path, current);
        continue;
      }
      await delay(100);
    }
  } finally {
    await rm(candidate, { recursive: true, force: true });
  }
}

async function removeOwner(path: string, owner: string): Promise<void> {
  await unlink(join(path, owner)).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
  // A late reclaimer may find a newly published owner; rmdir leaves its nonempty directory intact.
  await rmdir(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT" && error.code !== "ENOTEMPTY") throw error;
  });
}

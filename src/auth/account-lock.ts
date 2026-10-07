import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

/** Keep an account's cookie snapshot current across CLI and MCP processes. */
export async function lockAccount(configDir: string): Promise<() => Promise<void>> {
  await mkdir(configDir, { recursive: true });
  const path = join(configDir, "session.lock");
  const owner = `${process.pid}:${randomUUID()}`;
  const candidate = `${path}.${owner.replace(":", ".")}.tmp`;
  await writeFile(candidate, owner, { mode: 0o600 });
  try {
    while (true) {
      try {
        // Publish an already-written owner atomically; a crash cannot leave an empty lock.
        await link(candidate, path);
        return () => unlink(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      let current: string;
      try { current = await readFile(path, "utf8"); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      try { process.kill(Number(current.split(":")[0]), 0); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
        // Another waiter may already have recovered the dead process's lock.
        if (await readFile(path, "utf8").catch((error: NodeJS.ErrnoException) => {
          if (error.code === "ENOENT") return "";
          throw error;
        }) === current) {
          await unlink(path).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          });
        }
        continue;
      }
      await delay(100);
    }
  } finally {
    await unlink(candidate);
  }
}

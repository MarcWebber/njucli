import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";

export async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, path);
}

export async function saveFile(path: string, content: string | Uint8Array | AsyncIterable<Uint8Array>): Promise<{ path: string; bytes: number }> {
  const target = resolve(path);
  let bytes = 0;
  const chunks = typeof content === "string" || content instanceof Uint8Array ? [content] : content;
  async function* counted() {
    for await (const chunk of chunks) {
      bytes += Buffer.byteLength(chunk);
      yield chunk;
    }
  }
  await writeFile(target, counted(), { mode: 0o600 });
  return { path: target, bytes };
}

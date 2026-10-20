import { cp, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const entry of await readdir(join(root, "skills"), { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith("njucli-")) continue;
  const directory = join(root, "skills", entry.name);
  if ((await readdir(directory)).includes("templates")) {
    await cp(join(directory, "templates"), join(root, "dist", "skills", entry.name, "templates"), { recursive: true });
  }
}
await writeFile(join(root, "dist", "cli.js"), '#!/usr/bin/env node\nimport "./src/cli.js";\n', { mode: 0o755 });

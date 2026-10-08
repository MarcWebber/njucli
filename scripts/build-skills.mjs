import { build } from "esbuild";
import { copyFile, cp, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const entries = (await readdir(join(root, "skills"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && entry.name.startsWith("njucli-"));

for (const entry of entries) {
  const directory = join(root, "skills", entry.name);
  const scripts = join(directory, "scripts");
  if ((await readdir(directory)).includes("templates")) {
    await cp(join(directory, "templates"), join(root, "dist", "skills", entry.name, "templates"), { recursive: true });
  }
  const result = await build({
    entryPoints: [join(scripts, "run.ts"), ...(entry.name === "njucli-auth" ? [join(scripts, "runtime.ts")] : [])],
    outdir: scripts,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    packages: "external",
    platform: "node",
    format: "esm",
    target: "node20",
    metafile: true,
    logLevel: "warning",
  });
  const packages = new Set(Object.values(result.metafile.outputs).flatMap((output) => output.imports)
    .filter((item) => item.external && !item.path.startsWith("node:"))
    .map((item) => item.path.startsWith("@") ? item.path.split("/").slice(0, 2).join("/") : item.path.split("/")[0]));
  const dependencies = Object.fromEntries([...packages].sort().map((name) => {
    const version = manifest.dependencies[name];
    if (!version) throw new Error(`Skill ${entry.name} 的运行依赖未声明：${name}`);
    return [name, version];
  }));
  await writeFile(join(directory, "package.json"), JSON.stringify({
    name: entry.name,
    version: manifest.version,
    private: true,
    type: "module",
    license: manifest.license,
    engines: manifest.engines,
    dependencies,
  }, null, 2) + "\n");
  await copyFile(join(root, "LICENSE"), join(directory, "LICENSE"));
}

await writeFile(join(root, "dist", "cli.js"), '#!/usr/bin/env node\nimport "./src/cli.js";\n');
console.log(`已构建 ${entries.length} 个独立 Skill 入口及依赖清单。`);

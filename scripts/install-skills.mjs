import { lstat, mkdir, readdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

async function installSuite(packageRoot, skillsRoot) {
  const root = await realpath(packageRoot);
  const source = join(root, "skills");
  const target = join(skillsRoot, "njucli");
  const existing = await lstat(target).catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  if (existing && (!existing.isSymbolicLink() || resolve(skillsRoot, await readlink(target)) !== source)) {
    throw new Error(`Skill 路径已被其他内容占用，请先迁移：${target}`);
  }
  await mkdir(skillsRoot, { recursive: true });
  if (!existing) await symlink(source, target, "dir");

  for (const entry of await readdir(skillsRoot, { withFileTypes: true })) {
    if (!entry.name.startsWith("njucli-") || !entry.isSymbolicLink()) continue;
    const path = join(skillsRoot, entry.name);
    const current = resolve(skillsRoot, await readlink(path));
    if (current === join(source, entry.name) || current === join(dirname(root), entry.name)) {
      await unlink(path);
    }
  }
  return target;
}

const isMain = process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && (process.argv[2] || (process.env.npm_lifecycle_event === "postinstall" && process.env.npm_config_global === "true"))) {
  const packageRoot = process.argv[2] || fileURLToPath(new URL("../", import.meta.url));
  const skillsRoot = resolve(process.env.NJUCLI_SKILLS_DIR || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "skills"));
  const target = await installSuite(packageRoot, skillsRoot);
  console.log(`已安装 NjuCLI Skills 套件：${target}`);
}

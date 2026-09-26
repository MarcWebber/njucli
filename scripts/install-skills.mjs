import { lstat, mkdir, readdir, readlink, realpath, symlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function installSkills(packageRoot, skillsRoot) {
  const source = join(await realpath(packageRoot), "skills");
  const names = (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("njucli-"))
    .map((entry) => entry.name);
  const pending = [];
  for (const name of names) {
    const target = join(skillsRoot, name);
    const existing = await lstat(target).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing) {
      if (existing.isSymbolicLink() && resolve(skillsRoot, await readlink(target)) === join(source, name)) continue;
      throw new Error(`Skill 路径已被其他内容占用，请先迁移：${target}`);
    }
    pending.push({ target, source: join(source, name) });
  }
  await mkdir(skillsRoot, { recursive: true });
  for (const item of pending) await symlink(item.source, item.target, "dir");
  return names;
}

if (process.env.npm_lifecycle_event === "postinstall" && process.env.npm_config_global === "true") {
  const packageRoot = fileURLToPath(new URL("../", import.meta.url));
  const skillsRoot = resolve(process.env.NJUCLI_SKILLS_DIR || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "skills"));
  const names = await installSkills(packageRoot, skillsRoot);
  console.log(`已安装 ${names.length} 个全局 Skill：${skillsRoot}`);
}

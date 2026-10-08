import { lstat, mkdir, readdir, readlink, realpath, symlink, unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export async function installSkills(packageRoot, skillsRoot, skillName) {
  const root = await realpath(packageRoot);
  const source = skillName ? root : join(root, "skills");
  const names = skillName ? [skillName] : (await readdir(source, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("njucli-"))
    .map((entry) => entry.name);
  const pending = [];
  for (const name of names) {
    const target = join(skillsRoot, name);
    const skillSource = skillName ? source : join(source, name);
    const existing = await lstat(target).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (existing) {
      let managed = false;
      if (existing.isSymbolicLink()) {
        const current = resolve(skillsRoot, await readlink(target));
        if (current === skillSource) continue;
        const alternate = skillName ? join(dirname(root), "njucli", "skills", name) : join(dirname(root), name);
        managed = current === alternate;
      }
      if (!managed) throw new Error(`Skill 路径已被其他内容占用，请先迁移：${target}`);
    }
    pending.push({ target, source: skillSource, replace: Boolean(existing) });
  }
  await mkdir(skillsRoot, { recursive: true });
  for (const item of pending) {
    if (item.replace) await unlink(item.target);
    await symlink(item.source, item.target, "dir");
  }
  return names;
}

const isMain = process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && (process.argv[2] || (process.env.npm_lifecycle_event === "postinstall" && process.env.npm_config_global === "true"))) {
  const packageRoot = process.argv[2] || fileURLToPath(new URL("../", import.meta.url));
  const skillsRoot = resolve(process.env.NJUCLI_SKILLS_DIR || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "skills"));
  const names = await installSkills(packageRoot, skillsRoot, process.argv[3]);
  console.log(`已安装 ${names.length} 个全局 Skill：${skillsRoot}`);
}

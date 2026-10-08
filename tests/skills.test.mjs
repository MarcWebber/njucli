import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const execute = promisify(execFile);

test("独立 Skill：单目录、声明依赖、共用账号与 MCP 契约", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-skills-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const env = { ...process.env, XDG_CONFIG_HOME: join(directory, "config"), XDG_DATA_HOME: join(directory, "data"), PATH: "/usr/bin:/bin" };
  delete env.NJUCLI_ACCOUNT;
  const run = async (skill, args) => (await execute(process.execPath, [join(directory, skill, "scripts/run.mjs"), ...args], { cwd: directory, env })).stdout;
  const names = (await readdir(join(root, "skills"))).filter((name) => name.startsWith("njucli-"));
  assert.equal(names.length, 16);

  for (const name of names) {
    const target = join(directory, name);
    await cp(join(root, "skills", name), target, { recursive: true, filter: (source) => !source.endsWith("node_modules") });
    const manifest = JSON.parse(await readFile(join(target, "package.json"), "utf8"));
    // Only declared third-party dependencies are available to the copied Skill.
    for (const dependency of Object.keys(manifest.dependencies)) {
      const link = join(target, "node_modules", dependency);
      await mkdir(dirname(link), { recursive: true });
      await symlink(await realpath(join(root, "node_modules", dependency)), link, "dir");
    }
    assert.match(await run(name, ["--help"]), new RegExp(`Usage: ${name}`));
  }

  const full = JSON.parse((await execute(process.execPath, [join(root, "dist/cli.js"), "campus", "sources", "--format", "json"], { env })).stdout);
  assert.deepEqual(JSON.parse(await run("njucli-campus", ["campus", "sources", "--format", "json"])), full);
  const preset = join(directory, "gradebook.json");
  assert.equal(JSON.parse(await run("njucli-table", ["table", "preset", "gradebook", "--output", preset, "--format", "json"])).ok, true);
  assert.equal(JSON.parse(await readFile(preset, "utf8")).tables[0].name, "课程成绩");
  assert.equal(JSON.parse(await run("njucli-box", ["account", "add", "portable", "--format", "json"])).ok, true);
  await run("njucli-box", ["account", "use", "portable", "--format", "json"]);
  assert.equal(JSON.parse(await run("njucli-mail", ["account", "current", "--format", "json"])).data, "portable");
  assert.deepEqual(JSON.parse(await run("njucli-box", ["auth", "logout", "box", "--format", "json"])).data, ["box"]);
  const sessions = JSON.parse(await readFile(join(env.XDG_CONFIG_HOME, "njucli/accounts/portable/sessions.json"), "utf8"));
  assert.deepEqual(sessions, [{ capability: "box", status: "logged-out" }]);

  const helper = pathToFileURL(join(directory, "njucli-auth/scripts/runtime.mjs")).href;
  const imported = await execute(process.execPath, ["--input-type=module", "-e", `const runtime = await import(${JSON.stringify(helper)}); console.log(["withBrowserSession", "createAuthServices", "createRuntime", "saveFile"].every(name => typeof runtime[name] === "function"))`], { cwd: directory, env });
  assert.equal(imported.stdout.trim(), "true");

  async function tools(entry) {
    const client = new Client({ name: "skill-isolation-test", version: "1.0.0" });
    const transport = new StdioClientTransport({ command: process.execPath, args: [entry, "mcp"], cwd: directory, env, stderr: "pipe" });
    try {
      await client.connect(transport);
      return (await client.listTools()).tools;
    } finally {
      await client.close();
    }
  }
  const unified = await tools(join(root, "dist/cli.js"));
  assert.equal(unified.length, 91);
  const separate = [];
  for (const name of names.filter((name) => !["njucli-auth", "njucli-doctor"].includes(name))) {
    const registered = await tools(join(directory, name, "scripts/run.mjs"));
    assert.ok(registered.length > 0);
    assert.ok(registered.every((tool) => tool.annotations.readOnlyHint === true));
    separate.push(...registered);
  }
  const byName = (a, b) => a.name.localeCompare(b.name);
  assert.deepEqual(separate.sort(byName), unified.sort(byName));
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, readdir, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const execute = promisify(execFile);

test("统一安装：njucli、Skill 注册、目录、模板与 MCP", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "njucli-install-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const prefix = join(directory, "install");
  const env = {
    ...process.env,
    NJUCLI_SKILLS_DIR: join(directory, "skills"),
    XDG_CONFIG_HOME: join(directory, "config"),
    XDG_DATA_HOME: join(directory, "data"),
    PATH: `${join(prefix, "bin")}${delimiter}${process.env.PATH}`,
  };
  delete env.NJUCLI_ACCOUNT;
  const packed = JSON.parse((await execute("npm", ["pack", "--ignore-scripts", "--pack-destination", directory, "--json"], { cwd: root })).stdout)[0];
  assert.equal(packed.files.filter((file) => file.path.endsWith("package.json")).length, 1);
  assert.ok(packed.files.every((file) => !file.path.startsWith("skills/") || !file.path.includes("/scripts/")));
  await execute("npm", ["install", "--global", "--prefix", prefix, "--foreground-scripts", "--no-audit", "--no-fund", join(directory, packed.filename)], { cwd: directory, env });
  const run = async (args) => (await execute("njucli", args, { cwd: directory, env })).stdout;
  const names = (await readdir(join(root, "skills"))).filter((name) => name.startsWith("njucli-"));
  assert.match(await run(["--help"]), /Usage: njucli/);
  for (const name of names) {
    const domain = name.slice("njucli-".length);
    assert.match(await run([domain, "--help"]), new RegExp(`Usage: njucli ${domain}`));
    const installed = join(prefix, "lib/node_modules/njucli/skills", name);
    assert.equal(await realpath(join(env.NJUCLI_SKILLS_DIR, name)), await realpath(installed));
    assert.equal(await readFile(join(installed, "SKILL.md"), "utf8"), await readFile(join(root, "skills", name, "SKILL.md"), "utf8"));
  }

  const sources = JSON.parse(await run(["campus", "sources", "--format", "json"]));
  assert.equal(sources.ok, true);
  const institutions = JSON.parse(await run(["institution", "list", "--format", "json"]));
  assert.ok(institutions.data.items.length > 0);
  const preset = join(directory, "gradebook.json");
  assert.equal(JSON.parse(await run(["table", "preset", "gradebook", "--output", preset, "--format", "json"])).ok, true);
  assert.deepEqual(JSON.parse(await readFile(preset, "utf8")), JSON.parse(await readFile(join(root, "skills/njucli-table/templates/gradebook.json"), "utf8")));

  const client = new Client({ name: "njucli-install-check", version: "1.0.0" });
  const transport = new StdioClientTransport({ command: "njucli", args: ["mcp"], cwd: directory, env, stderr: "pipe" });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    assert.equal(new Set(tools.map((tool) => tool.name)).size, tools.length);
    assert.ok(tools.every((tool) => tool.annotations.readOnlyHint === true));
    for (const name of names.filter((name) => name !== "njucli-auth")) {
      const prefix = name.slice("njucli-".length).replaceAll("-", "_") + "_";
      assert.ok(tools.some((tool) => tool.name.startsWith(prefix)), name);
    }
    const result = await client.callTool({ name: "institution_list", arguments: {} });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(result.content[0].text), institutions);
    t.diagnostic(`${names.length} 个业务入口与 Skill 注册、${tools.length} 个只读 MCP 工具通过实际安装验证`);
  } finally {
    await client.close();
  }
});

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { addFormatOption, runCommand, type CommandRuntime, type FormatOptions } from "../core/command.js";

const SOURCE = "https://github.com/MarcWebber/njucli/tree/main";

export function registerUpgradeCommand(program: Command, runtime: CommandRuntime): void {
  addFormatOption(program.command("upgrade").description("从 GitHub main 升级全局 CLI 和 Skill"))
    .action(async (options: FormatOptions) => runCommand(runtime, options, async () => {
      const directory = await mkdtemp(join(tmpdir(), "njucli-upgrade-"));
      // Source runs from src/commands; compiled modules run from dist/src/commands.
      const packageRoot = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "../../" : "../../../", import.meta.url));
      const modules = dirname(packageRoot.replace(/\/$/, ""));
      const environment = { ...runtime.environment };
      if (basename(modules) === "node_modules" && basename(dirname(modules)) === "lib") {
        environment.NJUCLI_INSTALL_PREFIX = dirname(dirname(modules));
      }
      try {
        await new Promise<void>((resolve, reject) => {
          const child = spawn("bash", [join(packageRoot, "scripts/install.sh")], { cwd: directory, env: environment, stdio: ["ignore", "pipe", "pipe"] });
          child.stdout.on("data", (value: Buffer) => runtime.output.stderr(value.toString()));
          child.stderr.on("data", (value: Buffer) => runtime.output.stderr(value.toString()));
          child.once("error", reject);
          child.once("close", (code, signal) => {
            if (code === 0) resolve();
            else reject(new Error(`升级失败：安装脚本${signal ? `被 ${signal} 终止` : `退出码 ${code}`}`));
          });
        });
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
      return { data: { source: SOURCE }, text: "CLI 和全局 Skill 已更新到 GitHub main。" };
    }));
}

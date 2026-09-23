#!/usr/bin/env node
import { createProductionServices } from "./app/production.js";
import { createCli } from "./commands/index.js";
import type { CommandRuntime } from "./core/command.js";

async function main(): Promise<void> {
  const runtime: CommandRuntime = {
    environment: process.env,
    output: {
      stdout: (value) => process.stdout.write(value),
      stderr: (value) => process.stderr.write(value),
    },
    setExitCode: (code) => {
      process.exitCode = code;
    },
  };
  await createCli(createProductionServices(), runtime).parseAsync(process.argv);
}

void main();

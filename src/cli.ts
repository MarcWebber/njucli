#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { createProductionServices } from "./app/production.js";
import { createCli } from "./commands/index.js";
import type { CommandRuntime } from "./core/command.js";

async function main(argv: readonly string[] = process.argv): Promise<void> {
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
  await createCli(createProductionServices(), runtime).parseAsync([...argv]);
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  void main();
}

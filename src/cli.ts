#!/usr/bin/env node
import { createProductionServices } from "./app/production.js";
import { createCli } from "./commands/index.js";
import { createCommandRuntime } from "./core/command.js";

await createCli(createProductionServices(), createCommandRuntime()).parseAsync(process.argv);

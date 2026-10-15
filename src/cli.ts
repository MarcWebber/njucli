#!/usr/bin/env node
import { createCli } from "./app/production.js";
import { createCommandRuntime } from "./core/command.js";

await createCli(createCommandRuntime()).parseAsync(process.argv);

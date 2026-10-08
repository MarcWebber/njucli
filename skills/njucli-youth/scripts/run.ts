import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { createYouthServices } from "./services.js";
import { registerYouthCommands } from "./commands.js";
import { registerYouthTools } from "./mcp.js";

const context = createRuntime();
const service = createYouthServices(context);

await runSkill("njucli-youth", context,
  (program, runtime) => { registerYouthCommands(program, service, runtime); },
  (read) => registerYouthTools(read, service));

import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { ItxiaClient } from "./client.js";
import { registerItxiaCommands } from "./commands.js";
import { registerItxiaTools } from "./mcp.js";

const context = createRuntime();
const service = new ItxiaClient();

await runSkill("njucli-itxia", context,
  (program, runtime) => { registerItxiaCommands(program, service, runtime); },
  (read) => registerItxiaTools(read, service));

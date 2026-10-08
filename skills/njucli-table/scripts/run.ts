import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { createTableServices } from "./services.js";
import { registerTableCommands } from "./commands.js";
import { registerTableTools } from "./mcp.js";

const context = createRuntime();
const service = createTableServices(context);

await runSkill("njucli-table", context,
  (program, runtime) => { registerTableCommands(program, service, runtime); },
  (read) => registerTableTools(read, service));

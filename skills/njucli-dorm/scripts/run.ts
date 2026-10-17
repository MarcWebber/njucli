import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { createDormServices } from "./client.js";
import { registerDormCommands, registerDormTools } from "./commands.js";

const context = createRuntime();
const service = createDormServices(context);
await runSkill("njucli-dorm", context, (program, runtime) => {
  registerDormCommands(program, service, runtime);
}, read => registerDormTools(read, service));

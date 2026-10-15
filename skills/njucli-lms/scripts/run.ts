import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { createLmsServices } from "./client.js";
import { registerLmsCommands, registerLmsTools } from "./commands.js";

const context = createRuntime();
const service = createLmsServices(context);
await runSkill("njucli-lms", context, (program, runtime) => { registerLmsCommands(program, service, runtime); }, read => registerLmsTools(read, service));

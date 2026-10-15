import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { registerSelfServiceCommands, registerSelfServiceTools } from "./commands.js";
import { createSelfServiceServices } from "./client.js";

const context = createRuntime();
const service = createSelfServiceServices(context);
await runSkill("njucli-self-service", context,
  (program, runtime) => { registerSelfServiceCommands(program, service, runtime); },
  (read) => registerSelfServiceTools(read, service));

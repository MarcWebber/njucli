import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { createPayServices } from "./client.js";
import { registerPayCommands, registerPayTools } from "./commands.js";

const context = createRuntime();
const service = createPayServices(context);
await runSkill("njucli-pay", context, (program, runtime) => {
  registerPayCommands(program, service, runtime);
}, read => registerPayTools(read, service));

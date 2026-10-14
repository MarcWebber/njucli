import { createRuntime } from "../../../src/app/runtime.js";
import { runSkill } from "../../../src/app/skill.js";
import { InstitutionClient } from "./client.js";
import { registerInstitutionCommands } from "./commands.js";
import { registerInstitutionTools } from "./mcp.js";

const service = new InstitutionClient();
await runSkill("njucli-institution", createRuntime(),
  (program, runtime) => { registerInstitutionCommands(program, service, runtime); },
  read => registerInstitutionTools(read, service));

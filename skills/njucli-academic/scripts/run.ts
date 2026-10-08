import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createAcademicServices } from './services.js';
import { registerAcademicCommands } from './commands.js';
import { registerAcademicTools } from './mcp.js';

const context = createRuntime();

const service = createAcademicServices(context);

await runSkill('njucli-academic', context, (program, runtime) => { registerAcademicCommands(program, service, runtime); }, read => registerAcademicTools(read, service));

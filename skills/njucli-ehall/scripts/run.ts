import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createEHallServices } from './services.js';
import { registerEHallCommands } from './commands.js';
import { registerEHallTools } from './mcp.js';

const context = createRuntime();

const service = createEHallServices(context);

await runSkill('njucli-ehall', context, (program, runtime) => { registerEHallCommands(program, service, runtime); }, read => registerEHallTools(read, service));

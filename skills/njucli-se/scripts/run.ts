import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createSeServices } from './services.js';
import { registerSeCommands } from './commands.js';
import { registerSeTools } from './mcp.js';

const context = createRuntime();

const service = createSeServices(context);

await runSkill('njucli-se', context, (program, runtime) => { registerSeCommands(program, service, runtime); }, read => registerSeTools(read, service));

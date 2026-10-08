import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createSoftSeServices } from './services.js';
import { registerSoftSeCommands } from './commands.js';
import { registerSoftSeTools } from './mcp.js';

const context = createRuntime();

const service = createSoftSeServices(context);

await runSkill('njucli-softse', context, (program, runtime) => { registerSoftSeCommands(program, service, runtime); }, read => registerSoftSeTools(read, service));

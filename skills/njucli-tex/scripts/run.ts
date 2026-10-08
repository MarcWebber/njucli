import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createTexServices } from './services.js';
import { registerTexCommands } from './commands.js';
import { registerTexTools } from './mcp.js';

const context = createRuntime();

const service = createTexServices(context);

await runSkill('njucli-tex', context, (program, runtime) => { registerTexCommands(program, service, runtime); }, read => registerTexTools(read, service));

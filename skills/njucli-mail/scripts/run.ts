import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createMailServices } from './services.js';
import { registerMailCommands } from './commands.js';
import { registerMailTools } from './mcp.js';

const context = createRuntime();

const service = createMailServices(context);

await runSkill('njucli-mail', context, (program, runtime) => { registerMailCommands(program, service, runtime); }, read => registerMailTools(read, service));

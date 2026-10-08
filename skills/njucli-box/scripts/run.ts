import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createBoxServices } from './services.js';
import { registerBoxCommands } from './commands.js';
import { registerBoxTools } from './mcp.js';

const context = createRuntime();

const service = createBoxServices(context);

await runSkill('njucli-box', context, (program, runtime) => { registerBoxCommands(program, service, runtime); }, read => registerBoxTools(read, service));

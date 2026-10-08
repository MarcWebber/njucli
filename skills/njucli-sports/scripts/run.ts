import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createSportsServices } from './services.js';
import { registerSportsCommands } from './commands.js';
import { registerSportsTools } from './mcp.js';

const context = createRuntime();

const service = createSportsServices(context);

await runSkill('njucli-sports', context, (program, runtime) => { registerSportsCommands(program, service, runtime); }, read => registerSportsTools(read, service));

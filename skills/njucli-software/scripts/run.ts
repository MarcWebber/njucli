import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { SoftwareClient } from './client.js';
import { registerSoftwareCommands } from './commands.js';
import { registerSoftwareTools } from './mcp.js';

const context = createRuntime();

const service = new SoftwareClient();

await runSkill('njucli-software', context, (program, runtime) => { registerSoftwareCommands(program, service, runtime); }, read => registerSoftwareTools(read, service));

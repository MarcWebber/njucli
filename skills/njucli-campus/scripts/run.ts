import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { CampusClient } from './client.js';
import { registerCampusCommands } from './commands.js';
import { registerCampusTools } from './mcp.js';

const context = createRuntime();

const service = new CampusClient(fetch);

await runSkill('njucli-campus', context, (program, runtime) => { registerCampusCommands(program, service, runtime); }, read => registerCampusTools(read, service));

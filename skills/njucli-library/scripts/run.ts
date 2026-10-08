import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createLibraryServices } from './services.js';
import { registerLibraryCommands } from './commands.js';
import { registerLibraryTools } from './mcp.js';

const context = createRuntime();

const service = createLibraryServices(context);

await runSkill('njucli-library', context, (program, runtime) => { registerLibraryCommands(program, service, runtime); }, read => registerLibraryTools(read, service));

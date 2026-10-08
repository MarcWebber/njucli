import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createCourseServices } from './services.js';
import { registerCourseCommands } from './commands.js';
import { registerCourseTools } from './mcp.js';

const context = createRuntime();

const service = createCourseServices(context);

await runSkill('njucli-course', context, (program, runtime) => { registerCourseCommands(program, service, runtime); }, read => registerCourseTools(read, service));

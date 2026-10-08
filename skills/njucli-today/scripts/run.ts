import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createTodayServices } from './services.js';
import { registerTodayCommand } from './commands.js';
import { createCourseServices } from '../../njucli-course/scripts/services.js';
import { createLibraryServices } from '../../njucli-library/scripts/services.js';
import { createSportsServices } from '../../njucli-sports/scripts/services.js';
import { registerTodayTools } from './mcp.js';

const context = createRuntime();

const service = createTodayServices({ course: createCourseServices(context), library: createLibraryServices(context), sports: createSportsServices(context) });

await runSkill('njucli-today', context, (program, runtime) => { registerTodayCommand(program, service, runtime); }, read => registerTodayTools(read, service));

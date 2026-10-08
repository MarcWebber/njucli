import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createCampusServices } from './services.js';
import { createEHallServices } from '../../njucli-ehall/scripts/services.js';
import { createLibraryServices } from '../../njucli-library/scripts/services.js';
import { createSportsServices } from '../../njucli-sports/scripts/services.js';
import { registerCampusCommands } from './commands.js';
import { registerCampusTools } from './mcp.js';

const context = createRuntime();

const service = createCampusServices({
  ehall: createEHallServices(context),
  library: createLibraryServices(context),
  sports: createSportsServices(context),
});

await runSkill('njucli-campus', context, (program, runtime) => { registerCampusCommands(program, service, runtime); }, read => registerCampusTools(read, service));

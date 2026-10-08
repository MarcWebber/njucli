import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';
import { createDoctorServices } from './services.js';
import { registerDoctorCommand } from './commands.js';

const context = createRuntime();

const service = createDoctorServices(context);

await runSkill('njucli-doctor', context, (program, runtime) => { registerDoctorCommand(program, service, runtime); });

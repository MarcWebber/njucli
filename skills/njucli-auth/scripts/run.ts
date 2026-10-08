import { createRuntime } from '../../../src/app/runtime.js';
import { runSkill } from '../../../src/app/skill.js';

const context = createRuntime();

await runSkill('njucli-auth', context, () => { });

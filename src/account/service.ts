import type { SkillRuntime } from '../app/runtime.js';

export type AccountServices = ReturnType<typeof createAccountServices>;

export function createAccountServices(runtime: SkillRuntime) {
  const { accountStore } = runtime;
  return {
    current: async () => (await accountStore.current()).name,
    list: async () => (await accountStore.list()).map((account) => account.name),
    add: async (name: string) => (await accountStore.add(name)).name,
    use: async (name: string) => (await accountStore.use(name)).name,
    remove: (name: string) => accountStore.remove(name),
  };
}

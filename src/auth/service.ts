import { type SkillRuntime } from "../app/runtime.js";
import { type AuthCapability, type AuthCredentials, type SessionMetadata } from "./types.js";
import { join } from "node:path";
import { withBrowserSession } from "./browser-session.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";

export type AuthServices = {
  status(capability?: AuthCapability): Promise<SessionMetadata[]>;
  login(capability?: AuthCapability, credentials?: AuthCredentials): Promise<SessionMetadata>;
  logout(capability?: AuthCapability): Promise<AuthCapability[]>;
};

export function createAuthServices(runtime: SkillRuntime): AuthServices {
  const { accountStore, auth } = runtime;
  return {
    status: async (capability) => auth.status(await accountStore.current(), capability),
    login: async (capability, credentials) => {
      const account = await accountStore.current();
      const path = join(account.configDir, "auth.json");
      const previous = await readJsonFile<AuthCredentials>(path);
      if (credentials)
        await writeJsonFile(path, credentials);
      return withBrowserSession(account, false, async (session) => {
        if (credentials && previous?.username !== credentials.username)
          await session.clearCookies();
        return auth.login(account, capability);
      });
    },
    logout: async (capability) => auth.logout(await accountStore.current(), capability),
  };
}

import { type SkillRuntime } from "../app/runtime.js";
import { type AuthCapability, type AuthCredentials, type AuthMaintenance, type SessionMetadata } from "./types.js";
import { join } from "node:path";
import { withBrowserSession } from "./browser-session.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import { AppError } from "../core/errors.js";

export type AuthServices = {
  maintain(): Promise<AuthMaintenance>;
  status(capability?: AuthCapability): Promise<SessionMetadata[]>;
  login(capability?: AuthCapability, credentials?: AuthCredentials): Promise<SessionMetadata>;
  logout(capability?: AuthCapability): Promise<AuthCapability[]>;
};

export function createAuthServices(runtime: SkillRuntime): AuthServices {
  const { accountStore, auth } = runtime;
  return {
    maintain: async () => {
      const account = await accountStore.current();
      return withBrowserSession(account, true, async () => {
        const [current] = await auth.status(account, "sso");
        const action = current!.status === "valid" ? "kept-alive" : "restored";
        if (action === "restored") {
          const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
          if (!credentials) throw new AppError("AUTH_REQUIRED", "请保存统一认证账号密码，以便自动恢复会话");
          await auth.login(account, "sso");
        }
        const result: AuthMaintenance = { checkedAt: new Date().toISOString(), action, status: "valid" };
        await writeJsonFile(join(account.configDir, "auth-maintenance.json"), result);
        return result;
      });
    },
    status: async (capability) => {
      const account = await accountStore.current();
      return withBrowserSession(account, true, () => auth.status(account, capability));
    },
    login: async (capability, credentials) => {
      const account = await accountStore.current();
      return withBrowserSession(account, false, async (session) => {
        if (credentials) {
          const path = join(account.configDir, "auth.json");
          const previous = await readJsonFile<AuthCredentials>(path);
          await writeJsonFile(path, credentials);
          if (previous?.username !== credentials.username) await session.clearCookies();
        }
        return auth.login(account, capability);
      });
    },
    logout: async (capability) => {
      const account = await accountStore.current();
      return withBrowserSession(account, true, () => auth.logout(account, capability));
    },
  };
}

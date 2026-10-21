import { type SkillRuntime } from "../app/runtime.js";
import { type AuthCapability, type AuthCredentials, type AuthMaintenance, type SessionMetadata } from "./types.js";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { withBrowserSession } from "./browser-session.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import { AppError } from "../core/errors.js";
import { authDaemonStatus, runAuthDaemon, startAuthDaemon, stopAuthDaemon, type AuthDaemonStatus } from "./daemon.js";
import { authAutostart, type AutostartAction } from "./autostart.js";
import type { OutputSink } from "../core/output.js";

export type AuthServices = {
  maintain(): Promise<AuthMaintenance>;
  autostart(action: AutostartAction, intervalSeconds?: number): ReturnType<typeof authAutostart>;
  daemonStart(intervalSeconds: number): Promise<AuthDaemonStatus>;
  daemonStatus(): Promise<AuthDaemonStatus>;
  daemonStop(): Promise<AuthDaemonStatus>;
  daemonRun(intervalSeconds: number, signal: AbortSignal, output: OutputSink): Promise<void>;
  status(capability?: AuthCapability): Promise<SessionMetadata[]>;
  authenticate(credentials: AuthCredentials): Promise<{ studentId: string }>;
  login(capability?: AuthCapability, credentials?: AuthCredentials): Promise<SessionMetadata>;
  logout(capability?: AuthCapability): Promise<AuthCapability[]>;
};

export function createAuthServices(runtime: SkillRuntime, readIdentity: () => Promise<{ studentId: string }>): AuthServices {
  const { accountStore, auth } = runtime;
  const services: AuthServices = {
    autostart: async (action, intervalSeconds) => authAutostart(await accountStore.current(), action, intervalSeconds),
    daemonStart: async (intervalSeconds) => startAuthDaemon(await accountStore.current(), intervalSeconds),
    daemonStatus: async () => authDaemonStatus(await accountStore.current()),
    daemonStop: async () => stopAuthDaemon(await accountStore.current()),
    daemonRun: async (intervalSeconds, signal, output) => runAuthDaemon(await accountStore.current(), services.maintain, intervalSeconds, signal, output),
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
    authenticate: async (credentials) => {
      const account = await accountStore.current();
      return withBrowserSession(account, true, async (session) => {
        const path = join(account.configDir, "auth.json");
        const previous = await readJsonFile<AuthCredentials>(path);
        await session.clearCookies();
        await writeJsonFile(path, credentials);
        try {
          await auth.login(account, "sso");
          return await readIdentity();
        } catch (error) {
          await session.clearCookies();
          if (previous) await writeJsonFile(path, previous);
          else await rm(path, { force: true });
          throw error;
        }
      });
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
  return services;
}

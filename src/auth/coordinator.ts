import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { AUTH_DEPENDENCIES, dependsOn } from "./capabilities.js";
import type { SessionStore } from "./session-store.js";
import { AUTH_CAPABILITIES, type AuthCapability, type AuthSessionDriver, type SessionMetadata } from "./types.js";

export class AuthCoordinator {
  constructor(private readonly options: {
    drivers: Record<AuthCapability, AuthSessionDriver>;
    sessions: SessionStore;
  }) {}

  async login(account: AccountRecord, capability: AuthCapability = "sso"): Promise<SessionMetadata> {
    for (const dependency of AUTH_DEPENDENCIES[capability]) await this.ensureSession(account, dependency);
    const metadata = await this.save(account, capability, await this.options.drivers[capability].login(account));
    if (metadata.status !== "valid") throw new AppError("AUTH_REQUIRED", `${capability} 登录未完成`);
    return metadata;
  }

  async status(account: AccountRecord, capability?: AuthCapability): Promise<SessionMetadata[]> {
    const targets = capability ? [capability] : (await this.options.sessions.list(account)).map((s) => s.capability);
    const result: SessionMetadata[] = [];
    for (const target of targets) result.push(await this.save(account, target, await this.probe(account, target)));
    return result;
  }

  async logout(account: AccountRecord, capability?: AuthCapability): Promise<AuthCapability[]> {
    const targets = AUTH_CAPABILITIES.filter((target) => !capability || target === capability || dependsOn(target, capability)).reverse();
    for (const target of targets) {
      await this.options.drivers[target].logout?.(account);
      await this.options.sessions.put(account, { capability: target, status: "logged-out" });
    }
    return targets;
  }

  async ensureSession(account: AccountRecord, capability: AuthCapability, probe?: () => Promise<boolean>): Promise<SessionMetadata> {
    if (await this.probe(account, capability, probe)) return this.save(account, capability, true);
    await this.save(account, capability, false);
    const metadata = await this.login(account, capability);
    // Some probes also initialize the per-command client or access token.
    try {
      if (probe && !await this.probe(account, capability, probe)) {
        throw new AppError("AUTH_REQUIRED", `${capability} 登录后会话仍不可用`);
      }
    } catch (error) {
      await this.save(account, capability, false);
      throw error;
    }
    return metadata;
  }

  private async probe(account: AccountRecord, capability: AuthCapability, probe = () => this.options.drivers[capability].probe(account)): Promise<boolean> {
    try {
      return await probe();
    } catch (error) {
      if (error instanceof AppError && error.code.startsWith("AUTH_")) return false;
      throw error;
    }
  }

  private async save(account: AccountRecord, capability: AuthCapability, valid: boolean): Promise<SessionMetadata> {
    const metadata: SessionMetadata = { capability, status: valid ? "valid" : "expired" };
    await this.options.sessions.put(account, metadata);
    return metadata;
  }
}

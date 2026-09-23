import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { AUTH_DEPENDENCIES, dependsOn, orderCapabilities } from "./capabilities.js";
import type { SessionStore } from "./session-store.js";
import {
  AUTH_CAPABILITIES,
  type AuthCapability,
  type AuthSessionDriver,
  type SessionMetadata,
} from "./types.js";

export class AuthCoordinator {
  constructor(private readonly options: {
    drivers: Record<AuthCapability, AuthSessionDriver>;
    sessions: SessionStore;
  }) {}

  capabilities(): AuthCapability[] {
    return [...AUTH_CAPABILITIES];
  }

  async login(
    account: AccountRecord,
    capability: AuthCapability = "sso",
  ): Promise<SessionMetadata> {
    for (const dependency of AUTH_DEPENDENCIES[capability]) {
      await this.login(account, dependency);
    }
    const valid = await this.options.drivers[capability].login(account);
    const metadata = await this.save(account, capability, valid);
    requireValid(capability, metadata.status, "login");
    return metadata;
  }

  async status(
    account: AccountRecord,
    capability?: AuthCapability,
  ): Promise<SessionMetadata[]> {
    if (capability) {
      return [await this.probeOne(account, capability)];
    }
    const configured = await this.options.sessions.list(account);
    const result: SessionMetadata[] = [];
    for (const current of orderCapabilities(configured.map((session) => session.capability))) {
      result.push(await this.probeOne(account, current));
    }
    return result;
  }

  async refresh(
    account: AccountRecord,
    capability?: AuthCapability,
  ): Promise<SessionMetadata[]> {
    if (capability) {
      return [await this.refreshOne(account, capability)];
    }

    const configured = await this.options.sessions.list(account);
    const targets = configured.filter((session) => session.status !== "logged-out").map((session) => session.capability);
    const ordered = orderCapabilities(targets);

    const result: SessionMetadata[] = [];
    for (const target of ordered) result.push(await this.refreshOne(account, target));
    return result;
  }

  async logout(
    account: AccountRecord,
    capability?: AuthCapability,
  ): Promise<AuthCapability[]> {
    const configured = await this.options.sessions.list(account);
    const targets = new Set<AuthCapability>();
    if (capability) {
      targets.add(capability);
      for (const session of configured) {
        if (dependsOn(session.capability, capability)) targets.add(session.capability);
      }
    } else {
      targets.add("sso");
      for (const session of configured) targets.add(session.capability);
    }

    const ordered = orderCapabilities(targets).reverse();
    const errors: unknown[] = [];
    for (const target of ordered) {
      const driver = this.options.drivers[target];
      try {
        await driver.logout?.(account);
      } catch (error) {
        errors.push(error);
      } finally {
        await this.options.sessions.put(account, { capability: target, status: "logged-out" });
      }
    }
    if (errors.length > 0) throw errors[0];
    return ordered;
  }

  async ensureSession(
    account: AccountRecord,
    capability: AuthCapability,
    probe?: () => Promise<boolean>,
  ): Promise<SessionMetadata> {
    const current = await this.options.sessions.get(account, capability);
    if (current?.status === "logged-out") throw authRequired(capability, false);
    return this.refreshOne(account, capability, probe);
  }

  private async refreshOne(
    account: AccountRecord,
    capability: AuthCapability,
    probe?: () => Promise<boolean>,
  ): Promise<SessionMetadata> {
    const metadata = await this.observe(account, capability, probe);
    requireValid(capability, metadata.status, "refresh");
    return metadata;
  }

  private async probeOne(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata> {
    const current = await this.options.sessions.get(account, capability);
    if (current?.status === "logged-out") return current;
    return this.observe(account, capability);
  }

  private async observe(
    account: AccountRecord, capability: AuthCapability,
    probe: () => Promise<boolean> = () => this.options.drivers[capability].probe(account),
  ): Promise<SessionMetadata> {
    let observation: boolean;
    try {
      observation = await probe();
    } catch (error) {
      if (!(error instanceof AppError) || !["AUTH_REQUIRED", "AUTH_EXPIRED", "AUTH_REFRESH_FAILED"].includes(error.code)) throw error;
      observation = false;
    }
    return this.save(account, capability, observation);
  }

  private async save(
    account: AccountRecord,
    capability: AuthCapability,
    observation: boolean,
  ): Promise<SessionMetadata> {
    const metadata: SessionMetadata = { capability, status: observation ? "valid" : "expired" };
    await this.options.sessions.put(account, metadata);
    return metadata;
  }
}

function requireValid(
  capability: AuthCapability,
  status: SessionMetadata["status"],
  operation: "login" | "refresh",
): void {
  if (status === "valid") return;
  if (operation === "login") throw authRequired(capability, status === "expired");
  throw new AppError("AUTH_REFRESH_FAILED", `认证会话刷新后仍不可用: ${capability}`, {
    hint: authLoginCommand(capability),
    authCommand: authLoginCommand(capability),
  });
}

function authRequired(capability: AuthCapability, expired: boolean): AppError {
  const command = authLoginCommand(capability);
  return new AppError(
    expired ? "AUTH_EXPIRED" : "AUTH_REQUIRED",
    `${capability} 认证会话${expired ? "已失效" : "不存在"}`,
    { hint: command, authCommand: command },
  );
}

function authLoginCommand(capability: AuthCapability): string {
  return capability === "sso" ? "njucli auth login" : `njucli auth login ${capability}`;
}

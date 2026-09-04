import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { systemClock, type Clock } from "../core/types.js";
import { AUTH_DEPENDENCIES, dependsOn, orderCapabilities } from "./capabilities.js";
import {
  AUTH_CAPABILITIES,
  type AuthCapability,
  type AuthSessionDriver,
  type SessionMetadata,
  type SessionMetadataStore,
  type SessionObservation,
  type SessionStatus,
} from "./types.js";

export class AuthCoordinator {
  private readonly drivers: ReadonlyMap<AuthCapability, AuthSessionDriver>;
  private readonly sessions: SessionMetadataStore;
  private readonly clock: Clock;

  constructor(options: {
    drivers: Iterable<AuthSessionDriver>;
    sessions: SessionMetadataStore;
    clock?: Clock;
  }) {
    const drivers = new Map<AuthCapability, AuthSessionDriver>();
    for (const driver of options.drivers) {
      if (drivers.has(driver.capability)) {
        throw new AppError("INVALID_INPUT", `认证能力注册了多个 driver: ${driver.capability}`);
      }
      drivers.set(driver.capability, driver);
    }
    this.drivers = drivers;
    this.sessions = options.sessions;
    this.clock = options.clock ?? systemClock;
  }

  capabilities(): AuthCapability[] {
    return AUTH_CAPABILITIES.filter((capability) => this.drivers.has(capability));
  }

  async login(
    account: AccountRecord,
    capability: AuthCapability = "sso",
  ): Promise<SessionMetadata> {
    this.driverFor(capability);
    return this.loginOne(account, capability);
  }

  async status(
    account: AccountRecord,
    capability?: AuthCapability,
  ): Promise<SessionMetadata[]> {
    if (capability) {
      this.driverFor(capability);
      return [await this.probeOne(account, capability)];
    }
    const configured = await this.sessions.list(account);
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
      this.driverFor(capability);
      return [await this.refreshOne(account, capability)];
    }

    const configured = await this.sessions.list(account);
    const targets = new Set<AuthCapability>(["sso"]);
    for (const session of configured) {
      if (dependsOn(session.capability, "sso")) targets.add(session.capability);
    }
    const ordered = orderCapabilities(targets);
    for (const target of ordered) this.driverFor(target);

    const result: SessionMetadata[] = [];
    for (const target of ordered) result.push(await this.refreshOne(account, target));
    return result;
  }

  async logout(
    account: AccountRecord,
    capability?: AuthCapability,
  ): Promise<AuthCapability[]> {
    const configured = await this.sessions.list(account);
    const targets = new Set<AuthCapability>();
    if (capability) {
      this.driverFor(capability);
      targets.add(capability);
      for (const session of configured) {
        if (dependsOn(session.capability, capability)) targets.add(session.capability);
      }
    } else {
      for (const session of configured) targets.add(session.capability);
    }

    const ordered = orderCapabilities(targets).reverse();
    for (const target of ordered) {
      const driver = this.driverFor(target);
      await driver.logout?.(account);
      await this.sessions.delete(account, target);
    }
    return ordered;
  }

  async forRead(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata> {
    this.driverFor(capability);
    const current = await this.sessions.get(account, capability);
    const state = this.freshness(current);
    if (state === "valid") return current!;
    if (state === "stale") return this.refreshOne(account, capability);
    throw authRequired(capability, state === "expired");
  }

  private async loginOne(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata> {
    for (const dependency of AUTH_DEPENDENCIES[capability]) {
      const state = this.freshness(await this.sessions.get(account, dependency));
      if (state === "stale") await this.refreshOne(account, dependency);
      if (state === "missing" || state === "expired") await this.loginOne(account, dependency);
    }

    const driver = this.driverFor(capability);
    const observation = await driver.login(account);
    requireValid(capability, observation, "login");
    return this.save(account, capability, observation);
  }

  private async refreshOne(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata> {
    const driver = this.driverFor(capability);
    const current = await this.sessions.get(account, capability);
    const state = this.freshness(current);
    if (state === "missing" || state === "expired") {
      throw authRequired(capability, state === "expired");
    }

    for (const dependency of AUTH_DEPENDENCIES[capability]) {
      const dependencyState = this.freshness(await this.sessions.get(account, dependency));
      if (dependencyState === "stale") await this.refreshOne(account, dependency);
      if (dependencyState !== "valid" && dependencyState !== "stale") {
        throw authRequired(dependency, dependencyState === "expired");
      }
    }

    const observation = driver.refresh
      ? await driver.refresh(account)
      : await driver.probe(account);
    requireValid(capability, observation, "refresh");
    return this.save(account, capability, observation);
  }

  private async probeOne(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata> {
    const driver = this.driverFor(capability);
    const observation = await driver.probe(account);
    const metadata = toMetadata(capability, observation);
    await this.sessions.put(account, metadata);
    return metadata;
  }

  private async save(
    account: AccountRecord,
    capability: AuthCapability,
    observation: SessionObservation,
  ): Promise<SessionMetadata> {
    const metadata = toMetadata(capability, observation);
    await this.sessions.put(account, metadata);
    return metadata;
  }

  private freshness(
    metadata: SessionMetadata | undefined,
  ): SessionStatus | "missing" | "stale" {
    if (!metadata) return "missing";
    if (metadata.status === "expired") return "expired";
    return Date.parse(metadata.refreshAfter) <= this.clock.now().getTime() ? "stale" : "valid";
  }

  private driverFor(capability: AuthCapability): AuthSessionDriver {
    const driver = this.drivers.get(capability);
    if (!driver) {
      throw new AppError("AUTH_CAPABILITY_UNKNOWN", `认证能力尚未配置 driver: ${capability}`);
    }
    return driver;
  }
}

function toMetadata(
  capability: AuthCapability,
  observation: SessionObservation,
): SessionMetadata {
  return observation.status === "valid"
    ? {
        capability,
        status: "valid",
        refreshAfter: observation.refreshAfter.toISOString(),
      }
    : { capability, status: "expired", refreshAfter: null };
}

function requireValid(
  capability: AuthCapability,
  observation: SessionObservation,
  operation: "login" | "refresh",
): void {
  if (observation.status === "valid") return;
  if (operation === "login") throw authRequired(capability, observation.status === "expired");
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

import { describe, expect, it } from "vitest";

import type { AccountRecord } from "../../src/account/types.js";
import { AuthCoordinator } from "../../src/auth/coordinator.js";
import type {
  AuthCapability,
  AuthSessionDriver,
  SessionMetadata,
  SessionMetadataStore,
  SessionObservation,
} from "../../src/auth/types.js";
import type { Clock } from "../../src/core/types.js";

const account: AccountRecord = {
  name: "default",
  configDir: "/tmp/njucli-test/config",
  browserDataDir: "/tmp/njucli-test/data/browser",
};
const clock: Clock = { now: () => new Date("2026-09-04T12:00:00.000Z") };

describe("AuthCoordinator", () => {
  it("rejects duplicate drivers instead of choosing one at runtime", () => {
    expect(
      () =>
        new AuthCoordinator({
          drivers: [new FakeDriver("sso"), new FakeDriver("sso")],
          sessions: new MemorySessions(),
          clock,
        }),
    ).toThrowError(/多个 driver/);
  });

  it("logs in required capabilities through the static dependency graph once", async () => {
    const calls: string[] = [];
    const sessions = new MemorySessions();
    const coordinator = new AuthCoordinator({
      drivers: [
        new FakeDriver("sso", calls),
        new FakeDriver("sports", calls),
      ],
      sessions,
      clock,
    });

    const result = await coordinator.login(account, "sports");

    expect(result.capability).toBe("sports");
    expect(calls).toEqual(["sso.login", "sports.login"]);
    expect((await sessions.list(account)).map((item) => item.capability)).toEqual([
      "sso",
      "sports",
    ]);
  });

  it("refreshes only SSO and already-used SSO descendants by default", async () => {
    const calls: string[] = [];
    const sessions = new MemorySessions();
    for (const capability of ["sso", "sports"] as const) {
      await sessions.put(account, metadata(capability));
    }
    const coordinator = new AuthCoordinator({
      drivers: ["sso", "sports"].map(
        (capability) => new FakeDriver(capability as AuthCapability, calls),
      ),
      sessions,
      clock,
    });

    const refreshed = await coordinator.refresh(account);

    expect(refreshed.map((item) => item.capability)).toEqual(["sso", "sports"]);
    expect(calls).toEqual(["sso.refresh", "sports.refresh"]);
  });

  it("cascades SSO logout to dependent sessions", async () => {
    const calls: string[] = [];
    const sessions = new MemorySessions();
    for (const capability of ["sso", "sports"] as const) {
      await sessions.put(account, metadata(capability));
    }
    const coordinator = new AuthCoordinator({
      drivers: ["sso", "sports"].map(
        (capability) => new FakeDriver(capability as AuthCapability, calls),
      ),
      sessions,
      clock,
    });

    expect(await coordinator.logout(account, "sso")).toEqual(["sports", "sso"]);
    expect(calls).toEqual(["sports.logout", "sso.logout"]);
    expect(await sessions.list(account)).toEqual([]);
  });

  it("refreshes a stale read", async () => {
    const calls: string[] = [];
    const sessions = new MemorySessions();
    await sessions.put(
      account,
      metadata("sso", "2026-09-04T11:59:00.000Z"),
    );
    const driver = new FakeDriver("sso", calls);
    const coordinator = new AuthCoordinator({
      drivers: [driver],
      sessions,
      clock,
    });

    expect((await coordinator.forRead(account, "sso")).status).toBe("valid");
    expect(calls).toEqual(["sso.refresh"]);
  });

  it("online-probes each configured capability for status", async () => {
    const calls: string[] = [];
    const sessions = new MemorySessions();
    await sessions.put(account, metadata("sso"));
    await sessions.put(account, metadata("sports"));
    const coordinator = new AuthCoordinator({
      drivers: [
        new FakeDriver("sso", calls),
        new FakeDriver("sports", calls),
      ],
      sessions,
      clock,
    });

    const status = await coordinator.status(account);

    expect(status.map((item) => item.capability)).toEqual(["sso", "sports"]);
    expect(calls).toEqual(["sso.probe", "sports.probe"]);
  });

  it("does not turn a failed login observation into valid metadata", async () => {
    const sessions = new MemorySessions();
    const driver = new FakeDriver("sso");
    driver.loginObservation = { status: "expired", refreshAfter: null };
    const coordinator = new AuthCoordinator({
      drivers: [driver],
      sessions,
      clock,
    });

    await expect(coordinator.login(account)).rejects.toMatchObject({
      code: "AUTH_EXPIRED",
    });
    expect(await sessions.list(account)).toEqual([]);
  });
});

class FakeDriver implements AuthSessionDriver {
  loginObservation: SessionObservation = observation();
  probeObservation: SessionObservation = observation();

  constructor(
    readonly capability: AuthCapability,
    private readonly calls: string[] = [],
  ) {}

  async login(_account: AccountRecord): Promise<SessionObservation> {
    this.calls.push(`${this.capability}.login`);
    return this.loginObservation;
  }

  async probe(_account: AccountRecord): Promise<SessionObservation> {
    this.calls.push(`${this.capability}.probe`);
    return this.probeObservation;
  }

  async refresh(_account: AccountRecord): Promise<SessionObservation> {
    this.calls.push(`${this.capability}.refresh`);
    return observation();
  }

  async logout(_account: AccountRecord): Promise<void> {
    this.calls.push(`${this.capability}.logout`);
  }
}

class MemorySessions implements SessionMetadataStore {
  private readonly values = new Map<string, SessionMetadata>();

  async get(account: AccountRecord, capability: AuthCapability) {
    return this.values.get(`${account.name}:${capability}`);
  }

  async list(account: AccountRecord) {
    return [...this.values.entries()]
      .filter(([key]) => key.startsWith(`${account.name}:`))
      .map(([, value]) => value);
  }

  async put(account: AccountRecord, value: SessionMetadata) {
    this.values.set(`${account.name}:${value.capability}`, value);
  }

  async delete(account: AccountRecord, capability: AuthCapability) {
    this.values.delete(`${account.name}:${capability}`);
  }
}

function observation(): SessionObservation {
  return {
    status: "valid",
    refreshAfter: new Date("2026-09-04T13:00:00.000Z"),
  };
}

function metadata(
  capability: AuthCapability,
  refreshAfter = "2026-09-04T13:00:00.000Z",
): SessionMetadata {
  return {
    capability,
    refreshAfter,
    status: "valid",
  };
}

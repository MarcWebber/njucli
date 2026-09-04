import { AppError } from "../core/errors.js";
import {
  AUTH_CAPABILITIES,
  type AuthCapability,
} from "./types.js";

export const AUTH_DEPENDENCIES: Readonly<Record<AuthCapability, readonly AuthCapability[]>> = {
  sso: [],
  vpn: ["sso"],
  ehall: ["sso"],
  timetable: ["ehall"],
  sports: ["sso"],
  opac: ["vpn"],
};

const AUTH_CAPABILITY_SET = new Set<string>(AUTH_CAPABILITIES);

export function parseAuthCapability(value: string): AuthCapability {
  if (!AUTH_CAPABILITY_SET.has(value)) {
    throw new AppError("AUTH_CAPABILITY_UNKNOWN", `未知认证能力: ${value}`, {
      details: { supported: AUTH_CAPABILITIES },
    });
  }
  return value as AuthCapability;
}

export function orderCapabilities(capabilities: Iterable<AuthCapability>): AuthCapability[] {
  const requested = new Set(capabilities);
  return AUTH_CAPABILITIES.filter((capability) => requested.has(capability));
}

export function dependsOn(
  capability: AuthCapability,
  ancestor: AuthCapability,
): boolean {
  const visited = new Set<AuthCapability>();
  const pending = [...AUTH_DEPENDENCIES[capability]];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === ancestor) return true;
    visited.add(current);
    pending.push(...AUTH_DEPENDENCIES[current]);
  }
  return false;
}

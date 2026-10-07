import { AppError } from "../core/errors.js";
import {
  AUTH_CAPABILITIES,
  type AuthCapability,
} from "./types.js";

export const AUTH_DEPENDENCIES: Readonly<Record<AuthCapability, readonly AuthCapability[]>> = {
  sso: [],
  selection: [],
  vpn: ["sso"],
  ehall: ["sso"],
  softse: ["sso"],
  tex: ["sso"],
  timetable: ["ehall"],
  sports: ["sso"],
  youth: ["sso"],
  opac: ["vpn"],
};

export function parseAuthCapability(value: string): AuthCapability {
  if (!(AUTH_CAPABILITIES as readonly string[]).includes(value)) {
    throw new AppError("AUTH_CAPABILITY_UNKNOWN", `未知认证能力: ${value}`, {
      details: { supported: AUTH_CAPABILITIES },
    });
  }
  return value as AuthCapability;
}

export function dependsOn(
  capability: AuthCapability,
  ancestor: AuthCapability,
): boolean {
  return AUTH_DEPENDENCIES[capability].some(
    (parent) => parent === ancestor || dependsOn(parent, ancestor),
  );
}

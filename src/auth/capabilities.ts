import type { AuthCapability } from "./types.js";

export const AUTH_DEPENDENCIES: Readonly<Record<AuthCapability, readonly AuthCapability[]>> = {
  sso: [],
  selection: [],
  vpn: ["sso"],
  ehall: ["sso"],
  softse: ["sso"],
  tex: ["sso"],
  box: [],
  timetable: ["ehall"],
  sports: ["sso"],
  opac: ["vpn"],
};

export function dependsOn(
  capability: AuthCapability,
  ancestor: AuthCapability,
): boolean {
  return AUTH_DEPENDENCIES[capability].some(
    (parent) => parent === ancestor || dependsOn(parent, ancestor),
  );
}

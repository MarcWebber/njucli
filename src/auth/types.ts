import type { AccountRecord } from "../account/types.js";

export const AUTH_CAPABILITIES = [
  "sso",
  "selection",
  "vpn",
  "ehall",
  "softse",
  "tex",
  "timetable",
  "sports",
  "youth",
  "opac",
] as const;

export type AuthCapability = (typeof AUTH_CAPABILITIES)[number];

export interface SessionMetadata {
  capability: AuthCapability;
  status: "valid" | "expired" | "logged-out";
}

export interface AuthSessionDriver {
  login(account: AccountRecord): Promise<boolean>;
  probe(account: AccountRecord): Promise<boolean>;
  logout?(account: AccountRecord): Promise<void>;
}

export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthMaintenance {
  checkedAt: string;
  action: "kept-alive" | "restored";
  status: "valid";
}

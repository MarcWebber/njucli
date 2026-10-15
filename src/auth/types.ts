import type { AccountRecord } from "../account/types.js";
import type { AUTH_SITES } from "./capabilities.js";

export type AuthCapability = keyof typeof AUTH_SITES;

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

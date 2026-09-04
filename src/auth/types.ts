import type { AccountRecord } from "../account/types.js";

export const AUTH_CAPABILITIES = [
  "sso",
  "vpn",
  "ehall",
  "timetable",
  "sports",
  "opac",
] as const;

export type AuthCapability = (typeof AUTH_CAPABILITIES)[number];

export type SessionStatus = "valid" | "expired";
export const SESSION_REFRESH_MILLISECONDS = 15 * 60 * 1000;

export type SessionMetadata =
  | { capability: AuthCapability; status: "valid"; refreshAfter: string }
  | { capability: AuthCapability; status: "expired"; refreshAfter: null };

export type SessionObservation =
  | { status: "valid"; refreshAfter: Date }
  | { status: "expired"; refreshAfter: null };

export interface AuthSessionDriver {
  readonly capability: AuthCapability;
  login(account: AccountRecord): Promise<SessionObservation>;
  probe(account: AccountRecord): Promise<SessionObservation>;
  refresh?(account: AccountRecord): Promise<SessionObservation>;
  logout?(account: AccountRecord): Promise<void>;
}

export interface SessionMetadataStore {
  get(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata | undefined>;
  list(account: AccountRecord): Promise<SessionMetadata[]>;
  put(account: AccountRecord, metadata: SessionMetadata): Promise<void>;
  delete(account: AccountRecord, capability: AuthCapability): Promise<void>;
}

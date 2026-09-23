import { join } from "node:path";
import { z } from "zod";

import type { AccountRecord } from "../account/types.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import { AUTH_CAPABILITIES, type AuthCapability, type SessionMetadata } from "./types.js";

const sessionsSchema = z.array(z.object({
  capability: z.enum(AUTH_CAPABILITIES),
  status: z.enum(["valid", "expired", "logged-out"]),
}));

export class SessionStore {
  async get(account: AccountRecord, capability: AuthCapability): Promise<SessionMetadata | undefined> {
    return (await this.list(account)).find((session) => session.capability === capability);
  }

  async list(account: AccountRecord): Promise<SessionMetadata[]> {
    const value = await readJsonFile<unknown>(join(account.configDir, "sessions.json"));
    return value === undefined ? [] : sessionsSchema.parse(value);
  }

  async put(account: AccountRecord, metadata: SessionMetadata): Promise<void> {
    const sessions = (await this.list(account)).filter((session) => session.capability !== metadata.capability);
    sessions.push(metadata);
    sessions.sort((a, b) => AUTH_CAPABILITIES.indexOf(a.capability) - AUTH_CAPABILITIES.indexOf(b.capability));
    await writeJsonFile(join(account.configDir, "sessions.json"), sessions);
  }
}

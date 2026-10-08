import { join } from "node:path";

import type { AccountRecord } from "../account/types.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import { AUTH_CAPABILITIES, type SessionMetadata } from "./types.js";

export class SessionStore {
  async list(account: AccountRecord): Promise<SessionMetadata[]> {
    const value = await readJsonFile<Array<SessionMetadata | { capability: "softse"; status: SessionMetadata["status"] }>>(join(account.configDir, "sessions.json"));
    const sessions = value ?? [];
    const hasSe = sessions.some((session) => session.capability === "se");
    return sessions.filter((session) => !hasSe || session.capability !== "softse")
      .map((session) => session.capability === "softse" ? { ...session, capability: "se" } : session);
  }

  async put(account: AccountRecord, metadata: SessionMetadata): Promise<void> {
    const sessions = (await this.list(account)).filter((session) => session.capability !== metadata.capability);
    sessions.push(metadata);
    sessions.sort((a, b) => AUTH_CAPABILITIES.indexOf(a.capability) - AUTH_CAPABILITIES.indexOf(b.capability));
    await writeJsonFile(join(account.configDir, "sessions.json"), sessions);
  }
}

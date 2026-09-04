import { join } from "node:path";

import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import { isRecord, isTimestamp } from "../core/guards.js";
import {
  AUTH_CAPABILITIES,
  type AuthCapability,
  type SessionMetadata,
  type SessionMetadataStore,
} from "./types.js";

export class JsonSessionMetadataStore implements SessionMetadataStore {
  async get(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<SessionMetadata | undefined> {
    return (await this.read(account)).find(
      (session) => session.capability === capability,
    );
  }

  async list(account: AccountRecord): Promise<SessionMetadata[]> {
    return (await this.read(account)).slice();
  }

  async put(account: AccountRecord, metadata: SessionMetadata): Promise<void> {
    if (!isSessionMetadata(metadata)) throw new AppError("INVALID_INPUT", "会话元数据无效");
    const sessions = (await this.read(account)).filter(
      (session) => session.capability !== metadata.capability,
    );
    sessions.push(metadata);
    await this.write(account, sortSessions(sessions));
  }

  async delete(
    account: AccountRecord,
    capability: AuthCapability,
  ): Promise<void> {
    await this.write(
      account,
      (await this.read(account)).filter((session) => session.capability !== capability),
    );
  }

  private async read(account: AccountRecord): Promise<SessionMetadata[]> {
    const path = sessionFilePath(account);
    let value: unknown;
    try {
      value = await readJsonFile<unknown>(path);
    } catch (error) {
      throw new AppError("INVALID_INPUT", "会话元数据无法读取", {
        cause: error,
        details: { path },
      });
    }

    if (value === undefined) return [];
    if (!isSessionFile(value)) {
      throw new AppError("INVALID_INPUT", "会话元数据格式无效", {
        details: { path },
      });
    }
    return value;
  }

  private async write(account: AccountRecord, sessions: SessionMetadata[]): Promise<void> {
    await writeJsonFile(sessionFilePath(account), sessions);
  }
}

function sessionFilePath(account: AccountRecord): string {
  return join(account.configDir, "sessions.json");
}

function sortSessions(sessions: SessionMetadata[]): SessionMetadata[] {
  return sessions.slice().sort(
    (left, right) =>
      AUTH_CAPABILITIES.indexOf(left.capability) -
      AUTH_CAPABILITIES.indexOf(right.capability),
  );
}

function isSessionFile(value: unknown): value is SessionMetadata[] {
  return Array.isArray(value) && value.every(isSessionMetadata);
}

function isSessionMetadata(value: unknown): value is SessionMetadata {
  if (!isRecord(value)) return false;
  if (
    typeof value.capability !== "string" ||
    !(AUTH_CAPABILITIES as readonly string[]).includes(value.capability)
  ) return false;
  return value.status === "valid"
    ? isTimestamp(value.refreshAfter)
    : value.status === "expired" && value.refreshAfter === null;
}

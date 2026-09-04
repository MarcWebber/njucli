import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { AccountRecord } from "../../src/account/types.js";
import { JsonSessionMetadataStore } from "../../src/auth/session-store.js";
import type { SessionMetadata } from "../../src/auth/types.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

describe("JsonSessionMetadataStore", () => {
  it("persists one metadata record per account and capability", async () => {
    const root = await mkdtemp(join(tmpdir(), "njucli-sessions-"));
    temporaryDirectories.push(root);
    const account = accountAt(root, "default");
    const other = accountAt(root, "other");
    const store = new JsonSessionMetadataStore();

    await store.put(account, session("sso"));
    await store.put(account, session("sso", "expired"));
    await store.put(other, session("sports"));

    expect(await store.list(account)).toEqual([
      session("sso", "expired"),
    ]);
    expect(await store.list(other)).toEqual([session("sports")]);

    await store.delete(account, "sso");
    expect(await store.list(account)).toEqual([]);
  });

});

function accountAt(root: string, name: string): AccountRecord {
  const configDir = join(root, name, "config");
  return {
    name,
    configDir,
    browserDataDir: join(root, name, "data", "browser"),
  };
}

function session(
  capability: SessionMetadata["capability"],
  status: SessionMetadata["status"] = "valid",
): SessionMetadata {
  return status === "valid"
    ? { capability, status, refreshAfter: "2026-09-04T13:00:00.000Z" }
    : { capability, status, refreshAfter: null };
}

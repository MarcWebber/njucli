import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { AccountStore } from "../../src/account/store.js";
import { AppError } from "../../src/core/errors.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) =>
      rm(path, { recursive: true, force: true }),
    ),
  );
});

describe("AccountStore", () => {
  it("creates and selects the default account on first resolution", async () => {
    const root = await temporaryRoot();
    const store = createStore(root);

    const account = await store.current();

    expect(account.name).toBe("default");
    expect(account.browserDataDir).toBe(
      join(root, "data", "accounts", "default", "browser"),
    );
    expect((await stat(account.configDir)).mode & 0o777).toBe(0o700);
    expect((await stat(account.browserDataDir)).mode & 0o777).toBe(0o700);
  });

  it("adds, lists and switches named accounts without a command-level account selector", async () => {
    const root = await temporaryRoot();
    const store = createStore(root);
    await store.current();
    await store.add("lab");

    expect((await store.current()).name).toBe("lab");
    expect((await store.list()).map((account) => account.name)).toEqual([
      "default",
      "lab",
    ]);

    await store.use("default");
    expect((await store.current()).name).toBe("default");
  });

  it("reads NJUCLI_ACCOUNT once and never falls back to persisted current", async () => {
    const root = await temporaryRoot();
    const setup = createStore(root);
    await setup.add("first");
    await setup.add("second");

    const env: Record<string, string | undefined> = { NJUCLI_ACCOUNT: "first" };
    const store = createStore(root, env);
    env.NJUCLI_ACCOUNT = "second";

    expect((await store.current()).name).toBe("first");

    const missing = createStore(root, { NJUCLI_ACCOUNT: "absent" });
    await expect(missing.current()).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
  });

  it("removes only a non-current account and its isolated storage", async () => {
    const root = await temporaryRoot();
    const store = createStore(root);
    const first = await store.add("first");
    await store.add("second");

    await store.remove("first");

    expect((await store.list()).map((account) => account.name)).toEqual([
      "second",
    ]);
    await expect(stat(first.configDir)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(store.remove("second")).rejects.toMatchObject({
      code: "ACCOUNT_IN_USE",
    });
  });

  it("rejects invalid and unknown account names with stable errors", async () => {
    const root = await temporaryRoot();
    const store = createStore(root);

    expect(() => createStore(root, { NJUCLI_ACCOUNT: "../escape" })).toThrow(
      AppError,
    );
    await expect(store.add("not allowed")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(store.use("missing")).rejects.toMatchObject({
      code: "ACCOUNT_NOT_FOUND",
    });
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "njucli-account-"));
  temporaryDirectories.push(root);
  return root;
}

function createStore(
  root: string,
  env: Record<string, string | undefined> = {},
): AccountStore {
  return new AccountStore({
    configRoot: join(root, "config"),
    dataRoot: join(root, "data"),
    env,
  });
}

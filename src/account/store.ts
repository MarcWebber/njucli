import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { AppError } from "../core/errors.js";
import { readJsonFile, removePath, writeJsonFile } from "../core/fs.js";
import { isRecord } from "../core/guards.js";
import type { AccountRecord } from "./types.js";

const DEFAULT_ACCOUNT = "default";
const ACCOUNT_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

interface AccountRegistry {
  current: string | null;
  accounts: string[];
}

export class AccountStore {
  private readonly configRoot: string;
  private readonly dataRoot: string;
  private readonly selectedByEnvironment: string | null;
  private readonly registryPath: string;

  constructor(options: {
    configRoot?: string;
    dataRoot?: string;
    env?: Readonly<Record<string, string | undefined>>;
  } = {}) {
    const env = options.env ?? process.env;
    const home = homedir();
    this.configRoot = options.configRoot ?? join(env.XDG_CONFIG_HOME || join(home, ".config"), "njucli");
    this.dataRoot = options.dataRoot ?? join(env.XDG_DATA_HOME || join(home, ".local", "share"), "njucli");
    this.registryPath = join(this.configRoot, "accounts.json");

    const selected = env.NJUCLI_ACCOUNT?.trim();
    this.selectedByEnvironment = selected ? validateAccountName(selected) : null;
  }

  async current(): Promise<AccountRecord> {
    const registry = await this.readRegistry();

    if (this.selectedByEnvironment) {
      if (!registry.accounts.includes(this.selectedByEnvironment)) {
        throw new AppError(
          "ACCOUNT_NOT_FOUND",
          `NJUCLI_ACCOUNT 指定的账号不存在: ${this.selectedByEnvironment}`,
          { hint: `运行 njucli account add ${this.selectedByEnvironment}` },
        );
      }
      return this.paths(this.selectedByEnvironment);
    }

    if (registry.accounts.length === 0) {
      return this.addToRegistry(registry, DEFAULT_ACCOUNT);
    }

    if (!registry.current) {
      throw new AppError("ACCOUNT_NOT_FOUND", "账号索引没有设置当前账号", {
        hint: "运行 njucli account use <name>",
      });
    }

    if (!registry.accounts.includes(registry.current)) {
      throw new AppError(
        "ACCOUNT_NOT_FOUND",
        `当前账号不存在: ${registry.current}`,
        { hint: "运行 njucli account use <name>" },
      );
    }
    return this.paths(registry.current);
  }

  async list(): Promise<AccountRecord[]> {
    const registry = await this.readRegistry();
    return registry.accounts
      .slice()
      .sort((left, right) => left.localeCompare(right, "en"))
      .map((account) => this.paths(account));
  }

  async add(name: string): Promise<AccountRecord> {
    const validatedName = validateAccountName(name);
    const registry = await this.readRegistry();
    if (registry.accounts.includes(validatedName)) {
      throw new AppError("ACCOUNT_EXISTS", `账号已存在: ${validatedName}`);
    }
    return this.addToRegistry(registry, validatedName);
  }

  async use(name: string): Promise<AccountRecord> {
    const validatedName = validateAccountName(name);
    const registry = await this.readRegistry();
    if (!registry.accounts.includes(validatedName)) {
      throw new AppError("ACCOUNT_NOT_FOUND", `账号不存在: ${validatedName}`, {
        hint: `运行 njucli account add ${validatedName}`,
      });
    }

    await this.writeRegistry({ ...registry, current: validatedName });
    return this.paths(validatedName);
  }

  async remove(name: string): Promise<void> {
    const validatedName = validateAccountName(name);
    const registry = await this.readRegistry();
    if (!registry.accounts.includes(validatedName)) {
      throw new AppError("ACCOUNT_NOT_FOUND", `账号不存在: ${validatedName}`);
    }

    if (
      this.selectedByEnvironment === validatedName ||
      registry.current === validatedName
    ) {
      throw new AppError("ACCOUNT_IN_USE", `不能删除当前账号: ${validatedName}`, {
        hint: "先运行 njucli account use <other-name>",
      });
    }

    const accounts = registry.accounts.filter((account) => account !== validatedName);
    await this.writeRegistry({ ...registry, accounts });

    const paths = this.paths(validatedName);
    await removePath(paths.configDir);
    await removePath(dirname(paths.browserDataDir));
  }

  private async addToRegistry(
    registry: AccountRegistry,
    name: string,
  ): Promise<AccountRecord> {
    const paths = this.paths(name);

    await mkdir(paths.configDir, { recursive: true, mode: 0o700 });
    await mkdir(paths.browserDataDir, { recursive: true, mode: 0o700 });

    await this.writeRegistry({
      current: name,
      accounts: [...registry.accounts, name],
    });
    return paths;
  }

  private async readRegistry(): Promise<AccountRegistry> {
    let value: unknown;
    try {
      value = await readJsonFile<unknown>(this.registryPath);
    } catch (error) {
      throw new AppError("INVALID_INPUT", "账号索引无法读取", { cause: error });
    }

    if (value === undefined) return emptyRegistry();
    if (!isAccountRegistry(value)) {
      throw new AppError("INVALID_INPUT", "账号索引格式无效", {
        details: { path: this.registryPath },
      });
    }
    return value;
  }

  private async writeRegistry(registry: AccountRegistry): Promise<void> {
    await writeJsonFile(this.registryPath, registry);
  }

  private paths(name: string): AccountRecord {
    return {
      name,
      configDir: join(this.configRoot, "accounts", name),
      browserDataDir: join(this.dataRoot, "accounts", name, "browser"),
    };
  }
}

function validateAccountName(name: string): string {
  const normalized = name.trim();
  if (!ACCOUNT_NAME_PATTERN.test(normalized)) {
    throw new AppError(
      "INVALID_INPUT",
      "账号名只能包含字母、数字、点、下划线和连字符，且最长 64 个字符",
    );
  }
  return normalized;
}

function emptyRegistry(): AccountRegistry {
  return { current: null, accounts: [] };
}

function isAccountRegistry(value: unknown): value is AccountRegistry {
  if (!isRecord(value)) return false;
  if (!(value.current === null || typeof value.current === "string")) return false;
  if (!Array.isArray(value.accounts)) return false;

  const names = new Set<string>();
  for (const account of value.accounts) {
    if (typeof account !== "string" || !ACCOUNT_NAME_PATTERN.test(account) || names.has(account)) return false;
    names.add(account);
  }

  return value.current === null || names.has(value.current);
}

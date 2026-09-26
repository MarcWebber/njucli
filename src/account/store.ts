import { mkdir, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { AppError } from "../core/errors.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import type { AccountRecord } from "./types.js";

interface AccountRegistry {
  current: string | null;
  accounts: string[];
}

export class AccountStore {
  private readonly configRoot = join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "njucli");
  private readonly dataRoot = join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "njucli");
  private readonly selected = process.env.NJUCLI_ACCOUNT?.trim() || undefined;
  private readonly registryPath = join(this.configRoot, "accounts.json");

  async current(): Promise<AccountRecord> {
    const registry = await this.readRegistry();
    if (this.selected) return this.existing(registry, this.selected);
    if (!registry.accounts.length) return this.add("default");
    return this.paths(registry.current ?? registry.accounts[0]!);
  }

  async list(): Promise<AccountRecord[]> {
    return (await this.readRegistry()).accounts.sort().map((name) => this.paths(name));
  }

  async add(name: string): Promise<AccountRecord> {
    name = name.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(name)) throw new AppError("INVALID_INPUT", "账号名应为 1–64 个字母、数字、点、下划线或连字符，以字母或数字开头");
    const registry = await this.readRegistry();
    if (registry.accounts.includes(name)) throw new AppError("ACCOUNT_EXISTS", `账号已存在: ${name}`);
    const account = this.paths(name);
    await mkdir(account.configDir, { recursive: true });
    await mkdir(account.browserDataDir, { recursive: true });
    await writeJsonFile(this.registryPath, { current: name, accounts: [...registry.accounts, name] });
    return account;
  }

  async use(name: string): Promise<AccountRecord> {
    const registry = await this.readRegistry();
    const account = this.existing(registry, name.trim());
    await writeJsonFile(this.registryPath, { ...registry, current: account.name });
    return account;
  }

  async remove(name: string): Promise<void> {
    const registry = await this.readRegistry();
    const account = this.existing(registry, name.trim());
    const accounts = registry.accounts.filter((entry) => entry !== account.name);
    await rm(account.configDir, { recursive: true, force: true });
    await rm(dirname(account.browserDataDir), { recursive: true, force: true });
    await writeJsonFile(this.registryPath, {
      accounts, current: registry.current === account.name ? accounts[0] ?? null : registry.current,
    });
  }

  private async readRegistry(): Promise<AccountRegistry> {
    return await readJsonFile<AccountRegistry>(this.registryPath) ?? { current: null, accounts: [] };
  }

  private existing(registry: AccountRegistry, name: string): AccountRecord {
    if (!registry.accounts.includes(name)) throw new AppError("ACCOUNT_NOT_FOUND", `账号不存在: ${name}`);
    return this.paths(name);
  }

  private paths(name: string): AccountRecord {
    return { name, configDir: join(this.configRoot, "accounts", name), browserDataDir: join(this.dataRoot, "accounts", name, "browser") };
  }
}

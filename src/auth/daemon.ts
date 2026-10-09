import { execFile } from "node:child_process";
import { mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { setTimeout as delay } from "node:timers/promises";
import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { readJsonFile, saveFile, writeJsonFile } from "../core/fs.js";
import { renderError, renderSuccess, type OutputSink } from "../core/output.js";
import type { AuthCredentials, AuthMaintenance } from "./types.js";

export interface AuthDaemonStatus {
  account: string;
  enabled: boolean;
  running: boolean;
  label: string;
  plistPath: string;
  logPath: string;
  intervalSeconds?: number;
  pid?: number;
  lastSuccess?: AuthMaintenance;
  lastResult?: unknown;
}

interface DaemonProcess {
  pid: number;
  intervalSeconds: number;
}

export async function runAuthDaemon(
  account: AccountRecord,
  maintain: () => Promise<AuthMaintenance>,
  intervalSeconds: number,
  signal: AbortSignal,
  output: OutputSink,
): Promise<void> {
  const path = join(account.configDir, "auth-daemon.json");
  await writeJsonFile(path, { pid: process.pid, intervalSeconds } satisfies DaemonProcess);
  try {
    while (!signal.aborted) {
      try {
        const data = await maintain();
        renderSuccess(output, "json", { data, text: "已维护统一认证会话" });
      } catch (error) {
        if (error instanceof AppError && ["AUTH_REJECTED", "AUTH_REQUIRED", "USER_ACTION_REQUIRED"].includes(error.code)) throw error;
        renderError(output, "json", error);
      }
      if (signal.aborted) break;
      try { await delay(intervalSeconds * 1000, undefined, { signal }); }
      catch (error) { if (!signal.aborted) throw error; }
    }
  } finally {
    await rm(path, { force: true });
  }
}

export async function startAuthDaemon(account: AccountRecord, intervalSeconds: number): Promise<AuthDaemonStatus> {
  const paths = daemonPaths(account);
  if (await isLoaded(paths.target)) {
    throw new AppError("INVALID_INPUT", "后台保活已启用；调整间隔时请先运行 auth daemon stop");
  }
  const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
  if (!credentials?.username || !credentials.password) {
    throw new AppError("AUTH_REQUIRED", "请先保存统一认证账号密码，以便后台恢复过期会话");
  }
  const entry = await realpath(resolve(process.argv[1]!));
  if (entry.endsWith(".ts")) throw new AppError("INVALID_INPUT", "请通过构建后的 CLI 或 Skill 入口启动后台保活");
  await mkdir(dirname(paths.plistPath), { recursive: true });
  await mkdir(account.configDir, { recursive: true });
  await (await open(paths.logPath, "a", 0o600)).close();
  await saveFile(paths.plistPath, JSON.stringify({
    Label: paths.label,
    ProgramArguments: [process.execPath, entry, "auth", "daemon", "run", "--interval", String(intervalSeconds), "--format", "json"],
    EnvironmentVariables: {
      NJUCLI_ACCOUNT: account.name,
      XDG_CONFIG_HOME: resolve(account.configDir, "../../.."),
      XDG_DATA_HOME: resolve(account.browserDataDir, "../../../.."),
    },
    RunAtLoad: true,
    KeepAlive: { Crashed: true },
    StandardOutPath: paths.logPath,
    StandardErrorPath: paths.logPath,
    Umask: 0o077,
  }));
  try {
    await promisify(execFile)("/usr/bin/plutil", ["-convert", "xml1", paths.plistPath]);
    await promisify(execFile)("/bin/launchctl", ["bootstrap", paths.domain, paths.plistPath]);
  } catch (error) {
    await rm(paths.plistPath, { force: true });
    throw error;
  }
  return authDaemonStatus(account);
}

export async function authDaemonStatus(account: AccountRecord): Promise<AuthDaemonStatus> {
  const paths = daemonPaths(account);
  const result: AuthDaemonStatus = {
    account: account.name,
    enabled: await isLoaded(paths.target),
    running: false,
    label: paths.label,
    plistPath: paths.plistPath,
    logPath: paths.logPath,
  };
  const plist = await readFile(paths.plistPath, "utf8").catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
    return undefined;
  });
  if (plist !== undefined) {
    const { stdout } = await promisify(execFile)("/usr/bin/plutil", ["-convert", "json", "-o", "-", paths.plistPath]);
    const { ProgramArguments: args } = JSON.parse(stdout) as { ProgramArguments: string[] };
    result.intervalSeconds = Number(args[args.indexOf("--interval") + 1]);
  }
  const worker = await readJsonFile<DaemonProcess>(join(account.configDir, "auth-daemon.json"));
  if (worker && isRunning(worker.pid)) {
    result.running = true;
    result.pid = worker.pid;
    result.intervalSeconds = worker.intervalSeconds;
  }
  const lastSuccess = await readJsonFile<AuthMaintenance>(join(account.configDir, "auth-maintenance.json"));
  if (lastSuccess) result.lastSuccess = lastSuccess;
  try {
    const line = (await readFile(paths.logPath, "utf8")).trim().split("\n").at(-1);
    if (line) {
      try { result.lastResult = JSON.parse(line) as unknown; }
      catch { result.lastResult = { ok: false, error: { message: "后台进程异常退出，请查看日志" } }; }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result;
}

export async function stopAuthDaemon(account: AccountRecord): Promise<AuthDaemonStatus> {
  const paths = daemonPaths(account);
  if (await isLoaded(paths.target)) await promisify(execFile)("/bin/launchctl", ["bootout", paths.target]);
  const processPath = join(account.configDir, "auth-daemon.json");
  const worker = await readJsonFile<DaemonProcess>(processPath);
  const deadline = Date.now() + 35_000;
  while (await isLoaded(paths.target) || (worker && isRunning(worker.pid))) {
    if (Date.now() >= deadline) throw new AppError("REMOTE_UNAVAILABLE", "CLI 后台进程停止超时，请查看后台状态和日志");
    await delay(100);
  }
  await rm(processPath, { force: true });
  await rm(paths.plistPath, { force: true });
  return authDaemonStatus(account);
}

function isRunning(pid: number): boolean {
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function daemonPaths(account: AccountRecord) {
  if (process.platform !== "darwin") throw new AppError("INVALID_INPUT", "后台保活服务使用 macOS launchd，请在 macOS 上运行");
  const label = `cn.edu.nju.njucli.auth.${account.name}`;
  const domain = `gui/${process.getuid!()}`;
  return {
    label, domain, target: `${domain}/${label}`,
    plistPath: join(homedir(), "Library", "LaunchAgents", `${label}.plist`),
    logPath: join(account.configDir, "auth-daemon.log"),
  };
}

async function isLoaded(target: string): Promise<boolean> {
  try {
    await promisify(execFile)("/bin/launchctl", ["print", target]);
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 113) return false;
    throw error;
  }
}

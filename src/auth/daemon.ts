import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { open, readFile, realpath, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { readJsonFile, writeJsonFile } from "../core/fs.js";
import { renderError, renderSuccess, type OutputSink } from "../core/output.js";
import { lockAccount } from "./account-lock.js";
import type { AuthCredentials, AuthMaintenance } from "./types.js";

export interface AuthDaemonStatus {
  account: string;
  running: boolean;
  processPath: string;
  logPath: string;
  intervalSeconds?: number;
  pid?: number;
  lastSuccess?: AuthMaintenance;
  lastResult?: unknown;
}

interface DaemonProcess {
  pid: number;
  intervalSeconds: number;
  port: number;
  token: string;
}

export async function runAuthDaemon(
  account: AccountRecord,
  maintain: () => Promise<AuthMaintenance>,
  intervalSeconds: number,
  signal: AbortSignal,
  output: OutputSink,
): Promise<void> {
  const paths = daemonPaths(account);
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop, { once: true });
  if (signal.aborted) stop();
  const token = randomUUID();
  // A private loopback endpoint identifies this worker before requesting a stop; stale PIDs are never signalled.
  const server = createServer((request, response) => {
    response.setHeader("Connection", "close");
    if (request.headers.authorization !== `Bearer ${token}`) {
      response.writeHead(403).end();
    } else if (request.method === "GET" && request.url === "/status") {
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ pid: process.pid, intervalSeconds }));
    } else if (request.method === "POST" && request.url === "/stop") {
      response.writeHead(204).end();
      stop();
    } else response.writeHead(404).end();
  });
  let registered = false;
  try {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("后台控制接口启动失败");
    await writeJsonFile(paths.processPath, { pid: process.pid, intervalSeconds, port: address.port, token } satisfies DaemonProcess);
    registered = true;
    process.send?.({ ready: true });
    while (!controller.signal.aborted) {
      try {
        const data = await maintain();
        renderSuccess(output, "json", { data, text: "已维护统一认证会话" });
      } catch (error) {
        if (error instanceof AppError && ["AUTH_REJECTED", "AUTH_REQUIRED", "USER_ACTION_REQUIRED"].includes(error.code)) throw error;
        renderError(output, "json", error);
      }
      if (controller.signal.aborted) break;
      try { await delay(intervalSeconds * 1000, undefined, { signal: controller.signal }); }
      catch (error) { if (!controller.signal.aborted) throw error; }
    }
  } finally {
    signal.removeEventListener("abort", stop);
    await new Promise<void>((resolve) => { server.close(() => resolve()); server.closeAllConnections(); });
    if (registered) await rm(paths.processPath, { force: true });
  }
}

export async function startAuthDaemon(account: AccountRecord, intervalSeconds: number): Promise<AuthDaemonStatus> {
  const paths = daemonPaths(account);
  const unlock = await lockAccount(paths.directory);
  try {
    if ((await authDaemonStatus(account)).running) {
      throw new AppError("INVALID_INPUT", "后台保活已运行；调整间隔时请先运行 auth daemon stop");
    }
    const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
    if (!credentials?.username || !credentials.password) {
      throw new AppError("AUTH_REQUIRED", "请先保存统一认证账号密码，以便后台恢复过期会话");
    }
    const entry = await realpath(resolve(process.argv[1]!));
    if (entry.endsWith(".ts")) throw new AppError("INVALID_INPUT", "请通过构建后的 CLI 或 Skill 入口启动后台保活");
    const log = await open(paths.logPath, "a", 0o600);
    try {
      const child = fork(entry, ["auth", "daemon", "run", "--interval", String(intervalSeconds), "--format", "json"], {
        detached: true,
        cwd: account.configDir,
        execArgv: [],
        stdio: ["ignore", log.fd, log.fd, "ipc"],
        env: {
          ...process.env,
          NJUCLI_ACCOUNT: account.name,
          XDG_CONFIG_HOME: resolve(account.configDir, "../../.."),
          XDG_DATA_HOME: resolve(account.browserDataDir, "../../../.."),
        },
      });
      child.unref();
      try { await waitForReady(child); }
      catch (error) {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        throw error;
      } finally { if (child.connected) child.disconnect(); }
    } finally { await log.close(); }
    const status = await authDaemonStatus(account);
    if (!status.running) throw new AppError("REMOTE_UNAVAILABLE", "后台进程启动后退出，请查看日志");
    return status;
  } finally { await unlock(); }
}

export async function authDaemonStatus(account: AccountRecord): Promise<AuthDaemonStatus> {
  const paths = daemonPaths(account);
  const result: AuthDaemonStatus = { account: account.name, running: false, processPath: paths.processPath, logPath: paths.logPath };
  const worker = await readJsonFile<DaemonProcess>(paths.processPath);
  if (worker && isRunning(worker.pid)) {
    const response = await control(worker, "status");
    const status = await response.json() as { pid: number; intervalSeconds: number };
    if (status.pid !== worker.pid || status.intervalSeconds !== worker.intervalSeconds) throw new AppError("REMOTE_UNAVAILABLE", "后台进程身份与记录不一致");
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
  const unlock = await lockAccount(paths.directory);
  try {
    const worker = await readJsonFile<DaemonProcess>(paths.processPath);
    if (worker && isRunning(worker.pid)) {
      await control(worker, "stop");
      const deadline = Date.now() + 35_000;
      while (isRunning(worker.pid)) {
        if (Date.now() >= deadline) throw new AppError("REMOTE_UNAVAILABLE", "CLI 后台进程仍在结束当前维护，请稍后查看状态和日志");
        await delay(100);
      }
    }
    await rm(paths.processPath, { force: true });
    return authDaemonStatus(account);
  } finally { await unlock(); }
}

async function control(worker: DaemonProcess, action: "status" | "stop"): Promise<Response> {
  try {
    if (!Number.isInteger(worker.port) || worker.port < 1 || worker.port > 65535 || typeof worker.token !== "string") throw new Error("invalid process record");
    const response = await fetch(`http://127.0.0.1:${worker.port}/${action}`, {
      method: action === "stop" ? "POST" : "GET",
      headers: { Authorization: `Bearer ${worker.token}` },
      signal: AbortSignal.timeout(3000),
      redirect: "error",
    });
    if (!response.ok) throw new Error("control request rejected");
    return response;
  } catch {
    throw new AppError("REMOTE_UNAVAILABLE", "无法确认后台进程身份，请检查账号目录中的进程记录");
  }
}

function waitForReady(child: ChildProcess): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      child.removeListener("message", ready);
      child.removeListener("error", failed);
      child.removeListener("exit", exited);
      if (error) reject(error); else resolve();
    };
    const ready = (message: unknown) => { if (typeof message === "object" && message !== null && "ready" in message && message.ready === true) finish(); };
    const failed = (error: Error) => finish(error);
    const exited = () => finish(new AppError("REMOTE_UNAVAILABLE", "后台进程启动失败，请查看日志"));
    const timer = setTimeout(() => finish(new AppError("REMOTE_UNAVAILABLE", "后台进程启动超时，请查看日志")), 15_000);
    child.once("message", ready);
    child.once("error", failed);
    child.once("exit", exited);
  });
}

function isRunning(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

function daemonPaths(account: AccountRecord) {
  const directory = join(account.configDir, "auth-daemon");
  return { directory, processPath: join(directory, "process.json"), logPath: join(directory, "output.log") };
}

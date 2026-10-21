import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { access, mkdir, realpath, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { AccountRecord } from "../account/types.js";
import { AppError } from "../core/errors.js";
import { readJsonFile, saveFile } from "../core/fs.js";
import type { AuthCredentials } from "./types.js";
import { authDaemonStatus, stopAuthDaemon } from "./daemon.js";

const execute = promisify(execFile);
export type AutostartAction = "enable" | "disable" | "status";

export async function authAutostart(account: AccountRecord, action: AutostartAction, intervalSeconds = 600) {
  if (process.platform === "linux" || process.platform === "win32") return platformAutostart(account, action, intervalSeconds);
  if (process.platform !== "darwin") throw new AppError("INVALID_INPUT", "后台保活自启动支持 macOS、Linux 与 Windows");
  const label = `cn.nju.njucli.auth.${account.name}`;
  const path = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
  const domain = `gui/${process.getuid!()}`;
  const target = `${domain}/${label}`;
  let enabled = false;
  try { await access(path); enabled = true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  let loaded = false;
  try { await execute("/bin/launchctl", ["print", target]); loaded = true; }
  catch (error) { if (typeof (error as { code?: unknown }).code !== "number") throw error; }
  if (action === "enable") {
    const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
    if (!credentials?.username || !credentials.password) throw new AppError("AUTH_REQUIRED", "请先保存统一认证账号密码");
    const entry = await realpath(resolve(process.argv[1]!));
    if (entry.endsWith(".ts")) throw new AppError("INVALID_INPUT", "请通过构建后的 CLI 或 Skill 入口设置自启动");
    const logPath = join(account.configDir, "auth-daemon", "output.log");
    const env = {
      NJUCLI_ACCOUNT: account.name,
      XDG_CONFIG_HOME: resolve(account.configDir, "../../.."),
      XDG_DATA_HOME: resolve(account.browserDataDir, "../../../.."),
      ...(process.env.NJUCLI_BROWSER_EXECUTABLE ? { NJUCLI_BROWSER_EXECUTABLE: process.env.NJUCLI_BROWSER_EXECUTABLE } : {}),
    };
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${escapeXml(label)}</string>
<key>ProgramArguments</key><array>${[process.execPath, entry, "auth", "daemon", "run", "--foreground", "--interval", String(intervalSeconds), "--format", "json"].map(v => `<string>${escapeXml(v)}</string>`).join("")}</array>
<key>EnvironmentVariables</key><dict>${Object.entries(env).map(([k,v]) => `<key>${escapeXml(k)}</key><string>${escapeXml(v)}</string>`).join("")}</dict>
<key>WorkingDirectory</key><string>${escapeXml(account.configDir)}</string>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${escapeXml(logPath)}</string>
<key>StandardErrorPath</key><string>${escapeXml(logPath)}</string>
</dict></plist>
`;
    await mkdir(dirname(path), { recursive: true });
    await mkdir(dirname(logPath), { recursive: true });
    // Create the log with private permissions before launchd opens it.
    try { await access(logPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await saveFile(logPath, "");
    }
    if ((await authDaemonStatus(account)).running) await stopAuthDaemon(account);
    if (loaded) await execute("/bin/launchctl", ["bootout", target]);
    await saveFile(path, xml);
    await execute("/bin/launchctl", ["enable", target]);
    await execute("/bin/launchctl", ["bootstrap", domain, path]);
    enabled = true;
    loaded = true;
  } else if (action === "disable") {
    if ((await authDaemonStatus(account)).running) await stopAuthDaemon(account);
    if (loaded) await execute("/bin/launchctl", ["bootout", target]);
    await rm(path, { force: true });
    enabled = false;
    loaded = false;
  }
  return { account: account.name, enabled, loaded, path };
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

async function platformAutostart(account: AccountRecord, action: AutostartAction, intervalSeconds: number) {
  const windows = process.platform === "win32";
  const name = windows ? `NjuCLI-${process.env.USERNAME}-${account.name}` : `njucli-auth-${account.name}.service`;
  const launcher = join(account.configDir, "auth-daemon", "autostart.mjs");
  const path = windows ? launcher : join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), "systemd", "user", name);
  const task = psQuote(name);
  let enabled: boolean;
  let loaded: boolean;
  if (windows) {
    const { stdout } = await powershell(`$task = Get-ScheduledTask -TaskPath '\\' | Where-Object { $_.TaskName -eq ${task} }; @{ enabled = ($null -ne $task -and $task.State -ne 'Disabled'); loaded = ($null -ne $task) } | ConvertTo-Json -Compress`);
    ({ enabled, loaded } = JSON.parse(stdout.trim()) as { enabled: boolean; loaded: boolean });
  } else {
    const { stdout } = await execute("systemctl", ["--user", "show", name, "--property=LoadState,UnitFileState"]).catch((error: unknown) => {
      const output = (error as { stdout?: string }).stdout;
      if (output?.includes("LoadState=not-found")) return { stdout: output };
      throw error;
    });
    enabled = stdout.includes("UnitFileState=enabled");
    loaded = stdout.includes("LoadState=loaded");
  }
  if (action === "enable") {
    const credentials = await readJsonFile<AuthCredentials>(join(account.configDir, "auth.json"));
    if (!credentials?.username || !credentials.password) throw new AppError("AUTH_REQUIRED", "请先保存统一认证账号密码");
    const entry = await realpath(resolve(process.argv[1]!));
    if (entry.endsWith(".ts")) throw new AppError("INVALID_INPUT", "请通过构建后的 CLI 或 Skill 入口设置自启动");
    const env = {
      NJUCLI_ACCOUNT: account.name,
      XDG_CONFIG_HOME: resolve(account.configDir, "../../.."),
      XDG_DATA_HOME: resolve(account.browserDataDir, "../../../.."),
      ...(process.env.NJUCLI_BROWSER_EXECUTABLE ? { NJUCLI_BROWSER_EXECUTABLE: process.env.NJUCLI_BROWSER_EXECUTABLE } : {}),
    };
    const args = [entry, "auth", "daemon", "run", "--foreground", "--interval", String(intervalSeconds), "--format", "json"];
    const source = `import { spawn } from 'node:child_process';
import { openSync, closeSync } from 'node:fs';
const log = openSync(${JSON.stringify(join(account.configDir, "auth-daemon", "output.log"))}, 'a', 0o600);
const child = spawn(${JSON.stringify(process.execPath)}, ${JSON.stringify(args)}, {
  cwd: ${JSON.stringify(account.configDir)},
  env: { ...process.env, ...${JSON.stringify(env)} },
  windowsHide: true, stdio: ['ignore', log, log],
});
closeSync(log);
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
`;
    if ((await authDaemonStatus(account)).running) await stopAuthDaemon(account);
    if (loaded) {
      if (windows) await powershell(`Stop-ScheduledTask -TaskName ${task}`);
      else await execute("systemctl", ["--user", "stop", name]);
    }
    await mkdir(dirname(launcher), { recursive: true });
    await saveFile(launcher, source);
    if (windows) {
      await powershell(`$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute ${psQuote(process.execPath)} -Argument ${psQuote('"' + launcher + '"')} -WorkingDirectory ${psQuote(account.configDir)}
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName ${task} -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName ${task}`);
    } else {
      await mkdir(dirname(path), { recursive: true });
      await saveFile(path, `[Unit]
Description=NjuCLI authentication keepalive (${account.name})
[Service]
Type=simple
ExecStart=${systemdQuote(process.execPath)} ${systemdQuote(launcher)}
TimeoutStopSec=40
[Install]
WantedBy=default.target
`);
      await execute("systemctl", ["--user", "daemon-reload"]);
      await execute("systemctl", ["--user", "enable", "--now", path]);
    }
    enabled = true;
    loaded = true;
  } else if (action === "disable") {
    if ((await authDaemonStatus(account)).running) await stopAuthDaemon(account);
    if (windows) {
      if (loaded) await powershell(`Stop-ScheduledTask -TaskName ${task}; Unregister-ScheduledTask -TaskName ${task} -Confirm:$false`);
    } else {
      if (enabled || loaded) await execute("systemctl", ["--user", "disable", "--now", name]);
      await rm(path, { force: true });
      await execute("systemctl", ["--user", "daemon-reload"]);
    }
    await rm(launcher, { force: true });
    enabled = false;
    loaded = false;
  }
  return { account: account.name, enabled, loaded, path, service: name };
}

function psQuote(value: string): string {
  return "'" + value.replace(/'/g, "''") + "'";
}

function powershell(script: string) {
  return execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from("$ErrorActionPreference = 'Stop';\n" + script, "utf16le").toString("base64")]);
}

function systemdQuote(value: string): string {
  return JSON.stringify(value).replace(/%/g, () => "%%").replace(/\$/g, () => "$$");
}

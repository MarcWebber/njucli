import type { Command } from "commander";
import { asAppError } from "./errors.js";
import {
  renderError,
  renderSuccess,
  resolveOutputFormat,
  type CommandPayload,
  type OutputSink,
} from "./output.js";

export interface CommandRuntime {
  environment: NodeJS.ProcessEnv;
  output: OutputSink;
  setExitCode(code: number): void;
}

export interface FormatOptions {
  format?: string;
}

export function addFormatOption<T extends Command>(command: T): T {
  return command.option(
    "--format <format>",
    "输出格式：text 或 json",
  ) as T;
}

export async function runCommand<T>(
  runtime: CommandRuntime,
  options: FormatOptions,
  operation: () => Promise<CommandPayload<T>>,
): Promise<void> {
  let format;
  try {
    format = resolveOutputFormat(options.format, runtime.environment);
    const result = await operation();
    renderSuccess(runtime.output, format, result);
    runtime.setExitCode(0);
  } catch (error) {
    const appError = asAppError(error);
    const errorFormat = format ?? (runtime.environment.NJUCLI_FORMAT === "json" ? "json" : "text");
    renderError(runtime.output, errorFormat, appError);
    runtime.setExitCode(exitCodeFor(appError.code));
  }
}

function exitCodeFor(code: string): number {
  if (code === "INVALID_INPUT") return 2;
  if (code.startsWith("AUTH_") || code === "VPN_REQUIRED") return 3;
  if (code === "USER_ACTION_REQUIRED") return 4;
  return 1;
}

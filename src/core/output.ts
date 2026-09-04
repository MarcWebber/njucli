import { AppError, asAppError } from "./errors.js";
import { redact } from "./redaction.js";

type OutputFormat = "text" | "json";

export interface OutputSink {
  stdout(value: string): void;
  stderr(value: string): void;
}

export interface CommandPayload<T> {
  data: T;
  text: string;
}

export function resolveOutputFormat(
  option: string | undefined,
  environment: NodeJS.ProcessEnv,
): OutputFormat {
  const value = option ?? environment.NJUCLI_FORMAT ?? "text";
  if (value === "text" || value === "json") return value;
  throw new AppError("INVALID_INPUT", `不支持的输出格式：${value}`, {
    hint: "使用 --format text 或 --format json",
  });
}

function successEnvelope<T>(payload: CommandPayload<T>) {
  return {
    ok: true,
    data: redact(payload.data),
  };
}

export function errorEnvelope(error: unknown) {
  const appError = asAppError(error);
  return {
    ok: false,
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.hint === undefined ? {} : { hint: appError.hint }),
      ...(appError.authCommand === undefined
        ? {}
        : { auth_command: appError.authCommand }),
      ...(appError.details === undefined ? {} : { details: redact(appError.details) }),
    },
  };
}

export function renderSuccess<T>(
  sink: OutputSink,
  format: OutputFormat,
  payload: CommandPayload<T>,
): void {
  if (format === "json") {
    sink.stdout(`${JSON.stringify(successEnvelope(payload))}\n`);
    return;
  }
  sink.stdout(`${payload.text}\n`);
}

export function renderError(
  sink: OutputSink,
  format: OutputFormat,
  error: unknown,
): void {
  const envelope = errorEnvelope(error);
  if (format === "json") {
    sink.stdout(`${JSON.stringify(envelope)}\n`);
    return;
  }
  const suffix = envelope.error.hint ? `\n提示：${envelope.error.hint}` : "";
  sink.stderr(`[${envelope.error.code}] ${envelope.error.message}${suffix}\n`);
}

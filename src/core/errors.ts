type ErrorCode =
  | "INVALID_INPUT"
  | "AUTH_REQUIRED"
  | "AUTH_EXPIRED"
  | "AUTH_REFRESH_FAILED"
  | "AUTH_RESTORE_FAILED"
  | "AUTH_CHALLENGE_FAILED"
  | "AUTH_REJECTED"
  | "AUTH_CAPABILITY_UNKNOWN"
  | "VPN_REQUIRED"
  | "USER_ACTION_REQUIRED"
  | "REMOTE_UNAVAILABLE"
  | "REMOTE_SCHEMA_CHANGED"
  | "NOT_FOUND"
  | "ACCOUNT_EXISTS"
  | "ACCOUNT_NOT_FOUND";

interface AppErrorOptions {
  hint?: string;
  authCommand?: string;
  details?: unknown;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly hint: string | undefined;
  readonly authCommand: string | undefined;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.hint = options.hint;
    this.authCommand = options.authCommand;
    this.details = options.details;
  }
}

export function asAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) {
    return new AppError("REMOTE_UNAVAILABLE", error.message, { cause: error });
  }
  return new AppError("REMOTE_UNAVAILABLE", "发生未知错误", { details: error });
}

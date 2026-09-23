import { AppError } from "./errors.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function requiredText(value: string, name: string): string {
  const text = value.trim();
  if (!text) throw new AppError("INVALID_INPUT", `${name} 不能为空`);
  return text;
}

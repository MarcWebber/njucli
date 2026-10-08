import { AppError } from "./errors.js";
export function optionalPositiveInteger(value: string | undefined, optionName: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new AppError("INVALID_INPUT", `${optionName} 必须是正整数`);
  return parsed;
}
export function optionalNonNegativeInteger(value: string | undefined, optionName: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new AppError("INVALID_INPUT", `${optionName} 必须是非负整数`);
  return parsed;
}

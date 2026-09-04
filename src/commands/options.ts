import { AppError } from "../core/errors.js";
import type { LibrarySearchField } from "../domains/library/types.js";

const LIBRARY_SEARCH_FIELDS = new Set<LibrarySearchField>([
  "all",
  "title",
  "author",
  "isbn",
  "callno",
]);

export function optionalPositiveInteger(
  value: string | undefined,
  optionName: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError("INVALID_INPUT", `${optionName} 必须是正整数`);
  }
  return parsed;
}

export function optionalNonNegativeInteger(
  value: string | undefined,
  optionName: string,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError("INVALID_INPUT", `${optionName} 必须是非负整数`);
  }
  return parsed;
}

export function librarySearchField(value: string | undefined): LibrarySearchField | undefined {
  if (value === undefined) return undefined;
  if (!LIBRARY_SEARCH_FIELDS.has(value as LibrarySearchField)) {
    throw new AppError("INVALID_INPUT", `不支持的图书检索字段：${value}`, {
      hint: "使用 all、title、author、isbn 或 callno",
    });
  }
  return value as LibrarySearchField;
}

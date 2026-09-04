import { AppError } from "./errors.js";

export function requireConfirmation(confirmed: boolean): void {
  if (confirmed) return;
  throw new AppError("CONFIRMATION_REQUIRED", "写操作尚未执行", {
    hint: "确认目标后，在同一条命令末尾添加 --yes",
  });
}

import { describe, expect, it } from "vitest";
import { requireConfirmation } from "../../src/core/confirmation.js";
import { AppError } from "../../src/core/errors.js";

describe("confirmation", () => {
  it("blocks mutation without explicit confirmation", () => {
    expect(() => requireConfirmation(false)).toThrowError(AppError);
    expect(() => requireConfirmation(true)).not.toThrow();
  });
});

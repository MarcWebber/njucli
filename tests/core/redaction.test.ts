import { describe, expect, it } from "vitest";
import { redact } from "../../src/core/redaction.js";

describe("redaction", () => {
  it("redacts nested secret-shaped keys", () => {
    expect(redact({ headers: { Authorization: "Bearer secret" }, safe: "ok" })).toEqual({
      headers: { Authorization: "[REDACTED]" },
      safe: "ok",
    });
  });

  it("redacts cookie and bearer values embedded in text", () => {
    expect(redact("CASTGC=abc; Bearer ey.foo.bar")).toBe(
      "CASTGC=[REDACTED]; Bearer [REDACTED]",
    );
  });
});

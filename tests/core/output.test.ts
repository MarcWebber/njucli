import { describe, expect, it } from "vitest";
import { AppError } from "../../src/core/errors.js";
import {
  errorEnvelope,
  renderSuccess,
  resolveOutputFormat,
} from "../../src/core/output.js";

describe("output", () => {
  it("uses explicit format before environment", () => {
    expect(resolveOutputFormat("text", { NJUCLI_FORMAT: "json" })).toBe("text");
    expect(resolveOutputFormat(undefined, { NJUCLI_FORMAT: "json" })).toBe("json");
  });

  it("rejects unknown formats", () => {
    expect(() => resolveOutputFormat("yaml", {})).toThrowError(AppError);
  });

  it("renders exactly one JSON envelope", () => {
    let output = "";
    renderSuccess(
      { stdout: (value) => (output += value), stderr: () => undefined },
      "json",
      { data: { value: 1 }, text: "ignored for JSON" },
    );
    expect(output.trim().split("\n")).toHaveLength(1);
    expect(JSON.parse(output)).toEqual({
      ok: true,
      data: { value: 1 },
    });
  });

  it("preserves stable error fields", () => {
    expect(
      errorEnvelope(
        new AppError("AUTH_REQUIRED", "需要登录", {
          hint: "运行 njucli auth login",
          authCommand: "njucli auth login",
        }),
      ),
    ).toEqual({
      ok: false,
      error: {
        code: "AUTH_REQUIRED",
        message: "需要登录",
        hint: "运行 njucli auth login",
        auth_command: "njucli auth login",
      },
    });
  });

  it("redacts sensitive values from success data and error details", () => {
    let output = "";
    renderSuccess(
      { stdout: (value) => (output += value), stderr: () => undefined },
      "json",
      {
        data: { accessToken: "secret", nested: { cookie: "CASTGC=value" } },
        text: "ignored for JSON",
      },
    );
    expect(JSON.parse(output).data).toEqual({
      accessToken: "[REDACTED]",
      nested: { cookie: "[REDACTED]" },
    });

    expect(
      errorEnvelope(new AppError("REMOTE_UNAVAILABLE", "failed", {
        details: { authorization: "Bearer secret", safe: "visible" },
      })),
    ).toMatchObject({
      error: {
        details: { authorization: "[REDACTED]", safe: "visible" },
      },
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  SPORTS_SSO_URL,
  exchangeSportsAccessToken,
} from "../../src/auth/sports-token.js";
import type { Clock, FetchLike, FetchResponse } from "../../src/core/types.js";

const clock: Clock = { now: () => new Date(1_800_000_000_000) };

function response(value: unknown, url: string): FetchResponse {
  return {
    ok: true,
    status: 200,
    url,
    text: async () => JSON.stringify(value),
  };
}

describe("sports token exchange", () => {
  it("exchanges the SSO landing code and selects the first role", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetch: FetchLike = async (input, init) => {
      const url = input.toString();
      calls.push(init === undefined ? { url } : { url, init });
      if (url === SPORTS_SSO_URL) {
        return response({}, "https://ggtypt.nju.edu.cn/venue-server/sso/manageLogin?oauth_token=once");
      }
      if (url.endsWith("/api/login")) {
        return response({
          code: 200,
          data: { token: { access_token: "first-token" }, roles: [{ id: 7 }] },
        }, url);
      }
      return response({
        code: 200,
        data: { token: { access_token: "role-token" } },
      }, url);
    };

    await expect(exchangeSportsAccessToken(fetch, clock)).resolves.toBe("role-token");
    expect(calls.map((call) => call.url)).toEqual([
      SPORTS_SSO_URL,
      "https://ggtypt.nju.edu.cn/venue-server/api/login",
      "https://ggtypt.nju.edu.cn/venue-server/roleLogin",
    ]);
    expect(new Headers(calls[1]?.init?.headers).get("oauth-token")).toBe("once");
    expect(calls[2]?.init?.body).toBe("roleid=7");
    expect(new Headers(calls[2]?.init?.headers).get("cgauthorization")).toBe("first-token");
  });

  it("uses the first access token when the account has no role", async () => {
    let calls = 0;
    const fetch: FetchLike = async (input) => {
      calls += 1;
      const url = input.toString();
      if (url === SPORTS_SSO_URL) {
        return response({}, "https://ggtypt.nju.edu.cn/venue-server/sso/manageLogin?oauth_token=once");
      }
      return response({
        code: 200,
        data: { token: { access_token: "token" }, roles: [] },
      }, url);
    };
    await expect(exchangeSportsAccessToken(fetch, clock)).resolves.toBe("token");
    expect(calls).toBe(2);
  });
});

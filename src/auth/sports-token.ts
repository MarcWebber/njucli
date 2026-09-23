import { z } from "zod";

import { AppError } from "../core/errors.js";
import type { FetchLike, FetchResponse } from "../core/types.js";
import { parseUrl, urlHostname } from "../core/url.js";
import {
  SPORTS_API_BASE_URL,
  SPORTS_PUBLIC_APP_KEY,
  createSportsSignature,
} from "../domains/sports/signing.js";

export const SPORTS_SSO_URL =
  "https://authserver.nju.edu.cn/authserver/login?service=" +
  encodeURIComponent(`${SPORTS_API_BASE_URL}/sso/manageLogin`);

const envelopeSchema = z.object({
  code: z.number().int(),
  message: z.string().nullish(),
  data: z.unknown().optional(),
});

const loginDataSchema = z.object({
  token: z.object({ access_token: z.string().min(1) }),
  roles: z.array(z.object({ id: z.union([z.string(), z.number()]) })),
});

const roleDataSchema = z.object({
  token: z.object({ access_token: z.string().min(1) }),
});

export async function exchangeSportsAccessToken(
  fetch: FetchLike,
): Promise<string> {
  const landing = await request(fetch, SPORTS_SSO_URL);
  if (urlHostname(landing.url) === "authserver.nju.edu.cn") {
    throw authRequired();
  }
  const oauthToken = parseUrl(landing.url)?.searchParams.get("oauth_token");
  if (!oauthToken) {
    throw new AppError("AUTH_REFRESH_FAILED", "体育场馆登录没有返回一次性授权码", {
      hint: "运行 njucli auth login sports",
      authCommand: "njucli auth login sports",
    });
  }

  const login = await sportsPost(fetch, "/api/login", [], {
    "oauth-token": oauthToken,
  });
  const parsedLogin = loginDataSchema.parse(login);

  const token = parsedLogin.token.access_token;
  const role = parsedLogin.roles[0];
  if (!role) return token;

  const roleId = String(role.id);
  const roleLogin = await sportsPost(
    fetch,
    "/roleLogin",
    [["roleid", roleId]],
    { cgAuthorization: token },
  );
  return roleDataSchema.parse(roleLogin).token.access_token;
}

async function sportsPost(
  fetch: FetchLike,
  path: string,
  form: ReadonlyArray<readonly [string, string]>,
  extraHeaders: Record<string, string>,
): Promise<unknown> {
  const timestamp = String(Date.now());
  const body = new URLSearchParams(form.map(([key, value]) => [key, value]));
  const response = await request(fetch, `${SPORTS_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "app-key": SPORTS_PUBLIC_APP_KEY,
      timestamp,
      sign: createSportsSignature(path, form, timestamp),
      ...extraHeaders,
    },
    body: body.toString(),
  });
  const envelope = envelopeSchema.parse(JSON.parse(await response.text()));
  if (envelope.code === 401 || envelope.code === 403) throw authRequired();
  if (envelope.code !== 200) {
    throw new Error(envelope.message ?? `体育场馆登录失败 (${envelope.code})`);
  }
  return envelope.data;
}

async function request(
  fetch: FetchLike,
  url: string,
  init?: RequestInit,
): Promise<FetchResponse> {
  const response = await fetch(url, init);
  if (response.status === 401 || response.status === 403) throw authRequired();
  if (!response.ok) {
    throw new Error(`体育场馆登录返回 HTTP ${response.status}`);
  }
  return response;
}

function authRequired(): AppError {
  return new AppError("AUTH_REQUIRED", "统一身份认证或体育场馆会话已失效", {
    hint: "运行 njucli auth login sports",
    authCommand: "njucli auth login sports",
  });
}

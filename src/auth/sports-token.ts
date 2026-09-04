import { z } from "zod";

import { AppError } from "../core/errors.js";
import {
  systemClock,
  type Clock,
  type FetchLike,
  type FetchResponse,
} from "../core/types.js";
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
  clock: Clock = systemClock,
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

  const login = await sportsPost(fetch, "/api/login", [], clock, {
    "oauth-token": oauthToken,
  });
  const parsedLogin = loginDataSchema.safeParse(login);
  if (!parsedLogin.success) throw schemaChanged("/api/login", parsedLogin.error);

  const token = parsedLogin.data.token.access_token;
  const role = parsedLogin.data.roles[0];
  if (!role) return token;

  const roleId = String(role.id);
  const roleLogin = await sportsPost(
    fetch,
    "/roleLogin",
    [["roleid", roleId]],
    clock,
    { cgAuthorization: token },
  );
  const parsedRole = roleDataSchema.safeParse(roleLogin);
  if (!parsedRole.success) throw schemaChanged("/roleLogin", parsedRole.error);
  return parsedRole.data.token.access_token;
}

async function sportsPost(
  fetch: FetchLike,
  path: string,
  form: ReadonlyArray<readonly [string, string]>,
  clock: Clock,
  extraHeaders: Record<string, string>,
): Promise<unknown> {
  const timestamp = String(Math.trunc(clock.now().getTime()));
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
  let value: unknown;
  try {
    value = JSON.parse(await response.text()) as unknown;
  } catch (cause) {
    throw schemaChanged(path, cause);
  }
  const envelope = envelopeSchema.safeParse(value);
  if (!envelope.success) throw schemaChanged(path, envelope.error);
  if (envelope.data.code === 401 || envelope.data.code === 403) throw authRequired();
  if (envelope.data.code !== 200) {
    throw new AppError(
      "AUTH_REFRESH_FAILED",
      envelope.data.message ?? "体育场馆登录失败",
      { details: { path, code: envelope.data.code } },
    );
  }
  return envelope.data.data;
}

async function request(
  fetch: FetchLike,
  url: string,
  init?: RequestInit,
): Promise<FetchResponse> {
  let response: FetchResponse;
  try {
    response = await fetch(url, init);
  } catch (cause) {
    throw new AppError("REMOTE_UNAVAILABLE", "无法连接体育场馆登录服务", { cause });
  }
  if (response.status === 401 || response.status === 403) throw authRequired();
  if (!response.ok) {
    throw new AppError("AUTH_REFRESH_FAILED", `体育场馆登录返回 HTTP ${response.status}`);
  }
  return response;
}

function authRequired(): AppError {
  return new AppError("AUTH_REQUIRED", "统一身份认证或体育场馆会话已失效", {
    hint: "运行 njucli auth login sports",
    authCommand: "njucli auth login sports",
  });
}

function schemaChanged(path: string, cause: unknown): AppError {
  return new AppError("REMOTE_SCHEMA_CHANGED", "体育场馆登录响应与固定契约不一致", {
    details: { path },
    cause,
  });
}

const SENSITIVE_KEY = /(?:cookie|authorization|password|passwd|secret|token|ticket|captcha|jwt|sessionid)|^(?:sid|pgt|pgtId|pgtIou)$/i;
const COOKIE_VALUE = /(?:(?:CASTGC|JSESSIONID|SESSION|sid|token|jwt)=)[^;\s]+/gi;
const BEARER_VALUE = /Bearer\s+[A-Za-z0-9._~+\-/]+=*/gi;
const PRIVATE_HEADER = /(\b(?:cookie|set-cookie|authorization)\s*:\s*)[^\r\n]+/gi;
const JWT_VALUE = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const AUTH_QUERY_VALUE = /([?&](?:ticket|pgt|pgtId|pgtIou|code|state|sesskey|oauth_token|access_token|refresh_token|id_token|sid|x-amz-[\w-]+)=)[^&#\s"']+/gi;
const CAS_CREDENTIAL = /\b(?:PGTIOU|PGT|TGT|PT|ST)-[A-Za-z0-9._~-]+/g;

export function redactText(value: string): string {
  return value.replace(PRIVATE_HEADER, "$1[REDACTED]")
    .replace(JWT_VALUE, "[REDACTED]")
    .replace(COOKIE_VALUE, (entry) => `${entry.split("=")[0]}=[REDACTED]`)
    .replace(BEARER_VALUE, "Bearer [REDACTED]")
    .replace(AUTH_QUERY_VALUE, "$1[REDACTED]")
    .replace(CAS_CREDENTIAL, "[REDACTED]");
}

export function redact(value: unknown): unknown {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[REDACTED]" : redact(entry),
      ]),
    );
  }
  return value;
}

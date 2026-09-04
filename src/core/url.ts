export function parseUrl(value: string, base?: string | URL): URL | null {
  if (base === undefined) return URL.canParse(value) ? new URL(value) : null;
  return URL.canParse(value, base) ? new URL(value, base) : null;
}

export function urlHostname(value: string): string | null {
  return parseUrl(value)?.hostname ?? null;
}

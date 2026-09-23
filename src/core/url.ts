export function parseUrl(value: string, base?: string | URL): URL | null {
  return URL.canParse(value, base) ? new URL(value, base) : null;
}

export function urlHostname(value: string): string | null {
  return parseUrl(value)?.hostname ?? null;
}

import normalizeUrl from "normalize-url";

export function normaliseUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return normalizeUrl(url, {
      stripHash: true,
      removeTrailingSlash: true,
      stripWWW: false,
      forceHttps: false,
    });
  } catch {
    return null;
  }
}

export function extractDomain(url: string | null): string | null {
  if (!url) {
    return null;
  }
  try {
    const { hostname } = new URL(url.startsWith("http") ? url : `https://${url}`);
    return hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

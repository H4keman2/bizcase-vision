/** Free-tier gating + local license storage for BizCase Builder. */

export const GUMROAD_URL = "https://hakeman.gumroad.com/l/bizcase-builder";
export const LICENSE_PRICE = "$19.99";
export const FREE_CASE_LIMIT = 3;

const KEY = "bizcase:license";
const EVENT = "bizcase:license-changed";

export class LicenseLimitError extends Error {
  constructor() {
    super(
      `Free version is limited to ${FREE_CASE_LIMIT} cases. Unlock unlimited cases for ${LICENSE_PRICE}.`,
    );
    this.name = "LicenseLimitError";
  }
}

export function isLicensed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(KEY));
  } catch {
    return false;
  }
}

export function getLicenseKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveLicenseKey(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, key);
  window.dispatchEvent(new Event(EVENT));
}

export function clearLicenseKey() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** Shows only the last 4 characters of a stored key, e.g. "••••-3F9A". */
export function maskLicenseKey(key: string): string {
  const t = key.trim();
  if (t.length <= 4) return t;
  return `••••-${t.slice(-4)}`;
}

export function onLicenseChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

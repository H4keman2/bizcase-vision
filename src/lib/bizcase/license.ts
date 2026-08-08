import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyLicenseKey } from "./license.functions";

/** Free-tier gating + local license storage for BizCase Builder. */

export const GUMROAD_URL = "https://hakeman.gumroad.com/l/bizcase-builder";
export const LICENSE_PRICE = "$19.99";
export const FREE_CASE_LIMIT = 2;

const KEY = "bizcase:license";
const EVENT = "bizcase:license-changed";
/** Every localStorage key that has ever held the license, across formats. */
const LICENSE_KEYS = [KEY, "bizcase-license", "bizcase:licenseKey", "bizcaseLicense", "license"];
const EXEC_SUMMARY_PREFIX = "execSummaryCount:";
/** Legacy/alternate prefixes used for the per-case exec summary counter. */
const EXEC_SUMMARY_PREFIXES = [
  EXEC_SUMMARY_PREFIX,
  "bizcase:execSummaryCount:",
  "execSummaryCount-",
];
// Don't re-ping Gumroad more than this often — just enough to catch a
// refunded/revoked key within a reasonable window without hammering the API.
const REVALIDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;

/** True for any storage key whose change could flip license or free-usage state,
 *  regardless of which format/prefix wrote it. */
export function isLicenseRelatedStorageKey(key: string | null): boolean {
  // A null key means storage was cleared wholesale — always re-read.
  if (key === null) return true;
  return (
    LICENSE_KEYS.includes(key) || EXEC_SUMMARY_PREFIXES.some((p) => key.startsWith(p))
  );
}

export class LicenseLimitError extends Error {
  constructor() {
    super(
      `Free version is limited to ${FREE_CASE_LIMIT} cases. Unlock unlimited cases for ${LICENSE_PRICE}.`,
    );
    this.name = "LicenseLimitError";
  }
}

interface LicenseRecord {
  key: string;
  lastCheckedAt: number;
}

function parseRecord(raw: string): LicenseRecord | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as LicenseRecord).key === "string" &&
      typeof (parsed as LicenseRecord).lastCheckedAt === "number"
    ) {
      return parsed as LicenseRecord;
    }
    return null;
  } catch {
    // Installs from before this format existed stored the bare key as
    // plain text. Treat it as due for an immediate background check
    // rather than logging an existing customer out.
    return { key: raw, lastCheckedAt: 0 };
  }
}

function readRecord(): LicenseRecord | null {
  if (typeof window === "undefined") return null;
  try {
    // Read the current key first, then any legacy/alternate location, so a key
    // written by an older build (or another surface) still unlocks the app.
    for (const k of LICENSE_KEYS) {
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      const record = parseRecord(raw);
      if (record) return record;
    }
    return null;
  } catch {
    return null;
  }
}

function writeRecord(record: LicenseRecord) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(record));
}

export function isLicensed(): boolean {
  return readRecord() !== null;
}

export function getLicenseKey(): string | null {
  return readRecord()?.key ?? null;
}

export function saveLicenseKey(key: string) {
  if (typeof window === "undefined") return;
  writeRecord({ key, lastCheckedAt: Date.now() });
  clearExecSummaryCounts();
  window.dispatchEvent(new Event(EVENT));
}

/** Clear all per-case exec summary counters when the user upgrades, across every
 *  prefix variant that has been used. Licensed users should never hit a stale
 *  locked state. */
export function clearExecSummaryCounts() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && EXEC_SUMMARY_PREFIXES.some((p) => k.startsWith(p))) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function clearLicenseKey() {
  if (typeof window === "undefined") return;
  // Remove every variant so a legacy copy can't silently re-license the app.
  LICENSE_KEYS.forEach((k) => window.localStorage.removeItem(k));
  window.dispatchEvent(new Event(EVENT));
}

/** Free-tier cap: one AI executive summary per case for unlicensed users. */
export const FREE_EXEC_SUMMARY_LIMIT = 1;

function execSummaryKey(caseId: string) {
  return `${EXEC_SUMMARY_PREFIX}${caseId}`;
}

export function getExecSummaryCount(caseId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    // Take the highest count across prefix variants so a legacy counter can't
    // be bypassed by the key format changing.
    return EXEC_SUMMARY_PREFIXES.reduce((max, p) => {
      const n = Number(window.localStorage.getItem(`${p}${caseId}`) ?? 0) || 0;
      return n > max ? n : max;
    }, 0);
  } catch {
    return 0;
  }
}

/** Licensed users are never tracked or capped. */
export function incrementExecSummaryCount(caseId: string): void {
  if (typeof window === "undefined" || isLicensed()) return;
  try {
    window.localStorage.setItem(execSummaryKey(caseId), String(getExecSummaryCount(caseId) + 1));
  } catch {
    /* ignore */
  }
}

export function canGenerateExecSummary(caseId: string): boolean {
  if (isLicensed()) return true;
  return getExecSummaryCount(caseId) < FREE_EXEC_SUMMARY_LIMIT;
}

/** Shows only the last 4 characters of a stored key, e.g. "••••-3F9A". */
export function maskLicenseKey(key: string): string {
  const t = key.trim();
  if (t.length <= 4) return t;
  return `••••-${t.slice(-4)}`;
}

export function onLicenseChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  // Cross-tab: `storage` fires in other tabs when the license key or a
  // per-case exec summary counter changes, so an upgrade in one tab clears
  // the locked state everywhere without a refresh.
  const onStorage = (e: StorageEvent) => {
    if (isLicenseRelatedStorageKey(e.key)) fn();
  };
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", onStorage);
  };
}

/** Hydration-safe license state: false on the server and first client render,
 *  then the real value. Prevents SSR/client markup mismatches. */
export function useLicensed(): boolean {
  const [licensed, setLicensed] = useState(false);
  useEffect(() => {
    setLicensed(isLicensed());
    return onLicenseChange(() => setLicensed(isLicensed()));
  }, []);
  return licensed;
}

/** Re-checks the stored key against Gumroad in the background, once per app
 *  load (throttled to REVALIDATE_INTERVAL_MS). Revokes access only on a
 *  genuine rejection from Gumroad — never on a network hiccup, so a flaky
 *  connection can't cost a real customer their access.
 *
 *  This is what makes `isLicensed()` mean something: writing an arbitrary
 *  string to localStorage (or a legacy plain-text key) now gets checked
 *  against Gumroad on the very next load and is revoked if it doesn't
 *  actually verify. There's no way to make a purely client-side check
 *  unbypassable without a backend of our own, but this closes the "paste
 *  anything and it works forever" version of the bypass. */
export function useLicenseRevalidation(): void {
  const verify = useServerFn(verifyLicenseKey);
  useEffect(() => {
    const record = readRecord();
    if (!record) return;
    if (Date.now() - record.lastCheckedAt < REVALIDATE_INTERVAL_MS) return;

    let cancelled = false;
    void (async () => {
      try {
        const result = await verify({ data: { key: record.key, incrementUses: false } });
        if (cancelled) return;
        if (result.valid) {
          writeRecord({ key: record.key, lastCheckedAt: Date.now() });
        } else if (!result.transient) {
          clearLicenseKey();
        }
        // Transient failures: leave the record untouched and try again next load.
      } catch {
        // Unexpected error calling the server function itself — treat as
        // transient, never revoke access over an unexpected failure.
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

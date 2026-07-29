import { calculate } from "./calc";
import { defaultInputs, type CaseDraft, type CaseRecord, type CaseVersion } from "./types";

const INDEX_KEY = "cases:index";
const caseKey = (id: string) => `cases:${id}`;
const versionKey = (id: string, n: number) => `cases:${id}:versions:${n}`;

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function listCaseIds(): string[] {
  return read<string[]>(INDEX_KEY) ?? [];
}

export function getCase(id: string): CaseRecord | null {
  return read<CaseRecord>(caseKey(id));
}

export function listCases(): CaseRecord[] {
  return listCaseIds()
    .map(getCase)
    .filter((c): c is CaseRecord => Boolean(c))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createCase(name = "Untitled Case"): CaseRecord {
  const ids = listCaseIds();
  const id = `case_${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const inputs = defaultInputs();
  const record: CaseRecord = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    latestVersion: 0,
    draft: { inputs, outputs: calculate(inputs) },
  };
  write(caseKey(id), record);
  write(INDEX_KEY, [id, ...ids]);
  return record;
}

export function saveCase(record: CaseRecord) {
  const next = { ...record, updatedAt: new Date().toISOString() };
  write(caseKey(record.id), next);
  const ids = listCaseIds();
  if (!ids.includes(record.id)) write(INDEX_KEY, [record.id, ...ids]);
  return next;
}

export function deleteCase(id: string) {
  if (typeof window === "undefined") return;
  const record = getCase(id);
  for (let n = 1; n <= (record?.latestVersion ?? 0); n++) {
    window.localStorage.removeItem(versionKey(id, n));
  }
  window.localStorage.removeItem(caseKey(id));
  write(
    INDEX_KEY,
    listCaseIds().filter((x) => x !== id),
  );
}

export function listVersions(id: string): CaseVersion[] {
  const record = getCase(id);
  if (!record) return [];
  const out: CaseVersion[] = [];
  for (let n = 1; n <= record.latestVersion; n++) {
    const v = read<CaseVersion>(versionKey(id, n));
    if (v) out.push(v);
  }
  return out.sort((a, b) => b.versionNumber - a.versionNumber);
}

export function saveVersion(id: string, label: string, draft: CaseDraft): CaseVersion | null {
  const record = getCase(id);
  if (!record) return null;
  const n = record.latestVersion + 1;
  const version: CaseVersion = {
    ...draft,
    versionLabel: label,
    savedAt: new Date().toISOString(),
    versionNumber: n,
  };
  write(versionKey(id, n), version);
  saveCase({ ...record, latestVersion: n, draft });
  return version;
}

import type { RawJurisdiction, RawJurisdictionDetail, RawStandardSet } from "@/lib/types";

const CSP_BASE = "https://api.commonstandardsproject.com/api/v1";

export function cspHeaders(): Record<string, string> {
  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.CSP_API_KEY?.trim();
  if (key) headers["Api-Key"] = key; // only when non-empty — a blank/invalid key forces a 401
  return headers;
}

export async function cspFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${CSP_BASE}${path}`, { headers: cspHeaders() });
  if (!res.ok) {
    throw new Error(`Common Standards API error ${res.status} (${res.statusText}) for ${path}`);
  }
  const json = (await res.json()) as { data: T };
  return json.data;
}

export const listJurisdictions = () => cspFetch<RawJurisdiction[]>("/jurisdictions");

export const getJurisdiction = (id: string) =>
  cspFetch<RawJurisdictionDetail>(`/jurisdictions/${encodeURIComponent(id)}`);

export const getStandardSet = (id: string) =>
  cspFetch<RawStandardSet>(`/standard_sets/${encodeURIComponent(id)}`);

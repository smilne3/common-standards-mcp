import * as csp from "@/lib/csp-client";
import { filterJurisdictions, filterStandardSets, normalizeStandardSet, findStandard } from "@/lib/normalize";
import type { NormalizedStandardSet } from "@/lib/types";

function buildAttribution(set: NormalizedStandardSet): string {
  const base = "Retrieved via the Common Standards Project (commonstandardsproject.com).";
  if (!set.license) return `Standards data for “${set.title}”. ${base}`;
  const rh = set.license.rightsHolder || "the rights holder";
  const lic = set.license.title || "its stated license";
  const url = set.license.URL ? ` (${set.license.URL})` : "";
  return `“${set.title}” © ${rh}, licensed under ${lic}${url}. ${base}`;
}

export async function listJurisdictionsTool(input: { type?: string; title_contains?: string }) {
  const all = await csp.listJurisdictions();
  const jurisdictions = filterJurisdictions(all, { type: input.type, titleContains: input.title_contains });
  return { count: jurisdictions.length, jurisdictions };
}

export async function listStandardSetsTool(input: { jurisdiction_id: string; subject?: string; education_level?: string }) {
  const j = await csp.getJurisdiction(input.jurisdiction_id);
  const standardSets = filterStandardSets(j.standardSets ?? [], {
    subject: input.subject,
    educationLevel: input.education_level,
  });
  return {
    jurisdiction: { id: j.id, title: j.title, type: j.type },
    count: standardSets.length,
    standardSets,
  };
}

export async function getStandardSetTool(input: { standard_set_id: string }) {
  const raw = await csp.getStandardSet(input.standard_set_id);
  const set = normalizeStandardSet(raw);
  return { ...set, standardCount: set.standards.length, attribution: buildAttribution(set) };
}

export async function getStandardTool(input: { standard_set_id: string; standard_id: string }) {
  const raw = await csp.getStandardSet(input.standard_set_id);
  const set = normalizeStandardSet(raw);
  const standard = findStandard(set, input.standard_id);
  if (!standard) {
    throw new Error(`Standard ${input.standard_id} not found in set ${input.standard_set_id}`);
  }
  return {
    standard,
    standardSet: { id: set.id, title: set.title, subject: set.subject },
    jurisdiction: set.jurisdiction,
    attribution: buildAttribution(set),
  };
}

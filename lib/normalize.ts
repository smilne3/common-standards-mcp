import type {
  RawJurisdiction,
  RawStandardSet,
  RawStandardSetSummary,
  RawStandard,
  NormalizedStandardSet,
} from "@/lib/types";

export function filterJurisdictions(
  list: RawJurisdiction[],
  opts: { type?: string; titleContains?: string } = {},
): RawJurisdiction[] {
  let out = list;
  if (opts.type) {
    const t = opts.type.toLowerCase();
    out = out.filter((j) => j.type?.toLowerCase() === t);
  }
  if (opts.titleContains) {
    const q = opts.titleContains.toLowerCase();
    out = out.filter((j) => j.title?.toLowerCase().includes(q));
  }
  return out;
}

export function filterStandardSets(
  sets: RawStandardSetSummary[],
  opts: { subject?: string; educationLevel?: string } = {},
): RawStandardSetSummary[] {
  let out = sets;
  if (opts.subject) {
    const q = opts.subject.toLowerCase();
    out = out.filter((s) => s.subject?.toLowerCase().includes(q));
  }
  if (opts.educationLevel) {
    out = out.filter((s) => (s.educationLevels ?? []).includes(opts.educationLevel!));
  }
  return out;
}

export function normalizeStandardSet(raw: RawStandardSet): NormalizedStandardSet {
  const standards: RawStandard[] = Object.values(raw.standards ?? {}).sort(
    (a, b) => (a.position ?? 0) - (b.position ?? 0),
  );
  const lic = raw.license;
  const hasLicense = !!lic && !!(lic.title || lic.URL || lic.rightsHolder);
  return {
    id: raw.id,
    title: raw.title,
    subject: raw.subject,
    normalizedSubject: raw.normalizedSubject,
    educationLevels: raw.educationLevels ?? [],
    jurisdiction: raw.jurisdiction,
    license: hasLicense
      ? { title: lic!.title ?? "", URL: lic!.URL ?? "", rightsHolder: lic!.rightsHolder ?? "" }
      : null,
    document: raw.document ?? null,
    standards,
  };
}

export function findStandard(set: NormalizedStandardSet, standardId: string): RawStandard | undefined {
  return set.standards.find((s) => s.id === standardId);
}

export interface RawJurisdiction {
  id: string;
  title: string;
  type: string; // "state" | "organization" | "school" (kept loose — upstream may add values)
}

export interface RawDocument {
  id: string;
  valid: string | null;
  title: string;
  sourceURL: string | null;
  asnIdentifier: string | null;
  publicationStatus: string;
}

export interface RawStandardSetSummary {
  id: string;
  title: string;
  subject: string;
  educationLevels: string[];
  document: RawDocument;
}

export interface RawJurisdictionDetail {
  id: string;
  title: string;
  type: string;
  standardSets: RawStandardSetSummary[];
}

export interface RawStandard {
  id: string;
  asnIdentifier?: string;
  position: number;
  depth: number;
  statementNotation?: string;
  statementLabel?: string;
  listId?: string | null;
  description: string;
  exactMatch?: string[];
  ancestorIds?: string[];
  parentId?: string | null;
}

export interface RawLicense {
  title?: string;
  URL?: string;
  rightsHolder?: string;
}

export interface RawStandardSet {
  id: string;
  title: string;
  subject: string;
  normalizedSubject?: string;
  educationLevels: string[];
  license?: RawLicense;
  document: RawDocument;
  jurisdiction: { id: string; title: string };
  standards: Record<string, RawStandard>; // object map, NOT an array
}

export interface NormalizedStandardSet {
  id: string;
  title: string;
  subject: string;
  normalizedSubject?: string;
  educationLevels: string[];
  jurisdiction: { id: string; title: string };
  license: { title: string; URL: string; rightsHolder: string } | null;
  standards: RawStandard[]; // sorted by position
}

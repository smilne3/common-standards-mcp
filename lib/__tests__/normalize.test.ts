import { describe, it, expect } from "vitest";
import { filterJurisdictions, filterStandardSets, normalizeStandardSet, findStandard } from "@/lib/normalize";
import type { RawStandardSet } from "@/lib/types";

const jurisdictions = [
  { id: "1", title: "Arizona", type: "state" },
  { id: "2", title: "Common Core State Standards", type: "organization" },
  { id: "3", title: "Arizona School of the Arts", type: "school" },
];

describe("filterJurisdictions", () => {
  it("returns all when no filters", () => {
    expect(filterJurisdictions(jurisdictions)).toHaveLength(3);
  });
  it("filters by type (case-insensitive)", () => {
    expect(filterJurisdictions(jurisdictions, { type: "State" }).map((j) => j.id)).toEqual(["1"]);
  });
  it("filters by title substring (case-insensitive)", () => {
    expect(filterJurisdictions(jurisdictions, { titleContains: "arizona" }).map((j) => j.id)).toEqual(["1", "3"]);
  });
});

const summary = (over: Partial<{ id: string; subject: string; educationLevels: string[] }>) => ({
  id: over.id ?? "s1",
  title: "T",
  subject: over.subject ?? "Mathematics",
  educationLevels: over.educationLevels ?? ["04"],
  document: { id: "d", valid: null, title: "D", sourceURL: null, asnIdentifier: null, publicationStatus: "Published" },
});

describe("filterStandardSets", () => {
  const sets = [
    summary({ id: "a", subject: "Mathematics", educationLevels: ["04"] }),
    summary({ id: "b", subject: "English Language Arts", educationLevels: ["04", "05"] }),
    summary({ id: "c", subject: "Mathematics", educationLevels: ["K"] }),
  ];
  it("filters by subject substring", () => {
    expect(filterStandardSets(sets, { subject: "math" }).map((s) => s.id)).toEqual(["a", "c"]);
  });
  it("filters by education level (exact, zero-padded string)", () => {
    expect(filterStandardSets(sets, { educationLevel: "04" }).map((s) => s.id)).toEqual(["a", "b"]);
  });
});

const rawSet: RawStandardSet = {
  id: "SET1",
  title: "Arizona Math Grade 4",
  subject: "Mathematics",
  normalizedSubject: "Math",
  educationLevels: ["04"],
  license: { title: "CC BY 3.0 US", URL: "http://creativecommons.org/licenses/by/3.0/us/", rightsHolder: "D2L" },
  document: { id: "d", valid: "2016", title: "AZ Math", sourceURL: null, asnIdentifier: "asn", publicationStatus: "Published" },
  jurisdiction: { id: "1", title: "Arizona" },
  standards: {
    "g2": { id: "g2", position: 200000, depth: 1, description: "second", statementNotation: "4.NF.A.2" },
    "g1": { id: "g1", position: 100000, depth: 1, description: "first", statementNotation: "4.NF.A.1" },
  },
};

describe("normalizeStandardSet", () => {
  it("turns the standards object-map into an array sorted by position", () => {
    const n = normalizeStandardSet(rawSet);
    expect(Array.isArray(n.standards)).toBe(true);
    expect(n.standards.map((s) => s.id)).toEqual(["g1", "g2"]);
  });
  it("surfaces the license block", () => {
    expect(normalizeStandardSet(rawSet).license).toEqual({
      title: "CC BY 3.0 US",
      URL: "http://creativecommons.org/licenses/by/3.0/us/",
      rightsHolder: "D2L",
    });
  });
  it("returns null license when absent", () => {
    const { license, ...rest } = rawSet;
    expect(normalizeStandardSet(rest as RawStandardSet).license).toBeNull();
  });
});

describe("findStandard", () => {
  it("finds a standard by id", () => {
    const n = normalizeStandardSet(rawSet);
    expect(findStandard(n, "g2")?.description).toBe("second");
  });
  it("returns undefined for an unknown id", () => {
    const n = normalizeStandardSet(rawSet);
    expect(findStandard(n, "nope")).toBeUndefined();
  });
});

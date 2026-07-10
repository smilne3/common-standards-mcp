import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RawJurisdiction, RawJurisdictionDetail, RawStandardSet } from "@/lib/types";

vi.mock("@/lib/csp-client", () => ({
  listJurisdictions: vi.fn(),
  getJurisdiction: vi.fn(),
  getStandardSet: vi.fn(),
}));

import * as csp from "@/lib/csp-client";
import { listJurisdictionsTool, listStandardSetsTool, getStandardSetTool, getStandardTool } from "@/lib/tools";

const jur: RawJurisdiction[] = [
  { id: "1", title: "Arizona", type: "state" },
  { id: "2", title: "Common Core", type: "organization" },
];

const jurDetail: RawJurisdictionDetail = {
  id: "1",
  title: "Arizona",
  type: "state",
  standardSets: [
    { id: "a", title: "Math G4", subject: "Mathematics", educationLevels: ["04"], document: { id: "d", valid: null, title: "t", sourceURL: null, asnIdentifier: null, publicationStatus: "Published" } },
    { id: "b", title: "ELA G4", subject: "English Language Arts", educationLevels: ["04"], document: { id: "d", valid: null, title: "t", sourceURL: null, asnIdentifier: null, publicationStatus: "Published" } },
  ],
};

const set: RawStandardSet = {
  id: "SET1",
  title: "Arizona Math Grade 4",
  subject: "Mathematics",
  educationLevels: ["04"],
  license: { title: "CC BY 3.0 US", URL: "http://cc/by", rightsHolder: "D2L" },
  document: { id: "d", valid: "2016", title: "t", sourceURL: null, asnIdentifier: null, publicationStatus: "Published" },
  jurisdiction: { id: "1", title: "Arizona" },
  standards: {
    s1: { id: "s1", position: 1, depth: 1, description: "first", statementNotation: "4.NF.A.1" },
  },
};

beforeEach(() => {
  vi.mocked(csp.listJurisdictions).mockResolvedValue(jur);
  vi.mocked(csp.getJurisdiction).mockResolvedValue(jurDetail);
  vi.mocked(csp.getStandardSet).mockResolvedValue(set);
});

describe("listJurisdictionsTool", () => {
  it("returns all with a count when unfiltered", async () => {
    const r = await listJurisdictionsTool({});
    expect(r.count).toBe(2);
    expect(r.jurisdictions).toHaveLength(2);
  });
  it("applies the type filter", async () => {
    const r = await listJurisdictionsTool({ type: "state" });
    expect(r.jurisdictions.map((j) => j.id)).toEqual(["1"]);
  });
});

describe("listStandardSetsTool", () => {
  it("returns the jurisdiction and its sets", async () => {
    const r = await listStandardSetsTool({ jurisdiction_id: "1" });
    expect(csp.getJurisdiction).toHaveBeenCalledWith("1");
    expect(r.jurisdiction.title).toBe("Arizona");
    expect(r.count).toBe(2);
  });
  it("filters sets by subject", async () => {
    const r = await listStandardSetsTool({ jurisdiction_id: "1", subject: "math" });
    expect(r.standardSets.map((s) => s.id)).toEqual(["a"]);
  });
});

describe("getStandardSetTool", () => {
  it("returns a normalized set with an attribution string", async () => {
    const r = await getStandardSetTool({ standard_set_id: "SET1" });
    expect(Array.isArray(r.standards)).toBe(true);
    expect(r.standardCount).toBe(1);
    expect(r.attribution).toMatch(/D2L/);
    expect(r.attribution).toMatch(/CC BY 3.0 US/);
  });
});

describe("getStandardTool", () => {
  it("returns a single standard with attribution", async () => {
    const r = await getStandardTool({ standard_set_id: "SET1", standard_id: "s1" });
    expect(r.standard.description).toBe("first");
    expect(r.jurisdiction.title).toBe("Arizona");
  });
  it("throws when the standard id is not in the set", async () => {
    await expect(getStandardTool({ standard_set_id: "SET1", standard_id: "zzz" })).rejects.toThrow(/not found/);
  });
});

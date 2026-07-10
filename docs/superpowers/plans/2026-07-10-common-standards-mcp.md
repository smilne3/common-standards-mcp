# Common Standards MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a live, read-only MCP server that exposes four tools for retrieving U.S. academic-standards data from the Common Standards Project API.

**Architecture:** A single Next.js (App Router) app deployed as a Vercel Function. One route file (`app/api/mcp/route.ts`) registers four MCP tools via Vercel's `mcp-handler` over the Streamable HTTP transport. Tool logic is split into testable, network-free layers: a thin API client (`lib/csp-client.ts`), pure normalizers (`lib/normalize.ts`), and tool functions that compose them (`lib/tools.ts`). No database, no auth, no background jobs.

**Tech Stack:** TypeScript, Next.js (App Router), `mcp-handler`, `@modelcontextprotocol/sdk`, `zod`, Vitest (tests), Vercel (hosting).

## Global Constraints

- Node runtime only (not Edge) — `mcp-handler` pulls in Node dependencies.
- `@modelcontextprotocol/sdk` pinned to `1.26.0` (security floor; the exact peer version `mcp-handler@1.1.0` expects). `zod@^3`.
- Upstream base URL: `https://api.commonstandardsproject.com/api/v1`.
- Auth: send the `Api-Key` HTTP header **only when `process.env.CSP_API_KEY` is set and non-empty** — a blank/invalid key forces an HTTP 401. Never send a blank key.
- Every upstream response is wrapped in a top-level `data` key — unwrap it.
- On `standard_sets/{id}`, the `standards` field is an **object map keyed by id, not an array** — convert with `Object.values()` and sort by `position`.
- Standard-set ids are compound opaque strings (`<jurisdictionId>_<documentId>_<grade-slug>`) — pass through, never parse. Jurisdiction ids are 32-char uppercase hex.
- `educationLevels` are zero-padded strings (`"01"`..`"12"`, `"K"`) — compare as strings.
- `document.sourceURL` and `license` fields can be missing/null — guard them.
- License/attribution is **per standard set** (read each set's `license` object); surface it on `get_standard_set` and `get_standard`.
- Code license: **MIT**.
- Code home: a **personal** GitHub repo. Hosting: a **personal** Vercel account.
- MCP connect URL shape: `https://<project>.vercel.app/api/mcp`.

---

### Task 1: Scaffold the project (Next.js + TypeScript + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.ts`, `.gitignore`, `.env.local.example`, `app/layout.tsx`, `app/page.tsx`
- Test: `lib/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working project where `npm run test` and `npm run dev` both run. Establishes the `@/*` path alias (maps to project root) used by every later task.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "common-standards-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest",
    "test:run": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
cd /Users/smilne3/dev/common-standards-mcp
npm install next@latest react@latest react-dom@latest mcp-handler@1.1.0 @modelcontextprotocol/sdk@1.26.0 zod@^3
npm install -D typescript @types/node @types/react @types/react-dom vitest
```
Expected: installs cleanly. `mcp-handler@1.1.0` peer-depends on **exactly** `@modelcontextprotocol/sdk@1.26.0` (an exact pin, not a range) — so pin the SDK to exactly that; installing a higher SDK version prints an npm peer-dependency warning. If `mcp-handler@1.1.0` no longer exists, run `npm view mcp-handler version` and `npm view mcp-handler peerDependencies`, install that version, and install the exact SDK version its peers list. (Note: `mcp-handler` pulls in `redis`, `chalk`, and `commander` transitively; `redis` is only used by the SSE transport, which this project does not use — no `REDIS_URL` is needed.)

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 5: Create `vitest.config.ts`** (node environment + the `@` alias so tests resolve imports the same way Next does)

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { environment: "node", include: ["lib/**/*.test.ts"] },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
```

- [ ] **Step 6: Create `.gitignore`**

```gitignore
node_modules
.next
out
.env
.env*.local
*.tsbuildinfo
next-env.d.ts
.DS_Store
.vercel
```

- [ ] **Step 7: Create `.env.local.example`**

```bash
# Optional: a free API key from https://commonstandardsproject.com
# The API currently serves data anonymously, but if you set this it is sent as the Api-Key header.
# Leave it unset/blank rather than putting a placeholder here — a blank/invalid key causes 401s.
CSP_API_KEY=
```

- [ ] **Step 8: Create `app/layout.tsx`** (minimal root layout required by Next App Router)

```tsx
export const metadata = {
  title: "Common Standards MCP",
  description: "An MCP server for U.S. academic standards, via the Common Standards Project.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Create a placeholder `app/page.tsx`** (replaced with the real landing page in Task 6)

```tsx
export default function Home() {
  return <main style={{ padding: "2rem" }}>Common Standards MCP — see /api/mcp</main>;
}
```

- [ ] **Step 10: Write the smoke test** — `lib/__tests__/smoke.test.ts`

```ts
import { describe, it, expect } from "vitest";

describe("toolchain", () => {
  it("runs vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 11: Run the test to confirm the runner works**

Run: `npm run test:run`
Expected: PASS — 1 passed.

- [ ] **Step 12: Confirm the dev server boots, then stop it**

Run: `npm run dev` (wait for "Ready", visit http://localhost:3000, then Ctrl-C)
Expected: page shows "Common Standards MCP — see /api/mcp".

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Vitest project"
```

---

### Task 2: Types and the Common Standards API client

**Files:**
- Create: `lib/types.ts`, `lib/csp-client.ts`
- Test: `lib/__tests__/csp-client.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - Types: `RawJurisdiction`, `RawStandardSetSummary`, `RawJurisdictionDetail`, `RawStandard`, `RawStandardSet`, `NormalizedStandardSet`.
  - `cspHeaders(): Record<string, string>`
  - `cspFetch<T>(path: string): Promise<T>` (returns the unwrapped `.data`)
  - `listJurisdictions(): Promise<RawJurisdiction[]>`
  - `getJurisdiction(id: string): Promise<RawJurisdictionDetail>`
  - `getStandardSet(id: string): Promise<RawStandardSet>`

- [ ] **Step 1: Create the types** — `lib/types.ts`

```ts
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
```

- [ ] **Step 2: Write the failing test** — `lib/__tests__/csp-client.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cspHeaders, cspFetch } from "@/lib/csp-client";

describe("cspHeaders", () => {
  afterEach(() => { delete process.env.CSP_API_KEY; });

  it("omits Api-Key when the env var is unset", () => {
    delete process.env.CSP_API_KEY;
    expect(cspHeaders()["Api-Key"]).toBeUndefined();
  });

  it("omits Api-Key when the env var is blank/whitespace", () => {
    process.env.CSP_API_KEY = "   ";
    expect(cspHeaders()["Api-Key"]).toBeUndefined();
  });

  it("sends Api-Key (trimmed) when the env var is set", () => {
    process.env.CSP_API_KEY = " abc123 ";
    expect(cspHeaders()["Api-Key"]).toBe("abc123");
  });
});

describe("cspFetch", () => {
  beforeEach(() => { delete process.env.CSP_API_KEY; });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("unwraps the top-level `data` envelope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ data: [{ id: "X" }] }), { status: 200 })));
    const result = await cspFetch<Array<{ id: string }>>("/jurisdictions");
    expect(result).toEqual([{ id: "X" }]);
  });

  it("throws a descriptive error on a non-200 response", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401, statusText: "Unauthorized" })));
    await expect(cspFetch("/jurisdictions")).rejects.toThrow(/401/);
  });

  it("calls the correct base URL and path", async () => {
    const spy = vi.fn(async () => new Response(JSON.stringify({ data: {} }), { status: 200 }));
    vi.stubGlobal("fetch", spy);
    await cspFetch("/standard_sets/ABC_D1_grade-04");
    expect(spy).toHaveBeenCalledWith(
      "https://api.commonstandardsproject.com/api/v1/standard_sets/ABC_D1_grade-04",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run test:run -- lib/__tests__/csp-client.test.ts`
Expected: FAIL — cannot resolve `@/lib/csp-client` (module not created yet).

- [ ] **Step 4: Write the implementation** — `lib/csp-client.ts`

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:run -- lib/__tests__/csp-client.test.ts`
Expected: PASS — 6 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/csp-client.ts lib/__tests__/csp-client.test.ts
git commit -m "feat: add Common Standards API client with auth + envelope handling"
```

---

### Task 3: Normalization and filtering (pure functions)

**Files:**
- Create: `lib/normalize.ts`
- Test: `lib/__tests__/normalize.test.ts`

**Interfaces:**
- Consumes: types from `lib/types.ts`.
- Produces:
  - `filterJurisdictions(list: RawJurisdiction[], opts?: { type?: string; titleContains?: string }): RawJurisdiction[]`
  - `filterStandardSets(sets: RawStandardSetSummary[], opts?: { subject?: string; educationLevel?: string }): RawStandardSetSummary[]`
  - `normalizeStandardSet(raw: RawStandardSet): NormalizedStandardSet`
  - `findStandard(set: NormalizedStandardSet, standardId: string): RawStandard | undefined`

- [ ] **Step 1: Write the failing test** — `lib/__tests__/normalize.test.ts`

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- lib/__tests__/normalize.test.ts`
Expected: FAIL — cannot resolve `@/lib/normalize`.

- [ ] **Step 3: Write the implementation** — `lib/normalize.ts`

```ts
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
    standards,
  };
}

export function findStandard(set: NormalizedStandardSet, standardId: string): RawStandard | undefined {
  return set.standards.find((s) => s.id === standardId);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- lib/__tests__/normalize.test.ts`
Expected: PASS — 10 passed.

- [ ] **Step 5: Commit**

```bash
git add lib/normalize.ts lib/__tests__/normalize.test.ts
git commit -m "feat: add pure normalization + filtering helpers"
```

---

### Task 4: Tool functions

**Files:**
- Create: `lib/tools.ts`
- Test: `lib/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `listJurisdictions`, `getJurisdiction`, `getStandardSet` from `lib/csp-client`; all of `lib/normalize`.
- Produces (each returns a plain JSON-serializable object; the route wraps these in the MCP envelope):
  - `listJurisdictionsTool(input: { type?: string; title_contains?: string }): Promise<{ count: number; jurisdictions: RawJurisdiction[] }>`
  - `listStandardSetsTool(input: { jurisdiction_id: string; subject?: string; education_level?: string }): Promise<{ jurisdiction: {...}; count: number; standardSets: RawStandardSetSummary[] }>`
  - `getStandardSetTool(input: { standard_set_id: string }): Promise<NormalizedStandardSet & { standardCount: number; attribution: string }>`
  - `getStandardTool(input: { standard_set_id: string; standard_id: string }): Promise<{ standard: RawStandard; standardSet: {...}; jurisdiction: {...}; attribution: string }>`

- [ ] **Step 1: Write the failing test** — `lib/__tests__/tools.test.ts` (mocks the client so no network is hit)

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test:run -- lib/__tests__/tools.test.ts`
Expected: FAIL — cannot resolve `@/lib/tools`.

- [ ] **Step 3: Write the implementation** — `lib/tools.ts`

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:run -- lib/__tests__/tools.test.ts`
Expected: PASS — 7 passed.

- [ ] **Step 5: Run the whole suite + typecheck**

Run: `npm run test:run && npm run typecheck`
Expected: all tests PASS; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/tools.ts lib/__tests__/tools.test.ts
git commit -m "feat: add the four tool functions composing client + normalize"
```

---

### Task 5: Wire the MCP route

**Files:**
- Create: `app/api/mcp/route.ts`

**Interfaces:**
- Consumes: the four tool functions from `lib/tools`.
- Produces: the live MCP endpoint at `/api/mcp` exposing `list_jurisdictions`, `list_standard_sets`, `get_standard_set`, `get_standard`.

- [ ] **Step 1: Confirm the `mcp-handler` API shape**

Run: `cat node_modules/mcp-handler/README.md | head -80`

Expected: confirm `createMcpHandler` is exported from `mcp-handler`. **Do not** rewrite the route to match the README's examples: the installed README may show a *newer/alternative* API — `server.registerTool(name, { title, description, inputSchema }, handler)`, an `app/api/[transport]/route.ts` path, and a GET/POST-only export. This plan deliberately uses the `server.tool(name, description, zodShape, handler)` overload, a **static** `app/api/mcp/route.ts`, `{ basePath: "/api" }`, and a GET/POST/DELETE export — this is Vercel's current official pattern ([vercel.com/docs/mcp/deploy-mcp-servers-to-vercel](https://vercel.com/docs/mcp/deploy-mcp-servers-to-vercel), updated 2026-03-19) and is verified to compile and run on `@modelcontextprotocol/sdk@1.26.0` (the `tool()` overload is marked deprecated but is present and functional). Only adapt if `createMcpHandler` itself is renamed or absent in the installed version.

- [ ] **Step 2: Write the route** — `app/api/mcp/route.ts`

```ts
import { z } from "zod";
import { createMcpHandler } from "mcp-handler";
import {
  listJurisdictionsTool,
  listStandardSetsTool,
  getStandardSetTool,
  getStandardTool,
} from "@/lib/tools";

export const maxDuration = 60;

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
function fail(e: unknown) {
  const message = e instanceof Error ? e.message : String(e);
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "list_jurisdictions",
      "List U.S. academic-standards jurisdictions (states, organizations like Common Core/NGSS, districts, schools). Optionally filter by type or a title substring. Start here to find a jurisdiction id.",
      {
        type: z.enum(["state", "organization", "school"]).optional(),
        title_contains: z.string().optional().describe("Case-insensitive substring of the jurisdiction title, e.g. 'Arizona'"),
      },
      async (args) => {
        try {
          return ok(await listJurisdictionsTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.tool(
      "list_standard_sets",
      "Given a jurisdiction id, list its standard sets (each is a subject × grade/course, e.g. 'Arizona Math, Grade 4'). Optionally filter by subject substring or education level ('04', 'K'). Use list_jurisdictions first to get the id.",
      {
        jurisdiction_id: z.string().describe("A 32-char jurisdiction id from list_jurisdictions"),
        subject: z.string().optional().describe("Case-insensitive subject substring, e.g. 'math'"),
        education_level: z.string().optional().describe("Zero-padded grade code: 'K','01'..'12'"),
      },
      async (args) => {
        try {
          return ok(await listStandardSetsTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.tool(
      "get_standard_set",
      "Get one full standard set by id: metadata plus every individual standard (text + codes like 4.NF.A.1), with attribution. Get the id from list_standard_sets.",
      {
        standard_set_id: z.string().describe("Compound id like <jurisdictionId>_<documentId>_grade-04"),
      },
      async (args) => {
        try {
          return ok(await getStandardSetTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );

    server.tool(
      "get_standard",
      "Get a single standard by its id within a standard set — its text, code, tree depth, and crosswalk links to matching standards. Requires both the standard_set_id and the standard's id.",
      {
        standard_set_id: z.string().describe("The parent standard set's compound id"),
        standard_id: z.string().describe("The standard's GUID (from get_standard_set)"),
      },
      async (args) => {
        try {
          return ok(await getStandardTool(args));
        } catch (e) {
          return fail(e);
        }
      },
    );
  },
  {},
  { basePath: "/api" },
);

export { handler as GET, handler as POST, handler as DELETE };
```

- [ ] **Step 3: Start the dev server**

Run: `npm run dev` (leave running for the next steps)
Expected: "Ready" with no compile errors.

- [ ] **Step 4: Verify the endpoint responds** (a stateless `tools/list` over Streamable HTTP)

Run:
```bash
curl -s -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```
Expected: a JSON (or SSE `data:` line) response listing the four tool names. If it lists them, the server works. (If the transport requires an `initialize` handshake first, use the MCP Inspector in the next step instead — that is the authoritative check.)

- [ ] **Step 5: Verify with the MCP Inspector (authoritative end-to-end check)**

Run (in a second terminal): `npx @modelcontextprotocol/inspector`
Then in the Inspector UI: Transport = **Streamable HTTP**, URL = `http://localhost:3000/api/mcp` → **Connect** → **List Tools** (expect all four) → run `list_jurisdictions` with no args (expect a large list including "Arizona"), then `list_standard_sets` with that Arizona id, then `get_standard_set` with one of those set ids.
Expected: real data flows through all four tools. Stop the dev server (Ctrl-C) when done.

- [ ] **Step 6: Commit**

```bash
git add app/api/mcp/route.ts
git commit -m "feat: expose the four tools over the MCP Streamable HTTP route"
```

---

### Task 6: Landing page, README, and LICENSE

**Files:**
- Modify: `app/page.tsx`
- Create: `README.md`, `LICENSE`

**Interfaces:**
- Consumes: nothing.
- Produces: a portfolio-quality repo front door and a landing page at `/`.

- [ ] **Step 1: Replace the landing page** — `app/page.tsx`

```tsx
export default function Home() {
  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.25rem", lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: ".25rem" }}>Common Standards MCP</h1>
      <p style={{ color: "#555", marginTop: 0 }}>
        An MCP server that lets an AI assistant look up U.S. academic standards on demand,
        via the <a href="https://commonstandardsproject.com/">Common Standards Project</a>.
      </p>
      <h2>Connect</h2>
      <p>Add this server to an MCP client (e.g. Claude) using its URL:</p>
      <pre style={{ background: "#f4f4f4", padding: "1rem", borderRadius: 8, overflowX: "auto" }}>
        <code>{`/api/mcp  (this deployment's origin + /api/mcp)`}</code>
      </pre>
      <h2>Tools</h2>
      <ul>
        <li><strong>list_jurisdictions</strong> — states &amp; organizations that publish standards</li>
        <li><strong>list_standard_sets</strong> — a jurisdiction&apos;s sets (subject × grade)</li>
        <li><strong>get_standard_set</strong> — every standard in a set, with attribution</li>
        <li><strong>get_standard</strong> — one standard by id, with crosswalks</li>
      </ul>
      <p style={{ color: "#777", fontSize: ".9rem" }}>
        Read-only. Standards data is licensed per set (typically CC BY); see each result&apos;s attribution.
      </p>
    </main>
  );
}
```

- [ ] **Step 2: Create `README.md`**

````markdown
# Common Standards MCP

A small, read-only [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that lets an AI assistant look up U.S. K–12 academic standards on demand, using the free [Common Standards Project](https://commonstandardsproject.com/) API. Built with TypeScript, Next.js, and Vercel's `mcp-handler`.

## What it does

Four read-only tools:

| Tool | Purpose |
|------|---------|
| `list_jurisdictions` | List states + organizations (Common Core, NGSS, …) that publish standards |
| `list_standard_sets` | For a jurisdiction, list its standard sets (subject × grade) |
| `get_standard_set` | Get one set with every standard (text + codes like `4.NF.A.1`) + attribution |
| `get_standard` | Get a single standard by id, with crosswalk links |

## Run locally

```bash
npm install
cp .env.local.example .env.local   # optional: add a CSP_API_KEY
npm run dev                        # serves the MCP at http://localhost:3000/api/mcp
npm run test:run                   # run the test suite
```

Inspect it with `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:3000/api/mcp`.

## Demo

Ask an assistant connected to this server:

> “List Arizona’s math standard sets, then show the standards in the Grade 4 set.”

It chains `list_jurisdictions` → `list_standard_sets` (Arizona) → `get_standard_set`, and answers with the real standards — e.g. `4.NF.A.1 — "Explain why a fraction a/b is equivalent to a fraction (n×a)/(n×b)…"` — each carrying its CC-BY attribution.

_Replace this with a screenshot or a copy of your actual run once deployed (see Task 7)._

## Deploy

Deploy to Vercel (see `docs/superpowers/plans/`). The MCP endpoint is `https://<your-project>.vercel.app/api/mcp`.

Add it to Claude Code:

```bash
claude mcp add --transport http common-standards https://<your-project>.vercel.app/api/mcp
```

## Configuration

| Env var | Required | Notes |
|---------|----------|-------|
| `CSP_API_KEY` | No | A free key from commonstandardsproject.com. The API currently serves data anonymously; if set, it is sent as the `Api-Key` header. Never set it to a blank/placeholder value — an invalid key causes 401s. |

## Attribution & licensing

- **Code:** MIT (see `LICENSE`).
- **Standards data:** licensed per standard set (commonly CC BY 3.0 US); each `get_standard_set` / `get_standard` result includes an `attribution` string. Data retrieved via the Common Standards Project.

## Notes

Optional hardening for a public deployment: add a Vercel Firewall rate-limit rule, or a shared-secret header check in `app/api/mcp/route.ts`. Not required for read-only public data.
````

- [ ] **Step 3: Create `LICENSE`** (MIT)

```text
MIT License

Copyright (c) 2026 Sarah Milne

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 4: Confirm the build passes**

Run: `npm run build`
Expected: Next build succeeds; the `/api/mcp` route appears in the build output.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx README.md LICENSE
git commit -m "docs: add landing page, README, and MIT license"
```

---

### Task 7: Deploy to Vercel and connect to Claude

> This task involves Sarah's personal accounts. The implementer should pause and guide her through the interactive account steps (marked 👤) rather than assume credentials.

**Files:** none (deployment + configuration).

**Interfaces:**
- Consumes: the finished repo.
- Produces: a live MCP at `https://<project>.vercel.app/api/mcp` connected to Claude.

- [ ] **Step 1: 👤 Create/confirm a personal GitHub account and repo**

Confirm which GitHub account should own this (personal, not ASU). Because this is a **portfolio** piece, create the repo **public** so it can be shown to others — this also makes the pushed `spec` and `plan` docs public, so confirm that's fine with Sarah first (nothing in them is sensitive). Create an empty repo named `common-standards-mcp` (via github.com or `gh repo create common-standards-mcp --public --source=. --remote=origin`). If `gh` is authenticated as the ASU account, run `gh auth login` for the personal account first, or add the remote manually:
```bash
git remote add origin https://github.com/<personal-username>/common-standards-mcp.git
```

- [ ] **Step 2: Push**

```bash
git push -u origin main
```
Expected: the repo (spec, plan, code) is on GitHub.

- [ ] **Step 3: 👤 Install the Vercel CLI and log in to the personal account**

```bash
npm i -g vercel
vercel login
```
Expected: logged into Sarah's personal Vercel account (not the asu-prep team).

- [ ] **Step 4: Add the (optional) API key as an env var**

If Sarah has signed up for a `CSP_API_KEY`, set it; otherwise skip (the API serves data anonymously):
```bash
vercel env add CSP_API_KEY production   # paste the key when prompted; repeat for preview/development if desired
```

- [ ] **Step 5: Deploy to production**

```bash
vercel --prod
```
Expected: a production URL like `https://common-standards-mcp-<hash>.vercel.app`. Note the exact origin.

- [ ] **Step 6: Verify the deployed endpoint**

Run: `npx @modelcontextprotocol/inspector` → Streamable HTTP → `https://<project>.vercel.app/api/mcp` → Connect → List Tools → run `list_jurisdictions`.
Expected: the four tools list and return real data from the deployed server.

- [ ] **Step 7: 👤 Connect it to Claude and confirm end-to-end**

```bash
claude mcp add --transport http common-standards https://<project>.vercel.app/api/mcp
```
Then in Claude, ask a real question — e.g. *"Using the common-standards MCP, list Arizona's math standard sets, then show the standards in the Grade 4 set."*
Expected: Claude calls the tools and answers with real standards data. **Done.**

- [ ] **Step 8: Capture the real demo + record the live URL**

Update the README connect URL with the real deployed origin, and replace the placeholder in the README **Demo** section with your actual run — either paste the real prompt-and-answer transcript from Step 7, or add a screenshot/GIF under `docs/`. Then commit and push.

```bash
git add README.md docs/ && git commit -m "docs: record live deployment URL and demo" && git push
```

---

## Self-Review

**Spec coverage:**
- §4 four tools → Tasks 4–5. ✓
- §5 API base URL, `Api-Key`-only-when-set, `.data` unwrap → Task 2 (+ Global Constraints). ✓
- §6 data gotchas (unwrap, map→array, compound ids, zero-padded levels, nullable fields, per-set license) → Tasks 2–4 tests. ✓
- §7 tech stack (TS, Next App Router, `mcp-handler`, SDK 1.26.0, Streamable HTTP, Node runtime, `maxDuration`) → Tasks 1, 5. ✓
- §8 security (open, key server-side) → Task 2 + README hardening note. ✓
- §9 error handling + verification (Inspector, end-to-end) → Task 5 `fail()`, Tasks 5 & 7. ✓
- §10 licensing (MIT code, per-set CC attribution surfaced) → Task 4 `buildAttribution`, Task 6 LICENSE/README. ✓
- §12 accounts (CSP key, personal GitHub, personal Vercel) → Task 7 (👤 steps). ✓
- §13 out of scope (search, ingest, auth) → not built; noted in README. ✓

**Placeholder scan:** No TBD/TODO; all code shown in full; the one runtime-verified variable (`mcp-handler` export name / version) has an explicit confirm step (Task 1 Step 2, Task 5 Step 1). ✓

**Type consistency:** `cspFetch`/`listJurisdictions`/`getJurisdiction`/`getStandardSet` (Task 2) are the exact names imported in Tasks 4–5. `normalizeStandardSet`/`filterJurisdictions`/`filterStandardSets`/`findStandard` (Task 3) match Task 4 imports. Tool function names/inputs (Task 4) match the route registrations (Task 5). ✓

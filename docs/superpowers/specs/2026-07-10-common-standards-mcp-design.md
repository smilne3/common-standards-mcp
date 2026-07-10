# Common Standards MCP — Design Spec

- **Date:** 2026-07-10
- **Author:** Sarah Milne (with Claude)
- **Status:** Approved scope — ready for implementation planning
- **Repo (local):** `/Users/smilne3/dev/common-standards-mcp`

---

## 1. What this is, in one paragraph

A small hosted web service — an **MCP server** — that gives Claude (or any MCP client, like Cursor) a set of tools for pulling real U.S. academic-standards data from the [Common Standards Project](https://commonstandardsproject.com/) on demand. You ask Claude a standards question in plain English ("What are the Arizona 4th-grade math standards?"); Claude quietly calls this service's tools; the service fetches the live data and hands it back; Claude answers. You never leave the chat.

**Why we're building it:** it's a **portfolio piece** — a genuine, transferable "I can build and ship an MCP server" skill, owned by Sarah, deliberately independent of ASU Prep. The Common Standards Project was chosen because it's a free, open, clean, well-documented public API — an ideal real-world thing to wrap.

## 2. Goals and non-goals

**Goals (v1):**
- A working, **live, hosted** MCP server anyone can connect to via a URL.
- Four clean, read-only tools that let Claude browse and retrieve standards (see §4).
- Built with **today's** best-practice stack (TypeScript, Next.js, Vercel's `mcp-handler`).
- Shipped as a **polished personal GitHub repo** (clean code + strong README + demo) that reads as portfolio-quality.
- Correct **attribution** of standards data (the data carries per-set Creative Commons licenses).

**Non-goals (v1) — intentionally deferred to keep the first build clean and reliable:**
- **Keyword search across all standards.** The Common Standards Project farms search out to a separate hosted search service (Algolia) that needs its own credentials and has a 100-requests/hour cap. It adds setup and a failure mode. → **v2.**
- **Mirroring the dataset into our own database.** Copying all standards into a database (for speed/uptime) is the "production-grade" upgrade. v1 calls the live API directly, which is right for a portfolio demo. → **v2.** *(Note: this local-ingest pattern is exactly what ASU's internal version does — see §10.)*
- **Write actions / user accounts / per-user auth.** The server is read-only and open (see §8).

## 3. How it works (architecture)

```
You (in Claude) ──ask──▶ Claude ──calls tool──▶ Common Standards MCP ──HTTPS GET──▶ Common Standards Project API
                                   (on your Vercel)                                   (api.commonstandardsproject.com)
      ▲                                                                                        │
      └──────────────── plain-English answer ◀── Claude ◀── clean JSON ◀── your MCP ◀──────────┘
```

- **One small Next.js app** deployed as a Vercel Function. A single route file defines the tools.
- Tools call the Common Standards Project's public REST API server-side, reshape the response into something clean, and return it to Claude.
- **Transport:** Streamable HTTP (the current MCP standard). No database, no background jobs, no login.

## 4. The tools (v1)

All tools are **read-only**. Inputs use typed schemas (zod) so Claude calls them correctly.

| # | Tool name | What it does (plain) | Inputs | Maps to |
|---|-----------|----------------------|--------|---------|
| 1 | `list_jurisdictions` | List every place that has standards — all 50 states + orgs (Common Core, NGSS, etc.). Discovery entry point. | *(optional)* `type` (`state`\|`organization`\|`school`), `title_contains` — filtered on our side | `GET /api/v1/jurisdictions` |
| 2 | `list_standard_sets` | Given a jurisdiction, list its standard sets (a "set" = jurisdiction × subject × grade, e.g. *Arizona Math, Grade 4*). | `jurisdiction_id` (required); *(optional)* `subject`, `education_level` (e.g. `"04"`, `"K"`) filters | `GET /api/v1/jurisdictions/{id}` |
| 3 | `get_standard_set` | Get one full set: metadata + **every** standard in it (official text, codes like `4.NF.A.1`), plus the license/credit line. | `standard_set_id` (required) | `GET /api/v1/standard_sets/{id}` |
| 4 | `get_standard` | Zoom in on a single standard by its id — its text, code, tree position, and crosswalk links to matching Common Core standards. Derived: fetches the parent set and picks out the one standard. | `standard_set_id` + `standard_id` (both required) | `GET /api/v1/standard_sets/{id}` (filtered) |

**Tool output convention:** each tool returns clean JSON (Claude reads it as text). `get_standard_set` and `get_standard` normalize the raw data (see §6) and always include the attribution block.

## 5. Upstream API reference (verified live 2026-07-10)

- **Base URL:** `https://api.commonstandardsproject.com/api/v1` (the bare `commonstandardsproject.com/api/v1` host serves identical responses; we standardize on the `api.` host).
- **Auth:** an API key is *optional today* — the three read endpoints currently return full data anonymously (HTTP 200). The key goes in an **`Api-Key` request header** when present.
  - **Critical rule:** send a **real key or no key at all** — never a blank/placeholder value. An *invalid-but-present* key forces an HTTP 401. So our client sends the header **only if** the env var is set and non-empty.
  - Anonymous access may be temporary and the docs still imply a key is expected, so we wire the header in from day one.
  - Free key: sign up at commonstandardsproject.com. Single shared key, no OAuth.
- **Data model (three levels, every response wrapped in a top-level `data` key):**
  - **Jurisdiction:** `{ id (32-char UPPERCASE hex), title, type }`.
  - **Standard set:** `{ id (compound, see below), title, subject, normalizedSubject, educationLevels[] (zero-padded: "K","01".."12"), license{ title, URL, rightsHolder }, document{...}, jurisdiction{ id, title }, standards{...} }`.
  - **Standard:** `{ id (GUID), asnIdentifier, position, depth, statementNotation (e.g. "4.NF.A.1"), statementLabel, description (the text), exactMatch[] (crosswalk URLs), ancestorIds[], parentId }`.
- **Rate limits:** none published on the read endpoints (no rate-limit headers seen live). Only the (deferred) search service is capped (100/IP/hour).

## 6. Data-handling rules (the important gotchas)

The implementation **must** handle these — they're the traps the research surfaced:

1. **Unwrap `.data`.** Every response is enveloped under a top-level `data` key.
2. **`standards` is an object *map*, not an array.** On `get_standard_set`, `data.standards` is keyed by standard id. Normalize to an **array** (`Object.values(...)`), ideally sorted by `position`, before returning. Array-assuming code silently breaks.
3. **Standard-set ids are compound:** `<jurisdictionId>_<documentId>_<grade-slug>` (e.g. `28903EF2A9F9469C9BF592D4D0BE10F8_D100036C_grade-01`). Treat as opaque strings passed back in; don't parse or shorten them.
4. **`educationLevels` are zero-padded strings** (`"01"`, not `1`) — filter/sort as strings.
5. **`document.sourceURL` can be `null`.** Guard it.
6. **Attribution is per-set** and only appears on the `standard_sets/{id}` detail response. Do **not** hard-code a single license — read each set's `license` object and surface it.

## 7. Tech stack and key decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Language | **TypeScript** | Transfers to Sarah's Next.js/Vercel skills; makes hosting trivial |
| Framework | **Next.js (App Router)**, single route `app/api/mcp/route.ts` → URL `/api/mcp` | Vercel-native; one file |
| MCP library | **`mcp-handler`** (Vercel's official adapter; pin `@modelcontextprotocol/sdk@1.26.0`, `zod@^3`) | Current best practice; thin wrapper over the official SDK; security floor SDK ≥ 1.26.0 |
| Transport | **Streamable HTTP** (stateless) | Current MCP standard; no Redis/SSE needed for read-only |
| Hosting | **Personal Vercel**, Fluid Compute (default), Node runtime | Sarah's stack; live URL for the portfolio |
| Runtime config | Node runtime; `maxDuration = 60` (optional safety for cold upstream) | `mcp-handler` uses Node deps; not Edge |
| Code home | **Personal GitHub** repo `common-standards-mcp` | Keeps it Sarah's, separate from ASU |
| Upstream key | Optional; stored server-side as env var `CSP_API_KEY`; header sent only if set | Never exposed to clients; avoids the blank-key 401 trap |

## 8. Security & privacy

- **Read-only, public data.** No write paths, no personal data, no user accounts.
- **Open (no auth on our server).** Anyone with the URL can call the tools. The only real exposure is someone using our upstream quota — acceptable for public read-only data. The upstream `CSP_API_KEY` stays server-side (never shipped to clients).
- **Optional hardening (documented, not required for v1):** a Vercel Firewall rate-limit rule, or a single shared-secret header checked in the handler. We'll note these in the README as easy add-ons.

## 9. Error handling & verification

- **Errors:** if the upstream returns a non-200, the tool returns a clear error message (status + which id failed) rather than throwing an opaque failure. Missing/blank `CSP_API_KEY` is treated as "no key" (header omitted), not an error.
- **Verification (before calling it done):**
  - Run locally, connect the **MCP Inspector** (Streamable HTTP → `http://localhost:3000/api/mcp`), confirm all four tools list and each returns real data for a known id (e.g. Arizona → a math set → its standards).
  - Deploy, then connect from Claude and confirm a real end-to-end question works (e.g. "List the Arizona jurisdictions' math standard sets").

## 10. Licensing & attribution

- **Code:** this repo will be **MIT** licensed (the common default for a portfolio repo; easy to change to Apache-2.0 if preferred). *(The Common Standards Project's own server code is Apache-2.0.)*
- **Standards data:** licensed **per standard set**, carried in each set's `license` object — commonly **CC BY 3.0 US** (rights holder often "D2L / Achievement Standards Network"). CC BY permits commercial, portfolio, and redistribution use **with attribution**. The MCP therefore surfaces each set's `license` (title, URL, rightsHolder) so any consumer can attribute correctly. The README will credit the Common Standards Project and note the per-set licensing.

## 11. Prior art (honest note)

- **`asuprep/who-knows-what`** — ASU Prep's *own* internal MCP — already wraps this same Common Standards Project data (it's the "Who Knows What" tool connected in Sarah's session). It's a heavier production system: Next.js + Vercel + Supabase (Postgres + pgvector), ingests the data locally, maps it to the CASE 1.0 standard, adds OAuth and ~7–8 tools (including semantic search, Bloom's, DOK).
- **This is fine and intentional.** This project is a **personal, from-scratch, public-data build** under Sarah's own accounts — a cleaner, lighter "here's how an MCP works" showcase, not a replacement for or duplicate of ASU's. No third-party CSP MCP exists publicly; the closest reference is an abandoned 2016 npm wrapper (`common-core-api`).

## 12. What Sarah needs to provide (later, with guidance)

1. A free **Common Standards Project** account → API key (optional but we'll wire it in).
2. A **personal GitHub** account (separate from ASU) to host the repo.
3. A **personal Vercel** account to deploy to.
- Claude will walk through each when we reach that step; none are needed to start building.

## 13. Out of scope / future (v2+)

- `search_standards` (Algolia-backed keyword search, with the 100/hr cap handled).
- Local data ingest + our own search/embeddings for speed and uptime.
- Optional CASE-format output for interoperability.
- Optional server auth / rate limiting if it ever hosts more than public data.

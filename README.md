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

It chains `list_jurisdictions` → `list_standard_sets` (Arizona) → `get_standard_set`, and answers with the real standards — each carrying its CC-BY attribution. For example, `list_jurisdictions` filtered to “Arizona” returns:

```json
{
  "count": 2,
  "jurisdictions": [
    { "id": "0B41FFF6B5114EB0B8A89CE0E70E22D8", "title": "Arizona", "type": "state" },
    { "id": "07130F1D86804B4D9D41E610BA605DA2", "title": "Arizona - Tucson Unified School District - Mansfeld Magnet Middle School", "type": "organization" }
  ]
}
```

_Tip: once deployed, add a screenshot or GIF of Claude answering a standards question here._

## Deploy

Deployed on Vercel. The live MCP endpoint is `https://common-standards-project.vercel.app/api/mcp`.

Add it to Claude Code:

```bash
claude mcp add --transport http common-standards https://common-standards-project.vercel.app/api/mcp
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

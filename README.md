# registrum-mcp-examples

[![npm](https://img.shields.io/npm/v/%40registrum%2Fmcp?label=%40registrum%2Fmcp)](https://www.npmjs.com/package/@registrum/mcp)
[![API status](https://uptime.betterstack.com/status-badges/v1/monitor/4158135.svg)](https://status.registrum.co.uk)
[![Licence](https://img.shields.io/badge/licence-MIT-green)](LICENSE)

Example prompts and scripts for the [Registrum MCP server](https://github.com/vdmeu/registrum-mcp) -- an [MCP](https://modelcontextprotocol.io) server that gives Claude, Cursor, and any other MCP-compatible agent live access to enriched UK Companies House data: company profiles, structured financials, directors, ECCTA identity-verification status, PSC/beneficial ownership, and director networks.

**8 tools:** `search_company`, `get_company`, `get_financials`, `get_directors`, `get_compliance`, `get_psc`, `get_psc_chain`, `get_network`. Run [`list-tools.mjs`](examples/list-tools.mjs) for the authoritative, live list -- this README is checked against the running server, but the server is the source of truth.

This repo has two parts:

- **A prompt cookbook** below -- copy these straight into Claude Desktop, Claude Code, or Cursor once the server is connected.
- **Runnable scripts** in [`examples/`](examples/) that drive the server programmatically with the MCP TypeScript SDK, for when you're building your own agent rather than chatting.

## Set up the server first

This repo doesn't run standalone -- it connects to the actual MCP server. Add it to your client's config:

```json
{
  "mcpServers": {
    "registrum": {
      "command": "npx",
      "args": ["-y", "@registrum/mcp"],
      "env": { "REGISTRUM_API_KEY": "reg_live_..." }
    }
  }
}
```

Claude Desktop: `~/.claude/claude_desktop_config.json`. Cursor: `.cursor/mcp.json`. Full instructions: [registrum-mcp](https://github.com/vdmeu/registrum-mcp).

Free API key, no credit card: [registrum.co.uk](https://registrum.co.uk) -- 50 calls/month.

## Prompt cookbook

Real prompts, and which tools the agent calls to answer them.

**"Who are the directors of Tesco PLC, and what other companies are they connected to?"**
→ `search_company` to resolve the name, then `get_directors` and `get_network`.

**"Do a KYB check on company 12345678 -- who actually owns it?"**
→ `get_psc` for the immediate ownership layer, then `get_psc_chain` to trace corporate PSCs up to natural persons or foreign entities (the ultimate beneficial owners).

**"Pull the last two years of financials for Rolls-Royce and tell me if revenue is growing."**
→ `search_company`, then `get_financials`. If accounts are PDF-only, `data_quality.source` will say `pdf` instead of `ixbrl`, and some fields may be null -- ask the agent to check `data_quality.missing_fields` before drawing conclusions.

**"Map the corporate group around Barratt Developments two levels deep."**
→ `get_network` with `depth: 2` (requires a Pro/Enterprise key -- Free/Web get a 403 with an upgrade link).

**"Is company 09876543 a shell? Check ownership, financials, and whether it shares directors with anything else."**
→ Chains five tools: `get_company`, `get_psc_chain`, `get_financials`, `get_directors`, `get_network`.

**"Which of these 20 companies has anyone who hasn't verified their identity with Companies House yet?"**
→ `get_compliance` per company. From **18 November 2026**, ECCTA requires every UK director and PSC to verify their identity, and unverified officers can block filings. Ask the agent to separate `overdue` from `pending` -- see the gotcha below, because conflating them is the standard mistake here. Requires a Pro key.

## Scripts

Each one is a standalone, no-build Node script using the [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)'s `Client` over stdio -- useful if you're wiring Registrum into your own agent instead of a chat client.

```bash
npm install
export REGISTRUM_API_KEY=reg_live_...

node examples/list-tools.mjs
node examples/beneficial-ownership-check.mjs "Tesco PLC"
node examples/director-network-map.mjs 00445790 --depth=2
node examples/financial-screening.mjs 00445790 12345678
node examples/eccta-compliance-check.mjs 00445790 03824658
```

| Script | Use case |
|---|---|
| [`list-tools.mjs`](examples/list-tools.mjs) | Minimal MCP client connection -- the "hello world" |
| [`beneficial-ownership-check.mjs`](examples/beneficial-ownership-check.mjs) | KYB/AML: resolve a name, then walk the PSC chain to find UBOs |
| [`director-network-map.mjs`](examples/director-network-map.mjs) | Corporate group / related-party discovery via shared directors |
| [`financial-screening.mjs`](examples/financial-screening.mjs) | Batch financial screening across a list of companies |
| [`eccta-compliance-check.mjs`](examples/eccta-compliance-check.mjs) | ECCTA: portfolio identity-verification status, overdue separated from pending |

## Gotchas these scripts handle

### 1. Tool results are JSON-as-text, not native JSON

MCP tools return `{ content: [{ type: "text", text: "<json string>" }] }` -- the payload is a string you `JSON.parse()` yourself, not a structured object the SDK hands you. See [`_client.mjs`](examples/_client.mjs).

### 2. `get_psc_chain` returns a tree, not a flat owner list

Corporate PSCs get resolved recursively, so the response is a nested tree (`pscs[].children`), not a flat array of beneficial owners. You walk it to collect the terminal nodes -- see `collectTerminalNodes()` in [`beneficial-ownership-check.mjs`](examples/beneficial-ownership-check.mjs).

### 3. `depth: 2` on `get_network` needs a Pro/Enterprise key

Free and Web-tier keys get a 403 on `depth: 2` -- `depth: 1` (direct connections only) works on every plan. Cold-cache depth-2 traversal is also intentionally capped at 30 connected companies (`truncated: true` in the response).

### 4. Not every company has structured financials

`get_financials` returns `available: false` with an `unavailable_reason` (`no_ixbrl_filings`, `image_pdf`, etc.) for a meaningful share of UK companies -- micro-entities and dormant companies especially. Check `available` before reading `profit_and_loss`.

### 5. Financial fields are `{ current, prior }` pairs, not bare numbers

`profit_and_loss.turnover` (and every other P&L / balance sheet field) is `{ current, prior }` -- the two most recently filed years -- or `null` if that line wasn't present in the filing. `field.toLocaleString()` will throw; `field.current.toLocaleString()` is what you want. See `fmt()` in [`financial-screening.mjs`](examples/financial-screening.mjs).

### 6. `pending` is not `overdue` on `get_compliance`

ECCTA identity verification is not a boolean. `pending` means a person's deadline **has not
passed yet** -- a normal state during the transition to 18 Nov 2026, and not a failure.
`overdue` means a deadline was actually missed. They are returned as separate counters
precisely so you don't have to guess, and collapsing them into one "unverified" flag will
overstate risk across most of the register. `verification_rate` counts only genuinely verified
people, so it is deliberately low right now and that is not a data error. See
[`eccta-compliance-check.mjs`](examples/eccta-compliance-check.mjs).

### 7. Every tool result is wrapped in the API's response envelope

The underlying REST API wraps every payload in `{ status, data, cached, cache_age_seconds, data_source }`, and the MCP tools pass that envelope straight through as the tool's text content -- it isn't unwrapped for you. `_client.mjs`'s `call()` does `JSON.parse(...).data` so every other script gets the plain payload.

## Building this without the MCP server

Registrum is a normal REST API under the hood -- the MCP server is a thin wrapper. If you'd rather call `api.registrum.co.uk` directly from Python or Node without an agent in the loop, see [companies-house-api-python-starter](https://github.com/RegistrumUK/companies-house-api-python-starter) and [companies-house-api-node-starter](https://github.com/RegistrumUK/companies-house-api-node-starter) -- or hit the raw, free [Companies House API](https://developer.company-information.service.gov.uk) directly and handle auth, rate limits, and iXBRL parsing yourself.

## License

MIT.

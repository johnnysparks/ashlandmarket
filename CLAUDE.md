# CLAUDE.md — Ashland Market Heat Map

## Multi-Agent Coordination Protocol

This project runs up to 5 Claude agents concurrently. Coordination is built around non-overlapping file ownership to minimize merge conflicts.

### Prompt Format

```
"Go X/Y"
```

- **X** = your agent number (order kicked off, 1-indexed)
- **Y** = total agents running concurrently

Examples:
- `Go 1/4` — you are agent 1 of 4
- `Go 3/5` — you are agent 3 of 5
- `Go` — solo/unstructured, pick the highest-impact work and go

### Agent Assignment Table

Agents are assigned by their number to work areas. Check `TODO.md` for the current task list — find your section and work it.

| Agent # | Primary Ownership | Directory/Files |
|---------|------------------|-----------------|
| 1 | Data pipeline + scraper | `data/`, `data/scraper/` |
| 2 | Approach A (Mapbox GL + React) | `approach-a/` |
| 3 | Approach B (Leaflet + Vanilla JS + D3) | `approach-b/` |
| 4 | Approach C (Deck.gl + Svelte) | `approach-c/` |
| 5 | Shared infra, docs, tooling, CI | `docs/`, root config files |

**When Y < 5**, agents absorb extra responsibilities:

| Agents (Y) | Assignment |
|-------------|-----------|
| 1 | Do whatever has highest impact |
| 2 | Agent 1: data + approaches A/B. Agent 2: approach C + shared infra |
| 3 | Agent 1: data pipeline. Agent 2: approach A + B. Agent 3: approach C + shared |
| 4 | Agent 1: data. Agent 2: approach A. Agent 3: approach B. Agent 4: approach C + shared |
| 5 | Full table above |

### Conflict Avoidance Rules

1. **Stay in your lane.** Only modify files in your assigned directories.
2. **Shared files are owned by the highest-numbered agent** (or agent 5 if present). Shared files include: root `package.json`, `.gitignore`, `README.md`, `CLAUDE.md`, `TODO.md`.
3. **`data/parcels.json` schema is a contract.** If you need to change the parcel data shape, document the proposed change in `docs/schema-proposals.md` — don't just change it. Other approaches depend on this schema.
4. **Commit early, commit often.** Small commits reduce merge pain.
5. **Branch per agent when possible.** If merge conflicts become a problem, the human will set up per-agent branches.

### What Each Agent Should Do on Start

1. Read `CLAUDE.md` (this file)
2. Read `TODO.md` — find your section based on your agent number and total count
3. Read `README.md` for project context if needed
4. Start working on the next unchecked item in your section
5. Update `TODO.md` to mark items in progress / done as you go

### The "Go" Command (No Numbers)

When the human just says `Go`:
- Scan `TODO.md` for the highest-priority unchecked item across all sections
- Work on it
- Don't worry about conflicts — the human will handle merges

---

## Roles

### Human (Johnny)
- Provides resources: API keys, data files, design decisions, clarification
- Resolves merge conflicts between agents
- Sets priorities by reordering `TODO.md`
- Kicks off agents with `Go X/Y`

### Claude Agents
- Own their assigned work areas completely
- Make implementation decisions within their scope
- Write tests for their own code
- Keep `TODO.md` updated with progress
- Ask the human when blocked (need API key, design decision, data file, etc.)

---

## Project Overview

Ashland OR Real Estate Heat Map. Mobile-first interactive map showing parcel-level data from Jackson County public records. Three parallel implementations race to find the best architecture.

See `README.md` for the full specification.

## Tech Stack by Area

| Area | Stack |
|------|-------|
| Scraper | Python (requests, BeautifulSoup), outputs JSON |
| Approach A | React, Mapbox GL JS, Vite |
| Approach B | Vanilla JS, Leaflet, D3.js, plain HTML/CSS |
| Approach C | Svelte, Deck.gl, Vite |
| Shared | Static JSON data, GitHub Pages hosting |

## Build / Test / Run Commands

Each approach is self-contained. See each approach directory's README for specific commands. General pattern:

```bash
# Data pipeline
cd data/scraper && python jaco_scraper.py

# Approach A
cd approach-a && npm install && npm run dev

# Approach B
cd approach-b && npx serve .   # or python -m http.server

# Approach C
cd approach-c && npm install && npm run dev
```

## Code Style

- No framework-specific linters enforced yet — each approach sets its own
- Python: follow PEP 8, use type hints
- JS/TS: prefer ES modules, const/let over var, no semicolons optional
- Mobile-first: test in 390x844 viewport (iPhone 14)
- Keep dependencies minimal — this ships to GitHub Pages as static files

## Data Contract

The shared data interface between the scraper and all three approaches:

```jsonc
// data/parcels.json — master index
{
  "generated": "2026-02-08T00:00:00Z",
  "parcels": [
    {
      "account": "10059095",
      "lat": 42.1945,
      "lng": -122.7095,
      "address": "123 Main St",
      "sqft_living": 1850,
      "sqft_lot": 7500,
      "year_built": 1952,
      "last_sale_price": 425000,
      "last_sale_date": "2023-06-15",
      "price_per_sqft": 229.73,
      "price_per_sqft_lot": 56.67,
      "assessed_value": 380000,
      "num_sales": 4,
      "num_permits": 2
    }
  ]
}

// data/sales/{account}.json — per-parcel detail
{
  "account": "10059095",
  "sales": [
    { "date": "2023-06-15", "price": 425000, "buyer": "SMITH JOHN", "type": "WARRANTY DEED" }
  ],
  "permits": [
    { "number": "B-2021-0456", "type": "REMODEL", "date": "2021-03-12", "status": "FINAL" }
  ],
  "improvements": [
    { "type": "DWELLING", "sqft": 1850, "year_built": 1952, "condition": "AVERAGE" }
  ]
}
```

This schema is a **shared contract**. All three approaches read from it. The scraper writes to it. Changes require coordination — propose in `docs/schema-proposals.md`.

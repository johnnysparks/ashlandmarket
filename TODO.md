# TODO — Ashland Market Heat Map

> **How to use this file:**
> Find your section based on your agent number from `Go X/Y`.
> Work items top-to-bottom. Mark `[x]` when done, `[~]` when in progress.
> See `CLAUDE.md` for the full agent assignment table.

---

## Phase 1: Data Pipeline (Agent 1)

### 1.1 Project Setup
- [x] Create `data/scraper/` directory structure
- [x] Set up Python project (`requirements.txt`) with requests, beautifulsoup4, lxml
- [x] Create `.gitignore` (Python venvs, `__pycache__`, `.env`, `node_modules`, raw HTML cache)

### 1.2 Parcel Seed List
- [x] Research Jackson County GIS data sources for Ashland parcel list
- [x] Fetch 10,317 Ashland parcels from ODOT ArcGIS (maptaxlot + polygon centroids)
- [~] Get account numbers (county spatial server intermittently down — `spatial.jacksoncountyor.gov` returns 502)
- [x] Output initial `data/parcels.json` with maptaxlot, lat, lng (other fields null pending scrape)

> **Note:** ODOT endpoint provides maptaxlot + geometry but no account numbers or addresses.
> The JCGIS AGOL hosted layer has the fields but returns null for non-geometry attributes.
> The county spatial server (`spatial.jacksoncountyor.gov`) has full data but is intermittently down.
> PDO `sales.cfm` supports both `?account=` and `?maptaxlot=` parameters.
> When the county server comes back, re-run `python jaco_scraper.py seed` to get full data.

### 1.3 Scraper
- [x] Build scraper for PDO sales page (`/pdo/sales.cfm?account=...` or `?maptaxlot=...`)
- [x] Build scraper for PDO property detail page (note: `detail.cfm` returns 404 — URL may have changed)
- [x] Build scraper for PDO permit page (note: `permit.cfm` returns 404 — URL may have changed)
- [x] Add rate limiting (0.75s between requests)
- [x] Add raw HTML caching (don't re-scrape what we have)
- [x] Add resume capability (skip already-cached accounts)

### 1.4 Parser
- [x] Parse sales history from cached HTML → structured JSON (tested on real data)
- [~] Parse property details (sqft, lot size, year built, improvements) — parser ready, needs working detail page URL
- [~] Parse permit history — parser ready, needs working permit page URL
- [x] Write per-account JSON files to `data/sales/{account}.json`
- [x] Update `data/parcels.json` master index with computed fields (price_per_sqft, etc.)

### 1.5 Aggregation
- [x] Precompute hexbin aggregation for $/sqft (code ready, runs after parse step)
- [x] Precompute grid-square aggregation (code ready, runs after parse step)
- [x] Write aggregate JSONs to `data/aggregates/`

### Data Pipeline Commands
```bash
cd data/scraper
python jaco_scraper.py seed       # Fetch parcel geometry from GIS
python jaco_scraper.py scrape     # Scrape PDO pages (sales history)
python jaco_scraper.py parse      # Parse HTML → JSON
python jaco_scraper.py aggregate  # Precompute hex/grid aggregations
python jaco_scraper.py status     # Show pipeline progress
```

---

## Phase 2: Approach A — Mapbox GL + React (Agent 2)

### 2.1 Project Setup
- [x] Initialize React + Vite project in `approach-a/`
- [x] Install mapbox-gl, react-map-gl dependencies
- [x] Create `approach-a/README.md` with setup instructions (incl. Mapbox token)
- [x] Set up basic dev server, confirm it runs

### 2.2 MVP Map
- [x] Render Ashland-centered Mapbox map (42.1945, -122.7095, zoom ~14)
- [x] Load `data/parcels.json` and render parcel markers/circles
- [x] Color parcels by $/sqft using a sequential color ramp
- [x] Tap/click parcel → tooltip with key stats

### 2.3 Controls
- [x] Overlay metric selector (dropdown or toggle group)
- [x] Color ramp picker
- [x] Opacity slider
- [x] Time window filter (date range for sales)

### 2.4 Detail View
- [x] Tap parcel at high zoom → slide-up panel
- [x] Load per-account JSON, display sales history
- [x] Price trajectory chart (simple line chart)
- [x] Permit list, improvement breakdown

---

## Phase 2: Approach B — Leaflet + Vanilla JS + D3 (Agent 3)

### 3.1 Project Setup
- [x] Create `approach-b/` with `index.html`, `style.css`, `main.js`
- [x] Include Leaflet + D3 via CDN or local bundle
- [x] Create `approach-b/README.md` with setup instructions
- [x] Confirm map renders with `npx serve .` or `python -m http.server`

### 3.2 MVP Map
- [x] Render Ashland-centered Leaflet map with OSM tiles
- [x] Load `data/parcels.json`, create GeoJSON layer from parcels
- [x] D3 color scale for $/sqft, apply to parcel markers
- [x] Click parcel → popup/tooltip with key stats

### 3.3 Controls
- [x] Overlay metric selector (HTML select or button group)
- [x] D3 color ramp switching
- [x] Opacity control
- [x] Time window filter (range inputs)

### 3.4 Detail View
- [x] Click parcel → side panel or modal with full history
- [x] Fetch per-account JSON, render sales table
- [x] D3 line chart for price trajectory
- [x] Permit list, improvement breakdown

---

## Phase 2: Approach C — Deck.gl + Svelte (Agent 4)

### 4.1 Project Setup
- [x] Initialize Svelte + Vite project in `approach-c/`
- [x] Install deck.gl, @luma.gl dependencies
- [x] Create `approach-c/README.md` with setup instructions
- [x] Set up basic dev server, confirm it runs

### 4.2 MVP Map
- [x] Render Ashland-centered map with Deck.gl base map
- [x] Load `data/parcels.json`, create ScatterplotLayer for parcels
- [x] HexagonLayer colored by $/sqft
- [x] Click/hover → tooltip with key stats

### 4.3 Controls
- [x] Svelte UI for overlay metric selector
- [x] Color ramp controls
- [x] Opacity and aggregation radius sliders
- [x] Time window filter

### 4.4 Detail View
- [x] Click parcel → Svelte slide-up panel
- [x] Load per-account JSON, display sales history
- [x] Chart component for price trajectory
- [x] Permit list, improvement breakdown

---

## Shared / Infra (Agent 5, or highest-numbered agent)

### 5.1 Project Setup
- [x] Create `docs/` directory
- [x] Create `docs/schema-proposals.md` (empty template for schema change requests)
- [x] Set up GitHub Pages deployment config (`.github/workflows/deploy.yml`)
- [x] Add sample/mock data for frontend development before scraper is done

### 5.2 Mock Data
- [x] Generate `data/parcels.json` with ~50 realistic mock parcels in Ashland
- [x] Generate a few `data/sales/{account}.json` mock files
- [x] Generate a mock aggregate file in `data/aggregates/`
- [x] Document mock data format in `docs/mock-data.md`

### 5.3 Integration
- [~] Verify all three approaches can load and render mock data (Approach C verified; A & B not started yet)
- [x] Document any schema issues found during integration (none found — schema is clean)
- [x] Set up a simple comparison page or notes for evaluating the three approaches (`docs/approach-comparison.md`)

---

## Backlog (Unassigned — grab these when primary work is done)

- [x] Phase 3: Aggregation mode switching (hexbin, grid, neighborhood polygon) — **Approach B done** (hexbin toggle)
- [x] Phase 3: Percentile clamp control (clip outliers) — **Approach B done** (adjustable lo/hi sliders)
- [ ] Phase 3: Multiple overlay metrics wired up across all approaches
- [ ] Phase 4: Compare mode (pin multiple parcels)
- [ ] Phase 5: Walkability/amenity overlays
- [x] Phase 5: Search/filter by criteria — **Approach B done** (address/account search with results)
- [ ] Phase 5: Offline/PWA support

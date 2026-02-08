# TODO — Ashland Market Heat Map

> **How to use this file:**
> Find your section based on your agent number from `Go X/Y`.
> Work items top-to-bottom. Mark `[x]` when done, `[~]` when in progress.
> See `CLAUDE.md` for the full agent assignment table.

---

## Phase 1: Data Pipeline (Agent 1)

### 1.1 Project Setup
- [ ] Create `data/scraper/` directory structure
- [ ] Set up Python project (`pyproject.toml` or `requirements.txt`) with requests, beautifulsoup4, lxml
- [ ] Create `.gitignore` (Python venvs, `__pycache__`, `.env`, `node_modules`, raw HTML cache)

### 1.2 Parcel Seed List
- [ ] Research Jackson County GIS data sources for Ashland parcel list
- [ ] Download or scrape Ashland parcel/account numbers with addresses
- [ ] Geocode parcels (county GIS shapefiles or Nominatim) to get lat/lng
- [ ] Output initial `data/parcels.json` with account, address, lat, lng (other fields null)

### 1.3 Scraper
- [ ] Build scraper for PDO sales page (`/pdo/sales.cfm?account=...`)
- [ ] Build scraper for PDO property detail page
- [ ] Build scraper for PDO permit page
- [ ] Add rate limiting (be respectful — 1-2 req/sec max)
- [ ] Add raw HTML caching (don't re-scrape what we have)
- [ ] Add resume capability (pick up where we left off)

### 1.4 Parser
- [ ] Parse sales history from cached HTML → structured JSON
- [ ] Parse property details (sqft, lot size, year built, improvements)
- [ ] Parse permit history
- [ ] Write per-account JSON files to `data/sales/{account}.json`
- [ ] Update `data/parcels.json` master index with computed fields (price_per_sqft, etc.)

### 1.5 Aggregation
- [ ] Precompute hexbin aggregation for $/sqft
- [ ] Precompute grid-square aggregation
- [ ] Write aggregate JSONs to `data/aggregates/`

---

## Phase 2: Approach A — Mapbox GL + React (Agent 2)

### 2.1 Project Setup
- [ ] Initialize React + Vite project in `approach-a/`
- [ ] Install mapbox-gl, react-map-gl dependencies
- [ ] Create `approach-a/README.md` with setup instructions (incl. Mapbox token)
- [ ] Set up basic dev server, confirm it runs

### 2.2 MVP Map
- [ ] Render Ashland-centered Mapbox map (42.1945, -122.7095, zoom ~14)
- [ ] Load `data/parcels.json` and render parcel markers/circles
- [ ] Color parcels by $/sqft using a sequential color ramp
- [ ] Tap/click parcel → tooltip with key stats

### 2.3 Controls
- [ ] Overlay metric selector (dropdown or toggle group)
- [ ] Color ramp picker
- [ ] Opacity slider
- [ ] Time window filter (date range for sales)

### 2.4 Detail View
- [ ] Tap parcel at high zoom → slide-up panel
- [ ] Load per-account JSON, display sales history
- [ ] Price trajectory chart (simple line chart)
- [ ] Permit list, improvement breakdown

---

## Phase 2: Approach B — Leaflet + Vanilla JS + D3 (Agent 3)

### 3.1 Project Setup
- [ ] Create `approach-b/` with `index.html`, `style.css`, `main.js`
- [ ] Include Leaflet + D3 via CDN or local bundle
- [ ] Create `approach-b/README.md` with setup instructions
- [ ] Confirm map renders with `npx serve .` or `python -m http.server`

### 3.2 MVP Map
- [ ] Render Ashland-centered Leaflet map with OSM tiles
- [ ] Load `data/parcels.json`, create GeoJSON layer from parcels
- [ ] D3 color scale for $/sqft, apply to parcel markers
- [ ] Click parcel → popup/tooltip with key stats

### 3.3 Controls
- [ ] Overlay metric selector (HTML select or button group)
- [ ] D3 color ramp switching
- [ ] Opacity control
- [ ] Time window filter (range inputs)

### 3.4 Detail View
- [ ] Click parcel → side panel or modal with full history
- [ ] Fetch per-account JSON, render sales table
- [ ] D3 line chart for price trajectory
- [ ] Permit list, improvement breakdown

---

## Phase 2: Approach C — Deck.gl + Svelte (Agent 4)

### 4.1 Project Setup
- [ ] Initialize Svelte + Vite project in `approach-c/`
- [ ] Install deck.gl, @luma.gl dependencies
- [ ] Create `approach-c/README.md` with setup instructions
- [ ] Set up basic dev server, confirm it runs

### 4.2 MVP Map
- [ ] Render Ashland-centered map with Deck.gl base map
- [ ] Load `data/parcels.json`, create ScatterplotLayer for parcels
- [ ] HexagonLayer colored by $/sqft
- [ ] Click/hover → tooltip with key stats

### 4.3 Controls
- [ ] Svelte UI for overlay metric selector
- [ ] Color ramp controls
- [ ] Opacity and aggregation radius sliders
- [ ] Time window filter

### 4.4 Detail View
- [ ] Click parcel → Svelte slide-up panel
- [ ] Load per-account JSON, display sales history
- [ ] Chart component for price trajectory
- [ ] Permit list, improvement breakdown

---

## Shared / Infra (Agent 5, or highest-numbered agent)

### 5.1 Project Setup
- [x] Create `docs/` directory
- [x] Create `docs/schema-proposals.md` (empty template for schema change requests)
- [ ] Set up GitHub Pages deployment config if needed
- [x] Add sample/mock data for frontend development before scraper is done
- [x] Create `.gitignore` (Python, Node, IDE, OS, scraper cache)

### 5.2 Mock Data
- [x] Generate `data/parcels.json` with ~50 realistic mock parcels in Ashland
- [x] Generate a few `data/sales/{account}.json` mock files (10 parcels)
- [x] Generate a mock aggregate file in `data/aggregates/`
- [x] Document mock data format in `docs/mock-data.md`

### 5.3 Integration
- [ ] Verify all three approaches can load and render mock data
- [ ] Document any schema issues found during integration
- [ ] Set up a simple comparison page or notes for evaluating the three approaches

---

## Backlog (Unassigned — grab these when primary work is done)

- [ ] Phase 3: Aggregation mode switching (hexbin, grid, neighborhood polygon)
- [ ] Phase 3: Percentile clamp control (clip outliers)
- [ ] Phase 3: Multiple overlay metrics wired up across all approaches
- [ ] Phase 4: Compare mode (pin multiple parcels)
- [ ] Phase 5: Walkability/amenity overlays
- [ ] Phase 5: Search/filter by criteria
- [ ] Phase 5: Offline/PWA support

# Ashland OR Real Estate Heat Map

A mobile-first interactive map of Ashland, Oregon showing parcel-level real estate data scraped from Jackson County public records. Three parallel implementations race to find the best architecture.

## The Problem

Jackson County has solid public records tooling (https://pdo.jacksoncountyor.gov) but the UX is desktop-oriented, single-parcel, and impossible to get a neighborhood-level read from. We want spatial context: which blocks are heating up, where’s the value, what fits our search criteria.

## Data Sources

**Primary: Jackson County PDO**

- Sales history per account: `https://pdo.jacksoncountyor.gov/pdo/sales.cfm?account={ACCOUNT_ID}`
- Property detail pages for sq footage, lot size, improvements, assessed values
- Permit history per parcel

**Secondary (stretch)**

- OpenStreetMap for walkability/amenity proximity
- Census/ACS for density metrics
- Oregon DEQ or city GIS for zoning overlays

## Data Points Per Parcel

Core (scrapeable from county):

- Sale price history (all recorded sales)
- % price change YoY
- $/sqft livable space
- $/sqft land
- Lot size vs improvement size (over/under-built ratio)
- Days on market (if available from MLS supplement)
- Permit pull count and types
- Number of improvements/structures
- Year built, effective year

Derived/computed:

- Neighborhood median price trend (spatial aggregate)
- Price deviation from local median (over/underpriced signal)
- Improvement-to-land ratio percentile
- Sale velocity (volume per area per time window)

Stretch:

- Walking distance to nearest coffee shop, grocery, park
- Zoning density variety within radius
- School proximity

## Interfaces

### 1. Map View

Ashland OR centered, zoom/pan (touch-friendly).

**Data overlay selector** — pick which metric to visualize as the heat/choropleth layer. One active overlay at a time, with opacity control.

**Overlay controls panel:**

- Aggregation method: per-parcel raw, hexbin, grid square, neighborhood polygon
- Bin count / gradient stops
- Color ramp picker (sequential, diverging, categorical)
- Time window slider (filter sales to date range)
- Label toggle (show values on parcels at high zoom)
- Percentile clamp (clip outliers, e.g. show 5th-95th)

**Interaction:**

- Hover/tap parcel → tooltip with key stats
- Tap parcel at high zoom → opens Detail View
- Long-press or shift-click → compare mode (pin multiple parcels)

### 2. Detail View

Full property dossier for a single account/parcel.

- All recorded sales with price, date, buyer type
- Price trajectory chart (line graph, inflation-adjusted toggle)
- Tax assessed vs market sale delta
- Permit timeline
- Improvement inventory (structures, sqft, year)
- Lot diagram if GIS polygon available
- “Similar nearby” quick links

## Architecture Constraints

- **No live database.** All data is either:
  - Pre-scraped into static JSON files (per-parcel and aggregate)
  - Computed client-side from loaded JSON
- Hosted on GitHub Pages (static files only)
- Heavy compute (spatial aggregation, hex binning) either:
  - Precomputed at scrape time → baked into JSON
  - Done in-browser with web workers if dataset is small enough
- Mobile-first. Touch targets, responsive panels, no hover-only interactions.

## File Structure (planned)

```
/
├── README.md
├── data/
│   ├── parcels.json          # master parcel list with coords + core stats
│   ├── sales/                # per-account sales history
│   │   ├── 10059095.json
│   │   └── ...
│   ├── aggregates/           # precomputed spatial aggregates
│   │   ├── hexbin-price-yoy.json
│   │   └── ...
│   └── scraper/              # scraping scripts
│       └── jaco_scraper.py
├── approach-a/               # Mapbox GL + React
├── approach-b/               # Leaflet + vanilla JS + D3
├── approach-c/               # Deck.gl + Svelte
└── docs/                     # shared design docs, screenshots
```

## Three Approaches

The point: each approach will hit different walls. When one stalls, the others inform the path forward. We converge on what works.

### Approach A: Mapbox GL + React

- **Bet:** Mapbox’s vector tile rendering and built-in choropleth support handles the heavy map lifting. React manages UI state cleanly.
- **Risk:** Mapbox token management, GL context on older mobile browsers, React overhead for a map-heavy app.
- **Start with:** Get parcels on a map with one working overlay. Wire up the control panel.

### Approach B: Leaflet + Vanilla JS + D3

- **Bet:** Leaflet is battle-tested on mobile, D3 gives full control over binning/color/scales, no framework overhead means fast iteration.
- **Risk:** Manual state management gets gnarly. SVG overlay performance with thousands of parcels. More glue code.
- **Start with:** Leaflet map, GeoJSON parcel layer, D3 color scale on one metric. Minimal UI.

### Approach C: Deck.gl + Svelte

- **Bet:** Deck.gl is purpose-built for exactly this (large-scale geospatial data viz, hex layers, heat maps). Svelte compiles away framework weight.
- **Risk:** Deck.gl’s learning curve, less mobile-tested, Svelte ecosystem smaller. Might be overengineered for our parcel count.
- **Start with:** HexagonLayer with one metric. See if the defaults look good before customizing.

## Scraping Strategy

Jackson County PDO doesn’t have a bulk export. Plan:

1. **Seed list:** Get Ashland parcel/account numbers. City GIS or assessor rolls may have a downloadable list. Alternatively, scrape the search results page with broad criteria.
1. **Per-parcel scrape:** Hit each account’s sales page, property detail page, and permit page. Rate-limited, respectful. Cache raw HTML.
1. **Parse → JSON:** Extract structured data from HTML. Store one JSON per account plus a master index.
1. **Geocode:** Parcel centroids from county GIS shapefiles (Jackson County likely publishes these) or geocode addresses via Nominatim.
1. **Precompute aggregates:** Run spatial binning offline, write aggregate JSONs.

Estimated parcel count for Ashland city limits: ~8,000-12,000. Manageable as static JSON.

## Development Sequence

**Phase 1: Data pipeline**

- [ ] Find/download Ashland parcel list with coordinates
- [ ] Build scraper for PDO sales + property + permits
- [ ] Parse into per-parcel JSON
- [ ] Build master parcels.json index
- [ ] Precompute one aggregate layer (e.g. median $/sqft by hexbin)

**Phase 2: MVP map (all three approaches, parallel)**

- [ ] Ashland basemap centered, zoom/pan
- [ ] Load parcels.json, render parcel points/polygons
- [ ] Color by one metric ($/sqft)
- [ ] Tap → tooltip
- [ ] Basic overlay selector (even if only 2 options)

**Phase 3: Controls + overlays**

- [ ] Aggregation mode switching
- [ ] Color ramp options
- [ ] Time window filter
- [ ] Percentile clamp
- [ ] Multiple overlay metrics wired up

**Phase 4: Detail view**

- [ ] Tap parcel → slide-up panel with full history
- [ ] Sale price chart
- [ ] Permit list
- [ ] Improvement breakdown

**Phase 5: Polish + stretch**

- [ ] Compare mode
- [ ] Walkability/amenity overlays
- [ ] Search/filter by criteria (“show me 3bd under $500k within 0.5mi of coffee”)
- [ ] Offline/PWA support

## Running Locally

Each approach is self-contained. cd into the directory and follow its own README. Shared data lives in `/data/`.

## Notes

- Jackson County property data is public record. Scraping is for personal use. Be polite with rate limits.
- Mapbox requires a free API token. Leaflet and Deck.gl can use free tile sources (OSM, Stadia, etc).
- Target device: iPhone 14-ish screen. Test everything in mobile viewport first.

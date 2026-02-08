# Approach C — Deck.gl + Svelte

Interactive parcel heat map for Ashland, OR using Deck.gl for GPU-accelerated geospatial visualization and Svelte for reactive UI.

## Stack

- **Svelte** — reactive UI components, compiled away at build time
- **Deck.gl** — WebGL-powered map layers (ScatterplotLayer, HexagonLayer)
- **MapLibre GL** — base map rendering with OpenStreetMap tiles
- **Vite** — dev server and build tooling

## Setup

```bash
cd approach-c
npm install
npm run dev
```

Open http://localhost:5173. The app loads mock data from `../data/parcels.json`.

## Build

```bash
npm run build
npm run preview  # preview production build
```

## Features

### MVP Map
- Ashland-centered map at zoom 14 (42.1945, -122.7095)
- ScatterplotLayer rendering parcels as colored circles
- HexagonLayer for aggregated hex-bin view
- MapLibre GL base map with OSM tiles

### Overlay Controls
- **Metric selector** — $/sqft, last sale price, assessed value, living sqft, lot size, year built
- **View mode toggle** — switch between point scatter and hexbin aggregation
- **Color ramp picker** — viridis, plasma, warm, cool, reds
- **Opacity slider** — 10-100%
- **Hex radius slider** — 50-500m (hexbin mode only)
- **Time window filter** — date range filter on last sale date

### Interactions
- **Hover** — tooltip with address, metric value, sqft, year built
- **Click** — opens detail panel

### Detail View (slide-up panel)
- Key stats grid (price, $/sqft, sqft, lot, year, assessed value)
- Price trajectory chart (SVG line chart)
- Sales history table
- Permits table with status badges
- Improvements list with condition

## Architecture

```
src/
├── main.ts           # Entry point, mounts Svelte app
├── App.svelte        # Root component
├── types.ts          # TypeScript interfaces
├── store.ts          # Svelte stores (state management)
├── colors.ts         # Color ramp interpolation
├── metrics.ts        # Metric definitions and formatters
└── components/
    ├── DeckMap.svelte     # Deck.gl + MapLibre map
    ├── Controls.svelte    # Overlay control panel
    ├── Tooltip.svelte     # Hover tooltip
    ├── Legend.svelte      # Color scale legend
    ├── DetailPanel.svelte # Parcel detail slide-up
    └── PriceChart.svelte  # SVG price history chart
```

## Data

Reads from `../data/parcels.json` (master index) and `../data/sales/{account}.json` (per-parcel detail). See `docs/mock-data.md` for mock data documentation.

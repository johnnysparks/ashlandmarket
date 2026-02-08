# Approach B — Leaflet + Vanilla JS + D3

Zero-build-step implementation of the Ashland Market Heat Map using Leaflet for mapping, D3 for color scales and charts, and plain HTML/CSS/JS.

## Quick Start

```bash
cd approach-b
npx serve .
# or
python3 -m http.server 8000
```

Open `http://localhost:3000` (serve) or `http://localhost:8000` (python) in a browser.

## Stack

- **Leaflet 1.9** — mobile-friendly interactive map with CARTO dark tiles
- **D3 v7** — color scales, data formatting, SVG price charts
- **Vanilla JS** — no framework, no build step, no node_modules

Both libraries loaded via CDN (unpkg).

## Features

- 10,000+ parcel markers colored by selectable metric
- 8 overlay metrics: $/sqft, sale price, assessed value, living sqft, lot size, year built, sale count, permit count
- 6 color ramp options (YlOrRd, Viridis, Blues, RdYlGn, Spectral, Plasma)
- Opacity control
- Time window filter (filter parcels by last sale date)
- Click parcel → popup with key stats
- "View full details" → slide-up detail panel with:
  - Summary cards (price, $/sqft, sqft, year, assessed value)
  - D3 line chart of price trajectory
  - Sales history table
  - Permit list
  - Improvement breakdown
- Mobile-first responsive layout (tested at 390×844)
- 5th–95th percentile clamping to reduce outlier influence on color scale

## File Structure

```
approach-b/
├── index.html   # Single page, CDN script tags
├── style.css    # Dark theme, mobile-first responsive
├── main.js      # All application logic
└── README.md
```

## Data

Reads from `../data/parcels.json` (master index) and `../data/sales/{account}.json` (per-parcel detail). No data files are bundled — the parent `data/` directory must exist.

# Anomaly Finder

Card-based outlier detection tool for Ashland real estate parcels. Groups properties into spatial neighborhoods and surfaces statistical anomalies using robust MAD-based z-scores.

## Quick Start

No build step required. Serve from the project root so `../data/parcels.json` resolves:

```bash
# from project root
npx serve .
# then open http://localhost:3000/anomaly-finder/

# or from this directory with python
cd anomaly-finder && python -m http.server 8080
# then open http://localhost:8080/
# (requires parcels.json at ../data/parcels.json)
```

## Views

### Anomalies (default tab)

Ranked list of anomalous parcels. Each card shows:

- Address, account number, severity badge (Notable / High / Extreme)
- Flagged metrics with direction arrows, values, and neighborhood median comparison
- Neighborhood context (name and parcel count)

Click a card to open the **detail panel** with property stats, z-score deviations, visual comparison bars (min-median-max range), and up to 8 neighboring parcels sorted by the primary anomaly metric.

### Neighborhoods

Summary cards for each spatial cluster showing median statistics (price, $/sqft, lot size, year built, assessed value) and anomaly counts. Click a card for neighborhood detail with value ranges (10th-90th percentile) and a list of flagged properties.

## Controls

| Control | Options | Default |
|---------|---------|---------|
| Sensitivity | 2σ (Very Sensitive), 3σ (Normal), 4σ (Strict), 5σ (Very Strict) | 3σ |
| Grid Size | ~200m (Fine), ~300m (Medium), ~500m (Coarse), ~800m (Very Coarse) | ~300m |
| Metric Filter | All Metrics, or any single metric | All |
| Sort | Severity, Price (High/Low), Lot Size, Address | Severity |
| Search | Free-text by address or account number | — |

## Metrics Tracked (8 total)

**Core:** Lot Size, Living Space, Sale Price, Price/Sqft, Assessed Value, Year Built

**Derived:** Sale/Assessed Ratio, Building/Lot Ratio

## How Detection Works

1. Parcels are assigned to grid cells based on lat/lng (configurable cell size)
2. Each grid cell becomes a "neighborhood", auto-named by the most common street
3. Per-neighborhood statistics are computed for all 8 metrics
4. Each parcel is scored using **modified z-scores**: `0.6745 * (value - median) / MAD`
5. Parcels exceeding the sensitivity threshold are flagged as anomalies
6. Neighborhoods with fewer than 5 parcels are excluded (insufficient sample size)

**Severity levels:** Notable (3-5σ), High (5-8σ), Extreme (8+σ)

## Architecture

```
anomaly-finder/
├── index.html      # UI layout — tabs, controls, summary bar, detail overlay
├── main.js         # App logic — rendering, filtering, event handling
├── analysis.js     # Statistical engine — clustering, z-scores, anomaly detection
└── style.css       # Mobile-first dark theme
```

- **Zero dependencies** — pure HTML/JS/CSS with ES modules
- **Client-side analysis** — all computation runs in the browser
- **Data source:** `../data/parcels.json` (shared project data contract)
- **Mobile-first** — optimized for 390x844 viewport, responsive to desktop

## Exports from analysis.js

| Function | Purpose |
|----------|---------|
| `clusterIntoNeighborhoods(parcels, cellSize)` | Spatial grid clustering |
| `nameNeighborhood(hood)` | Auto-name from street data |
| `computeNeighborhoodStats(hood)` | Per-neighborhood statistics for all metrics |
| `findParcelAnomalies(parcel, stats, threshold)` | Parcel-level outlier detection |
| `runAnalysis(parcels, options)` | Main orchestration — returns `{ neighborhoods, anomalies }` |
| `getAllMetrics()` | Returns all 8 metric definitions |
| `median()`, `mad()`, `mean()`, `percentile()` | Statistical helpers |
| `modifiedZScore(value, median, mad)` | Robust outlier scoring |

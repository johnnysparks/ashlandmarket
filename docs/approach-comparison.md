# Approach Comparison — Ashland Market Heat Map

Evaluation framework for comparing the three parallel implementations.

## Implementation Status

| Feature | Approach A (Mapbox GL + React) | Approach B (Leaflet + D3) | Approach C (Deck.gl + Svelte) |
|---------|-------------------------------|--------------------------|-------------------------------|
| Project scaffolding | Not started | Not started | Complete |
| Base map rendering | - | - | MapLibre GL + OSM tiles |
| Parcel visualization | - | - | ScatterplotLayer (10,317 parcels) |
| Aggregation layers | - | - | HexagonLayer + GridLayer |
| Color ramps | - | - | 5 ramps (viridis, plasma, warm, cool, reds) |
| Metric overlays | - | - | 8 metrics ($/sqft, price, value, sqft, lot, year, sales, permits) |
| Percentile clamping | - | - | Dual-slider P0-P100 outlier clipping |
| Time window filter | - | - | Date range filter on last_sale_date |
| Hover tooltip | - | - | Parcel stats on hover |
| Detail panel | - | - | Slide-up panel with charts, sales, permits |
| Price chart | - | - | SVG line chart |
| Mobile responsive | - | - | 480px breakpoint, touch-friendly |
| Build size (gzip) | - | - | ~495 KB JS, ~2 KB CSS |

## Evaluation Criteria

### Performance
- **Render time**: How quickly does the map load and display 10K+ parcels?
- **Interaction FPS**: Is panning/zooming smooth at 60fps?
- **Memory usage**: How much memory does the visualization consume?
- **Mobile performance**: Does it stay responsive on mid-range phones?

### Developer Experience
- **Setup complexity**: How many steps to get running?
- **Code volume**: Lines of code for equivalent features?
- **Type safety**: TypeScript support quality?
- **Hot reload**: Development iteration speed?

### Bundle Size
- **JS payload**: Initial download size (gzipped)
- **CSS payload**: Stylesheet size
- **Tree-shaking**: How much unused code ships?

### Feature Completeness
- **Layer types**: Point, hexbin, grid, polygon support
- **Interaction**: Click, hover, selection, filtering
- **Controls**: Metric switching, color ramps, opacity, radius
- **Detail views**: Per-parcel drill-down with history

### Maintainability
- **Component structure**: Clean separation of concerns?
- **State management**: Predictable data flow?
- **Extensibility**: How easy to add new metrics/layers?

## Approach C Notes (Deck.gl + Svelte)

### Strengths
- WebGL-accelerated rendering handles 10K parcels smoothly
- Deck.gl's built-in aggregation layers (Hexagon, Grid) require minimal custom code
- Svelte's reactive stores provide clean state management with minimal boilerplate
- Small component count (6 components) keeps the codebase navigable
- TypeScript throughout with strict mode

### Weaknesses
- Large bundle size (~495 KB gzip) primarily from Deck.gl/luma.gl WebGL stack
- No built-in basemap — requires separate MapLibre GL instance synced to Deck viewport
- Deck.gl API is complex with many layer-specific options to learn
- WebGL dependency means no SSR and requires GPU-capable device
- Svelte 5 migration path may introduce breaking changes

### Architecture Decisions
- **Dual canvas approach**: MapLibre GL renders tiles, Deck.gl renders data layers on top
- **Store-driven reactivity**: All state in Svelte stores, components subscribe and react
- **Percentile clamping**: Computed in derived store, applied to color mapping min/max
- **No external charting lib**: SVG price chart built from scratch to avoid dependency bloat

## Recommendations

Once Approaches A and B are implemented, compare:
1. Run identical user scenarios across all three
2. Measure Lighthouse scores on mobile viewport (390x844)
3. Profile memory and render times with Chrome DevTools
4. Evaluate code maintainability by having a fresh developer add a new metric
5. Test with real scraped data (full 10K parcels with sales history)

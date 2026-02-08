// Ashland Market Heat Map — Approach B
// Pure business logic extracted for testability
// No DOM, Leaflet, or D3-DOM dependencies

// ── Config ──────────────────────────────────────────────
export const ASHLAND_CENTER = [42.1945, -122.7095];
export const INITIAL_ZOOM = 14;
export const DATA_BASE = '../data';
export const MARKER_RADIUS_RANGE = [4, 8];

// ── Metric formatting ──────────────────────────────────
export const METRIC_CONFIG = {
  price_per_sqft: { label: '$/sqft', fmt: v => '$' + Math.round(v) },
  last_sale_price: { label: 'Sale Price', fmt: v => '$' + Math.round(v).toLocaleString('en-US') },
  assessed_value: { label: 'Assessed', fmt: v => '$' + Math.round(v).toLocaleString('en-US') },
  sqft_living: { label: 'Living sqft', fmt: v => Math.round(v).toLocaleString('en-US') },
  sqft_lot: { label: 'Lot sqft', fmt: v => Math.round(v).toLocaleString('en-US') },
  year_built: { label: 'Year Built', fmt: v => String(v) },
  num_sales: { label: 'Sales', fmt: v => String(v) },
  num_permits: { label: 'Permits', fmt: v => String(v) },
};

// ── Hex polygon geometry ────────────────────────────────
export function createHexPolygon(lat, lng, size) {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i + Math.PI / 6;
    const lngSize = size / Math.cos(lat * Math.PI / 180);
    points.push([
      lat + size * Math.sin(angle),
      lng + lngSize * Math.cos(angle),
    ]);
  }
  return points;
}

// ── Zoom-based marker radius ────────────────────────────
export function getRadius(zoom) {
  if (zoom >= 17) return 10;
  if (zoom >= 15) return 6;
  if (zoom >= 13) return 4;
  return 3;
}

// ── Date-range filtering ────────────────────────────────
export function applyFilters(parcels, dateFrom, dateTo) {
  return parcels.filter(p => {
    if (!p.last_sale_date) return true;
    const d = new Date(p.last_sale_date);
    return d >= dateFrom && d <= dateTo;
  });
}

// ── Percentile-based color scale builder ────────────────
// Returns { lo, hi } domain boundaries after percentile clamping.
// Accepts a d3-like quantile function for flexibility in testing.
export function computeColorDomain(parcels, metric, clampLo, clampHi, quantileFn) {
  const values = parcels
    .map(p => p[metric])
    .filter(v => v != null && isFinite(v));

  if (values.length === 0) return null;

  values.sort((a, b) => a - b);
  const lo = quantileFn(values, clampLo / 100);
  const hi = quantileFn(values, clampHi / 100);
  return { lo, hi, count: values.length };
}

// ── Color value resolver ────────────────────────────────
// Given a domain and interpolator, returns a color for a value.
export function resolveColor(value, lo, hi, interpolatorFn) {
  if (value == null || !isFinite(value)) return '#444';
  const t = Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  return interpolatorFn(t);
}

// ── Search matching ─────────────────────────────────────
export function searchParcels(parcels, query, maxResults = 8) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  return parcels.filter(p => {
    const addr = (p.address || '').toLowerCase();
    const acct = (p.account || '').toLowerCase();
    return addr.includes(q) || acct.includes(q);
  }).slice(0, maxResults);
}

// ── Parcel data validation ──────────────────────────────
export function filterValidParcels(parcels) {
  return parcels.filter(p => p.lat && p.lng);
}

// ── Sort sales by date ──────────────────────────────────
export function sortSalesByDate(sales, descending = true) {
  return [...sales].sort((a, b) => {
    const da = new Date(a.date);
    const db = new Date(b.date);
    return descending ? db - da : da - db;
  });
}

// ── Filter sales with valid price+date for charting ─────
export function filterChartableSales(sales) {
  return sales
    .filter(s => s.price && s.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ── Legend gradient steps ───────────────────────────────
export function buildGradientStops(interpolatorFn, steps = 20) {
  const colors = [];
  for (let i = 0; i < steps; i++) {
    colors.push(interpolatorFn(i / (steps - 1)));
  }
  return colors;
}

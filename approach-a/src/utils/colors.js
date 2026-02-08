// Color ramp definitions and utilities

export const COLOR_RAMPS = {
  viridis: {
    name: 'Viridis',
    stops: ['#440154', '#482777', '#3e4989', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6ece58', '#b5de2b', '#fde725']
  },
  inferno: {
    name: 'Inferno',
    stops: ['#000004', '#160b39', '#420a68', '#6a176e', '#932667', '#bc3754', '#dd513a', '#f37819', '#fca50a', '#f0f921']
  },
  magma: {
    name: 'Magma',
    stops: ['#000004', '#140e36', '#3b0f70', '#641a80', '#8c2981', '#b73779', '#de4968', '#f7735c', '#feb078', '#fcfdbf']
  },
  plasma: {
    name: 'Plasma',
    stops: ['#0d0887', '#3a049a', '#6a00a8', '#900da4', '#b12a90', '#cc4778', '#e16462', '#f2844b', '#fca636', '#f0f921']
  },
  ylOrRd: {
    name: 'Yellow-Orange-Red',
    stops: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026']
  },
  blues: {
    name: 'Blues',
    stops: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b']
  },
  rdYlGn: {
    name: 'Red-Yellow-Green',
    stops: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837']
  }
}

export const METRICS = {
  price_per_sqft: { label: '$/sqft', key: 'price_per_sqft', format: v => `$${Math.round(v)}` },
  last_sale_price: { label: 'Last Sale Price', key: 'last_sale_price', format: v => `$${(v / 1000).toFixed(0)}k` },
  assessed_value: { label: 'Assessed Value', key: 'assessed_value', format: v => `$${(v / 1000).toFixed(0)}k` },
  year_built: { label: 'Year Built', key: 'year_built', format: v => String(Math.round(v)) },
  sqft_living: { label: 'Living Sqft', key: 'sqft_living', format: v => `${Math.round(v).toLocaleString()} sqft` },
  sqft_lot: { label: 'Lot Size', key: 'sqft_lot', format: v => `${Math.round(v).toLocaleString()} sqft` },
  num_sales: { label: 'Sale Count', key: 'num_sales', format: v => String(Math.round(v)) },
  num_permits: { label: 'Permit Count', key: 'num_permits', format: v => String(Math.round(v)) },
  // Derived metrics
  property_age: { label: 'Property Age', key: 'property_age', format: v => `${Math.round(v)} yrs` },
  price_vs_assessed: { label: 'Sale/Assessed Ratio', key: 'price_vs_assessed', format: v => `${v.toFixed(2)}x` },
  improvement_ratio: { label: 'Building/Lot Ratio', key: 'improvement_ratio', format: v => `${(v * 100).toFixed(1)}%` },
  price_per_sqft_lot: { label: '$/sqft Lot', key: 'price_per_sqft_lot', format: v => `$${Math.round(v)}` }
}

export function interpolateColor(stops, t) {
  t = Math.max(0, Math.min(1, t))
  const idx = t * (stops.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return stops[lo]
  const frac = idx - lo
  return lerpColor(stops[lo], stops[hi], frac)
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16)
  const ag = parseInt(a.slice(3, 5), 16)
  const ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16)
  const bg = parseInt(b.slice(3, 5), 16)
  const bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b2 = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b2.toString(16).padStart(2, '0')}`
}

// Build Mapbox GL style expression for color interpolation
export function buildColorExpression(metricKey, min, max, stops) {
  if (min === max) return stops[Math.floor(stops.length / 2)]

  const expr = ['interpolate', ['linear'], ['get', metricKey]]
  stops.forEach((color, i) => {
    const value = min + (max - min) * (i / (stops.length - 1))
    expr.push(value, color)
  })
  return expr
}

// Compute percentile values for clamping outliers
export function computePercentiles(values, lower = 5, upper = 95) {
  const sorted = values.filter(v => v != null && !isNaN(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return { min: 0, max: 1 }
  const lo = sorted[Math.floor(sorted.length * lower / 100)]
  const hi = sorted[Math.floor(sorted.length * upper / 100)]
  return { min: lo, max: hi }
}

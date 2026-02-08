/**
 * Anomaly Finder — Analysis Engine
 *
 * Clusters parcels into neighborhoods using spatial grid cells,
 * computes per-neighborhood statistics, and identifies outlier parcels
 * using modified z-scores (MAD-based for robustness to skewed data).
 */

// --- Neighborhood Clustering ---

/**
 * Assign each parcel to a grid cell based on lat/lng.
 * cellSize is in degrees (~0.003 deg ≈ 300m in Ashland's latitude).
 */
export function clusterIntoNeighborhoods(parcels, cellSize = 0.003) {
  const neighborhoods = new Map()

  for (const p of parcels) {
    const gridRow = Math.floor(p.lat / cellSize)
    const gridCol = Math.floor(p.lng / cellSize)
    const key = `${gridRow},${gridCol}`

    if (!neighborhoods.has(key)) {
      neighborhoods.set(key, {
        id: key,
        gridRow,
        gridCol,
        centerLat: (gridRow + 0.5) * cellSize,
        centerLng: (gridCol + 0.5) * cellSize,
        parcels: [],
      })
    }
    neighborhoods.get(key).parcels.push(p)
  }

  return neighborhoods
}

/**
 * Name neighborhoods by their most common street or a geographic label.
 */
export function nameNeighborhood(hood) {
  const parcels = hood.parcels
  if (parcels.length === 0) return 'Unknown'

  // Count street names (last part of address after the house number)
  const streetCounts = {}
  for (const p of parcels) {
    if (!p.address) continue
    const parts = p.address.trim().split(/\s+/)
    // Drop house number (first token if numeric)
    const street = /^\d/.test(parts[0]) ? parts.slice(1).join(' ') : p.address
    if (street) {
      streetCounts[street] = (streetCounts[street] || 0) + 1
    }
  }

  const sorted = Object.entries(streetCounts).sort((a, b) => b[1] - a[1])
  if (sorted.length > 0) {
    return sorted[0][0]
  }
  return `Area ${hood.id}`
}

// --- Statistics Helpers ---

export function median(arr) {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

export function mad(arr) {
  const med = median(arr)
  if (med === null) return null
  const deviations = arr.map((v) => Math.abs(v - med))
  return median(deviations)
}

export function mean(arr) {
  if (arr.length === 0) return null
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

export function percentile(arr, p) {
  if (arr.length === 0) return null
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

/**
 * Modified z-score using median and MAD (more robust than mean/stddev).
 * Returns null if MAD is 0 (no variation).
 * Convention: 0.6745 is the 0.75th quantile of the standard normal distribution.
 */
export function modifiedZScore(value, med, madVal) {
  if (madVal === null || madVal === 0) return null
  return (0.6745 * (value - med)) / madVal
}

// --- Anomaly Detection ---

const METRICS = [
  {
    key: 'sqft_lot',
    label: 'Lot Size',
    unit: 'sqft',
    format: (v) => v.toLocaleString() + ' sqft',
  },
  {
    key: 'sqft_living',
    label: 'Living Space',
    unit: 'sqft',
    format: (v) => v.toLocaleString() + ' sqft',
  },
  {
    key: 'last_sale_price',
    label: 'Sale Price',
    unit: '$',
    format: (v) => '$' + v.toLocaleString(),
  },
  {
    key: 'price_per_sqft',
    label: 'Price/Sqft',
    unit: '$/sqft',
    format: (v) => '$' + v.toFixed(0) + '/sqft',
  },
  {
    key: 'assessed_value',
    label: 'Assessed Value',
    unit: '$',
    format: (v) => '$' + v.toLocaleString(),
  },
  {
    key: 'year_built',
    label: 'Year Built',
    unit: 'year',
    format: (v) => String(v),
  },
]

// Derived metrics computed per-parcel
const DERIVED_METRICS = [
  {
    key: 'sale_assess_ratio',
    label: 'Sale/Assessed Ratio',
    unit: 'x',
    format: (v) => v.toFixed(2) + 'x',
    compute: (p) =>
      p.last_sale_price && p.assessed_value
        ? p.last_sale_price / p.assessed_value
        : null,
  },
  {
    key: 'building_lot_ratio',
    label: 'Building/Lot Ratio',
    unit: '%',
    format: (v) => (v * 100).toFixed(1) + '%',
    compute: (p) =>
      p.sqft_living && p.sqft_lot ? p.sqft_living / p.sqft_lot : null,
  },
]

export function getAllMetrics() {
  return [...METRICS, ...DERIVED_METRICS]
}

/**
 * Compute neighborhood-level stats for every metric.
 */
export function computeNeighborhoodStats(hood) {
  const stats = {}

  for (const metric of METRICS) {
    const values = hood.parcels
      .map((p) => p[metric.key])
      .filter((v) => v != null && v > 0)

    stats[metric.key] = {
      ...metric,
      count: values.length,
      median: median(values),
      mad: mad(values),
      mean: mean(values),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      p10: percentile(values, 10),
      p90: percentile(values, 90),
    }
  }

  for (const metric of DERIVED_METRICS) {
    const values = hood.parcels
      .map((p) => metric.compute(p))
      .filter((v) => v != null && isFinite(v))

    stats[metric.key] = {
      ...metric,
      count: values.length,
      median: median(values),
      mad: mad(values),
      mean: mean(values),
      min: values.length ? Math.min(...values) : null,
      max: values.length ? Math.max(...values) : null,
      p10: percentile(values, 10),
      p90: percentile(values, 90),
    }
  }

  return stats
}

/**
 * Find anomalies for a single parcel within its neighborhood.
 * Returns an array of anomaly objects, one per metric where the parcel is an outlier.
 */
export function findParcelAnomalies(parcel, neighborhoodStats, threshold = 3.0) {
  const anomalies = []

  for (const metric of METRICS) {
    const value = parcel[metric.key]
    if (value == null || value <= 0) continue

    const stats = neighborhoodStats[metric.key]
    if (!stats || stats.count < 5) continue // need enough neighbors for meaningful stats

    const z = modifiedZScore(value, stats.median, stats.mad)
    if (z === null) continue

    if (Math.abs(z) >= threshold) {
      anomalies.push({
        metric: metric.key,
        label: metric.label,
        value,
        formatted: metric.format(value),
        neighborhoodMedian: stats.median,
        neighborhoodMedianFormatted: metric.format(stats.median),
        zScore: z,
        direction: z > 0 ? 'high' : 'low',
        severity: Math.abs(z),
      })
    }
  }

  for (const metric of DERIVED_METRICS) {
    const value = metric.compute(parcel)
    if (value == null || !isFinite(value)) continue

    const stats = neighborhoodStats[metric.key]
    if (!stats || stats.count < 5) continue

    const z = modifiedZScore(value, stats.median, stats.mad)
    if (z === null) continue

    if (Math.abs(z) >= threshold) {
      anomalies.push({
        metric: metric.key,
        label: metric.label,
        value,
        formatted: metric.format(value),
        neighborhoodMedian: stats.median,
        neighborhoodMedianFormatted: metric.format(stats.median),
        zScore: z,
        direction: z > 0 ? 'high' : 'low',
        severity: Math.abs(z),
      })
    }
  }

  return anomalies
}

/**
 * Run the full analysis pipeline.
 * Returns { neighborhoods, anomalies } where anomalies is a flat list
 * sorted by severity (most extreme first).
 */
export function runAnalysis(parcels, { cellSize = 0.003, threshold = 3.0 } = {}) {
  const hoodMap = clusterIntoNeighborhoods(parcels, cellSize)

  const neighborhoods = []
  const allAnomalies = []

  for (const [id, hood] of hoodMap) {
    const name = nameNeighborhood(hood)
    const stats = computeNeighborhoodStats(hood)

    const hoodResult = {
      id,
      name,
      parcelCount: hood.parcels.length,
      centerLat: hood.centerLat,
      centerLng: hood.centerLng,
      stats,
      anomalyCount: 0,
    }

    for (const parcel of hood.parcels) {
      const anomalies = findParcelAnomalies(parcel, stats, threshold)
      if (anomalies.length > 0) {
        hoodResult.anomalyCount += anomalies.length
        allAnomalies.push({
          parcel,
          neighborhood: { id, name, parcelCount: hood.parcels.length },
          anomalies,
          maxSeverity: Math.max(...anomalies.map((a) => a.severity)),
        })
      }
    }

    neighborhoods.push(hoodResult)
  }

  // Sort anomalies by max severity descending
  allAnomalies.sort((a, b) => b.maxSeverity - a.maxSeverity)

  // Sort neighborhoods by anomaly count then parcel count
  neighborhoods.sort((a, b) => b.anomalyCount - a.anomalyCount || b.parcelCount - a.parcelCount)

  return { neighborhoods, anomalies: allAnomalies }
}

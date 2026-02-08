// Data loading and transformation utilities

const CURRENT_YEAR = new Date().getFullYear()

let cachedParcels = null

const DATA_BASE = import.meta.env.DEV ? '../data' : `${import.meta.env.BASE_URL}data`

export async function loadParcels() {
  if (cachedParcels) return cachedParcels

  const resp = await fetch(`${DATA_BASE}/parcels.json`)
  const data = await resp.json()

  cachedParcels = data.parcels.filter(p => p.lat && p.lng)
  return cachedParcels
}

// Compute derived metrics for a parcel
function computeDerived(p) {
  const property_age = p.year_built ? CURRENT_YEAR - p.year_built : null
  const price_vs_assessed = (p.last_sale_price && p.assessed_value)
    ? p.last_sale_price / p.assessed_value
    : null
  const improvement_ratio = (p.sqft_living && p.sqft_lot && p.sqft_lot > 0)
    ? p.sqft_living / p.sqft_lot
    : null
  const price_per_sqft_lot = (p.last_sale_price && p.sqft_lot && p.sqft_lot > 0)
    ? p.last_sale_price / p.sqft_lot
    : null
  return { property_age, price_vs_assessed, improvement_ratio, price_per_sqft_lot }
}

export function parcelsToGeoJSON(parcels) {
  return {
    type: 'FeatureCollection',
    features: parcels.map(p => {
      const derived = computeDerived(p)
      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [p.lng, p.lat]
        },
        properties: {
          account: p.account,
          address: p.address || `Parcel ${p.account}`,
          maptaxlot: p.maptaxlot,
          sqft_living: p.sqft_living,
          sqft_lot: p.sqft_lot,
          year_built: p.year_built,
          last_sale_price: p.last_sale_price,
          last_sale_date: p.last_sale_date,
          price_per_sqft: p.price_per_sqft,
          assessed_value: p.assessed_value,
          num_sales: p.num_sales,
          num_permits: p.num_permits,
          ...derived
        }
      }
    })
  }
}

export function filterByTimeWindow(parcels, startDate, endDate) {
  if (!startDate && !endDate) return parcels
  return parcels.filter(p => {
    if (!p.last_sale_date) return false
    const d = new Date(p.last_sale_date)
    if (startDate && d < new Date(startDate)) return false
    if (endDate && d > new Date(endDate)) return false
    return true
  })
}

export async function loadParcelDetail(account) {
  try {
    const resp = await fetch(`${DATA_BASE}/sales/${account}.json`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

// Hexbin aggregate loading - supports multiple metrics
const hexbinCache = {}

// Map metric keys to available aggregate files
const HEXBIN_FILE_MAP = {
  price_per_sqft: 'hexbin-price_per_sqft.json',
  price_per_sqft_lot: 'hexbin-price_per_sqft_lot.json',
  last_sale_price: 'hexbin-last_sale_price.json',
  assessed_value: 'hexbin-assessed_value.json'
}

export async function loadHexbins(metricKey = 'price_per_sqft') {
  // Check if we have a specific file for this metric
  const fileName = HEXBIN_FILE_MAP[metricKey]
  if (!fileName) {
    // Fall back to price_per_sqft for metrics without pre-computed hexbins
    return loadHexbins('price_per_sqft')
  }

  if (hexbinCache[metricKey]) return hexbinCache[metricKey]

  try {
    const resp = await fetch(`${DATA_BASE}/aggregates/${fileName}`)
    if (!resp.ok) return null
    const data = await resp.json()
    hexbinCache[metricKey] = data
    return data
  } catch {
    return null
  }
}

export function hexbinsToGeoJSON(hexData) {
  if (!hexData) return { type: 'FeatureCollection', features: [] }

  // Support both formats: new (cells array) and old (hexagons array)
  if (hexData.cells) {
    return {
      type: 'FeatureCollection',
      features: hexData.cells.map((c, i) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [c.lng, c.lat]
        },
        properties: {
          id: i,
          count: c.count,
          median: c.median,
          mean: c.mean,
          min: c.min,
          max: c.max
        }
      }))
    }
  }

  // Legacy format (hexagons array from mock data)
  if (hexData.hexagons) {
    return {
      type: 'FeatureCollection',
      features: hexData.hexagons.map((h, i) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [h.center_lng, h.center_lat]
        },
        properties: {
          id: i,
          count: h.count,
          median: h.median_price_sqft,
          mean: h.mean_price_sqft,
          min: h.min_price_sqft,
          max: h.max_price_sqft
        }
      }))
    }
  }

  return { type: 'FeatureCollection', features: [] }
}

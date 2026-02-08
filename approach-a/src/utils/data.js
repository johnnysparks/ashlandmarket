// Data loading and transformation utilities

let cachedParcels = null

export async function loadParcels() {
  if (cachedParcels) return cachedParcels

  const resp = await fetch('../data/parcels.json')
  const data = await resp.json()

  cachedParcels = data.parcels.filter(p => p.lat && p.lng)
  return cachedParcels
}

export function parcelsToGeoJSON(parcels) {
  return {
    type: 'FeatureCollection',
    features: parcels.map(p => ({
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
        num_permits: p.num_permits
      }
    }))
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
    const resp = await fetch(`../data/sales/${account}.json`)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    return null
  }
}

let cachedHexbins = null

export async function loadHexbins() {
  if (cachedHexbins) return cachedHexbins
  try {
    const resp = await fetch('../data/aggregates/hexbin-price-sqft.json')
    if (!resp.ok) return null
    const data = await resp.json()
    cachedHexbins = data
    return data
  } catch {
    return null
  }
}

export function hexbinsToGeoJSON(hexData) {
  if (!hexData || !hexData.hexagons) return { type: 'FeatureCollection', features: [] }
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
        median_price_sqft: h.median_price_sqft,
        mean_price_sqft: h.mean_price_sqft,
        min_price_sqft: h.min_price_sqft,
        max_price_sqft: h.max_price_sqft
      }
    }))
  }
}

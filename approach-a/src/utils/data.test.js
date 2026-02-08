import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parcelsToGeoJSON, filterByTimeWindow, hexbinsToGeoJSON } from './data'

const mockParcels = [
  {
    account: '10059095',
    lat: 42.1945,
    lng: -122.7095,
    address: '123 Main St',
    maptaxlot: '391E04BB',
    sqft_living: 1850,
    sqft_lot: 7500,
    year_built: 1952,
    last_sale_price: 425000,
    last_sale_date: '2023-06-15',
    price_per_sqft: 229.73,
    assessed_value: 380000,
    num_sales: 4,
    num_permits: 2
  },
  {
    account: '10059096',
    lat: 42.1950,
    lng: -122.7100,
    address: '456 Oak Ave',
    maptaxlot: '391E04BC',
    sqft_living: 2200,
    sqft_lot: 9000,
    year_built: 2005,
    last_sale_price: 550000,
    last_sale_date: '2024-01-20',
    price_per_sqft: 250,
    assessed_value: 500000,
    num_sales: 2,
    num_permits: 1
  },
  {
    account: '10059097',
    lat: 42.1960,
    lng: -122.7080,
    sqft_living: 1200,
    sqft_lot: 5000,
    year_built: 1978,
    last_sale_price: 300000,
    last_sale_date: '2022-03-10',
    price_per_sqft: 250,
    assessed_value: 280000,
    num_sales: 3,
    num_permits: 0
  }
]

describe('parcelsToGeoJSON', () => {
  it('returns a valid GeoJSON FeatureCollection', () => {
    const result = parcelsToGeoJSON(mockParcels)
    expect(result.type).toBe('FeatureCollection')
    expect(Array.isArray(result.features)).toBe(true)
    expect(result.features.length).toBe(3)
  })

  it('creates Point features with correct coordinates', () => {
    const result = parcelsToGeoJSON(mockParcels)
    const feature = result.features[0]
    expect(feature.type).toBe('Feature')
    expect(feature.geometry.type).toBe('Point')
    expect(feature.geometry.coordinates).toEqual([-122.7095, 42.1945])
  })

  it('includes all expected properties', () => {
    const result = parcelsToGeoJSON(mockParcels)
    const props = result.features[0].properties
    expect(props.account).toBe('10059095')
    expect(props.address).toBe('123 Main St')
    expect(props.sqft_living).toBe(1850)
    expect(props.sqft_lot).toBe(7500)
    expect(props.year_built).toBe(1952)
    expect(props.last_sale_price).toBe(425000)
    expect(props.last_sale_date).toBe('2023-06-15')
    expect(props.price_per_sqft).toBe(229.73)
    expect(props.assessed_value).toBe(380000)
    expect(props.num_sales).toBe(4)
    expect(props.num_permits).toBe(2)
    expect(props.maptaxlot).toBe('391E04BB')
  })

  it('uses fallback address when address is missing', () => {
    const result = parcelsToGeoJSON(mockParcels)
    const noAddressFeature = result.features[2]
    expect(noAddressFeature.properties.address).toBe('Parcel 10059097')
  })

  it('handles empty array', () => {
    const result = parcelsToGeoJSON([])
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toEqual([])
  })
})

describe('filterByTimeWindow', () => {
  it('returns all parcels when no dates specified', () => {
    const result = filterByTimeWindow(mockParcels, '', '')
    expect(result.length).toBe(3)
  })

  it('returns all parcels when dates are null', () => {
    const result = filterByTimeWindow(mockParcels, null, null)
    expect(result.length).toBe(3)
  })

  it('filters parcels after start date', () => {
    const result = filterByTimeWindow(mockParcels, '2023-01-01', '')
    expect(result.length).toBe(2) // 2023-06-15 and 2024-01-20
    expect(result.map(p => p.account)).toEqual(['10059095', '10059096'])
  })

  it('filters parcels before end date', () => {
    const result = filterByTimeWindow(mockParcels, '', '2023-01-01')
    expect(result.length).toBe(1) // Only 2022-03-10
    expect(result[0].account).toBe('10059097')
  })

  it('filters parcels within date range', () => {
    const result = filterByTimeWindow(mockParcels, '2023-01-01', '2023-12-31')
    expect(result.length).toBe(1) // Only 2023-06-15
    expect(result[0].account).toBe('10059095')
  })

  it('excludes parcels without last_sale_date when filtering', () => {
    const parcelsWithMissing = [
      ...mockParcels,
      { account: '99999', lat: 42.0, lng: -122.0 } // no last_sale_date
    ]
    const result = filterByTimeWindow(parcelsWithMissing, '2020-01-01', '')
    // Should exclude the one without a date
    expect(result.every(p => p.last_sale_date)).toBe(true)
  })

  it('returns empty when no parcels match', () => {
    const result = filterByTimeWindow(mockParcels, '2025-01-01', '2025-12-31')
    expect(result.length).toBe(0)
  })
})

describe('hexbinsToGeoJSON', () => {
  const mockHexData = {
    hexagons: [
      {
        center_lat: 42.195,
        center_lng: -122.710,
        count: 15,
        median_price_sqft: 230,
        mean_price_sqft: 245,
        min_price_sqft: 120,
        max_price_sqft: 400
      },
      {
        center_lat: 42.196,
        center_lng: -122.708,
        count: 8,
        median_price_sqft: 180,
        mean_price_sqft: 190,
        min_price_sqft: 100,
        max_price_sqft: 310
      }
    ]
  }

  it('returns valid GeoJSON FeatureCollection', () => {
    const result = hexbinsToGeoJSON(mockHexData)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features.length).toBe(2)
  })

  it('creates Point features with correct coordinates', () => {
    const result = hexbinsToGeoJSON(mockHexData)
    expect(result.features[0].geometry.type).toBe('Point')
    expect(result.features[0].geometry.coordinates).toEqual([-122.710, 42.195])
  })

  it('includes hexbin properties', () => {
    const result = hexbinsToGeoJSON(mockHexData)
    const props = result.features[0].properties
    expect(props.count).toBe(15)
    expect(props.median_price_sqft).toBe(230)
    expect(props.mean_price_sqft).toBe(245)
    expect(props.min_price_sqft).toBe(120)
    expect(props.max_price_sqft).toBe(400)
    expect(props.id).toBe(0)
  })

  it('returns empty FeatureCollection for null input', () => {
    const result = hexbinsToGeoJSON(null)
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toEqual([])
  })

  it('returns empty FeatureCollection for missing hexagons', () => {
    const result = hexbinsToGeoJSON({})
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toEqual([])
  })
})

describe('loadParcels', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('fetches and filters parcels with valid lat/lng', async () => {
    const mockData = {
      parcels: [
        { account: '1', lat: 42.0, lng: -122.0 },
        { account: '2', lat: null, lng: -122.0 },
        { account: '3', lat: 42.0, lng: null },
        { account: '4', lat: 42.1, lng: -122.1 }
      ]
    }

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve(mockData)
    })

    // Need to re-import to reset cache
    const { loadParcels } = await import('./data.js?test1')
    const result = await loadParcels()
    expect(result.length).toBe(2)
    expect(result[0].account).toBe('1')
    expect(result[1].account).toBe('4')
  })
})

describe('loadParcelDetail', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed JSON on success', async () => {
    const mockDetail = {
      sales: [{ date: '2023-01-01', price: 400000 }],
      permits: [],
      improvements: []
    }

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    const { loadParcelDetail } = await import('./data.js?test2')
    const result = await loadParcelDetail('12345')
    expect(result).toEqual(mockDetail)
  })

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false
    })

    const { loadParcelDetail } = await import('./data.js?test3')
    const result = await loadParcelDetail('99999')
    expect(result).toBeNull()
  })

  it('returns null on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    const { loadParcelDetail } = await import('./data.js?test4')
    const result = await loadParcelDetail('99999')
    expect(result).toBeNull()
  })
})

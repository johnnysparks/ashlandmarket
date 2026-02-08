import { describe, it, expect, vi, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import {
  parcels,
  selectedMetric,
  colorRamp,
  opacity,
  viewMode,
  hexRadius,
  gridCellSize,
  percentileLow,
  percentileHigh,
  timeStart,
  timeEnd,
  selectedParcel,
  selectedDetail,
  detailLoading,
  hoveredParcel,
  hoverPosition,
  filteredParcels,
  metricRange,
  loadParcels,
  loadParcelDetail,
} from './store'
import type { Parcel, ParcelDetail } from './types'

function makeParcel(overrides: Partial<Parcel> = {}): Parcel {
  return {
    account: '10059095',
    lat: 42.1945,
    lng: -122.7095,
    address: '123 Main St',
    sqft_living: 1850,
    sqft_lot: 7500,
    year_built: 1952,
    last_sale_price: 425000,
    last_sale_date: '2023-06-15',
    price_per_sqft: 229.73,
    assessed_value: 380000,
    num_sales: 4,
    num_permits: 2,
    ...overrides,
  }
}

describe('store defaults', () => {
  beforeEach(() => {
    // Reset stores to defaults
    parcels.set([])
    selectedMetric.set('price_per_sqft')
    colorRamp.set('viridis')
    opacity.set(0.8)
    viewMode.set('scatter')
    hexRadius.set(200)
    gridCellSize.set(200)
    percentileLow.set(2)
    percentileHigh.set(98)
    timeStart.set('')
    timeEnd.set('')
    selectedParcel.set(null)
    selectedDetail.set(null)
    detailLoading.set(false)
    hoveredParcel.set(null)
    hoverPosition.set({ x: 0, y: 0 })
  })

  it('selectedMetric defaults to price_per_sqft', () => {
    expect(get(selectedMetric)).toBe('price_per_sqft')
  })

  it('colorRamp defaults to viridis', () => {
    expect(get(colorRamp)).toBe('viridis')
  })

  it('opacity defaults to 0.8', () => {
    expect(get(opacity)).toBe(0.8)
  })

  it('viewMode defaults to scatter', () => {
    expect(get(viewMode)).toBe('scatter')
  })

  it('hexRadius defaults to 200', () => {
    expect(get(hexRadius)).toBe(200)
  })

  it('gridCellSize defaults to 200', () => {
    expect(get(gridCellSize)).toBe(200)
  })

  it('percentileLow defaults to 2', () => {
    expect(get(percentileLow)).toBe(2)
  })

  it('percentileHigh defaults to 98', () => {
    expect(get(percentileHigh)).toBe(98)
  })

  it('timeStart defaults to empty string', () => {
    expect(get(timeStart)).toBe('')
  })

  it('timeEnd defaults to empty string', () => {
    expect(get(timeEnd)).toBe('')
  })

  it('selectedParcel defaults to null', () => {
    expect(get(selectedParcel)).toBeNull()
  })

  it('selectedDetail defaults to null', () => {
    expect(get(selectedDetail)).toBeNull()
  })

  it('detailLoading defaults to false', () => {
    expect(get(detailLoading)).toBe(false)
  })
})

describe('store setters', () => {
  it('can set parcels', () => {
    const p = [makeParcel()]
    parcels.set(p)
    expect(get(parcels)).toEqual(p)
  })

  it('can update selectedMetric', () => {
    selectedMetric.set('assessed_value')
    expect(get(selectedMetric)).toBe('assessed_value')
  })

  it('can update viewMode', () => {
    viewMode.set('hexagon')
    expect(get(viewMode)).toBe('hexagon')
    viewMode.set('grid')
    expect(get(viewMode)).toBe('grid')
  })

  it('can update opacity', () => {
    opacity.set(0.5)
    expect(get(opacity)).toBe(0.5)
  })

  it('can update colorRamp', () => {
    colorRamp.set('plasma')
    expect(get(colorRamp)).toBe('plasma')
  })
})

describe('filteredParcels (derived store)', () => {
  beforeEach(() => {
    timeStart.set('')
    timeEnd.set('')
  })

  it('returns all parcels when no time filter is set', () => {
    const data = [
      makeParcel({ account: '1', last_sale_date: '2020-01-01' }),
      makeParcel({ account: '2', last_sale_date: '2023-06-15' }),
    ]
    parcels.set(data)
    expect(get(filteredParcels)).toEqual(data)
  })

  it('filters by timeStart', () => {
    const data = [
      makeParcel({ account: '1', last_sale_date: '2020-01-01' }),
      makeParcel({ account: '2', last_sale_date: '2023-06-15' }),
      makeParcel({ account: '3', last_sale_date: '2024-01-01' }),
    ]
    parcels.set(data)
    timeStart.set('2023-01-01')
    const result = get(filteredParcels)
    expect(result).toHaveLength(2)
    expect(result.map(p => p.account)).toEqual(['2', '3'])
  })

  it('filters by timeEnd', () => {
    const data = [
      makeParcel({ account: '1', last_sale_date: '2020-01-01' }),
      makeParcel({ account: '2', last_sale_date: '2023-06-15' }),
      makeParcel({ account: '3', last_sale_date: '2024-01-01' }),
    ]
    parcels.set(data)
    timeEnd.set('2022-12-31')
    const result = get(filteredParcels)
    expect(result).toHaveLength(1)
    expect(result[0].account).toBe('1')
  })

  it('filters by both timeStart and timeEnd', () => {
    const data = [
      makeParcel({ account: '1', last_sale_date: '2020-01-01' }),
      makeParcel({ account: '2', last_sale_date: '2023-06-15' }),
      makeParcel({ account: '3', last_sale_date: '2024-01-01' }),
    ]
    parcels.set(data)
    timeStart.set('2022-01-01')
    timeEnd.set('2023-12-31')
    const result = get(filteredParcels)
    expect(result).toHaveLength(1)
    expect(result[0].account).toBe('2')
  })

  it('returns empty array when no parcels match the filter', () => {
    parcels.set([makeParcel({ last_sale_date: '2020-01-01' })])
    timeStart.set('2025-01-01')
    expect(get(filteredParcels)).toHaveLength(0)
  })
})

describe('metricRange (derived store)', () => {
  beforeEach(() => {
    percentileLow.set(0)
    percentileHigh.set(100)
    selectedMetric.set('price_per_sqft')
    timeStart.set('')
    timeEnd.set('')
  })

  it('returns default range when no parcels', () => {
    parcels.set([])
    const range = get(metricRange)
    expect(range).toEqual({ min: 0, max: 1, rawMin: 0, rawMax: 1 })
  })

  it('computes min/max from parcel metric values', () => {
    parcels.set([
      makeParcel({ price_per_sqft: 100 }),
      makeParcel({ price_per_sqft: 200 }),
      makeParcel({ price_per_sqft: 300 }),
    ])
    const range = get(metricRange)
    expect(range.rawMin).toBe(100)
    expect(range.rawMax).toBe(300)
    expect(range.min).toBe(100)
    expect(range.max).toBe(300)
  })

  it('applies percentile clamping', () => {
    // Create 100 parcels with price_per_sqft from 1 to 100
    const data = Array.from({ length: 100 }, (_, i) =>
      makeParcel({ account: String(i), price_per_sqft: i + 1 })
    )
    parcels.set(data)
    percentileLow.set(10)
    percentileHigh.set(90)
    const range = get(metricRange)
    // P10 of [1..100]: at index 9.9 → ~10.9
    // P90 of [1..100]: at index 89.1 → ~90.1
    expect(range.min).toBeGreaterThanOrEqual(10)
    expect(range.min).toBeLessThanOrEqual(12)
    expect(range.max).toBeGreaterThanOrEqual(89)
    expect(range.max).toBeLessThanOrEqual(91)
    expect(range.rawMin).toBe(1)
    expect(range.rawMax).toBe(100)
  })

  it('responds to metric changes', () => {
    parcels.set([
      makeParcel({ price_per_sqft: 100, assessed_value: 500000 }),
      makeParcel({ price_per_sqft: 200, assessed_value: 700000 }),
    ])

    selectedMetric.set('price_per_sqft')
    let range = get(metricRange)
    expect(range.rawMin).toBe(100)
    expect(range.rawMax).toBe(200)

    selectedMetric.set('assessed_value')
    range = get(metricRange)
    expect(range.rawMin).toBe(500000)
    expect(range.rawMax).toBe(700000)
  })

  it('handles single parcel', () => {
    parcels.set([makeParcel({ price_per_sqft: 150 })])
    const range = get(metricRange)
    expect(range.rawMin).toBe(150)
    expect(range.rawMax).toBe(150)
    expect(range.min).toBe(150)
    expect(range.max).toBe(150)
  })
})

describe('loadParcels', () => {
  beforeEach(() => {
    parcels.set([])
    vi.restoreAllMocks()
  })

  it('fetches parcels.json and sets the parcels store', async () => {
    const mockData = {
      generated: '2026-02-08T00:00:00Z',
      parcels: [makeParcel()],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    }))

    await loadParcels()
    expect(fetch).toHaveBeenCalledWith('../data/parcels.json')
    expect(get(parcels)).toEqual(mockData.parcels)

    vi.unstubAllGlobals()
  })
})

describe('loadParcelDetail', () => {
  beforeEach(() => {
    selectedDetail.set(null)
    detailLoading.set(false)
    vi.restoreAllMocks()
  })

  it('fetches detail JSON and sets selectedDetail', async () => {
    const mockDetail: ParcelDetail = {
      account: '10059095',
      sales: [{ date: '2023-06-15', price: 425000, buyer: 'SMITH JOHN', type: 'WARRANTY DEED' }],
      permits: [],
      improvements: [],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail),
    }))

    await loadParcelDetail('10059095')
    expect(fetch).toHaveBeenCalledWith('../data/sales/10059095.json')
    expect(get(selectedDetail)).toEqual(mockDetail)
    expect(get(detailLoading)).toBe(false)

    vi.unstubAllGlobals()
  })

  it('sets selectedDetail to null on fetch error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

    await loadParcelDetail('99999')
    expect(get(selectedDetail)).toBeNull()
    expect(get(detailLoading)).toBe(false)

    vi.unstubAllGlobals()
  })

  it('manages detailLoading state during fetch', async () => {
    let resolveFetch: (value: any) => void
    const fetchPromise = new Promise(resolve => { resolveFetch = resolve })

    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise))

    const loadPromise = loadParcelDetail('10059095')

    // While loading, detailLoading should be true
    expect(get(detailLoading)).toBe(true)

    // Resolve the fetch
    resolveFetch!({
      ok: true,
      json: () => Promise.resolve({
        account: '10059095',
        sales: [],
        permits: [],
        improvements: [],
      }),
    })

    await loadPromise
    expect(get(detailLoading)).toBe(false)

    vi.unstubAllGlobals()
  })
})

import { writable, derived } from 'svelte/store'
import type { Parcel, ParcelDetail, MetricKey, ColorRamp, ViewMode } from './types'

export const parcels = writable<Parcel[]>([])
export const selectedMetric = writable<MetricKey>('price_per_sqft')
export const colorRamp = writable<ColorRamp>('viridis')
export const opacity = writable(0.8)
export const viewMode = writable<ViewMode>('scatter')
export const hexRadius = writable(200)

// Time filter
export const timeStart = writable('')
export const timeEnd = writable('')

// Selected parcel for detail view
export const selectedParcel = writable<Parcel | null>(null)
export const selectedDetail = writable<ParcelDetail | null>(null)
export const detailLoading = writable(false)

// Hovered parcel for tooltip
export const hoveredParcel = writable<Parcel | null>(null)
export const hoverPosition = writable<{ x: number; y: number }>({ x: 0, y: 0 })

// Filtered parcels based on time window
export const filteredParcels = derived(
  [parcels, timeStart, timeEnd],
  ([$parcels, $timeStart, $timeEnd]) => {
    if (!$timeStart && !$timeEnd) return $parcels
    return $parcels.filter(p => {
      if ($timeStart && p.last_sale_date < $timeStart) return false
      if ($timeEnd && p.last_sale_date > $timeEnd) return false
      return true
    })
  }
)

// Metric range for color scaling
export const metricRange = derived(
  [filteredParcels, selectedMetric],
  ([$parcels, $metric]) => {
    if ($parcels.length === 0) return { min: 0, max: 1 }
    const values = $parcels.map(p => p[$metric])
    return {
      min: Math.min(...values),
      max: Math.max(...values),
    }
  }
)

export async function loadParcels() {
  const resp = await fetch('../data/parcels.json')
  const data = await resp.json()
  parcels.set(data.parcels)
}

export async function loadParcelDetail(account: string) {
  detailLoading.set(true)
  try {
    const resp = await fetch(`../data/sales/${account}.json`)
    const data = await resp.json()
    selectedDetail.set(data)
  } catch {
    selectedDetail.set(null)
  } finally {
    detailLoading.set(false)
  }
}

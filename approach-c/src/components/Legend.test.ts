import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import Legend from './Legend.svelte'
import {
  parcels,
  selectedMetric,
  colorRamp,
  percentileLow,
  percentileHigh,
  timeStart,
  timeEnd,
} from '../store'
import type { Parcel } from '../types'

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

describe('Legend', () => {
  beforeEach(() => {
    parcels.set([])
    selectedMetric.set('price_per_sqft')
    colorRamp.set('viridis')
    percentileLow.set(0)
    percentileHigh.set(100)
    timeStart.set('')
    timeEnd.set('')
  })

  it('renders the legend container', () => {
    const { container } = render(Legend)
    expect(container.querySelector('.legend')).toBeInTheDocument()
  })

  it('displays the metric label', () => {
    const { container } = render(Legend)
    const label = container.querySelector('.legend-label')
    expect(label?.textContent).toContain('$/sqft')
  })

  it('updates label when metric changes', async () => {
    const { container } = render(Legend)
    selectedMetric.set('last_sale_price')
    // Wait for reactive update
    await new Promise(r => setTimeout(r, 0))
    const label = container.querySelector('.legend-label')
    expect(label?.textContent).toContain('Last Sale Price')
  })

  it('renders the color gradient bar', () => {
    const { container } = render(Legend)
    const bar = container.querySelector('.legend-bar')
    expect(bar).toBeInTheDocument()
    const style = bar?.getAttribute('style') ?? ''
    expect(style).toContain('background')
    expect(style).toContain('linear-gradient')
  })

  it('shows parcel count in the range', async () => {
    parcels.set([
      makeParcel({ account: '1', price_per_sqft: 100 }),
      makeParcel({ account: '2', price_per_sqft: 200 }),
      makeParcel({ account: '3', price_per_sqft: 300 }),
    ])
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Legend)
    const range = container.querySelector('.legend-range')
    expect(range?.textContent).toContain('3 parcels')
  })

  it('shows percentile badge when clamped', async () => {
    percentileLow.set(10)
    percentileHigh.set(90)
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Legend)
    const badge = container.querySelector('.clamp-badge')
    expect(badge).toBeInTheDocument()
    expect(badge?.textContent).toContain('P10')
    expect(badge?.textContent).toContain('P90')
  })

  it('hides percentile badge at full range', () => {
    percentileLow.set(0)
    percentileHigh.set(100)
    const { container } = render(Legend)
    const badge = container.querySelector('.clamp-badge')
    expect(badge).not.toBeInTheDocument()
  })
})

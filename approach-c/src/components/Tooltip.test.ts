import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/svelte'
import Tooltip from './Tooltip.svelte'
import { hoveredParcel, hoverPosition, selectedMetric } from '../store'
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

describe('Tooltip', () => {
  beforeEach(() => {
    hoveredParcel.set(null)
    hoverPosition.set({ x: 0, y: 0 })
    selectedMetric.set('price_per_sqft')
  })

  it('renders nothing when no parcel is hovered', () => {
    const { container } = render(Tooltip)
    expect(container.querySelector('.tooltip')).not.toBeInTheDocument()
  })

  it('renders tooltip when a parcel is hovered', async () => {
    hoveredParcel.set(makeParcel())
    hoverPosition.set({ x: 100, y: 200 })
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Tooltip)
    expect(container.querySelector('.tooltip')).toBeInTheDocument()
  })

  it('displays the parcel address', async () => {
    hoveredParcel.set(makeParcel({ address: '456 Oak Ave' }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Tooltip)
    const address = container.querySelector('.address')
    expect(address?.textContent).toBe('456 Oak Ave')
  })

  it('displays the selected metric value', async () => {
    hoveredParcel.set(makeParcel({ price_per_sqft: 229.73 }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Tooltip)
    const metricValue = container.querySelector('.metric-value')
    expect(metricValue?.textContent).toContain('$/sqft')
    expect(metricValue?.textContent).toContain('229')
  })

  it('displays sqft and year built', async () => {
    hoveredParcel.set(makeParcel({ sqft_living: 2100, year_built: 1965 }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Tooltip)
    const stats = container.querySelector('.stats')
    expect(stats?.textContent).toContain('2,100')
    expect(stats?.textContent).toContain('1965')
  })

  it('shows click hint', async () => {
    hoveredParcel.set(makeParcel())
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Tooltip)
    const hint = container.querySelector('.hint')
    expect(hint?.textContent).toContain('Click for details')
  })

  it('positions tooltip based on hover position', async () => {
    hoveredParcel.set(makeParcel())
    hoverPosition.set({ x: 150, y: 250 })
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(Tooltip)
    const tooltip = container.querySelector('.tooltip') as HTMLElement
    expect(tooltip.style.left).toBe('162px') // x + 12
    expect(tooltip.style.top).toBe('238px') // y - 12
  })
})

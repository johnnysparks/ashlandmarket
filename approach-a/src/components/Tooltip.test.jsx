import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Tooltip from './Tooltip'
import { METRICS } from '../utils/colors'

const mockParcel = {
  account: '10059095',
  address: '123 Main St',
  price_per_sqft: 229.73,
  last_sale_price: 425000,
  last_sale_date: '2023-06-15',
  sqft_living: 1850
}

const mockPoint = { x: 100, y: 200 }

describe('Tooltip', () => {
  it('renders nothing when parcel is null', () => {
    const { container } = render(
      <Tooltip parcel={null} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing when point is null', () => {
    const { container } = render(
      <Tooltip parcel={mockParcel} point={null} metric={METRICS.price_per_sqft} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders address as title', () => {
    render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
  })

  it('renders fallback title when address is missing', () => {
    const noAddressParcel = { ...mockParcel, address: null }
    render(
      <Tooltip parcel={noAddressParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.getByText('Parcel 10059095')).toBeInTheDocument()
  })

  it('renders formatted metric value', () => {
    render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.getByText('$230')).toBeInTheDocument()
    expect(screen.getByText('$/sqft:')).toBeInTheDocument()
  })

  it('renders last sale price', () => {
    render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.getByText('$425k')).toBeInTheDocument()
  })

  it('renders sale date', () => {
    render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.getByText('2023-06-15')).toBeInTheDocument()
  })

  it('renders living sqft', () => {
    render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.getByText(/1,850 sqft/)).toBeInTheDocument()
  })

  it('hides last sale when not present', () => {
    const parcel = { ...mockParcel, last_sale_price: null }
    render(
      <Tooltip parcel={parcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.queryByText('Last Sale:')).not.toBeInTheDocument()
  })

  it('hides date when not present', () => {
    const parcel = { ...mockParcel, last_sale_date: null }
    render(
      <Tooltip parcel={parcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.queryByText('Date:')).not.toBeInTheDocument()
  })

  it('hides living sqft when not present', () => {
    const parcel = { ...mockParcel, sqft_living: null }
    render(
      <Tooltip parcel={parcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    expect(screen.queryByText(/sqft$/)).not.toBeInTheDocument()
  })

  it('is positioned at the cursor point with offset', () => {
    const { container } = render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.price_per_sqft} />
    )
    const tooltip = container.querySelector('.map-tooltip')
    expect(tooltip.style.left).toBe('112px')
    expect(tooltip.style.top).toBe('188px')
    expect(tooltip.style.pointerEvents).toBe('none')
  })

  it('works with different metrics', () => {
    render(
      <Tooltip parcel={mockParcel} point={mockPoint} metric={METRICS.year_built} />
    )
    expect(screen.getByText('Year Built:')).toBeInTheDocument()
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import DetailPanel from './DetailPanel'

const mockParcel = {
  account: '10059095',
  address: '123 Main St',
  price_per_sqft: 229.73,
  last_sale_price: 425000,
  assessed_value: 380000,
  year_built: 1952,
  sqft_living: 1850,
  sqft_lot: 7500
}

const mockDetail = {
  sales: [
    { date: '2023-06-15', price: 425000, type: 'WARRANTY DEED' },
    { date: '2019-03-20', price: 350000, type: 'WARRANTY DEED' }
  ],
  permits: [
    { number: 'B-2021-0456', type: 'REMODEL', date: '2021-03-12', status: 'FINAL' }
  ],
  improvements: [
    { type: 'DWELLING', sqft: 1850, year_built: 1952, condition: 'AVERAGE' }
  ]
}

describe('DetailPanel', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders nothing when parcel is null', () => {
    const { container } = render(<DetailPanel parcel={null} onClose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders header with address', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)
    expect(screen.getByText('123 Main St')).toBeInTheDocument()
  })

  it('renders fallback header when address is missing', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    const noAddr = { ...mockParcel, address: null }
    render(<DetailPanel parcel={noAddr} onClose={vi.fn()} />)
    expect(screen.getByText('Parcel 10059095')).toBeInTheDocument()
  })

  it('shows account number', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)
    expect(screen.getByText('Account: 10059095')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    const onClose = vi.fn()
    render(<DetailPanel parcel={mockParcel} onClose={onClose} />)
    fireEvent.click(screen.getByText('\u00d7'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders stat cards with correct values', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)
    expect(screen.getByText('$230')).toBeInTheDocument() // price_per_sqft rounded
    expect(screen.getByText('$425k')).toBeInTheDocument() // last_sale_price
    expect(screen.getByText('$380k')).toBeInTheDocument() // assessed_value
    expect(screen.getByText('1952')).toBeInTheDocument() // year_built
  })

  it('shows N/A for missing stat values', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    const sparse = { account: '123', address: 'Test' }
    render(<DetailPanel parcel={sparse} onClose={vi.fn()} />)
    const naElements = screen.getAllByText('N/A')
    expect(naElements.length).toBeGreaterThanOrEqual(4)
  })

  it('shows loading state while fetching details', () => {
    // Never resolving promise to keep loading state
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)
    expect(screen.getByText('Loading details...')).toBeInTheDocument()
  })

  it('renders sales history when loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Sales History')).toBeInTheDocument()
    })
    expect(screen.getByText('2023-06-15')).toBeInTheDocument()
    expect(screen.getByText('$425,000')).toBeInTheDocument()
    expect(screen.getAllByText('WARRANTY DEED').length).toBe(2)
  })

  it('renders permits when loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Permits (1)')).toBeInTheDocument()
    })
    expect(screen.getByText('REMODEL')).toBeInTheDocument()
    expect(screen.getByText('FINAL')).toBeInTheDocument()
  })

  it('renders improvements when loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Improvements')).toBeInTheDocument()
    })
    expect(screen.getByText('DWELLING')).toBeInTheDocument()
    expect(screen.getByText('AVERAGE')).toBeInTheDocument()
  })

  it('shows no data message when detail fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false
    })

    render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('No detailed data available for this parcel.')).toBeInTheDocument()
    })
  })

  it('renders price chart when 2+ valid sales exist', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockDetail)
    })

    const { container } = render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(container.querySelector('.price-chart')).toBeInTheDocument()
    })
  })

  it('hides price chart when fewer than 2 valid sales', async () => {
    const singleSale = {
      ...mockDetail,
      sales: [{ date: '2023-06-15', price: 425000, type: 'WARRANTY DEED' }]
    }

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(singleSale)
    })

    const { container } = render(<DetailPanel parcel={mockParcel} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('Sales History')).toBeInTheDocument()
    })
    expect(container.querySelector('.price-chart')).not.toBeInTheDocument()
  })
})

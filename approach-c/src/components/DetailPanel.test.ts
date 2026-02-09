import { describe, it, expect, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/svelte'
import { get } from 'svelte/store'
import DetailPanel from './DetailPanel.svelte'
import { selectedParcel, selectedDetail, detailLoading } from '../store'
import type { Parcel, ParcelDetail } from '../types'

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
    price_per_sqft_lot: 56.67,
    assessed_value: 380000,
    num_sales: 4,
    num_permits: 2,
    ...overrides,
  }
}

function makeDetail(overrides: Partial<ParcelDetail> = {}): ParcelDetail {
  return {
    account: '10059095',
    sales: [
      { date: '2023-06-15', price: 425000, buyer: 'SMITH JOHN', type: 'WARRANTY DEED' },
    ],
    permits: [],
    improvements: [],
    ...overrides,
  }
}

describe('DetailPanel', () => {
  beforeEach(() => {
    selectedParcel.set(makeParcel())
    selectedDetail.set(null)
    detailLoading.set(false)
  })

  it('shows loading state when detailLoading is true', async () => {
    detailLoading.set(true)
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    expect(container.querySelector('.loading')?.textContent).toContain('Loading')
  })

  it('shows "No detail data" when detail is null and not loading', () => {
    const { container } = render(DetailPanel)
    expect(container.querySelector('.loading')?.textContent).toContain('No detail data')
  })

  it('displays the parcel address in the header', async () => {
    selectedParcel.set(makeParcel({ address: '789 Pine Rd' }))
    selectedDetail.set(makeDetail())
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const h2 = container.querySelector('h2')
    expect(h2?.textContent).toBe('789 Pine Rd')
  })

  it('displays the account number', async () => {
    selectedParcel.set(makeParcel({ account: '12345' }))
    selectedDetail.set(makeDetail())
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const account = container.querySelector('.account')
    expect(account?.textContent).toContain('12345')
  })

  it('renders stats grid with key values', async () => {
    selectedParcel.set(makeParcel())
    selectedDetail.set(makeDetail())
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const stats = container.querySelectorAll('.stat')
    expect(stats.length).toBe(7) // Last Sale, $/sqft, $/sqft Lot, Living, Lot, Built, Assessed
  })

  it('renders sales table', async () => {
    selectedDetail.set(makeDetail({
      sales: [
        { date: '2023-06-15', price: 425000, buyer: 'SMITH JOHN', type: 'WARRANTY DEED' },
        { date: '2020-01-01', price: 350000, buyer: 'DOE JANE', type: 'BARGAIN AND SALE' },
      ],
    }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const rows = container.querySelectorAll('tbody tr')
    expect(rows).toHaveLength(2)
  })

  it('renders price chart when there are multiple sales', async () => {
    selectedDetail.set(makeDetail({
      sales: [
        { date: '2020-01-01', price: 350000, buyer: 'DOE JANE', type: 'WARRANTY DEED' },
        { date: '2023-06-15', price: 425000, buyer: 'SMITH JOHN', type: 'WARRANTY DEED' },
      ],
    }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('does not render price chart for a single sale', async () => {
    selectedDetail.set(makeDetail({
      sales: [
        { date: '2023-06-15', price: 425000, buyer: 'SMITH JOHN', type: 'WARRANTY DEED' },
      ],
    }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeInTheDocument()
  })

  it('renders permits section when permits exist', async () => {
    selectedDetail.set(makeDetail({
      permits: [
        { number: 'B-2021-0456', type: 'REMODEL', date: '2021-03-12', status: 'FINAL' },
      ],
    }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const h3s = Array.from(container.querySelectorAll('h3'))
    const permitsHeader = h3s.find(h => h.textContent?.includes('Permits'))
    expect(permitsHeader).toBeTruthy()
  })

  it('does not render permits section when empty', async () => {
    selectedDetail.set(makeDetail({ permits: [] }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const h3s = Array.from(container.querySelectorAll('h3'))
    const permitsHeader = h3s.find(h => h.textContent?.includes('Permits'))
    expect(permitsHeader).toBeFalsy()
  })

  it('renders improvements section when improvements exist', async () => {
    selectedDetail.set(makeDetail({
      improvements: [
        { type: 'DWELLING', sqft: 1850, year_built: 1952, condition: 'AVERAGE' },
      ],
    }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const h3s = Array.from(container.querySelectorAll('h3'))
    const impHeader = h3s.find(h => h.textContent?.includes('Improvements'))
    expect(impHeader).toBeTruthy()
  })

  it('closes panel on close button click', async () => {
    selectedParcel.set(makeParcel())
    selectedDetail.set(makeDetail())
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const closeBtn = container.querySelector('.close-btn') as HTMLElement
    await fireEvent.click(closeBtn)
    expect(get(selectedParcel)).toBeNull()
    expect(get(selectedDetail)).toBeNull()
  })

  it('renders permit status badges with correct classes', async () => {
    selectedDetail.set(makeDetail({
      permits: [
        { number: 'B-001', type: 'REMODEL', date: '2021-03-12', status: 'FINAL' },
        { number: 'B-002', type: 'NEW', date: '2022-01-01', status: 'ACTIVE' },
      ],
    }))
    await new Promise(r => setTimeout(r, 0))
    const { container } = render(DetailPanel)
    const statuses = container.querySelectorAll('.status')
    expect(statuses).toHaveLength(2)
    expect(statuses[0].classList.contains('final')).toBe(true)
    expect(statuses[1].classList.contains('active')).toBe(true)
  })
})

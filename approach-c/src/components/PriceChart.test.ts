import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import PriceChart from './PriceChart.svelte'
import type { Sale } from '../types'

function makeSale(overrides: Partial<Sale> = {}): Sale {
  return {
    date: '2023-06-15',
    price: 425000,
    buyer: 'SMITH JOHN',
    type: 'WARRANTY DEED',
    ...overrides,
  }
}

describe('PriceChart', () => {
  it('renders an SVG element', () => {
    const sales = [makeSale()]
    const { container } = render(PriceChart, { props: { sales } })
    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('renders a circle for each sale', () => {
    const sales = [
      makeSale({ date: '2020-01-01', price: 300000 }),
      makeSale({ date: '2022-06-01', price: 400000 }),
      makeSale({ date: '2024-01-01', price: 500000 }),
    ]
    const { container } = render(PriceChart, { props: { sales } })
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(3)
  })

  it('renders a path for the line', () => {
    const sales = [
      makeSale({ date: '2020-01-01', price: 300000 }),
      makeSale({ date: '2023-06-01', price: 425000 }),
    ]
    const { container } = render(PriceChart, { props: { sales } })
    const path = container.querySelector('path')
    expect(path).toBeInTheDocument()
    expect(path?.getAttribute('d')).toContain('M')
  })

  it('sorts sales by date and renders date labels', () => {
    const sales = [
      makeSale({ date: '2024-01-01', price: 500000 }),
      makeSale({ date: '2020-01-01', price: 300000 }),
    ]
    const { container } = render(PriceChart, { props: { sales } })
    const textElements = container.querySelectorAll('text')
    // Should include year labels - find the date labels
    const dateTexts = Array.from(textElements)
      .map(t => t.textContent)
      .filter(t => t && /^\d{4}$/.test(t))
    expect(dateTexts).toContain('2020')
    expect(dateTexts).toContain('2024')
  })

  it('renders y-axis tick labels with currency format', () => {
    const sales = [
      makeSale({ date: '2020-01-01', price: 200000 }),
      makeSale({ date: '2023-01-01', price: 600000 }),
    ]
    const { container } = render(PriceChart, { props: { sales } })
    const textElements = container.querySelectorAll('text')
    const tickTexts = Array.from(textElements)
      .map(t => t.textContent ?? '')
      .filter(t => t.includes('$'))
    expect(tickTexts.length).toBeGreaterThan(0)
  })

  it('renders grid lines', () => {
    const sales = [
      makeSale({ date: '2020-01-01', price: 200000 }),
      makeSale({ date: '2023-01-01', price: 500000 }),
    ]
    const { container } = render(PriceChart, { props: { sales } })
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThan(0)
  })

  it('handles a single sale', () => {
    const sales = [makeSale()]
    const { container } = render(PriceChart, { props: { sales } })
    const circles = container.querySelectorAll('circle')
    expect(circles).toHaveLength(1)
  })
})

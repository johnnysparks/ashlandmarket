import { describe, it, expect } from 'vitest'
import { METRICS } from './metrics'
import type { MetricKey } from './types'

describe('METRICS', () => {
  const expectedKeys: MetricKey[] = [
    'price_per_sqft',
    'price_per_sqft_lot',
    'last_sale_price',
    'assessed_value',
    'sqft_living',
    'sqft_lot',
    'year_built',
    'num_sales',
    'num_permits',
  ]

  it('defines all 9 metric options', () => {
    expect(METRICS).toHaveLength(9)
  })

  it('contains all expected metric keys', () => {
    const keys = METRICS.map(m => m.key)
    for (const k of expectedKeys) {
      expect(keys).toContain(k)
    }
  })

  it('has no duplicate keys', () => {
    const keys = METRICS.map(m => m.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('every metric has a non-empty label', () => {
    for (const m of METRICS) {
      expect(m.label).toBeTruthy()
      expect(typeof m.label).toBe('string')
      expect(m.label.length).toBeGreaterThan(0)
    }
  })

  it('every metric has a format function', () => {
    for (const m of METRICS) {
      expect(typeof m.format).toBe('function')
    }
  })

  describe('formatters', () => {
    it('price_per_sqft formats as currency with decimals', () => {
      const metric = METRICS.find(m => m.key === 'price_per_sqft')!
      const result = metric.format(229.73)
      expect(result).toContain('229')
      expect(result).toContain('$')
    })

    it('last_sale_price formats as whole-dollar currency', () => {
      const metric = METRICS.find(m => m.key === 'last_sale_price')!
      const result = metric.format(425000)
      expect(result).toContain('$')
      expect(result).toContain('425,000') // US-formatted
    })

    it('assessed_value formats as whole-dollar currency', () => {
      const metric = METRICS.find(m => m.key === 'assessed_value')!
      const result = metric.format(380000)
      expect(result).toContain('$')
      expect(result).toContain('380,000')
    })

    it('sqft_living formats with "sqft" suffix', () => {
      const metric = METRICS.find(m => m.key === 'sqft_living')!
      const result = metric.format(1850)
      expect(result).toContain('1,850')
      expect(result).toContain('sqft')
    })

    it('sqft_lot formats with "sqft" suffix', () => {
      const metric = METRICS.find(m => m.key === 'sqft_lot')!
      const result = metric.format(7500)
      expect(result).toContain('7,500')
      expect(result).toContain('sqft')
    })

    it('year_built formats as plain string', () => {
      const metric = METRICS.find(m => m.key === 'year_built')!
      expect(metric.format(1952)).toBe('1952')
    })

    it('num_sales formats as a number', () => {
      const metric = METRICS.find(m => m.key === 'num_sales')!
      expect(metric.format(4)).toBe('4')
    })

    it('num_permits formats as a number', () => {
      const metric = METRICS.find(m => m.key === 'num_permits')!
      expect(metric.format(2)).toBe('2')
    })

    it('formatters handle zero', () => {
      for (const m of METRICS) {
        const result = m.format(0)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      }
    })

    it('formatters handle large numbers', () => {
      for (const m of METRICS) {
        const result = m.format(1000000)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
      }
    })
  })
})

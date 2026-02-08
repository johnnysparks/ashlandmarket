import { describe, it, expect } from 'vitest'
import {
  COLOR_RAMPS,
  METRICS,
  interpolateColor,
  buildColorExpression,
  computePercentiles
} from './colors'

describe('COLOR_RAMPS', () => {
  it('contains all expected ramp keys', () => {
    const keys = Object.keys(COLOR_RAMPS)
    expect(keys).toContain('viridis')
    expect(keys).toContain('inferno')
    expect(keys).toContain('magma')
    expect(keys).toContain('plasma')
    expect(keys).toContain('ylOrRd')
    expect(keys).toContain('blues')
    expect(keys).toContain('rdYlGn')
  })

  it('each ramp has a name and stops array with at least 2 colors', () => {
    for (const [key, ramp] of Object.entries(COLOR_RAMPS)) {
      expect(ramp.name, `${key} should have a name`).toBeTruthy()
      expect(Array.isArray(ramp.stops), `${key} stops should be an array`).toBe(true)
      expect(ramp.stops.length, `${key} should have at least 2 stops`).toBeGreaterThanOrEqual(2)
    }
  })

  it('all color stops are valid hex colors', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i
    for (const [key, ramp] of Object.entries(COLOR_RAMPS)) {
      for (const stop of ramp.stops) {
        expect(stop, `${key} stop "${stop}" should be valid hex`).toMatch(hexPattern)
      }
    }
  })
})

describe('METRICS', () => {
  it('contains all expected metric keys', () => {
    const keys = Object.keys(METRICS)
    expect(keys).toEqual(expect.arrayContaining([
      'price_per_sqft', 'last_sale_price', 'assessed_value',
      'year_built', 'sqft_living', 'sqft_lot',
      'num_sales', 'num_permits'
    ]))
  })

  it('each metric has label, key, and format function', () => {
    for (const [key, m] of Object.entries(METRICS)) {
      expect(m.label, `${key} should have a label`).toBeTruthy()
      expect(m.key, `${key} metric key should match object key`).toBe(key)
      expect(typeof m.format, `${key} should have a format function`).toBe('function')
    }
  })

  it('format functions produce strings', () => {
    expect(METRICS.price_per_sqft.format(229)).toBe('$229')
    expect(METRICS.last_sale_price.format(425000)).toBe('$425k')
    expect(METRICS.assessed_value.format(380000)).toBe('$380k')
    expect(METRICS.year_built.format(1952)).toBe('1952')
    expect(METRICS.num_sales.format(4)).toBe('4')
    expect(METRICS.num_permits.format(2)).toBe('2')
  })
})

describe('interpolateColor', () => {
  const stops = ['#000000', '#ffffff']

  it('returns first color at t=0', () => {
    expect(interpolateColor(stops, 0)).toBe('#000000')
  })

  it('returns last color at t=1', () => {
    expect(interpolateColor(stops, 1)).toBe('#ffffff')
  })

  it('returns midpoint color at t=0.5', () => {
    const result = interpolateColor(stops, 0.5)
    // Midpoint between black and white should be around #808080
    expect(result).toBe('#808080')
  })

  it('clamps t below 0 to first stop', () => {
    expect(interpolateColor(stops, -1)).toBe('#000000')
  })

  it('clamps t above 1 to last stop', () => {
    expect(interpolateColor(stops, 2)).toBe('#ffffff')
  })

  it('interpolates correctly with multiple stops', () => {
    const multiStops = ['#ff0000', '#00ff00', '#0000ff']
    // t=0 -> red
    expect(interpolateColor(multiStops, 0)).toBe('#ff0000')
    // t=0.5 -> green
    expect(interpolateColor(multiStops, 0.5)).toBe('#00ff00')
    // t=1 -> blue
    expect(interpolateColor(multiStops, 1)).toBe('#0000ff')
  })

  it('works with actual viridis ramp', () => {
    const result = interpolateColor(COLOR_RAMPS.viridis.stops, 0)
    expect(result).toBe(COLOR_RAMPS.viridis.stops[0])
  })
})

describe('buildColorExpression', () => {
  const stops = ['#ff0000', '#00ff00', '#0000ff']

  it('returns midpoint color when min equals max', () => {
    const result = buildColorExpression('price_per_sqft', 100, 100, stops)
    expect(result).toBe(stops[1]) // middle stop
  })

  it('returns Mapbox interpolation expression for valid range', () => {
    const result = buildColorExpression('price_per_sqft', 0, 200, stops)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0]).toBe('interpolate')
    expect(result[1]).toEqual(['linear'])
    expect(result[2]).toEqual(['get', 'price_per_sqft'])
  })

  it('expression contains correct value-color pairs', () => {
    const result = buildColorExpression('price_per_sqft', 0, 200, stops)
    // Should have: ['interpolate', ['linear'], ['get', key], val0, color0, val1, color1, val2, color2]
    // That's 3 header items + 3 * 2 = 6 items = 9 total
    expect(result.length).toBe(9)
    // First value should be min (0)
    expect(result[3]).toBe(0)
    expect(result[4]).toBe('#ff0000')
    // Middle value should be 100
    expect(result[5]).toBe(100)
    expect(result[6]).toBe('#00ff00')
    // Last value should be max (200)
    expect(result[7]).toBe(200)
    expect(result[8]).toBe('#0000ff')
  })

  it('uses the correct metric key', () => {
    const result = buildColorExpression('assessed_value', 0, 500000, stops)
    expect(result[2]).toEqual(['get', 'assessed_value'])
  })
})

describe('computePercentiles', () => {
  it('returns {min: 0, max: 1} for empty array', () => {
    expect(computePercentiles([])).toEqual({ min: 0, max: 1 })
  })

  it('filters out null and NaN values', () => {
    const values = [null, NaN, 10, undefined, 20, NaN, 30]
    const result = computePercentiles(values, 0, 99)
    expect(result.min).toBe(10)
    expect(result.max).toBe(30)
  })

  it('returns correct percentiles for a sorted dataset', () => {
    // 100 values from 1 to 100
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    const result = computePercentiles(values, 5, 95)
    expect(result.min).toBe(6)  // 5th percentile of 1-100
    expect(result.max).toBe(96) // 95th percentile of 1-100
  })

  it('handles single value', () => {
    const result = computePercentiles([42], 5, 95)
    expect(result.min).toBe(42)
    expect(result.max).toBe(42)
  })

  it('uses default percentiles (5, 95) when not specified', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    const result = computePercentiles(values)
    expect(result.min).toBe(6)
    expect(result.max).toBe(96)
  })

  it('handles 0-99 percentile range (near full range)', () => {
    const values = [5, 10, 15, 20, 25]
    const result = computePercentiles(values, 0, 99)
    expect(result.min).toBe(5)
    expect(result.max).toBe(25)
  })

  it('handles 50th percentile', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    const result = computePercentiles(values, 50, 95)
    expect(result.min).toBe(60) // index 5
    expect(result.max).toBe(100) // index 9
  })

  it('sorts unsorted input correctly', () => {
    const values = [50, 10, 90, 30, 70]
    const result = computePercentiles(values, 0, 100)
    expect(result.min).toBe(10)
  })
})

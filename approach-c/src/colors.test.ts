import { describe, it, expect } from 'vitest'
import { getColor, getRampColors } from './colors'
import type { ColorRamp } from './types'

describe('getRampColors', () => {
  const ramps: ColorRamp[] = ['viridis', 'plasma', 'warm', 'cool', 'reds']

  it.each(ramps)('returns an array of RGB tuples for %s', (ramp) => {
    const colors = getRampColors(ramp)
    expect(colors.length).toBeGreaterThanOrEqual(2)
    for (const c of colors) {
      expect(c).toHaveLength(3)
      expect(c[0]).toBeGreaterThanOrEqual(0)
      expect(c[0]).toBeLessThanOrEqual(255)
      expect(c[1]).toBeGreaterThanOrEqual(0)
      expect(c[1]).toBeLessThanOrEqual(255)
      expect(c[2]).toBeGreaterThanOrEqual(0)
      expect(c[2]).toBeLessThanOrEqual(255)
    }
  })

  it('viridis has 7 color stops', () => {
    expect(getRampColors('viridis')).toHaveLength(7)
  })
})

describe('getColor', () => {
  it('returns RGBA tuple with alpha 200', () => {
    const color = getColor(50, 0, 100, 'viridis')
    expect(color).toHaveLength(4)
    expect(color[3]).toBe(200)
  })

  it('returns the first ramp color at min value', () => {
    const color = getColor(0, 0, 100, 'viridis')
    const ramp = getRampColors('viridis')
    expect(color[0]).toBe(ramp[0][0])
    expect(color[1]).toBe(ramp[0][1])
    expect(color[2]).toBe(ramp[0][2])
  })

  it('returns the last ramp color at max value', () => {
    const color = getColor(100, 0, 100, 'viridis')
    const ramp = getRampColors('viridis')
    const last = ramp[ramp.length - 1]
    expect(color[0]).toBe(last[0])
    expect(color[1]).toBe(last[1])
    expect(color[2]).toBe(last[2])
  })

  it('clamps values below min to first color', () => {
    const color = getColor(-50, 0, 100, 'viridis')
    const ramp = getRampColors('viridis')
    expect(color[0]).toBe(ramp[0][0])
    expect(color[1]).toBe(ramp[0][1])
    expect(color[2]).toBe(ramp[0][2])
  })

  it('clamps values above max to last color', () => {
    const color = getColor(200, 0, 100, 'viridis')
    const ramp = getRampColors('viridis')
    const last = ramp[ramp.length - 1]
    expect(color[0]).toBe(last[0])
    expect(color[1]).toBe(last[1])
    expect(color[2]).toBe(last[2])
  })

  it('returns midpoint color for equal min/max', () => {
    const color = getColor(50, 50, 50, 'viridis')
    const ramp = getRampColors('viridis')
    // When min === max, returns colors[3] (the midpoint) with alpha 200
    expect(color[0]).toBe(ramp[3][0])
    expect(color[1]).toBe(ramp[3][1])
    expect(color[2]).toBe(ramp[3][2])
    expect(color[3]).toBe(200)
  })

  it('interpolates between color stops for midpoint values', () => {
    const color = getColor(50, 0, 100, 'viridis')
    // At t=0.5, scaled = 3.0 (for 7-stop ramp), so it should be exactly colors[3]
    const ramp = getRampColors('viridis')
    expect(color[0]).toBe(ramp[3][0])
    expect(color[1]).toBe(ramp[3][1])
    expect(color[2]).toBe(ramp[3][2])
  })

  it('produces valid RGB values for all ramps at various positions', () => {
    const ramps: ColorRamp[] = ['viridis', 'plasma', 'warm', 'cool', 'reds']
    const positions = [0, 25, 50, 75, 100]

    for (const ramp of ramps) {
      for (const pos of positions) {
        const color = getColor(pos, 0, 100, ramp)
        expect(color[0]).toBeGreaterThanOrEqual(0)
        expect(color[0]).toBeLessThanOrEqual(255)
        expect(color[1]).toBeGreaterThanOrEqual(0)
        expect(color[1]).toBeLessThanOrEqual(255)
        expect(color[2]).toBeGreaterThanOrEqual(0)
        expect(color[2]).toBeLessThanOrEqual(255)
        expect(color[3]).toBe(200)
      }
    }
  })

  it('produces a gradient (different colors at different positions)', () => {
    const c1 = getColor(0, 0, 100, 'viridis')
    const c2 = getColor(50, 0, 100, 'viridis')
    const c3 = getColor(100, 0, 100, 'viridis')

    // At least some channels should differ between start, mid, end
    const differs12 = c1[0] !== c2[0] || c1[1] !== c2[1] || c1[2] !== c2[2]
    const differs23 = c2[0] !== c3[0] || c2[1] !== c3[1] || c2[2] !== c3[2]
    expect(differs12).toBe(true)
    expect(differs23).toBe(true)
  })
})

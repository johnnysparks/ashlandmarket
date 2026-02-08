import type { ColorRamp } from './types'

type RGB = [number, number, number]

const RAMPS: Record<ColorRamp, RGB[]> = {
  viridis: [
    [68, 1, 84], [72, 35, 116], [64, 67, 135], [52, 94, 141],
    [33, 145, 140], [94, 201, 98], [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135], [84, 2, 163], [139, 10, 165], [185, 50, 137],
    [219, 92, 104], [244, 136, 73], [240, 249, 33],
  ],
  warm: [
    [110, 64, 170], [175, 57, 137], [221, 68, 93], [243, 114, 44],
    [236, 175, 25], [190, 229, 52], [175, 240, 91],
  ],
  cool: [
    [110, 64, 170], [67, 97, 198], [40, 134, 207], [55, 171, 187],
    [93, 201, 148], [155, 219, 108], [175, 240, 91],
  ],
  reds: [
    [255, 245, 235], [254, 230, 206], [253, 208, 162], [253, 174, 107],
    [253, 141, 60], [230, 85, 13], [166, 54, 3],
  ],
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpColor(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ]
}

export function getColor(value: number, min: number, max: number, ramp: ColorRamp): [number, number, number, number] {
  const colors = RAMPS[ramp]
  if (max === min) return [...colors[3], 200] as [number, number, number, number]

  const t = Math.max(0, Math.min(1, (value - min) / (max - min)))
  const scaled = t * (colors.length - 1)
  const idx = Math.floor(scaled)
  const frac = scaled - idx

  const c = idx >= colors.length - 1
    ? colors[colors.length - 1]
    : lerpColor(colors[idx], colors[idx + 1], frac)

  return [c[0], c[1], c[2], 200]
}

export function getRampColors(ramp: ColorRamp): RGB[] {
  return RAMPS[ramp]
}

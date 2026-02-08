import type { MetricOption } from './types'

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
const fmtDec = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
const fmtNum = new Intl.NumberFormat('en-US')

export const METRICS: MetricOption[] = [
  { key: 'price_per_sqft', label: '$/sqft', format: (v) => fmtDec.format(v) },
  { key: 'last_sale_price', label: 'Last Sale Price', format: (v) => fmt.format(v) },
  { key: 'assessed_value', label: 'Assessed Value', format: (v) => fmt.format(v) },
  { key: 'sqft_living', label: 'Living Sqft', format: (v) => `${fmtNum.format(v)} sqft` },
  { key: 'sqft_lot', label: 'Lot Size', format: (v) => `${fmtNum.format(v)} sqft` },
  { key: 'year_built', label: 'Year Built', format: (v) => String(v) },
]

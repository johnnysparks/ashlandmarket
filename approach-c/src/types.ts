export interface Parcel {
  account: string
  lat: number
  lng: number
  address: string
  sqft_living: number
  sqft_lot: number
  year_built: number
  last_sale_price: number
  last_sale_date: string
  price_per_sqft: number
  assessed_value: number
  num_sales: number
  num_permits: number
}

export interface ParcelsData {
  generated: string
  parcels: Parcel[]
}

export interface Sale {
  date: string
  price: number
  buyer: string
  type: string
}

export interface Permit {
  number: string
  type: string
  date: string
  status: string
}

export interface Improvement {
  type: string
  sqft: number
  year_built: number
  condition: string
}

export interface ParcelDetail {
  account: string
  sales: Sale[]
  permits: Permit[]
  improvements: Improvement[]
}

export type MetricKey =
  | 'price_per_sqft'
  | 'last_sale_price'
  | 'assessed_value'
  | 'sqft_living'
  | 'sqft_lot'
  | 'year_built'
  | 'num_sales'
  | 'num_permits'

export interface MetricOption {
  key: MetricKey
  label: string
  format: (v: number) => string
}

export type ColorRamp = 'viridis' | 'plasma' | 'warm' | 'cool' | 'reds'

export type ViewMode = 'scatter' | 'hexagon' | 'grid'

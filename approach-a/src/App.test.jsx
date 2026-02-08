import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import App from './App'

// Mock MapView since it depends on Mapbox GL which doesn't work in jsdom
vi.mock('./components/MapView', () => ({
  default: function MockMapView(props) {
    return (
      <div data-testid="map-view">
        <span data-testid="map-view-mode">{props.viewMode}</span>
        <span data-testid="map-metric">{props.metric?.key}</span>
        <span data-testid="map-opacity">{props.opacity}</span>
        <button
          data-testid="map-click-parcel"
          onClick={() => props.onParcelClick({
            account: '10059095',
            address: '123 Main St',
            price_per_sqft: 229
          })}
        >
          Click Parcel
        </button>
        <button
          data-testid="map-hover-parcel"
          onClick={() => props.onParcelHover(
            { account: '10059095', address: '123 Main St', price_per_sqft: 229 },
            { x: 100, y: 200 }
          )}
        >
          Hover Parcel
        </button>
      </div>
    )
  }
}))

const mockParcelsResponse = {
  parcels: [
    {
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
      assessed_value: 380000,
      num_sales: 4,
      num_permits: 2
    },
    {
      account: '10059096',
      lat: 42.1950,
      lng: -122.7100,
      address: '456 Oak Ave',
      sqft_living: 2200,
      sqft_lot: 9000,
      year_built: 2005,
      last_sale_price: 550000,
      last_sale_date: '2024-01-20',
      price_per_sqft: 250,
      assessed_value: 500000,
      num_sales: 2,
      num_permits: 1
    }
  ]
}

describe('App', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('shows loading screen initially', () => {
    // Never-resolving fetch to stay in loading state
    globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    render(<App />)
    expect(screen.getByText('Loading parcel data...')).toBeInTheDocument()
  })

  it('shows error screen on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Error Loading Data')).toBeInTheDocument()
    })
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders map and header after data loads', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      // hexbin data
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Ashland Market')).toBeInTheDocument()
    })
    expect(screen.getByTestId('map-view')).toBeInTheDocument()
    expect(screen.getByText('2 parcels')).toBeInTheDocument()
  })

  it('renders Controls component', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('Ashland Market')).toBeInTheDocument()
    })
    // Controls is collapsed by default, showing "Controls" button
    expect(screen.getByText('Controls')).toBeInTheDocument()
  })

  it('passes correct default metric and view mode to MapView', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('map-metric')).toHaveTextContent('price_per_sqft')
    })
    expect(screen.getByTestId('map-view-mode')).toHaveTextContent('points')
    expect(screen.getByTestId('map-opacity')).toHaveTextContent('0.8')
  })

  it('renders legend with metric label', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByText('$/sqft')).toBeInTheDocument()
    })
  })

  it('shows DetailPanel when parcel is clicked', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      if (url.includes('sales/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sales: [], permits: [], improvements: [] })
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('map-click-parcel'))

    await waitFor(() => {
      expect(screen.getByText('Account: 10059095')).toBeInTheDocument()
    })
  })

  it('shows tooltip on parcel hover', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByTestId('map-hover-parcel'))

    await waitFor(() => {
      expect(screen.getByText('123 Main St')).toBeInTheDocument()
    })
  })

  it('closes DetailPanel when close button clicked', async () => {
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('parcels.json')) {
        return Promise.resolve({
          json: () => Promise.resolve(mockParcelsResponse)
        })
      }
      if (url.includes('sales/')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ sales: [], permits: [], improvements: [] })
        })
      }
      return Promise.resolve({ ok: false })
    })

    render(<App />)

    await waitFor(() => {
      expect(screen.getByTestId('map-view')).toBeInTheDocument()
    })

    // Click parcel to open detail
    fireEvent.click(screen.getByTestId('map-click-parcel'))

    await waitFor(() => {
      expect(screen.getByText('Account: 10059095')).toBeInTheDocument()
    })

    // Close detail panel
    fireEvent.click(screen.getByText('\u00d7'))

    await waitFor(() => {
      expect(screen.queryByText('Account: 10059095')).not.toBeInTheDocument()
    })
  })
})

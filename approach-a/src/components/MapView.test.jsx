import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MapView from './MapView'
import { COLOR_RAMPS, METRICS } from '../utils/colors'

// Mock react-map-gl/mapbox — capture props passed to Map and layers
const mapChildren = []
vi.mock('react-map-gl/mapbox', () => {
  const MockMap = vi.fn(({ children, onClick, onMouseMove, ...rest }) => {
    mapChildren.length = 0
    return (
      <div data-testid="mock-map" data-token={rest.mapboxAccessToken}>
        {children}
      </div>
    )
  })

  const MockSource = ({ children, id, data }) => (
    <div data-testid={`source-${id}`} data-source-type="geojson">
      {children}
    </div>
  )

  const MockLayer = ({ id, type, paint }) => (
    <div data-testid={`layer-${id}`} data-layer-type={type} />
  )

  return {
    __esModule: true,
    default: MockMap,
    Source: MockSource,
    Layer: MockLayer
  }
})

// Mock mapbox-gl CSS import
vi.mock('mapbox-gl/dist/mapbox-gl.css', () => ({}))

const mockGeojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.7095, 42.1945] },
      properties: {
        account: '10059095',
        address: '123 Main St',
        price_per_sqft: 229.73,
        last_sale_price: 425000,
        sqft_living: 1850,
        year_built: 1952
      }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.71, 42.195] },
      properties: {
        account: '10059096',
        address: '456 Oak Ave',
        price_per_sqft: 250,
        last_sale_price: 550000,
        sqft_living: 2200,
        year_built: 2005
      }
    }
  ]
}

const mockHexbinGeojson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.71, 42.195] },
      properties: { count: 5, median_price_sqft: 230 }
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [-122.7, 42.19] },
      properties: { count: 10, median_price_sqft: 280 }
    }
  ]
}

const defaultProps = {
  geojson: mockGeojson,
  hexbinGeojson: mockHexbinGeojson,
  metric: METRICS.price_per_sqft,
  colorRamp: COLOR_RAMPS.viridis,
  opacity: 0.8,
  percentileRange: { lower: 5, upper: 95 },
  viewMode: 'points',
  sizeMetric: null,
  onParcelClick: vi.fn(),
  onParcelHover: vi.fn(),
  hoveredAccount: null
}

describe('MapView', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Set a token so we skip the token prompt
    import.meta.env.VITE_MAPBOX_TOKEN = 'pk.test_token'
  })

  describe('token prompt', () => {
    it('shows token prompt when no token is available', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = ''
      render(<MapView {...defaultProps} />)
      expect(screen.getByText('Mapbox Access Token Required')).toBeInTheDocument()
      expect(screen.getByText('Load Map')).toBeInTheDocument()
    })

    it('shows hint about VITE_MAPBOX_TOKEN env var', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = ''
      render(<MapView {...defaultProps} />)
      expect(screen.getByText('VITE_MAPBOX_TOKEN')).toBeInTheDocument()
    })

    it('accepts token input and loads map', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = ''
      render(<MapView {...defaultProps} />)

      const input = screen.getByPlaceholderText('pk.eyJ1...')
      fireEvent.change(input, { target: { value: 'pk.my_token' } })
      fireEvent.click(screen.getByText('Load Map'))

      // Token prompt should be gone, map should render
      expect(screen.queryByText('Mapbox Access Token Required')).not.toBeInTheDocument()
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })

    it('accepts token via Enter key', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = ''
      render(<MapView {...defaultProps} />)

      const input = screen.getByPlaceholderText('pk.eyJ1...')
      fireEvent.change(input, { target: { value: 'pk.enter_token' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(screen.queryByText('Mapbox Access Token Required')).not.toBeInTheDocument()
    })

    it('does not accept empty token', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = ''
      render(<MapView {...defaultProps} />)

      fireEvent.click(screen.getByText('Load Map'))
      expect(screen.getByText('Mapbox Access Token Required')).toBeInTheDocument()
    })

    it('does not accept whitespace-only token via Enter', () => {
      import.meta.env.VITE_MAPBOX_TOKEN = ''
      render(<MapView {...defaultProps} />)

      const input = screen.getByPlaceholderText('pk.eyJ1...')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(screen.getByText('Mapbox Access Token Required')).toBeInTheDocument()
    })
  })

  describe('points mode rendering', () => {
    it('renders map with parcels source and circle layer', () => {
      render(<MapView {...defaultProps} />)
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
      expect(screen.getByTestId('source-parcels')).toBeInTheDocument()
      expect(screen.getByTestId('layer-parcels-circle')).toBeInTheDocument()
    })

    it('does not render heatmap or hexbin layers in points mode', () => {
      render(<MapView {...defaultProps} />)
      expect(screen.queryByTestId('layer-parcels-heatmap')).not.toBeInTheDocument()
      expect(screen.queryByTestId('layer-hexbin-circle')).not.toBeInTheDocument()
    })
  })

  describe('heatmap mode rendering', () => {
    it('renders heatmap layer', () => {
      render(<MapView {...defaultProps} viewMode="heatmap" />)
      expect(screen.getByTestId('source-parcels-heat')).toBeInTheDocument()
      expect(screen.getByTestId('layer-parcels-heatmap')).toBeInTheDocument()
    })

    it('does not render points or hexbin in heatmap mode', () => {
      render(<MapView {...defaultProps} viewMode="heatmap" />)
      expect(screen.queryByTestId('layer-parcels-circle')).not.toBeInTheDocument()
      expect(screen.queryByTestId('layer-hexbin-circle')).not.toBeInTheDocument()
    })
  })

  describe('hexbin mode rendering', () => {
    it('renders hexbin layer', () => {
      render(<MapView {...defaultProps} viewMode="hexbin" />)
      expect(screen.getByTestId('source-hexbins')).toBeInTheDocument()
      expect(screen.getByTestId('layer-hexbin-circle')).toBeInTheDocument()
    })

    it('does not render points or heatmap in hexbin mode', () => {
      render(<MapView {...defaultProps} viewMode="hexbin" />)
      expect(screen.queryByTestId('layer-parcels-circle')).not.toBeInTheDocument()
      expect(screen.queryByTestId('layer-parcels-heatmap')).not.toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('handles null geojson gracefully', () => {
      render(<MapView {...defaultProps} geojson={null} />)
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
      expect(screen.queryByTestId('source-parcels')).not.toBeInTheDocument()
    })

    it('handles empty features array', () => {
      const emptyGeojson = { type: 'FeatureCollection', features: [] }
      render(<MapView {...defaultProps} geojson={emptyGeojson} />)
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })

    it('handles null hexbin data in hexbin mode', () => {
      render(<MapView {...defaultProps} viewMode="hexbin" hexbinGeojson={null} />)
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
      expect(screen.queryByTestId('source-hexbins')).not.toBeInTheDocument()
    })

    it('handles empty hexbin features', () => {
      const emptyHexbins = { type: 'FeatureCollection', features: [] }
      render(<MapView {...defaultProps} viewMode="hexbin" hexbinGeojson={emptyHexbins} />)
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
    })
  })

  describe('bivariate mode (size metric)', () => {
    it('renders with size metric enabled', () => {
      render(<MapView {...defaultProps} sizeMetric={METRICS.sqft_living} />)
      expect(screen.getByTestId('mock-map')).toBeInTheDocument()
      expect(screen.getByTestId('layer-parcels-circle')).toBeInTheDocument()
    })
  })
})

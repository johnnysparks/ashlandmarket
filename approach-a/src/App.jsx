import { useState, useEffect, useMemo, useCallback } from 'react'
import MapView from './components/MapView'
import Controls from './components/Controls'
import Tooltip from './components/Tooltip'
import DetailPanel from './components/DetailPanel'
import { loadParcels, parcelsToGeoJSON, filterByTimeWindow } from './utils/data'
import { COLOR_RAMPS, METRICS } from './utils/colors'
import './App.css'

export default function App() {
  const [parcels, setParcels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Controls state
  const [metric, setMetric] = useState(METRICS.price_per_sqft)
  const [colorRamp, setColorRamp] = useState(COLOR_RAMPS.viridis)
  const [opacity, setOpacity] = useState(0.8)
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [controlsOpen, setControlsOpen] = useState(false)

  // Interaction state
  const [hoveredParcel, setHoveredParcel] = useState(null)
  const [hoverPoint, setHoverPoint] = useState(null)
  const [selectedParcel, setSelectedParcel] = useState(null)

  useEffect(() => {
    loadParcels()
      .then(data => {
        setParcels(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  const filteredParcels = useMemo(
    () => filterByTimeWindow(parcels, dateRange.start, dateRange.end),
    [parcels, dateRange.start, dateRange.end]
  )

  const geojson = useMemo(
    () => parcelsToGeoJSON(filteredParcels),
    [filteredParcels]
  )

  const handleParcelClick = useCallback((props) => {
    setSelectedParcel(props)
    setHoveredParcel(null)
  }, [])

  const handleParcelHover = useCallback((props, point) => {
    setHoveredParcel(props)
    setHoverPoint(point)
  }, [])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading parcel data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="error-screen">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <p>Make sure <code>data/parcels.json</code> is accessible.</p>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="map-container">
        <MapView
          geojson={geojson}
          metric={metric}
          colorRamp={colorRamp}
          opacity={opacity}
          onParcelClick={handleParcelClick}
          onParcelHover={handleParcelHover}
          hoveredAccount={hoveredParcel?.account}
        />

        <Tooltip parcel={hoveredParcel} point={hoverPoint} metric={metric} />

        <div className="map-header">
          <h1>Ashland Market</h1>
          <span className="parcel-count">{filteredParcels.length.toLocaleString()} parcels</span>
        </div>

        <Controls
          metric={metric}
          setMetric={setMetric}
          colorRamp={colorRamp}
          setColorRamp={setColorRamp}
          opacity={opacity}
          setOpacity={setOpacity}
          dateRange={dateRange}
          setDateRange={setDateRange}
          isOpen={controlsOpen}
          setIsOpen={setControlsOpen}
        />

        <Legend metric={metric} colorRamp={colorRamp} geojson={geojson} />
      </div>

      {selectedParcel && (
        <DetailPanel
          parcel={selectedParcel}
          onClose={() => setSelectedParcel(null)}
        />
      )}
    </div>
  )
}

function Legend({ metric, colorRamp, geojson }) {
  const { min, max } = useMemo(() => {
    if (!geojson || !geojson.features.length) return { min: 0, max: 1 }
    const values = geojson.features
      .map(f => f.properties[metric.key])
      .filter(v => v != null && !isNaN(v))
      .sort((a, b) => a - b)
    if (values.length === 0) return { min: 0, max: 1 }
    return {
      min: values[Math.floor(values.length * 0.05)],
      max: values[Math.floor(values.length * 0.95)]
    }
  }, [geojson, metric.key])

  return (
    <div className="legend">
      <div className="legend-label">{metric.label}</div>
      <div
        className="legend-bar"
        style={{ background: `linear-gradient(to right, ${colorRamp.stops.join(', ')})` }}
      />
      <div className="legend-range">
        <span>{metric.format(min)}</span>
        <span>{metric.format(max)}</span>
      </div>
    </div>
  )
}

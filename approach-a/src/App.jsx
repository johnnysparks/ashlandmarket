import { useState, useEffect, useMemo, useCallback } from 'react'
import MapView from './components/MapView'
import Controls from './components/Controls'
import Tooltip from './components/Tooltip'
import DetailPanel from './components/DetailPanel'
import ComparePanel from './components/ComparePanel'
import { loadParcels, parcelsToGeoJSON, filterByTimeWindow, loadHexbins, hexbinsToGeoJSON } from './utils/data'
import { COLOR_RAMPS, METRICS, computePercentiles } from './utils/colors'
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

  // Phase 3: Percentile clamp control
  const [percentileRange, setPercentileRange] = useState({ lower: 5, upper: 95 })

  // Phase 3: Aggregation mode switching
  const [viewMode, setViewMode] = useState('points') // 'points' | 'heatmap' | 'hexbin'
  const [hexbinData, setHexbinData] = useState(null)

  // Phase 3: Secondary metric for circle size (bivariate)
  const [sizeMetric, setSizeMetric] = useState(null) // null = uniform size

  // Interaction state
  const [hoveredParcel, setHoveredParcel] = useState(null)
  const [hoverPoint, setHoverPoint] = useState(null)
  const [selectedParcel, setSelectedParcel] = useState(null)

  // Phase 4: Compare mode
  const [compareList, setCompareList] = useState([]) // array of parcel properties
  const [compareOpen, setCompareOpen] = useState(false)

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

  // Load hexbin data when metric changes (for hexbin view mode)
  useEffect(() => {
    loadHexbins(metric.key).then(data => {
      if (data) setHexbinData(data)
    })
  }, [metric.key])

  const filteredParcels = useMemo(
    () => filterByTimeWindow(parcels, dateRange.start, dateRange.end),
    [parcels, dateRange.start, dateRange.end]
  )

  const geojson = useMemo(
    () => parcelsToGeoJSON(filteredParcels),
    [filteredParcels]
  )

  const hexbinGeojson = useMemo(
    () => hexbinsToGeoJSON(hexbinData),
    [hexbinData]
  )

  const handleParcelClick = useCallback((props) => {
    setSelectedParcel(props)
    setHoveredParcel(null)
  }, [])

  const handleParcelHover = useCallback((props, point) => {
    setHoveredParcel(props)
    setHoverPoint(point)
  }, [])

  // Compare mode handlers
  const handleAddToCompare = useCallback((parcel) => {
    setCompareList(prev => {
      if (prev.some(p => p.account === parcel.account)) return prev
      if (prev.length >= 5) return prev // max 5 parcels
      return [...prev, parcel]
    })
    setCompareOpen(true)
  }, [])

  const handleRemoveFromCompare = useCallback((account) => {
    setCompareList(prev => {
      const next = prev.filter(p => p.account !== account)
      if (next.length === 0) setCompareOpen(false)
      return next
    })
  }, [])

  const handleClearCompare = useCallback(() => {
    setCompareList([])
    setCompareOpen(false)
  }, [])

  // Set of accounts in compare list for map highlighting
  const compareAccounts = useMemo(
    () => new Set(compareList.map(p => p.account)),
    [compareList]
  )

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
          hexbinGeojson={hexbinGeojson}
          metric={metric}
          colorRamp={colorRamp}
          opacity={opacity}
          percentileRange={percentileRange}
          viewMode={viewMode}
          sizeMetric={sizeMetric}
          onParcelClick={handleParcelClick}
          onParcelHover={handleParcelHover}
          hoveredAccount={hoveredParcel?.account}
          compareAccounts={compareAccounts}
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
          percentileRange={percentileRange}
          setPercentileRange={setPercentileRange}
          viewMode={viewMode}
          setViewMode={setViewMode}
          sizeMetric={sizeMetric}
          setSizeMetric={setSizeMetric}
          isOpen={controlsOpen}
          setIsOpen={setControlsOpen}
        />

        <Legend metric={metric} colorRamp={colorRamp} geojson={geojson} percentileRange={percentileRange} />

        {compareList.length > 0 && !compareOpen && (
          <button
            className="compare-badge"
            onClick={() => setCompareOpen(true)}
          >
            Compare ({compareList.length})
          </button>
        )}
      </div>

      {selectedParcel && (
        <DetailPanel
          parcel={selectedParcel}
          onClose={() => setSelectedParcel(null)}
          onCompare={handleAddToCompare}
          isInCompare={compareAccounts.has(selectedParcel.account)}
        />
      )}

      {compareOpen && compareList.length > 0 && (
        <ComparePanel
          parcels={compareList}
          metric={metric}
          onRemove={handleRemoveFromCompare}
          onClear={handleClearCompare}
          onClose={() => setCompareOpen(false)}
          onSelect={(parcel) => { setSelectedParcel(parcel); }}
        />
      )}
    </div>
  )
}

function Legend({ metric, colorRamp, geojson, percentileRange }) {
  const { min, max } = useMemo(() => {
    if (!geojson || !geojson.features.length) return { min: 0, max: 1 }
    const values = geojson.features
      .map(f => f.properties[metric.key])
      .filter(v => v != null && !isNaN(v))
    if (values.length === 0) return { min: 0, max: 1 }
    return computePercentiles(values, percentileRange.lower, percentileRange.upper)
  }, [geojson, metric.key, percentileRange.lower, percentileRange.upper])

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

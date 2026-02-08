import { useRef, useCallback, useState, useMemo } from 'react'
import Map, { Source, Layer } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { buildColorExpression, computePercentiles } from '../utils/colors'

const ASHLAND_CENTER = { longitude: -122.7095, latitude: 42.1945 }

export default function MapView({
  geojson,
  hexbinGeojson,
  metric,
  colorRamp,
  opacity,
  percentileRange,
  viewMode,
  sizeMetric,
  onParcelClick,
  onParcelHover,
  hoveredAccount,
  compareAccounts
}) {
  const mapRef = useRef()
  const [token, setToken] = useState(import.meta.env.VITE_MAPBOX_TOKEN || '')
  const [tokenInput, setTokenInput] = useState('')

  // Compute color range from data using adjustable percentile
  const { min, max } = useMemo(
    () => computeMetricRange(geojson, metric.key, percentileRange.lower, percentileRange.upper),
    [geojson, metric.key, percentileRange.lower, percentileRange.upper]
  )

  // Compute size range for bivariate mode
  const sizeRange = useMemo(() => {
    if (!sizeMetric) return null
    return computeMetricRange(geojson, sizeMetric.key, percentileRange.lower, percentileRange.upper)
  }, [geojson, sizeMetric, percentileRange.lower, percentileRange.upper])

  const circleColor = geojson && geojson.features.length > 0
    ? buildColorExpression(metric.key, min, max, colorRamp.stops)
    : '#888'

  // Build circle-radius expression: either uniform zoom-based or data-driven bivariate
  const circleRadius = useMemo(() => {
    if (!sizeMetric || !sizeRange) {
      return ['interpolate', ['linear'], ['zoom'], 10, 2, 14, 5, 18, 12]
    }
    // Data-driven radius: interpolate metric value between min/max radius, scaled by zoom
    return [
      'interpolate', ['linear'], ['zoom'],
      10, ['interpolate', ['linear'],
        ['coalesce', ['get', sizeMetric.key], sizeRange.min],
        sizeRange.min, 1,
        sizeRange.max, 4
      ],
      14, ['interpolate', ['linear'],
        ['coalesce', ['get', sizeMetric.key], sizeRange.min],
        sizeRange.min, 3,
        sizeRange.max, 10
      ],
      18, ['interpolate', ['linear'],
        ['coalesce', ['get', sizeMetric.key], sizeRange.min],
        sizeRange.min, 5,
        sizeRange.max, 20
      ]
    ]
  }, [sizeMetric, sizeRange])

  // Hexbin color expression (uses normalized 'median' property from hexbinsToGeoJSON)
  const hexbinColor = useMemo(() => {
    if (!hexbinGeojson || !hexbinGeojson.features.length) return '#888'
    const values = hexbinGeojson.features.map(f => f.properties.median).filter(v => v != null)
    if (!values.length) return '#888'
    const { min: hMin, max: hMax } = computePercentiles(values, percentileRange.lower, percentileRange.upper)
    return buildColorExpression('median', hMin, hMax, colorRamp.stops)
  }, [hexbinGeojson, colorRamp.stops, percentileRange.lower, percentileRange.upper])

  // Hexbin radius expression (based on parcel count)
  const hexbinRadius = useMemo(() => {
    if (!hexbinGeojson || !hexbinGeojson.features.length) return 10
    const counts = hexbinGeojson.features.map(f => f.properties.count)
    const maxCount = Math.max(...counts, 1)
    return [
      'interpolate', ['linear'], ['zoom'],
      10, ['interpolate', ['linear'], ['get', 'count'], 1, 4, maxCount, 12],
      14, ['interpolate', ['linear'], ['get', 'count'], 1, 8, maxCount, 25],
      18, ['interpolate', ['linear'], ['get', 'count'], 1, 12, maxCount, 40]
    ]
  }, [hexbinGeojson])

  // Build heatmap weight expression
  const heatmapWeight = useMemo(() => {
    if (min === max) return 1
    return [
      'interpolate', ['linear'],
      ['coalesce', ['get', metric.key], min],
      min, 0,
      max, 1
    ]
  }, [metric.key, min, max])

  // Heatmap color expression
  const heatmapColor = useMemo(() => {
    // Build gradient from transparent to color ramp stops
    const stops = colorRamp.stops
    const expr = ['interpolate', ['linear'], ['heatmap-density']]
    expr.push(0, 'rgba(0,0,0,0)')
    stops.forEach((color, i) => {
      expr.push((i + 1) / stops.length, color)
    })
    return expr
  }, [colorRamp.stops])

  // Build compare highlight expressions
  const compareAccountsList = useMemo(() => {
    return compareAccounts ? Array.from(compareAccounts) : []
  }, [compareAccounts])

  const strokeWidth = useMemo(() => {
    const base = [
      'case',
      ['==', ['get', 'account'], hoveredAccount || ''],
      2
    ]
    // Add compare highlights
    for (const acct of compareAccountsList) {
      base.push(['==', ['get', 'account'], acct], 3)
    }
    base.push(0.5) // default
    return base
  }, [hoveredAccount, compareAccountsList])

  const strokeColor = useMemo(() => {
    const base = [
      'case',
      ['==', ['get', 'account'], hoveredAccount || ''],
      '#fff'
    ]
    for (const acct of compareAccountsList) {
      base.push(['==', ['get', 'account'], acct], '#ff6b35')
    }
    base.push('rgba(0,0,0,0.3)') // default
    return base
  }, [hoveredAccount, compareAccountsList])

  const interactiveLayerIds = useMemo(() => {
    if (viewMode === 'points') return ['parcels-circle']
    if (viewMode === 'hexbin') return ['hexbin-circle']
    return []
  }, [viewMode])

  const handleClick = useCallback((e) => {
    if (!mapRef.current) return
    const layers = viewMode === 'hexbin' ? ['hexbin-circle'] : ['parcels-circle']
    const features = mapRef.current.queryRenderedFeatures(e.point, { layers })
    if (features.length > 0) {
      onParcelClick(features[0].properties)
    }
  }, [onParcelClick, viewMode])

  const handleMouseMove = useCallback((e) => {
    if (!mapRef.current) return
    const layers = viewMode === 'points' ? ['parcels-circle'] : viewMode === 'hexbin' ? ['hexbin-circle'] : []
    if (!layers.length) {
      onParcelHover(null, null)
      return
    }
    const features = mapRef.current.queryRenderedFeatures(e.point, { layers })
    mapRef.current.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
    if (features.length > 0) {
      onParcelHover(features[0].properties, e.point)
    } else {
      onParcelHover(null, null)
    }
  }, [onParcelHover, viewMode])

  if (!token) {
    return (
      <div className="token-prompt">
        <div className="token-dialog">
          <h2>Mapbox Access Token Required</h2>
          <p>
            Enter your Mapbox public token to load the map.
            Get one free at <a href="https://mapbox.com" target="_blank" rel="noreferrer">mapbox.com</a>.
          </p>
          <p className="token-hint">
            Or set <code>VITE_MAPBOX_TOKEN</code> in a <code>.env</code> file.
          </p>
          <input
            type="text"
            placeholder="pk.eyJ1..."
            value={tokenInput}
            onChange={e => setTokenInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && tokenInput.trim()) setToken(tokenInput.trim()) }}
          />
          <button onClick={() => tokenInput.trim() && setToken(tokenInput.trim())}>
            Load Map
          </button>
        </div>
      </div>
    )
  }

  return (
    <Map
      ref={mapRef}
      mapboxAccessToken={token}
      initialViewState={{
        ...ASHLAND_CENTER,
        zoom: 14,
        pitch: 0
      }}
      style={{ width: '100%', height: '100%' }}
      mapStyle="mapbox://styles/mapbox/light-v11"
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      interactiveLayerIds={interactiveLayerIds}
    >
      {/* Points mode: colored circles */}
      {viewMode === 'points' && geojson && (
        <Source id="parcels" type="geojson" data={geojson}>
          <Layer
            id="parcels-circle"
            type="circle"
            paint={{
              'circle-radius': circleRadius,
              'circle-color': circleColor,
              'circle-opacity': opacity,
              'circle-stroke-width': strokeWidth,
              'circle-stroke-color': strokeColor
            }}
          />
        </Source>
      )}

      {/* Heatmap mode: Mapbox GL heatmap layer */}
      {viewMode === 'heatmap' && geojson && (
        <Source id="parcels-heat" type="geojson" data={geojson}>
          <Layer
            id="parcels-heatmap"
            type="heatmap"
            paint={{
              'heatmap-weight': heatmapWeight,
              'heatmap-intensity': [
                'interpolate', ['linear'], ['zoom'],
                10, 1,
                14, 2,
                18, 3
              ],
              'heatmap-color': heatmapColor,
              'heatmap-radius': [
                'interpolate', ['linear'], ['zoom'],
                10, 15,
                14, 25,
                18, 40
              ],
              'heatmap-opacity': opacity
            }}
          />
        </Source>
      )}

      {/* Hexbin mode: pre-aggregated hex circles */}
      {viewMode === 'hexbin' && hexbinGeojson && (
        <Source id="hexbins" type="geojson" data={hexbinGeojson}>
          <Layer
            id="hexbin-circle"
            type="circle"
            paint={{
              'circle-radius': hexbinRadius,
              'circle-color': hexbinColor,
              'circle-opacity': opacity,
              'circle-stroke-width': 1,
              'circle-stroke-color': 'rgba(0,0,0,0.2)'
            }}
          />
        </Source>
      )}
    </Map>
  )
}

function computeMetricRange(geojson, key, lower = 5, upper = 95) {
  if (!geojson || !geojson.features.length) return { min: 0, max: 1 }
  const values = geojson.features.map(f => f.properties[key]).filter(v => v != null && !isNaN(v))
  return computePercentiles(values, lower, upper)
}

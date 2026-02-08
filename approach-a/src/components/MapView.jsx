import { useRef, useCallback, useEffect, useState } from 'react'
import Map, { Source, Layer } from 'react-map-gl/mapbox'
import 'mapbox-gl/dist/mapbox-gl.css'
import { buildColorExpression, computePercentiles } from '../utils/colors'

const ASHLAND_CENTER = { longitude: -122.7095, latitude: 42.1945 }

export default function MapView({
  geojson,
  metric,
  colorRamp,
  opacity,
  onParcelClick,
  onParcelHover,
  hoveredAccount
}) {
  const mapRef = useRef()
  const [token, setToken] = useState(import.meta.env.VITE_MAPBOX_TOKEN || '')
  const [tokenInput, setTokenInput] = useState('')

  // Compute color range from data
  const { min, max } = computeMetricRange(geojson, metric.key)

  const circleColor = geojson && geojson.features.length > 0
    ? buildColorExpression(metric.key, min, max, colorRamp.stops)
    : '#888'

  const handleClick = useCallback((e) => {
    if (!mapRef.current) return
    const features = mapRef.current.queryRenderedFeatures(e.point, { layers: ['parcels-circle'] })
    if (features.length > 0) {
      onParcelClick(features[0].properties)
    }
  }, [onParcelClick])

  const handleMouseMove = useCallback((e) => {
    if (!mapRef.current) return
    const features = mapRef.current.queryRenderedFeatures(e.point, { layers: ['parcels-circle'] })
    mapRef.current.getCanvas().style.cursor = features.length > 0 ? 'pointer' : ''
    if (features.length > 0) {
      onParcelHover(features[0].properties, e.point)
    } else {
      onParcelHover(null, null)
    }
  }, [onParcelHover])

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
      interactiveLayerIds={['parcels-circle']}
    >
      {geojson && (
        <Source id="parcels" type="geojson" data={geojson}>
          <Layer
            id="parcels-circle"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                10, 2,
                14, 5,
                18, 12
              ],
              'circle-color': circleColor,
              'circle-opacity': opacity,
              'circle-stroke-width': [
                'case',
                ['==', ['get', 'account'], hoveredAccount || ''],
                2,
                0.5
              ],
              'circle-stroke-color': [
                'case',
                ['==', ['get', 'account'], hoveredAccount || ''],
                '#fff',
                'rgba(0,0,0,0.3)'
              ]
            }}
          />
        </Source>
      )}
    </Map>
  )
}

function computeMetricRange(geojson, key) {
  if (!geojson || !geojson.features.length) return { min: 0, max: 1 }
  const values = geojson.features.map(f => f.properties[key]).filter(v => v != null && !isNaN(v))
  const { min, max } = computePercentiles(values, 5, 95)
  return { min, max }
}

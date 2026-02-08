<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { Deck } from '@deck.gl/core'
  import { ScatterplotLayer } from '@deck.gl/layers'
  import { HexagonLayer, GridLayer } from '@deck.gl/aggregation-layers'
  import maplibregl from 'maplibre-gl'
  import {
    filteredParcels,
    selectedMetric,
    colorRamp,
    opacity,
    viewMode,
    hexRadius,
    gridCellSize,
    metricRange,
    selectedParcel,
    hoveredParcel,
    hoverPosition,
    loadParcelDetail,
  } from '../store'
  import { getColor, getRampColors } from '../colors'
  import type { Parcel, MetricKey, ColorRamp as ColorRampType, ViewMode as ViewModeType } from '../types'
  import { METRICS } from '../metrics'

  let mapContainer: HTMLDivElement
  let deckCanvas: HTMLCanvasElement
  let map: maplibregl.Map
  let deck: Deck

  const ASHLAND_CENTER = { latitude: 42.1945, longitude: -122.7095 }
  const INITIAL_ZOOM = 14

  let currentParcels: Parcel[] = []
  let currentMetric: MetricKey = 'price_per_sqft'
  let currentRamp: ColorRampType = 'viridis'
  let currentOpacity: number = 0.8
  let currentMode: ViewModeType = 'scatter'
  let currentHexRadius: number = 200
  let currentGridCellSize: number = 200
  let currentRange = { min: 0, max: 1 }

  const unsubs: Array<() => void> = []

  onMount(() => {
    map = new maplibregl.Map({
      container: mapContainer,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
          },
        ],
      },
      center: [ASHLAND_CENTER.longitude, ASHLAND_CENTER.latitude],
      zoom: INITIAL_ZOOM,
      attributionControl: true,
    })

    deck = new Deck({
      canvas: deckCanvas,
      initialViewState: {
        longitude: ASHLAND_CENTER.longitude,
        latitude: ASHLAND_CENTER.latitude,
        zoom: INITIAL_ZOOM,
        pitch: 0,
        bearing: 0,
      },
      controller: true,
      onViewStateChange: ({ viewState }: any) => {
        map.jumpTo({
          center: [viewState.longitude, viewState.latitude],
          zoom: viewState.zoom,
          bearing: viewState.bearing,
          pitch: viewState.pitch,
        })
      },
      getTooltip: () => null,
      layers: [],
    })

    unsubs.push(filteredParcels.subscribe(v => { currentParcels = v; updateLayers() }))
    unsubs.push(selectedMetric.subscribe(v => { currentMetric = v; updateLayers() }))
    unsubs.push(colorRamp.subscribe(v => { currentRamp = v; updateLayers() }))
    unsubs.push(opacity.subscribe(v => { currentOpacity = v; updateLayers() }))
    unsubs.push(viewMode.subscribe(v => { currentMode = v; updateLayers() }))
    unsubs.push(hexRadius.subscribe(v => { currentHexRadius = v; updateLayers() }))
    unsubs.push(gridCellSize.subscribe(v => { currentGridCellSize = v; updateLayers() }))
    unsubs.push(metricRange.subscribe(v => { currentRange = v; updateLayers() }))
  })

  onDestroy(() => {
    unsubs.forEach(u => u())
    deck?.finalize()
    map?.remove()
  })

  function getMetricLabel(metric: MetricKey): string {
    return METRICS.find(m => m.key === metric)?.label ?? metric
  }

  function formatMetric(metric: MetricKey, value: number): string {
    return METRICS.find(m => m.key === metric)?.format(value) ?? String(value)
  }

  function updateLayers() {
    if (!deck) return

    const layers = []

    if (currentMode === 'scatter') {
      layers.push(
        new ScatterplotLayer({
          id: 'parcels-scatter',
          data: currentParcels,
          getPosition: (d: Parcel) => [d.lng, d.lat],
          getRadius: 15,
          radiusMinPixels: 4,
          radiusMaxPixels: 30,
          getFillColor: (d: Parcel) => getColor(
            d[currentMetric],
            currentRange.min,
            currentRange.max,
            currentRamp
          ),
          opacity: currentOpacity,
          pickable: true,
          onClick: ({ object }: any) => {
            if (object) {
              selectedParcel.set(object)
              loadParcelDetail(object.account)
            }
          },
          onHover: ({ object, x, y }: any) => {
            hoveredParcel.set(object ?? null)
            if (object) {
              hoverPosition.set({ x, y })
            }
          },
          updateTriggers: {
            getFillColor: [currentMetric, currentRange, currentRamp],
          },
        })
      )
    } else if (currentMode === 'hexagon') {
      const rampColors = getRampColors(currentRamp)
      layers.push(
        new HexagonLayer({
          id: 'parcels-hexagon',
          data: currentParcels,
          getPosition: (d: Parcel) => [d.lng, d.lat],
          radius: currentHexRadius,
          elevationScale: 4,
          extruded: false,
          getColorWeight: (d: Parcel) => d[currentMetric],
          colorAggregation: 'MEAN',
          colorRange: rampColors,
          opacity: currentOpacity,
          pickable: true,
          onHover: ({ object, x, y }: any) => {
            if (object) {
              hoveredParcel.set(null)
              hoverPosition.set({ x, y })
            } else {
              hoveredParcel.set(null)
            }
          },
        })
      )
    } else if (currentMode === 'grid') {
      const rampColors = getRampColors(currentRamp)
      layers.push(
        new GridLayer({
          id: 'parcels-grid',
          data: currentParcels,
          getPosition: (d: Parcel) => [d.lng, d.lat],
          cellSize: currentGridCellSize,
          elevationScale: 4,
          extruded: false,
          getColorWeight: (d: Parcel) => d[currentMetric],
          colorAggregation: 'MEAN',
          colorRange: rampColors,
          opacity: currentOpacity,
          pickable: true,
          onHover: ({ object, x, y }: any) => {
            if (object) {
              hoveredParcel.set(null)
              hoverPosition.set({ x, y })
            } else {
              hoveredParcel.set(null)
            }
          },
        })
      )
    }

    deck.setProps({ layers })
  }
</script>

<div class="map-wrapper">
  <div bind:this={mapContainer} class="map-container"></div>
  <canvas bind:this={deckCanvas} class="deck-canvas"></canvas>
</div>

<style>
  .map-wrapper {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .map-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .deck-canvas {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }
</style>

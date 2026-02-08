<script lang="ts">
  import { selectedMetric, colorRamp, metricRange, filteredParcels } from '../store'
  import { getRampColors } from '../colors'
  import { METRICS } from '../metrics'

  $: metric = METRICS.find(m => m.key === $selectedMetric)
  $: colors = getRampColors($colorRamp)
  $: gradient = `linear-gradient(to right, ${colors.map(c => `rgb(${c[0]},${c[1]},${c[2]})`).join(', ')})`
  $: formatValue = metric?.format ?? String
</script>

<div class="legend">
  <div class="legend-label">{metric?.label ?? $selectedMetric}</div>
  <div class="legend-bar" style="background: {gradient};"></div>
  <div class="legend-range">
    <span>{formatValue($metricRange.min)}</span>
    <span>{$filteredParcels.length} parcels</span>
    <span>{formatValue($metricRange.max)}</span>
  </div>
</div>

<style>
  .legend {
    position: absolute;
    bottom: 28px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(26, 26, 46, 0.92);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 10px 16px;
    z-index: 10;
    min-width: 240px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .legend-label {
    font-size: 11px;
    color: #8888aa;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
    text-align: center;
  }

  .legend-bar {
    height: 10px;
    border-radius: 5px;
    margin-bottom: 4px;
  }

  .legend-range {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #a0a0c0;
  }

  @media (max-width: 480px) {
    .legend {
      bottom: auto;
      top: 12px;
      left: 12px;
      transform: none;
      min-width: auto;
    }
  }
</style>

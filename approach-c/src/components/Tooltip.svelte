<script lang="ts">
  import { hoveredParcel, hoverPosition, selectedMetric } from '../store'
  import { METRICS } from '../metrics'

  $: metric = METRICS.find(m => m.key === $selectedMetric)
  $: formatValue = metric?.format ?? String
</script>

{#if $hoveredParcel}
  <div
    class="tooltip"
    style="left: {$hoverPosition.x + 12}px; top: {$hoverPosition.y - 12}px;"
  >
    <div class="address">{$hoveredParcel.address}</div>
    <div class="metric-value">
      {metric?.label}: {formatValue($hoveredParcel[$selectedMetric])}
    </div>
    <div class="stats">
      <span>{$hoveredParcel.sqft_living.toLocaleString()} sqft</span>
      <span>Built {$hoveredParcel.year_built}</span>
    </div>
    <div class="hint">Click for details</div>
  </div>
{/if}

<style>
  .tooltip {
    position: absolute;
    background: rgba(20, 20, 40, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 8px;
    padding: 10px 12px;
    pointer-events: none;
    z-index: 20;
    max-width: 240px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  }

  .address {
    font-size: 13px;
    font-weight: 600;
    color: #e0e0e0;
    margin-bottom: 4px;
  }

  .metric-value {
    font-size: 15px;
    font-weight: 700;
    color: #8888ff;
    margin-bottom: 4px;
  }

  .stats {
    display: flex;
    gap: 10px;
    font-size: 11px;
    color: #8888aa;
  }

  .hint {
    margin-top: 4px;
    font-size: 10px;
    color: #6666aa;
    font-style: italic;
  }
</style>

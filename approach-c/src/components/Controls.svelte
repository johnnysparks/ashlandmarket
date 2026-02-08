<script lang="ts">
  import {
    selectedMetric,
    colorRamp,
    opacity,
    viewMode,
    hexRadius,
    timeStart,
    timeEnd,
  } from '../store'
  import { METRICS } from '../metrics'
  import type { MetricKey, ColorRamp, ViewMode } from '../types'

  let collapsed = false

  const colorRamps: { key: ColorRamp; label: string }[] = [
    { key: 'viridis', label: 'Viridis' },
    { key: 'plasma', label: 'Plasma' },
    { key: 'warm', label: 'Warm' },
    { key: 'cool', label: 'Cool' },
    { key: 'reds', label: 'Reds' },
  ]

  function handleMetricChange(e: Event) {
    const target = e.target as HTMLSelectElement
    selectedMetric.set(target.value as MetricKey)
  }

  function handleRampChange(e: Event) {
    const target = e.target as HTMLSelectElement
    colorRamp.set(target.value as ColorRamp)
  }

  function handleOpacityChange(e: Event) {
    const target = e.target as HTMLInputElement
    opacity.set(parseFloat(target.value))
  }

  function handleHexRadiusChange(e: Event) {
    const target = e.target as HTMLInputElement
    hexRadius.set(parseInt(target.value))
  }

  function setViewMode(mode: ViewMode) {
    viewMode.set(mode)
  }
</script>

<div class="controls" class:collapsed>
  <button class="toggle" on:click={() => collapsed = !collapsed}>
    {collapsed ? '>' : '<'}
  </button>

  {#if !collapsed}
    <div class="controls-content">
      <h3>Overlay Controls</h3>

      <div class="control-group">
        <label for="metric-select">Metric</label>
        <select id="metric-select" on:change={handleMetricChange}>
          {#each METRICS as metric}
            <option value={metric.key}>{metric.label}</option>
          {/each}
        </select>
      </div>

      <div class="control-group">
        <span class="field-label">View Mode</span>
        <div class="btn-group">
          <button
            class:active={$viewMode === 'scatter'}
            on:click={() => setViewMode('scatter')}
          >Points</button>
          <button
            class:active={$viewMode === 'hexagon'}
            on:click={() => setViewMode('hexagon')}
          >Hexbin</button>
        </div>
      </div>

      <div class="control-group">
        <label for="ramp-select">Color Ramp</label>
        <select id="ramp-select" on:change={handleRampChange}>
          {#each colorRamps as ramp}
            <option value={ramp.key}>{ramp.label}</option>
          {/each}
        </select>
      </div>

      <div class="control-group">
        <label for="opacity-slider">Opacity: {Math.round($opacity * 100)}%</label>
        <input
          id="opacity-slider"
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={$opacity}
          on:input={handleOpacityChange}
        />
      </div>

      {#if $viewMode === 'hexagon'}
        <div class="control-group">
          <label for="radius-slider">Hex Radius: {$hexRadius}m</label>
          <input
            id="radius-slider"
            type="range"
            min="50"
            max="500"
            step="25"
            value={$hexRadius}
            on:input={handleHexRadiusChange}
          />
        </div>
      {/if}

      <div class="control-group">
        <span class="field-label">Time Window</span>
        <div class="date-range">
          <input
            type="date"
            placeholder="Start"
            value={$timeStart}
            on:input={(e) => timeStart.set((e.target as HTMLInputElement).value)}
          />
          <span>to</span>
          <input
            type="date"
            placeholder="End"
            value={$timeEnd}
            on:input={(e) => timeEnd.set((e.target as HTMLInputElement).value)}
          />
        </div>
        {#if $timeStart || $timeEnd}
          <button class="clear-btn" on:click={() => { timeStart.set(''); timeEnd.set('') }}>
            Clear dates
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .controls {
    position: absolute;
    top: 12px;
    right: 12px;
    background: rgba(26, 26, 46, 0.92);
    backdrop-filter: blur(8px);
    border-radius: 12px;
    padding: 16px;
    width: 260px;
    z-index: 10;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: width 0.2s;
  }

  .controls.collapsed {
    width: 44px;
    padding: 8px;
  }

  .toggle {
    position: absolute;
    top: 8px;
    left: 8px;
    background: none;
    border: none;
    color: #e0e0e0;
    font-size: 18px;
    cursor: pointer;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
  }

  .toggle:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .controls-content {
    margin-top: 28px;
  }

  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 14px;
    color: #a0a0c0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .control-group {
    margin-bottom: 14px;
  }

  label, .field-label {
    display: block;
    font-size: 12px;
    color: #8888aa;
    margin-bottom: 4px;
  }

  select {
    width: 100%;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 13px;
    cursor: pointer;
  }

  select:focus {
    outline: none;
    border-color: rgba(100, 100, 255, 0.5);
  }

  input[type="range"] {
    width: 100%;
    accent-color: #6666ff;
  }

  .btn-group {
    display: flex;
    gap: 4px;
  }

  .btn-group button {
    flex: 1;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #a0a0c0;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-group button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .btn-group button.active {
    background: rgba(100, 100, 255, 0.3);
    border-color: rgba(100, 100, 255, 0.5);
    color: #e0e0e0;
  }

  .date-range {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .date-range input {
    flex: 1;
    padding: 5px 6px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    color: #e0e0e0;
    font-size: 11px;
  }

  .date-range input:focus {
    outline: none;
    border-color: rgba(100, 100, 255, 0.5);
  }

  .date-range span {
    color: #8888aa;
    font-size: 11px;
  }

  .clear-btn {
    margin-top: 4px;
    padding: 3px 8px;
    background: none;
    border: none;
    color: #6666ff;
    font-size: 11px;
    cursor: pointer;
  }

  .clear-btn:hover {
    color: #8888ff;
  }

  @media (max-width: 480px) {
    .controls {
      top: auto;
      bottom: 12px;
      right: 12px;
      left: 12px;
      width: auto;
      max-height: 50vh;
      overflow-y: auto;
    }

    .controls.collapsed {
      width: 44px;
      left: auto;
    }
  }
</style>

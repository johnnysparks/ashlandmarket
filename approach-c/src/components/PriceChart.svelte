<script lang="ts">
  import type { Sale } from '../types'

  export let sales: Sale[]

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  // Sort sales by date ascending for the chart
  $: sorted = [...sales].sort((a, b) => a.date.localeCompare(b.date))

  // SVG dimensions
  const width = 420
  const height = 160
  const padLeft = 60
  const padRight = 20
  const padTop = 20
  const padBottom = 30

  $: chartWidth = width - padLeft - padRight
  $: chartHeight = height - padTop - padBottom

  $: prices = sorted.map(s => s.price)
  $: minPrice = Math.min(...prices) * 0.9
  $: maxPrice = Math.max(...prices) * 1.1

  $: xScale = (i: number) => padLeft + (i / Math.max(sorted.length - 1, 1)) * chartWidth
  $: yScale = (v: number) => padTop + chartHeight - ((v - minPrice) / (maxPrice - minPrice)) * chartHeight

  $: linePath = sorted.map((s, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(s.price)}`).join(' ')

  $: yTicks = (() => {
    const range = maxPrice - minPrice
    const step = Math.pow(10, Math.floor(Math.log10(range))) || 1
    const ticks = []
    let v = Math.ceil(minPrice / step) * step
    while (v <= maxPrice) {
      ticks.push(v)
      v += step
    }
    return ticks.slice(0, 5)
  })()
</script>

<svg viewBox="0 0 {width} {height}" class="chart">
  <!-- Grid lines -->
  {#each yTicks as tick}
    <line
      x1={padLeft}
      y1={yScale(tick)}
      x2={width - padRight}
      y2={yScale(tick)}
      stroke="rgba(255,255,255,0.06)"
      stroke-dasharray="4 4"
    />
    <text
      x={padLeft - 6}
      y={yScale(tick) + 4}
      text-anchor="end"
      fill="#6666aa"
      font-size="9"
    >{fmt.format(tick)}</text>
  {/each}

  <!-- Line -->
  <path d={linePath} fill="none" stroke="#6666ff" stroke-width="2" />

  <!-- Points -->
  {#each sorted as sale, i}
    <circle
      cx={xScale(i)}
      cy={yScale(sale.price)}
      r="4"
      fill="#6666ff"
      stroke="#1a1a2e"
      stroke-width="2"
    />
    <!-- Date labels -->
    <text
      x={xScale(i)}
      y={height - 6}
      text-anchor="middle"
      fill="#6666aa"
      font-size="9"
    >{sale.date.substring(0, 4)}</text>
  {/each}
</svg>

<style>
  .chart {
    width: 100%;
    max-width: 420px;
    height: auto;
  }
</style>

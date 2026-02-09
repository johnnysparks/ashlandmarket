import {
  runAnalysis,
  getAllMetrics,
  computeNeighborhoodStats,
  clusterIntoNeighborhoods,
  nameNeighborhood,
  findParcelAnomalies,
} from './analysis.js'

// --- State ---

let parcels = []
let analysisResult = null
let currentView = 'anomalies'
let filters = {
  threshold: 3.0,
  cellSize: 0.003,
  metric: 'all',
  sort: 'severity',
  search: '',
}

// --- Data Loading ---

async function loadParcels() {
  const resp = await fetch('../data/parcels.json')
  const data = await resp.json()
  return data.parcels
}

// --- Boot ---

async function init() {
  try {
    parcels = await loadParcels()
    populateMetricFilter()
    runAndRender()
    setupEventListeners()
    document.getElementById('loading').classList.add('hidden')
  } catch (err) {
    document.getElementById('loading').textContent =
      'Failed to load data: ' + err.message
    console.error(err)
  }
}

function populateMetricFilter() {
  const select = document.getElementById('metric-filter')
  for (const m of getAllMetrics()) {
    const opt = document.createElement('option')
    opt.value = m.key
    opt.textContent = m.label
    select.appendChild(opt)
  }
}

// --- Analysis + Render Pipeline ---

function runAndRender() {
  analysisResult = runAnalysis(parcels, {
    cellSize: filters.cellSize,
    threshold: filters.threshold,
  })
  updateSummary()
  renderCurrentView()
}

function updateSummary() {
  const { neighborhoods, anomalies } = analysisResult
  setText('stat-parcels', '.stat-value', parcels.length.toLocaleString())
  setText('stat-neighborhoods', '.stat-value', neighborhoods.length.toLocaleString())
  setText('stat-anomalies', '.stat-value', anomalies.length.toLocaleString())
  const uniqueParcels = new Set(anomalies.map((a) => a.parcel.account)).size
  setText('stat-parcels-flagged', '.stat-value', uniqueParcels.toLocaleString())
}

function setText(parentId, selector, text) {
  document.getElementById(parentId).querySelector(selector).textContent = text
}

function renderCurrentView() {
  if (currentView === 'anomalies') {
    renderAnomalies()
  } else {
    renderNeighborhoods()
  }
}

// --- Filtering & Sorting ---

function getFilteredAnomalies() {
  let list = analysisResult.anomalies

  // Metric filter
  if (filters.metric !== 'all') {
    list = list.filter((a) =>
      a.anomalies.some((f) => f.metric === filters.metric)
    )
    // Also trim each item's anomalies to only the matching metric
    list = list.map((a) => ({
      ...a,
      anomalies: a.anomalies.filter((f) => f.metric === filters.metric),
      maxSeverity: Math.max(
        ...a.anomalies
          .filter((f) => f.metric === filters.metric)
          .map((f) => f.severity)
      ),
    }))
  }

  // Search filter
  if (filters.search) {
    const q = filters.search.toLowerCase()
    list = list.filter(
      (a) =>
        a.parcel.address?.toLowerCase().includes(q) ||
        a.parcel.account?.toLowerCase().includes(q)
    )
  }

  // Sort
  switch (filters.sort) {
    case 'severity':
      list.sort((a, b) => b.maxSeverity - a.maxSeverity)
      break
    case 'price-high':
      list.sort(
        (a, b) => (b.parcel.last_sale_price || 0) - (a.parcel.last_sale_price || 0)
      )
      break
    case 'price-low':
      list.sort(
        (a, b) => (a.parcel.last_sale_price || Infinity) - (b.parcel.last_sale_price || Infinity)
      )
      break
    case 'lot-size':
      list.sort((a, b) => (b.parcel.sqft_lot || 0) - (a.parcel.sqft_lot || 0))
      break
    case 'address':
      list.sort((a, b) =>
        (a.parcel.address || '').localeCompare(b.parcel.address || '')
      )
      break
  }

  return list
}

// --- Anomaly Rendering ---

const MAX_VISIBLE = 100
let visibleCount = MAX_VISIBLE

function renderAnomalies() {
  const container = document.getElementById('anomaly-list')
  const list = getFilteredAnomalies()
  visibleCount = MAX_VISIBLE

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#9745;</div>
        <div class="empty-state-text">No anomalies found with current filters.</div>
      </div>`
    return
  }

  renderAnomalyPage(container, list)
}

function renderAnomalyPage(container, list) {
  const visible = list.slice(0, visibleCount)
  container.innerHTML = visible.map(renderAnomalyCard).join('')

  if (list.length > visibleCount) {
    container.insertAdjacentHTML(
      'beforeend',
      `<button class="load-more" id="load-more-btn">
        Show more (${list.length - visibleCount} remaining)
      </button>`
    )
    document.getElementById('load-more-btn').addEventListener('click', () => {
      visibleCount += MAX_VISIBLE
      renderAnomalyPage(container, list)
    })
  }

  attachAnomalyClickHandlers()
}

function renderAnomalyCard(item) {
  const { parcel, neighborhood, anomalies, maxSeverity } = item
  const severityClass =
    maxSeverity >= 8
      ? 'severity-extreme'
      : maxSeverity >= 5
        ? 'severity-high'
        : 'severity-moderate'
  const severityLabel =
    maxSeverity >= 8
      ? 'Extreme'
      : maxSeverity >= 5
        ? 'High'
        : 'Notable'

  const flags = anomalies
    .sort((a, b) => b.severity - a.severity)
    .map(
      (a) => `
    <div class="anomaly-flag ${a.direction}">
      <span class="flag-direction">${a.direction === 'high' ? '&#9650;' : '&#9660;'}</span>
      <span class="flag-label">${a.label}</span>
      <span class="flag-value">${a.formatted}</span>
      <span class="flag-vs">vs ${a.neighborhoodMedianFormatted} median</span>
    </div>`
    )
    .join('')

  return `
    <div class="anomaly-card" data-account="${parcel.account}">
      <div class="anomaly-header">
        <div>
          <div class="anomaly-address">${parcel.address || 'No address'}</div>
          <div class="anomaly-account">${parcel.account}</div>
        </div>
        <span class="anomaly-severity ${severityClass}">${severityLabel} (${maxSeverity.toFixed(1)}&sigma;)</span>
      </div>
      <div class="anomaly-flags">${flags}</div>
      <div class="anomaly-neighborhood">${neighborhood.name} area &middot; ${neighborhood.parcelCount} parcels in neighborhood</div>
    </div>`
}

function attachAnomalyClickHandlers() {
  document.querySelectorAll('.anomaly-card').forEach((card) => {
    card.addEventListener('click', () => {
      const account = card.dataset.account
      const item = analysisResult.anomalies.find(
        (a) => a.parcel.account === account
      )
      if (item) showDetail(item)
    })
  })
}

// --- Neighborhood Rendering ---

function renderNeighborhoods() {
  const container = document.getElementById('neighborhood-list')
  const hoods = analysisResult.neighborhoods

  if (hoods.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">&#127968;</div>
        <div class="empty-state-text">No neighborhoods found.</div>
      </div>`
    return
  }

  // Filter by search
  let filtered = hoods
  if (filters.search) {
    const q = filters.search.toLowerCase()
    filtered = hoods.filter((h) => h.name.toLowerCase().includes(q))
  }

  container.innerHTML = filtered.map(renderNeighborhoodCard).join('')
  attachNeighborhoodClickHandlers()
}

function renderNeighborhoodCard(hood) {
  const s = hood.stats
  const statItems = []

  if (s.last_sale_price?.median != null) {
    statItems.push({
      label: 'Median Price',
      value: '$' + Math.round(s.last_sale_price.median).toLocaleString(),
    })
  }
  if (s.price_per_sqft?.median != null) {
    statItems.push({
      label: 'Median $/sqft',
      value: '$' + s.price_per_sqft.median.toFixed(0),
    })
  }
  if (s.sqft_lot?.median != null) {
    statItems.push({
      label: 'Median Lot',
      value: Math.round(s.sqft_lot.median).toLocaleString() + ' sqft',
    })
  }
  if (s.year_built?.median != null) {
    statItems.push({
      label: 'Median Year',
      value: String(Math.round(s.year_built.median)),
    })
  }
  if (s.assessed_value?.median != null) {
    statItems.push({
      label: 'Median Assessed',
      value: '$' + Math.round(s.assessed_value.median).toLocaleString(),
    })
  }

  const statsHtml = statItems
    .map(
      (si) => `
    <div class="hood-stat">
      <span class="hood-stat-label">${si.label}</span>
      <span class="hood-stat-value">${si.value}</span>
    </div>`
    )
    .join('')

  const anomalyBadge =
    hood.anomalyCount > 0
      ? `<span class="hood-anomaly-badge">${hood.anomalyCount} anomal${hood.anomalyCount === 1 ? 'y' : 'ies'}</span>`
      : ''

  return `
    <div class="neighborhood-card" data-hood-id="${hood.id}">
      <div class="hood-header">
        <span class="hood-name">${hood.name}${anomalyBadge}</span>
        <span class="hood-count">${hood.parcelCount} parcels</span>
      </div>
      <div class="hood-stats">${statsHtml}</div>
    </div>`
}

function attachNeighborhoodClickHandlers() {
  document.querySelectorAll('.neighborhood-card').forEach((card) => {
    card.addEventListener('click', () => {
      const hoodId = card.dataset.hoodId
      showNeighborhoodDetail(hoodId)
    })
  })
}

// --- Detail Panel ---

function showDetail(item) {
  const { parcel, neighborhood, anomalies } = item
  const overlay = document.getElementById('detail-overlay')
  const content = document.getElementById('detail-content')

  // Find all parcels in this neighborhood for comparison
  const hoodMap = clusterIntoNeighborhoods(parcels, filters.cellSize)
  const hood = hoodMap.get(neighborhood.id)
  const neighbors = hood ? hood.parcels.filter((p) => p.account !== parcel.account) : []

  let html = `
    <div class="detail-title">${parcel.address || 'No address'}</div>
    <div class="detail-subtitle">Account ${parcel.account} &middot; ${neighborhood.name} area</div>

    <div class="detail-section">
      <div class="detail-section-title">Property Details</div>
      <div class="detail-grid">
        ${detailItem('Sale Price', parcel.last_sale_price ? '$' + parcel.last_sale_price.toLocaleString() : '—')}
        ${detailItem('Assessed Value', parcel.assessed_value ? '$' + parcel.assessed_value.toLocaleString() : '—')}
        ${detailItem('Price/Sqft', parcel.price_per_sqft ? '$' + parcel.price_per_sqft.toFixed(0) : '—')}
        ${detailItem('Living Space', parcel.sqft_living ? parcel.sqft_living.toLocaleString() + ' sqft' : '—')}
        ${detailItem('Lot Size', parcel.sqft_lot ? parcel.sqft_lot.toLocaleString() + ' sqft' : '—')}
        ${detailItem('Year Built', parcel.year_built || '—')}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Anomalies Detected</div>
      ${anomalies
        .sort((a, b) => b.severity - a.severity)
        .map((a) => renderAnomalyComparison(a, neighborhood))
        .join('')}
    </div>`

  // Show nearest neighbors with the most anomalous metric
  if (anomalies.length > 0 && neighbors.length > 0) {
    const topMetric = anomalies[0]
    const metricKey = topMetric.metric
    const allMetrics = getAllMetrics()
    const metricDef = allMetrics.find((m) => m.key === metricKey)

    const neighborsWithValue = neighbors
      .map((n) => {
        const val = metricDef.compute
          ? metricDef.compute(n)
          : n[metricKey]
        return { parcel: n, value: val }
      })
      .filter((n) => n.value != null && isFinite(n.value))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)

    if (neighborsWithValue.length > 0) {
      html += `
        <div class="detail-section">
          <div class="detail-section-title">Neighbors — ${topMetric.label}</div>
          <div class="neighbors-list">
            ${neighborsWithValue
              .map(
                (n) => `
              <div class="neighbor-row">
                <span class="neighbor-addr">${n.parcel.address || n.parcel.account}</span>
                <span class="neighbor-value">${metricDef.format(n.value)}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>`
    }
  }

  content.innerHTML = html
  overlay.classList.remove('hidden')
}

function renderAnomalyComparison(anomaly, neighborhood) {
  const { label, formatted, neighborhoodMedianFormatted, zScore, direction, severity } = anomaly

  // Compute bar positions
  const stats = analysisResult.neighborhoods.find(
    (n) => n.id === neighborhood.id
  )?.stats[anomaly.metric]

  let barHtml = ''
  if (stats && stats.min != null && stats.max != null) {
    const range = stats.max - stats.min
    if (range > 0) {
      const valuePos = Math.max(0, Math.min(100, ((anomaly.value - stats.min) / range) * 100))
      const medianPos = ((stats.median - stats.min) / range) * 100
      const p10Pos = stats.p10 != null ? ((stats.p10 - stats.min) / range) * 100 : null
      const p90Pos = stats.p90 != null ? ((stats.p90 - stats.min) / range) * 100 : null

      barHtml = `
        <div class="detail-bar-container">
          <div class="detail-bar">
            ${p10Pos != null && p90Pos != null
              ? `<div class="detail-bar-fill" style="left:${p10Pos}%;width:${p90Pos - p10Pos}%;background:var(--surface-2)"></div>`
              : ''}
            <div class="detail-bar-marker" style="left:${medianPos}%;background:var(--accent);" title="Neighborhood median"></div>
            <div class="detail-bar-marker" style="left:${valuePos}%;background:${direction === 'high' ? 'var(--high)' : 'var(--low)'};" title="This property"></div>
          </div>
          <div class="detail-bar-label">
            <span>${stats.min != null ? getAllMetrics().find(m => m.key === anomaly.metric)?.format(stats.min) || '' : ''}</span>
            <span>${stats.max != null ? getAllMetrics().find(m => m.key === anomaly.metric)?.format(stats.max) || '' : ''}</span>
          </div>
        </div>`
    }
  }

  return `
    <div class="detail-comparison">
      <div class="detail-comp-row">
        <span class="detail-comp-label">${label}</span>
        <span class="detail-comp-value" style="color:${direction === 'high' ? 'var(--high)' : 'var(--low)'}">${formatted}</span>
      </div>
      <div class="detail-comp-row">
        <span class="detail-comp-label">Neighborhood median</span>
        <span class="detail-comp-value">${neighborhoodMedianFormatted}</span>
      </div>
      <div class="detail-comp-row">
        <span class="detail-comp-label">Deviation</span>
        <span class="detail-comp-value">${zScore > 0 ? '+' : ''}${zScore.toFixed(1)}&sigma; ${direction === 'high' ? 'above' : 'below'}</span>
      </div>
      ${barHtml}
    </div>`
}

function showNeighborhoodDetail(hoodId) {
  const hood = analysisResult.neighborhoods.find((n) => n.id === hoodId)
  if (!hood) return

  // Get all anomalies in this neighborhood
  const hoodAnomalies = analysisResult.anomalies.filter(
    (a) => a.neighborhood.id === hoodId
  )

  const overlay = document.getElementById('detail-overlay')
  const content = document.getElementById('detail-content')

  const s = hood.stats

  let html = `
    <div class="detail-title">${hood.name}</div>
    <div class="detail-subtitle">${hood.parcelCount} parcels &middot; ${hoodAnomalies.length} anomalies</div>

    <div class="detail-section">
      <div class="detail-section-title">Neighborhood Statistics</div>
      <div class="detail-grid">`

  const displayStats = [
    { key: 'last_sale_price', label: 'Median Price' },
    { key: 'price_per_sqft', label: 'Median $/Sqft' },
    { key: 'assessed_value', label: 'Median Assessed' },
    { key: 'sqft_living', label: 'Median Living' },
    { key: 'sqft_lot', label: 'Median Lot' },
    { key: 'year_built', label: 'Median Year Built' },
  ]

  for (const ds of displayStats) {
    const stat = s[ds.key]
    if (stat?.median != null) {
      html += detailItem(ds.label, stat.format(stat.median))
    }
  }

  html += `</div></div>`

  // Show range info
  html += `
    <div class="detail-section">
      <div class="detail-section-title">Value Ranges (10th - 90th Percentile)</div>`

  for (const ds of displayStats) {
    const stat = s[ds.key]
    if (stat?.p10 != null && stat?.p90 != null) {
      html += `
        <div class="detail-comparison">
          <div class="detail-comp-row">
            <span class="detail-comp-label">${stat.label}</span>
            <span class="detail-comp-value">${stat.format(stat.p10)} — ${stat.format(stat.p90)}</span>
          </div>
        </div>`
    }
  }
  html += `</div>`

  // Show anomalies in this neighborhood
  if (hoodAnomalies.length > 0) {
    html += `
      <div class="detail-section">
        <div class="detail-section-title">Flagged Properties</div>
        <div class="neighbors-list">
          ${hoodAnomalies
            .sort((a, b) => b.maxSeverity - a.maxSeverity)
            .slice(0, 15)
            .map(
              (a) => `
            <div class="neighbor-row" style="cursor:pointer" data-detail-account="${a.parcel.account}">
              <span class="neighbor-addr">${a.parcel.address || a.parcel.account}</span>
              <span class="neighbor-value" style="color:var(--high)">${a.maxSeverity.toFixed(1)}&sigma;</span>
            </div>`
            )
            .join('')}
        </div>
      </div>`
  }

  content.innerHTML = html
  overlay.classList.remove('hidden')

  // Attach click handlers on flagged properties
  content.querySelectorAll('[data-detail-account]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      const account = el.dataset.detailAccount
      const item = analysisResult.anomalies.find(
        (a) => a.parcel.account === account
      )
      if (item) showDetail(item)
    })
  })
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <div class="detail-item-label">${label}</div>
      <div class="detail-item-value">${value}</div>
    </div>`
}

function hideDetail() {
  document.getElementById('detail-overlay').classList.add('hidden')
}

// --- Event Listeners ---

function setupEventListeners() {
  // Threshold
  document.getElementById('threshold-select').addEventListener('change', (e) => {
    filters.threshold = parseFloat(e.target.value)
    runAndRender()
  })

  // Grid size
  document.getElementById('grid-select').addEventListener('change', (e) => {
    filters.cellSize = parseFloat(e.target.value)
    runAndRender()
  })

  // Metric filter
  document.getElementById('metric-filter').addEventListener('change', (e) => {
    filters.metric = e.target.value
    renderCurrentView()
  })

  // Sort
  document.getElementById('sort-select').addEventListener('change', (e) => {
    filters.sort = e.target.value
    renderCurrentView()
  })

  // Search
  let searchTimeout
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(searchTimeout)
    searchTimeout = setTimeout(() => {
      filters.search = e.target.value
      renderCurrentView()
    }, 200)
  })

  // View tabs
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
      document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'))
      tab.classList.add('active')
      const viewName = tab.dataset.view
      document.getElementById(`${viewName}-view`).classList.add('active')
      currentView = viewName
      renderCurrentView()
    })
  })

  // Detail close
  document.getElementById('detail-close').addEventListener('click', hideDetail)
  document.getElementById('detail-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideDetail()
  })

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hideDetail()
  })
}

// --- Go ---

init()

// Ashland Market Heat Map — Approach B (Leaflet + D3)
// Vanilla JS, no build step required

(function () {
  'use strict';

  // ── Config ──────────────────────────────────────────────
  const ASHLAND_CENTER = [42.1945, -122.7095];
  const INITIAL_ZOOM = 14;
  const DATA_BASE = '../data';
  const MARKER_RADIUS_RANGE = [4, 8]; // min/max circle radius in px

  // ── Color ramps (D3 interpolators) ─────────────────────
  const COLOR_RAMPS = {
    YlOrRd: d3.interpolateYlOrRd,
    Viridis: d3.interpolateViridis,
    Blues: d3.interpolateBlues,
    RdYlGn: t => d3.interpolateRdYlGn(1 - t), // reverse so red=high
    Spectral: t => d3.interpolateSpectral(1 - t),
    Plasma: d3.interpolatePlasma,
  };

  // ── Metric formatting ──────────────────────────────────
  const METRIC_CONFIG = {
    price_per_sqft: { label: '$/sqft', fmt: v => '$' + Math.round(v) },
    last_sale_price: { label: 'Sale Price', fmt: v => '$' + d3.format(',.0f')(v) },
    assessed_value: { label: 'Assessed', fmt: v => '$' + d3.format(',.0f')(v) },
    sqft_living: { label: 'Living sqft', fmt: v => d3.format(',.0f')(v) },
    sqft_lot: { label: 'Lot sqft', fmt: v => d3.format(',.0f')(v) },
    year_built: { label: 'Year Built', fmt: v => String(v) },
    num_sales: { label: 'Sales', fmt: v => String(v) },
    num_permits: { label: 'Permits', fmt: v => String(v) },
  };

  // ── State ──────────────────────────────────────────────
  let allParcels = [];
  let filteredParcels = [];
  let markerLayer = null;
  let hexLayer = null;
  let hexData = null;
  let colorScale = null;
  let currentMetric = 'price_per_sqft';
  let currentRamp = 'YlOrRd';
  let currentOpacity = 0.75;
  let currentView = 'parcels'; // 'parcels' or 'hexbin'
  let clampLo = 5;
  let clampHi = 95;
  let dateFrom = new Date('2000-01-01');
  let dateTo = new Date('2026-12-31');

  // ── Map setup ──────────────────────────────────────────
  const map = L.map('map', {
    center: ASHLAND_CENTER,
    zoom: INITIAL_ZOOM,
    zoomControl: false,
    attributionControl: false,
  });

  // Zoom control on bottom-left for mobile ergonomics
  L.control.zoom({ position: 'bottomleft' }).addTo(map);
  L.control.attribution({ position: 'bottomleft' }).addTo(map);

  // OSM tiles with dark-ish style
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/copyright">OSM</a>',
    maxZoom: 19,
  }).addTo(map);

  // ── Data loading ───────────────────────────────────────
  async function loadParcels() {
    const resp = await fetch(`${DATA_BASE}/parcels.json`);
    const data = await resp.json();
    allParcels = data.parcels.filter(p => p.lat && p.lng);
    filteredParcels = allParcels;
    applyFilters();
    renderMarkers();
  }

  async function loadHexData() {
    try {
      const resp = await fetch(`${DATA_BASE}/aggregates/hexbin-price-sqft.json`);
      if (!resp.ok) throw new Error('No hexbin data');
      hexData = await resp.json();
    } catch {
      hexData = null;
    }
  }

  // ── Filtering ──────────────────────────────────────────
  function applyFilters() {
    filteredParcels = allParcels.filter(p => {
      if (!p.last_sale_date) return true; // show parcels without sale dates
      const d = new Date(p.last_sale_date);
      return d >= dateFrom && d <= dateTo;
    });
  }

  // ── Color scale ────────────────────────────────────────
  function buildColorScale() {
    const values = filteredParcels
      .map(p => p[currentMetric])
      .filter(v => v != null && isFinite(v));

    if (values.length === 0) {
      colorScale = () => '#666';
      return;
    }

    // Percentile clamping (user-adjustable)
    values.sort((a, b) => a - b);
    const lo = d3.quantile(values, clampLo / 100);
    const hi = d3.quantile(values, clampHi / 100);

    const interpolator = COLOR_RAMPS[currentRamp] || COLOR_RAMPS.YlOrRd;
    const scale = d3.scaleSequential(interpolator).domain([lo, hi]).clamp(true);

    colorScale = v => (v == null || !isFinite(v)) ? '#444' : scale(v);
    colorScale.domain = [lo, hi];
    colorScale.interpolator = interpolator;
  }

  // ── Render markers ─────────────────────────────────────
  function renderMarkers() {
    if (markerLayer) {
      map.removeLayer(markerLayer);
      markerLayer = null;
    }
    if (hexLayer) {
      map.removeLayer(hexLayer);
      hexLayer = null;
    }

    buildColorScale();
    renderLegend();

    if (currentView === 'hexbin') {
      renderHexbins();
      return;
    }

    const markers = filteredParcels.map(p => {
      const val = p[currentMetric];
      const color = colorScale(val);
      const radius = getRadius();

      const marker = L.circleMarker([p.lat, p.lng], {
        radius: radius,
        fillColor: color,
        fillOpacity: currentOpacity,
        color: 'rgba(255,255,255,0.15)',
        weight: 0.5,
      });

      marker.on('click', () => onParcelClick(p, marker));
      return marker;
    });

    markerLayer = L.layerGroup(markers).addTo(map);
  }

  // ── Hexbin rendering ─────────────────────────────────
  function renderHexbins() {
    if (!hexData || !hexData.hexagons) return;

    const hexSize = hexData.hex_size_degrees || 0.005;
    const hexagons = hexData.hexagons.filter(h => h.count > 0);

    // Build a color scale from hexbin median values
    const values = hexagons.map(h => h.median_price_sqft).filter(v => v != null && isFinite(v));
    if (!values.length) return;

    values.sort((a, b) => a - b);
    const lo = d3.quantile(values, clampLo / 100);
    const hi = d3.quantile(values, clampHi / 100);
    const interpolator = COLOR_RAMPS[currentRamp] || COLOR_RAMPS.YlOrRd;
    const hexScale = d3.scaleSequential(interpolator).domain([lo, hi]).clamp(true);

    // Update colorScale for legend
    colorScale = v => (v == null || !isFinite(v)) ? '#444' : hexScale(v);
    colorScale.domain = [lo, hi];
    colorScale.interpolator = interpolator;
    renderLegend();

    const polys = hexagons.map(h => {
      const hex = createHexPolygon(h.center_lat, h.center_lng, hexSize * 0.55);
      const color = hexScale(h.median_price_sqft);

      const poly = L.polygon(hex, {
        fillColor: color,
        fillOpacity: currentOpacity,
        color: 'rgba(255,255,255,0.1)',
        weight: 1,
      });

      poly.bindPopup(`
        <div class="popup-title">Hex Area</div>
        <div class="popup-stat"><span class="label">Median $/sqft</span><span class="value">$${Math.round(h.median_price_sqft)}</span></div>
        <div class="popup-stat"><span class="label">Mean $/sqft</span><span class="value">$${Math.round(h.mean_price_sqft)}</span></div>
        <div class="popup-stat"><span class="label">Parcels</span><span class="value">${h.count}</span></div>
        <div class="popup-stat"><span class="label">Range</span><span class="value">$${Math.round(h.min_price_sqft)}–$${Math.round(h.max_price_sqft)}</span></div>
      `, { maxWidth: 240 });

      return poly;
    });

    hexLayer = L.layerGroup(polys).addTo(map);
  }

  function createHexPolygon(lat, lng, size) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      // Correct for latitude distortion on lng
      const lngSize = size / Math.cos(lat * Math.PI / 180);
      points.push([
        lat + size * Math.sin(angle),
        lng + lngSize * Math.cos(angle),
      ]);
    }
    return points;
  }

  function getRadius() {
    const z = map.getZoom();
    if (z >= 17) return 10;
    if (z >= 15) return 6;
    if (z >= 13) return 4;
    return 3;
  }

  // Update marker sizes on zoom
  map.on('zoomend', () => {
    if (!markerLayer) return;
    const r = getRadius();
    markerLayer.eachLayer(m => {
      if (m.setRadius) m.setRadius(r);
    });
  });

  // ── Parcel click → popup ───────────────────────────────
  function onParcelClick(parcel, marker) {
    const mc = METRIC_CONFIG[currentMetric];
    const val = parcel[currentMetric];

    const popupContent = `
      <div class="popup-title">${parcel.address || 'Parcel ' + parcel.account}</div>
      <div class="popup-stat"><span class="label">${mc.label}</span><span class="value">${val != null ? mc.fmt(val) : '—'}</span></div>
      <div class="popup-stat"><span class="label">Last Sale</span><span class="value">${parcel.last_sale_price ? '$' + d3.format(',.0f')(parcel.last_sale_price) : '—'}</span></div>
      <div class="popup-stat"><span class="label">Sale Date</span><span class="value">${parcel.last_sale_date || '—'}</span></div>
      <div class="popup-stat"><span class="label">Living sqft</span><span class="value">${parcel.sqft_living ? d3.format(',')(parcel.sqft_living) : '—'}</span></div>
      <div class="popup-stat"><span class="label">Lot sqft</span><span class="value">${parcel.sqft_lot ? d3.format(',')(parcel.sqft_lot) : '—'}</span></div>
      <div class="popup-stat"><span class="label">Year Built</span><span class="value">${parcel.year_built || '—'}</span></div>
      <div class="popup-stat"><span class="label">Assessed</span><span class="value">${parcel.assessed_value ? '$' + d3.format(',.0f')(parcel.assessed_value) : '—'}</span></div>
      <span class="popup-link" data-account="${parcel.account}">View full details &rarr;</span>
    `;

    marker.bindPopup(popupContent, { maxWidth: 260, className: '' }).openPopup();

    // Attach detail-link handler after popup opens
    setTimeout(() => {
      const link = document.querySelector(`.popup-link[data-account="${parcel.account}"]`);
      if (link) {
        link.addEventListener('click', () => {
          map.closePopup();
          openDetailPanel(parcel);
        });
      }
    }, 50);
  }

  // ── Detail Panel ───────────────────────────────────────
  const detailPanel = document.getElementById('detail-panel');
  const detailTitle = document.getElementById('detail-title');
  const detailSummary = document.getElementById('detail-summary');
  const detailChart = document.getElementById('detail-chart');
  const detailSales = document.getElementById('detail-sales');
  const detailPermits = document.getElementById('detail-permits');
  const detailImprovements = document.getElementById('detail-improvements');

  document.getElementById('detail-close').addEventListener('click', () => {
    detailPanel.classList.add('hidden');
  });

  async function openDetailPanel(parcel) {
    detailTitle.textContent = parcel.address || 'Parcel ' + parcel.account;
    detailPanel.classList.remove('hidden');

    // Summary cards
    detailSummary.innerHTML = [
      { label: 'Sale Price', value: parcel.last_sale_price ? '$' + d3.format(',.0f')(parcel.last_sale_price) : '—' },
      { label: '$/sqft', value: parcel.price_per_sqft ? '$' + Math.round(parcel.price_per_sqft) : '—' },
      { label: 'Living sqft', value: parcel.sqft_living ? d3.format(',')(parcel.sqft_living) : '—' },
      { label: 'Lot sqft', value: parcel.sqft_lot ? d3.format(',')(parcel.sqft_lot) : '—' },
      { label: 'Year Built', value: parcel.year_built || '—' },
      { label: 'Assessed', value: parcel.assessed_value ? '$' + d3.format(',.0f')(parcel.assessed_value) : '—' },
    ].map(c => `<div class="summary-card"><div class="label">${c.label}</div><div class="value">${c.value}</div></div>`).join('');

    // Load per-account detail
    detailChart.innerHTML = '<div class="loading">Loading...</div>';
    detailSales.innerHTML = '';
    detailPermits.innerHTML = '';
    detailImprovements.innerHTML = '';

    try {
      const resp = await fetch(`${DATA_BASE}/sales/${parcel.account}.json`);
      if (!resp.ok) throw new Error('Not found');
      const detail = await resp.json();
      renderSalesChart(detail.sales || []);
      renderSalesTable(detail.sales || []);
      renderPermits(detail.permits || []);
      renderImprovements(detail.improvements || []);
    } catch {
      detailChart.innerHTML = '<div class="loading">No detail data available</div>';
    }
  }

  // ── D3 price trajectory chart ──────────────────────────
  function renderSalesChart(sales) {
    if (sales.length < 2) {
      detailChart.innerHTML = sales.length === 1
        ? '<h4>Price History</h4><div class="loading">Only one sale recorded</div>'
        : '<h4>Price History</h4><div class="loading">No sales data</div>';
      return;
    }

    detailChart.innerHTML = '<h4>Price History</h4>';

    const sorted = [...sales]
      .filter(s => s.price && s.date)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (sorted.length < 2) {
      detailChart.innerHTML += '<div class="loading">Insufficient data for chart</div>';
      return;
    }

    const margin = { top: 16, right: 16, bottom: 32, left: 56 };
    const width = detailChart.clientWidth || 320;
    const height = 160;

    const svg = d3.select(detailChart)
      .append('svg')
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const x = d3.scaleTime()
      .domain(d3.extent(sorted, d => new Date(d.date)))
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(sorted, d => d.price) * 1.1])
      .range([height - margin.bottom, margin.top]);

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.timeFormat('%Y')))
      .attr('color', '#666');

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(4).tickFormat(d => '$' + d3.format('~s')(d)))
      .attr('color', '#666');

    // Line
    const line = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.price));

    svg.append('path')
      .datum(sorted)
      .attr('fill', 'none')
      .attr('stroke', '#6bc5ff')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Dots
    svg.selectAll('.dot')
      .data(sorted)
      .join('circle')
      .attr('cx', d => x(new Date(d.date)))
      .attr('cy', d => y(d.price))
      .attr('r', 4)
      .attr('fill', '#6bc5ff');
  }

  // ── Sales table ────────────────────────────────────────
  function renderSalesTable(sales) {
    if (!sales.length) {
      detailSales.innerHTML = '';
      return;
    }

    const sorted = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date));

    detailSales.innerHTML = `
      <h4>Sales History</h4>
      <table class="sales-table">
        <thead><tr><th>Date</th><th>Price</th><th>Type</th></tr></thead>
        <tbody>
          ${sorted.map(s => `
            <tr>
              <td>${s.date || '—'}</td>
              <td>${s.price ? '$' + d3.format(',.0f')(s.price) : '—'}</td>
              <td>${s.type || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ── Permits ────────────────────────────────────────────
  function renderPermits(permits) {
    if (!permits.length) {
      detailPermits.innerHTML = '';
      return;
    }

    detailPermits.innerHTML = `
      <h4>Permits</h4>
      ${permits.map(p => `
        <div class="permit-item">
          <div class="permit-type">${p.type || 'Unknown'} — ${p.number || ''}</div>
          <div class="permit-meta">${p.date || ''} &middot; ${p.status || ''}</div>
        </div>
      `).join('')}
    `;
  }

  // ── Improvements ───────────────────────────────────────
  function renderImprovements(improvements) {
    if (!improvements.length) {
      detailImprovements.innerHTML = '';
      return;
    }

    detailImprovements.innerHTML = `
      <h4>Improvements</h4>
      ${improvements.map(imp => `
        <div class="improvement-item">
          <div class="imp-type">${imp.type || 'Structure'}</div>
          <div class="imp-meta">${imp.sqft ? d3.format(',')(imp.sqft) + ' sqft' : ''} &middot; Built ${imp.year_built || '?'} &middot; ${imp.condition || ''}</div>
        </div>
      `).join('')}
    `;
  }

  // ── Legend ─────────────────────────────────────────────
  function renderLegend() {
    const legend = document.getElementById('legend');
    if (!colorScale || !colorScale.domain) {
      legend.innerHTML = '';
      return;
    }

    const [lo, hi] = colorScale.domain;
    const mc = METRIC_CONFIG[currentMetric];
    const interpolator = colorScale.interpolator;

    // Build gradient
    const steps = 20;
    const colors = d3.range(steps).map(i => interpolator(i / (steps - 1)));
    const gradient = `linear-gradient(to right, ${colors.join(', ')})`;

    legend.innerHTML = `
      <div class="legend-bar" style="background: ${gradient};"></div>
      <div class="legend-labels">
        <span>${mc.fmt(lo)}</span>
        <span>${mc.fmt(hi)}</span>
      </div>
    `;
  }

  // ── Search ─────────────────────────────────────────────
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let searchDebounce = null;

  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(doSearch, 200);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.length >= 2) doSearch();
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#search-container')) {
      searchResults.classList.add('hidden');
    }
  });

  function doSearch() {
    const q = searchInput.value.trim().toLowerCase();
    if (q.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    const matches = allParcels.filter(p => {
      const addr = (p.address || '').toLowerCase();
      const acct = (p.account || '').toLowerCase();
      return addr.includes(q) || acct.includes(q);
    }).slice(0, 8);

    if (!matches.length) {
      searchResults.innerHTML = '<div class="search-result-item"><span class="result-meta">No results</span></div>';
      searchResults.classList.remove('hidden');
      return;
    }

    searchResults.innerHTML = matches.map(p => `
      <div class="search-result-item" data-account="${p.account}" data-lat="${p.lat}" data-lng="${p.lng}">
        <div class="result-addr">${p.address || 'Parcel ' + p.account}</div>
        <div class="result-meta">${p.price_per_sqft ? '$' + Math.round(p.price_per_sqft) + '/sqft' : ''} ${p.last_sale_date ? '· ' + p.last_sale_date : ''}</div>
      </div>
    `).join('');
    searchResults.classList.remove('hidden');

    searchResults.querySelectorAll('.search-result-item[data-account]').forEach(el => {
      el.addEventListener('click', () => {
        const lat = parseFloat(el.dataset.lat);
        const lng = parseFloat(el.dataset.lng);
        const account = el.dataset.account;
        map.setView([lat, lng], 17);
        searchResults.classList.add('hidden');
        searchInput.value = '';

        // Find and click the parcel
        const parcel = allParcels.find(p => p.account === account);
        if (parcel) {
          // Small delay to let the map pan, then open detail
          setTimeout(() => openDetailPanel(parcel), 300);
        }
      });
    });
  }

  // ── Controls wiring ────────────────────────────────────
  // Toggle controls panel
  document.getElementById('controls-toggle').addEventListener('click', () => {
    document.getElementById('controls-body').classList.toggle('collapsed');
  });

  // View mode toggle
  document.getElementById('view-parcels').addEventListener('click', () => {
    currentView = 'parcels';
    document.getElementById('view-parcels').classList.add('active');
    document.getElementById('view-hexbin').classList.remove('active');
    renderMarkers();
  });

  document.getElementById('view-hexbin').addEventListener('click', () => {
    currentView = 'hexbin';
    document.getElementById('view-hexbin').classList.add('active');
    document.getElementById('view-parcels').classList.remove('active');
    renderMarkers();
  });

  // Metric selector
  document.getElementById('metric-select').addEventListener('change', e => {
    currentMetric = e.target.value;
    renderMarkers();
  });

  // Color ramp
  document.getElementById('ramp-select').addEventListener('change', e => {
    currentRamp = e.target.value;
    renderMarkers();
  });

  // Opacity
  document.getElementById('opacity-slider').addEventListener('input', e => {
    currentOpacity = parseFloat(e.target.value);
    document.getElementById('opacity-value').textContent = currentOpacity.toFixed(2);
    const layer = markerLayer || hexLayer;
    if (layer) {
      layer.eachLayer(m => {
        if (m.setStyle) m.setStyle({ fillOpacity: currentOpacity });
      });
    }
  });

  // Percentile clamp
  document.getElementById('clamp-lo').addEventListener('input', e => {
    clampLo = parseInt(e.target.value);
    document.getElementById('clamp-value').textContent = clampLo + '–' + clampHi;
  });
  document.getElementById('clamp-lo').addEventListener('change', () => {
    renderMarkers();
  });

  document.getElementById('clamp-hi').addEventListener('input', e => {
    clampHi = parseInt(e.target.value);
    document.getElementById('clamp-value').textContent = clampLo + '–' + clampHi;
  });
  document.getElementById('clamp-hi').addEventListener('change', () => {
    renderMarkers();
  });

  // Date filters
  document.getElementById('date-from').addEventListener('change', e => {
    dateFrom = new Date(e.target.value);
    applyFilters();
    renderMarkers();
  });

  document.getElementById('date-to').addEventListener('change', e => {
    dateTo = new Date(e.target.value);
    applyFilters();
    renderMarkers();
  });

  // ── Init ───────────────────────────────────────────────
  loadParcels();
  loadHexData();
})();

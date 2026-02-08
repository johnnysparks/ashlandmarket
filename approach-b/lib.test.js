import { describe, it, expect } from 'vitest';
import {
  ASHLAND_CENTER,
  INITIAL_ZOOM,
  DATA_BASE,
  MARKER_RADIUS_RANGE,
  METRIC_CONFIG,
  createHexPolygon,
  getRadius,
  applyFilters,
  computeColorDomain,
  resolveColor,
  searchParcels,
  filterValidParcels,
  sortSalesByDate,
  filterChartableSales,
  buildGradientStops,
} from './lib.js';

// ── Test data fixtures ──────────────────────────────────

const SAMPLE_PARCELS = [
  {
    account: '10001',
    lat: 42.1945,
    lng: -122.7095,
    address: '123 Main St',
    sqft_living: 1850,
    sqft_lot: 7500,
    year_built: 1952,
    last_sale_price: 425000,
    last_sale_date: '2023-06-15',
    price_per_sqft: 229.73,
    assessed_value: 380000,
    num_sales: 4,
    num_permits: 2,
  },
  {
    account: '10002',
    lat: 42.1950,
    lng: -122.7100,
    address: '456 Oak Ave',
    sqft_living: 1200,
    sqft_lot: 5000,
    year_built: 1975,
    last_sale_price: 310000,
    last_sale_date: '2021-03-10',
    price_per_sqft: 258.33,
    assessed_value: 290000,
    num_sales: 2,
    num_permits: 0,
  },
  {
    account: '10003',
    lat: 42.1960,
    lng: -122.7080,
    address: '789 Elm Dr',
    sqft_living: 2400,
    sqft_lot: 12000,
    year_built: 2005,
    last_sale_price: 650000,
    last_sale_date: '2024-01-20',
    price_per_sqft: 270.83,
    assessed_value: 620000,
    num_sales: 1,
    num_permits: 5,
  },
  {
    account: '10004',
    lat: 42.1940,
    lng: -122.7110,
    address: '321 Pine Ln',
    sqft_living: 900,
    sqft_lot: 3000,
    year_built: 1940,
    last_sale_price: 185000,
    last_sale_date: '2019-08-05',
    price_per_sqft: 205.56,
    assessed_value: 175000,
    num_sales: 6,
    num_permits: 1,
  },
  {
    account: '10005',
    lat: null,
    lng: null,
    address: '555 No Location Blvd',
    sqft_living: 1000,
    last_sale_price: 200000,
    last_sale_date: '2020-01-01',
    price_per_sqft: 200,
  },
  {
    account: '10006',
    lat: 42.1955,
    lng: -122.7090,
    address: null,
    sqft_living: null,
    sqft_lot: null,
    year_built: null,
    last_sale_price: null,
    last_sale_date: null,
    price_per_sqft: null,
    assessed_value: null,
    num_sales: 0,
    num_permits: 0,
  },
];

const SAMPLE_SALES = [
  { date: '2023-06-15', price: 425000, buyer: 'SMITH JOHN', type: 'WARRANTY DEED' },
  { date: '2018-09-20', price: 350000, buyer: 'DOE JANE', type: 'WARRANTY DEED' },
  { date: '2010-01-05', price: 220000, buyer: 'JONES BOB', type: 'QUIT CLAIM' },
  { date: '2005-11-12', price: 180000, buyer: 'WILLIAMS SAM', type: 'WARRANTY DEED' },
];

// ── Constants ───────────────────────────────────────────

describe('Constants', () => {
  it('ASHLAND_CENTER is a valid lat/lng pair', () => {
    expect(ASHLAND_CENTER).toHaveLength(2);
    const [lat, lng] = ASHLAND_CENTER;
    expect(lat).toBeGreaterThan(42);
    expect(lat).toBeLessThan(43);
    expect(lng).toBeGreaterThan(-123);
    expect(lng).toBeLessThan(-122);
  });

  it('INITIAL_ZOOM is a reasonable map zoom level', () => {
    expect(INITIAL_ZOOM).toBeGreaterThanOrEqual(10);
    expect(INITIAL_ZOOM).toBeLessThanOrEqual(18);
  });

  it('DATA_BASE is the expected relative path', () => {
    expect(DATA_BASE).toBe('../data');
  });

  it('MARKER_RADIUS_RANGE is a [min, max] tuple', () => {
    expect(MARKER_RADIUS_RANGE).toHaveLength(2);
    expect(MARKER_RADIUS_RANGE[0]).toBeLessThan(MARKER_RADIUS_RANGE[1]);
  });
});

// ── METRIC_CONFIG ───────────────────────────────────────

describe('METRIC_CONFIG', () => {
  it('has all expected metrics', () => {
    const expected = [
      'price_per_sqft', 'last_sale_price', 'assessed_value',
      'sqft_living', 'sqft_lot', 'year_built', 'num_sales', 'num_permits',
    ];
    expect(Object.keys(METRIC_CONFIG)).toEqual(expect.arrayContaining(expected));
    expect(Object.keys(METRIC_CONFIG)).toHaveLength(expected.length);
  });

  it('each metric has label and fmt function', () => {
    for (const [key, config] of Object.entries(METRIC_CONFIG)) {
      expect(config).toHaveProperty('label');
      expect(config).toHaveProperty('fmt');
      expect(typeof config.label).toBe('string');
      expect(typeof config.fmt).toBe('function');
    }
  });

  it('price_per_sqft formats as dollar amount', () => {
    expect(METRIC_CONFIG.price_per_sqft.fmt(229.73)).toBe('$230');
    expect(METRIC_CONFIG.price_per_sqft.fmt(100)).toBe('$100');
  });

  it('year_built formats as plain string', () => {
    expect(METRIC_CONFIG.year_built.fmt(1952)).toBe('1952');
    expect(METRIC_CONFIG.year_built.fmt(2005)).toBe('2005');
  });

  it('num_sales and num_permits format as plain string', () => {
    expect(METRIC_CONFIG.num_sales.fmt(4)).toBe('4');
    expect(METRIC_CONFIG.num_permits.fmt(0)).toBe('0');
  });

  it('last_sale_price formats with dollar sign and commas', () => {
    const result = METRIC_CONFIG.last_sale_price.fmt(425000);
    expect(result).toMatch(/^\$[\d,]+$/);
    expect(result).toContain('425');
  });

  it('sqft_living formats with commas', () => {
    const result = METRIC_CONFIG.sqft_living.fmt(1850);
    expect(result).toMatch(/[\d,]+/);
  });
});

// ── createHexPolygon ────────────────────────────────────

describe('createHexPolygon', () => {
  it('returns exactly 6 points', () => {
    const points = createHexPolygon(42.1945, -122.7095, 0.005);
    expect(points).toHaveLength(6);
  });

  it('each point is a [lat, lng] pair', () => {
    const points = createHexPolygon(42.1945, -122.7095, 0.005);
    for (const point of points) {
      expect(point).toHaveLength(2);
      expect(typeof point[0]).toBe('number');
      expect(typeof point[1]).toBe('number');
    }
  });

  it('points are centered roughly around the input lat/lng', () => {
    const lat = 42.1945;
    const lng = -122.7095;
    const size = 0.005;
    const points = createHexPolygon(lat, lng, size);

    const avgLat = points.reduce((s, p) => s + p[0], 0) / 6;
    const avgLng = points.reduce((s, p) => s + p[1], 0) / 6;

    expect(avgLat).toBeCloseTo(lat, 3);
    expect(avgLng).toBeCloseTo(lng, 3);
  });

  it('hex size scales with the size parameter', () => {
    const small = createHexPolygon(42.1945, -122.7095, 0.001);
    const large = createHexPolygon(42.1945, -122.7095, 0.01);

    // Compute span of lat values
    const smallLatSpan = Math.max(...small.map(p => p[0])) - Math.min(...small.map(p => p[0]));
    const largeLatSpan = Math.max(...large.map(p => p[0])) - Math.min(...large.map(p => p[0]));

    expect(largeLatSpan).toBeGreaterThan(smallLatSpan * 5);
  });

  it('corrects for latitude distortion on longitude', () => {
    // At higher latitudes, the lng spread should be wider than at the equator
    const equator = createHexPolygon(0, 0, 0.01);
    const midLat = createHexPolygon(42.0, 0, 0.01);

    const eqLngSpan = Math.max(...equator.map(p => p[1])) - Math.min(...equator.map(p => p[1]));
    const midLngSpan = Math.max(...midLat.map(p => p[1])) - Math.min(...midLat.map(p => p[1]));

    // At 42 degrees, cos(42) ~ 0.743, so lng spread should be larger (divided by smaller cos)
    expect(midLngSpan).toBeGreaterThan(eqLngSpan);
  });

  it('produces a valid regular hexagon (equal side distances)', () => {
    const points = createHexPolygon(0, 0, 0.01); // equator for simpler math
    const distances = [];
    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const dlat = points[next][0] - points[i][0];
      const dlng = points[next][1] - points[i][1];
      distances.push(Math.sqrt(dlat * dlat + dlng * dlng));
    }
    // All sides should be approximately equal
    const avg = distances.reduce((s, d) => s + d, 0) / 6;
    for (const d of distances) {
      expect(d).toBeCloseTo(avg, 4);
    }
  });
});

// ── getRadius ───────────────────────────────────────────

describe('getRadius', () => {
  it('returns 10 at zoom >= 17', () => {
    expect(getRadius(17)).toBe(10);
    expect(getRadius(18)).toBe(10);
    expect(getRadius(19)).toBe(10);
  });

  it('returns 6 at zoom 15-16', () => {
    expect(getRadius(15)).toBe(6);
    expect(getRadius(16)).toBe(6);
  });

  it('returns 4 at zoom 13-14', () => {
    expect(getRadius(13)).toBe(4);
    expect(getRadius(14)).toBe(4);
  });

  it('returns 3 at zoom < 13', () => {
    expect(getRadius(12)).toBe(3);
    expect(getRadius(10)).toBe(3);
    expect(getRadius(5)).toBe(3);
    expect(getRadius(1)).toBe(3);
  });

  it('returns larger radius at higher zoom (monotonically non-decreasing)', () => {
    let prev = getRadius(1);
    for (let z = 2; z <= 19; z++) {
      const curr = getRadius(z);
      expect(curr).toBeGreaterThanOrEqual(prev);
      prev = curr;
    }
  });
});

// ── applyFilters ────────────────────────────────────────

describe('applyFilters', () => {
  const parcels = SAMPLE_PARCELS.filter(p => p.lat && p.lng); // valid parcels only

  it('returns all parcels when date range covers everything', () => {
    const result = applyFilters(parcels, new Date('2000-01-01'), new Date('2030-01-01'));
    expect(result).toHaveLength(parcels.length);
  });

  it('includes parcels without sale dates', () => {
    const parcelsWithNull = [
      ...parcels,
      { account: '99', lat: 42, lng: -122, last_sale_date: null },
    ];
    const result = applyFilters(parcelsWithNull, new Date('2025-01-01'), new Date('2026-01-01'));
    // Should include the null-date parcel even though date range excludes most
    const nullParcel = result.find(p => p.account === '99');
    expect(nullParcel).toBeDefined();
  });

  it('filters out parcels outside the date range', () => {
    // Only include sales from 2022+
    const result = applyFilters(parcels, new Date('2022-01-01'), new Date('2026-12-31'));
    // 10001 (2023), 10003 (2024) should be in; 10002 (2021), 10004 (2019) should be out
    // 10006 has null date, so it should be included
    const accounts = result.map(p => p.account);
    expect(accounts).toContain('10001');
    expect(accounts).toContain('10003');
    expect(accounts).toContain('10006');
    expect(accounts).not.toContain('10002');
    expect(accounts).not.toContain('10004');
  });

  it('returns empty array when no parcels match', () => {
    // Narrow range that doesn't match any sale
    const result = applyFilters(
      parcels.filter(p => p.last_sale_date), // remove null dates
      new Date('2025-06-01'),
      new Date('2025-06-02'),
    );
    expect(result).toHaveLength(0);
  });

  it('handles empty input array', () => {
    const result = applyFilters([], new Date('2000-01-01'), new Date('2030-01-01'));
    expect(result).toEqual([]);
  });

  it('boundary: includes parcels on exact date boundaries', () => {
    const result = applyFilters(parcels, new Date('2023-06-15'), new Date('2023-06-15'));
    const accounts = result.map(p => p.account);
    expect(accounts).toContain('10001'); // exact match on 2023-06-15
    expect(accounts).toContain('10006'); // null date included
  });
});

// ── computeColorDomain ──────────────────────────────────

describe('computeColorDomain', () => {
  // Simple quantile function for testing (linear interpolation)
  function simpleQuantile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  const parcels = SAMPLE_PARCELS.filter(p => p.lat && p.lng);

  it('returns domain with lo and hi for valid data', () => {
    const result = computeColorDomain(parcels, 'price_per_sqft', 0, 100, simpleQuantile);
    expect(result).toHaveProperty('lo');
    expect(result).toHaveProperty('hi');
    expect(result).toHaveProperty('count');
    expect(result.lo).toBeLessThanOrEqual(result.hi);
  });

  it('returns null when no valid values exist', () => {
    const emptyParcels = [{ account: '1', price_per_sqft: null }];
    const result = computeColorDomain(emptyParcels, 'price_per_sqft', 5, 95, simpleQuantile);
    expect(result).toBeNull();
  });

  it('returns null for empty parcels array', () => {
    const result = computeColorDomain([], 'price_per_sqft', 5, 95, simpleQuantile);
    expect(result).toBeNull();
  });

  it('returns correct count of valid values', () => {
    const result = computeColorDomain(parcels, 'price_per_sqft', 5, 95, simpleQuantile);
    // parcels with valid price_per_sqft: 10001 (229.73), 10002 (258.33), 10003 (270.83), 10004 (205.56)
    // 10006 has null
    expect(result.count).toBe(4);
  });

  it('clamp at 0/100 returns min/max', () => {
    const result = computeColorDomain(parcels, 'price_per_sqft', 0, 100, simpleQuantile);
    expect(result.lo).toBeCloseTo(205.56, 1);
    expect(result.hi).toBeCloseTo(270.83, 1);
  });

  it('tighter clamp narrows the domain', () => {
    const wide = computeColorDomain(parcels, 'price_per_sqft', 0, 100, simpleQuantile);
    const narrow = computeColorDomain(parcels, 'price_per_sqft', 25, 75, simpleQuantile);
    expect(narrow.lo).toBeGreaterThanOrEqual(wide.lo);
    expect(narrow.hi).toBeLessThanOrEqual(wide.hi);
  });

  it('filters out non-finite values (NaN, Infinity)', () => {
    const parcelsWithBadValues = [
      { price_per_sqft: 100 },
      { price_per_sqft: NaN },
      { price_per_sqft: Infinity },
      { price_per_sqft: -Infinity },
      { price_per_sqft: 200 },
    ];
    const result = computeColorDomain(parcelsWithBadValues, 'price_per_sqft', 0, 100, simpleQuantile);
    expect(result.count).toBe(2);
    expect(result.lo).toBe(100);
    expect(result.hi).toBe(200);
  });

  it('works with different metrics', () => {
    const sqft = computeColorDomain(parcels, 'sqft_living', 0, 100, simpleQuantile);
    expect(sqft).not.toBeNull();
    // 10006 has null sqft_living, so 4 valid: 1850, 1200, 2400, 900
    expect(sqft.count).toBe(4);
    expect(sqft.lo).toBe(900);
    expect(sqft.hi).toBe(2400);
  });
});

// ── resolveColor ────────────────────────────────────────

describe('resolveColor', () => {
  // Simple grayscale interpolator for testing
  const grayscale = t => `rgb(${Math.round(t * 255)},${Math.round(t * 255)},${Math.round(t * 255)})`;

  it('returns #444 for null value', () => {
    expect(resolveColor(null, 0, 100, grayscale)).toBe('#444');
  });

  it('returns #444 for NaN value', () => {
    expect(resolveColor(NaN, 0, 100, grayscale)).toBe('#444');
  });

  it('returns #444 for Infinity value', () => {
    expect(resolveColor(Infinity, 0, 100, grayscale)).toBe('#444');
  });

  it('returns interpolated color for value at lo boundary', () => {
    const color = resolveColor(0, 0, 100, grayscale);
    expect(color).toBe('rgb(0,0,0)');
  });

  it('returns interpolated color for value at hi boundary', () => {
    const color = resolveColor(100, 0, 100, grayscale);
    expect(color).toBe('rgb(255,255,255)');
  });

  it('returns interpolated color for midpoint value', () => {
    const color = resolveColor(50, 0, 100, grayscale);
    expect(color).toBe('rgb(128,128,128)');
  });

  it('clamps values below lo to 0', () => {
    const color = resolveColor(-50, 0, 100, grayscale);
    expect(color).toBe('rgb(0,0,0)');
  });

  it('clamps values above hi to 1', () => {
    const color = resolveColor(200, 0, 100, grayscale);
    expect(color).toBe('rgb(255,255,255)');
  });
});

// ── searchParcels ───────────────────────────────────────

describe('searchParcels', () => {
  const parcels = SAMPLE_PARCELS;

  it('returns empty array for query shorter than 2 chars', () => {
    expect(searchParcels(parcels, '')).toEqual([]);
    expect(searchParcels(parcels, 'a')).toEqual([]);
  });

  it('returns empty array for whitespace-only query', () => {
    expect(searchParcels(parcels, '   ')).toEqual([]);
  });

  it('finds parcels by address substring (case-insensitive)', () => {
    const results = searchParcels(parcels, 'main');
    expect(results).toHaveLength(1);
    expect(results[0].account).toBe('10001');
  });

  it('finds parcels by account number', () => {
    const results = searchParcels(parcels, '10003');
    expect(results).toHaveLength(1);
    expect(results[0].account).toBe('10003');
  });

  it('search is case-insensitive', () => {
    const results = searchParcels(parcels, 'OAK');
    expect(results).toHaveLength(1);
    expect(results[0].address).toBe('456 Oak Ave');
  });

  it('returns multiple matches', () => {
    // "1000" matches all accounts starting with 1000
    const results = searchParcels(parcels, '1000');
    expect(results.length).toBeGreaterThan(1);
  });

  it('respects maxResults limit', () => {
    const results = searchParcels(parcels, '1000', 2);
    expect(results).toHaveLength(2);
  });

  it('defaults to 8 max results', () => {
    // Create many parcels
    const many = Array.from({ length: 20 }, (_, i) => ({
      account: `2000${i}`,
      address: `${i} Test St`,
    }));
    const results = searchParcels(many, 'test');
    expect(results).toHaveLength(8);
  });

  it('handles parcels with null address gracefully', () => {
    const results = searchParcels(parcels, '10006');
    expect(results).toHaveLength(1);
    expect(results[0].account).toBe('10006');
  });

  it('trims whitespace from query', () => {
    const results = searchParcels(parcels, '  main  ');
    expect(results).toHaveLength(1);
    expect(results[0].account).toBe('10001');
  });
});

// ── filterValidParcels ──────────────────────────────────

describe('filterValidParcels', () => {
  it('removes parcels with null lat/lng', () => {
    const result = filterValidParcels(SAMPLE_PARCELS);
    expect(result.every(p => p.lat && p.lng)).toBe(true);
    // 10005 has null lat/lng
    expect(result.find(p => p.account === '10005')).toBeUndefined();
  });

  it('keeps parcels with valid coordinates', () => {
    const result = filterValidParcels(SAMPLE_PARCELS);
    expect(result.find(p => p.account === '10001')).toBeDefined();
    expect(result.find(p => p.account === '10002')).toBeDefined();
  });

  it('returns empty array when all parcels are invalid', () => {
    const invalid = [
      { account: '1', lat: null, lng: null },
      { account: '2', lat: 0, lng: null },
      { account: '3', lat: null, lng: -122 },
    ];
    const result = filterValidParcels(invalid);
    expect(result).toHaveLength(0);
  });

  it('handles empty input', () => {
    expect(filterValidParcels([])).toEqual([]);
  });

  it('removes parcels with lat=0, lng=0 (falsy but valid coords filtered out)', () => {
    // This is a known behavior: the filter uses truthiness, so 0 is falsy
    const parcels = [{ account: '1', lat: 0, lng: 0 }];
    const result = filterValidParcels(parcels);
    expect(result).toHaveLength(0); // 0 is falsy
  });
});

// ── sortSalesByDate ─────────────────────────────────────

describe('sortSalesByDate', () => {
  it('sorts descending by default', () => {
    const result = sortSalesByDate(SAMPLE_SALES);
    expect(result[0].date).toBe('2023-06-15');
    expect(result[result.length - 1].date).toBe('2005-11-12');
  });

  it('sorts ascending when descending=false', () => {
    const result = sortSalesByDate(SAMPLE_SALES, false);
    expect(result[0].date).toBe('2005-11-12');
    expect(result[result.length - 1].date).toBe('2023-06-15');
  });

  it('does not mutate the original array', () => {
    const original = [...SAMPLE_SALES];
    sortSalesByDate(SAMPLE_SALES);
    expect(SAMPLE_SALES).toEqual(original);
  });

  it('handles empty array', () => {
    expect(sortSalesByDate([])).toEqual([]);
  });

  it('handles single sale', () => {
    const single = [{ date: '2023-01-01', price: 100000 }];
    expect(sortSalesByDate(single)).toEqual(single);
  });
});

// ── filterChartableSales ────────────────────────────────

describe('filterChartableSales', () => {
  it('returns sales with both price and date, sorted ascending', () => {
    const result = filterChartableSales(SAMPLE_SALES);
    expect(result).toHaveLength(4);
    expect(result[0].date).toBe('2005-11-12');
    expect(result[result.length - 1].date).toBe('2023-06-15');
  });

  it('filters out sales without price', () => {
    const sales = [
      { date: '2023-01-01', price: 100000 },
      { date: '2022-01-01', price: null },
      { date: '2021-01-01', price: 0 }, // 0 is falsy
    ];
    const result = filterChartableSales(sales);
    expect(result).toHaveLength(1);
    expect(result[0].price).toBe(100000);
  });

  it('filters out sales without date', () => {
    const sales = [
      { date: '2023-01-01', price: 100000 },
      { date: null, price: 200000 },
      { date: '', price: 300000 }, // empty string is falsy
    ];
    const result = filterChartableSales(sales);
    expect(result).toHaveLength(1);
  });

  it('does not mutate the original array', () => {
    const original = [...SAMPLE_SALES];
    filterChartableSales(SAMPLE_SALES);
    expect(SAMPLE_SALES).toEqual(original);
  });

  it('handles empty array', () => {
    expect(filterChartableSales([])).toEqual([]);
  });
});

// ── buildGradientStops ──────────────────────────────────

describe('buildGradientStops', () => {
  const identity = t => `${t}`;

  it('returns correct number of steps', () => {
    expect(buildGradientStops(identity, 5)).toHaveLength(5);
    expect(buildGradientStops(identity, 20)).toHaveLength(20);
    expect(buildGradientStops(identity, 1)).toHaveLength(1);
  });

  it('first stop is at t=0', () => {
    const stops = buildGradientStops(identity, 10);
    expect(stops[0]).toBe('0');
  });

  it('last stop is at t=1', () => {
    const stops = buildGradientStops(identity, 10);
    expect(stops[stops.length - 1]).toBe('1');
  });

  it('stops are evenly distributed', () => {
    const stops = buildGradientStops(t => t, 5);
    // Expected: 0, 0.25, 0.5, 0.75, 1
    expect(Number(stops[0])).toBeCloseTo(0, 5);
    expect(Number(stops[1])).toBeCloseTo(0.25, 5);
    expect(Number(stops[2])).toBeCloseTo(0.5, 5);
    expect(Number(stops[3])).toBeCloseTo(0.75, 5);
    expect(Number(stops[4])).toBeCloseTo(1, 5);
  });

  it('defaults to 20 steps', () => {
    const stops = buildGradientStops(identity);
    expect(stops).toHaveLength(20);
  });

  it('calls interpolator with correct t values', () => {
    const calls = [];
    buildGradientStops(t => { calls.push(t); return t; }, 3);
    expect(calls).toEqual([0, 0.5, 1]);
  });
});

// ── Integration-style tests ─────────────────────────────

describe('Integration: filter → computeDomain pipeline', () => {
  function simpleQuantile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  }

  it('valid parcels → date filter → color domain', () => {
    const valid = filterValidParcels(SAMPLE_PARCELS);
    const filtered = applyFilters(valid, new Date('2022-01-01'), new Date('2026-12-31'));
    const domain = computeColorDomain(filtered, 'price_per_sqft', 0, 100, simpleQuantile);

    expect(domain).not.toBeNull();
    // Only 10001 (229.73) and 10003 (270.83) and 10006 (null) pass the filter
    // 10006 has null price_per_sqft, so count = 2
    expect(domain.count).toBe(2);
    expect(domain.lo).toBeCloseTo(229.73, 1);
    expect(domain.hi).toBeCloseTo(270.83, 1);
  });

  it('resolveColor works with computed domain', () => {
    const valid = filterValidParcels(SAMPLE_PARCELS);
    const domain = computeColorDomain(valid, 'price_per_sqft', 0, 100, simpleQuantile);
    const grayscale = t => `gray(${Math.round(t * 100)}%)`;

    // Low value
    const colorLo = resolveColor(domain.lo, domain.lo, domain.hi, grayscale);
    expect(colorLo).toBe('gray(0%)');

    // High value
    const colorHi = resolveColor(domain.hi, domain.lo, domain.hi, grayscale);
    expect(colorHi).toBe('gray(100%)');

    // Null value
    const colorNull = resolveColor(null, domain.lo, domain.hi, grayscale);
    expect(colorNull).toBe('#444');
  });
});

describe('Integration: search + filter pipeline', () => {
  it('search within filtered parcels', () => {
    const valid = filterValidParcels(SAMPLE_PARCELS);
    const filtered = applyFilters(valid, new Date('2022-01-01'), new Date('2026-12-31'));
    const results = searchParcels(filtered, 'main');
    expect(results).toHaveLength(1);
    expect(results[0].address).toBe('123 Main St');
  });

  it('search returns nothing for parcels excluded by date filter', () => {
    const valid = filterValidParcels(SAMPLE_PARCELS);
    const filtered = applyFilters(valid, new Date('2025-01-01'), new Date('2026-12-31'));
    // Pine Ln was sold in 2019, should not be in filtered set
    const results = searchParcels(filtered, 'pine');
    expect(results).toHaveLength(0);
  });
});

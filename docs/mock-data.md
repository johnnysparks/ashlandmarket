# Mock Data

Mock data for frontend development before the scraper is operational.

## Generation

Run from the repo root:

```bash
python3 data/generate_mock.py
```

This overwrites all mock data files. The script uses a fixed random seed (`42`) for reproducibility.

## Files Produced

### `data/parcels.json`

Master parcel index with 50 mock parcels. Schema matches the contract in `CLAUDE.md`.

| Field | Type | Description |
|-------|------|-------------|
| `account` | string | 8-digit account ID |
| `lat` / `lng` | number | Coordinates within Ashland bounding box (42.175–42.215, -122.730–-122.690) |
| `address` | string | Realistic Ashland street address |
| `sqft_living` | int | 600–4,500 sqft |
| `sqft_lot` | int | 2,000–40,000 sqft |
| `year_built` | int | 1890–2024 |
| `last_sale_price` | int | Derived from sqft × price_per_sqft |
| `last_sale_date` | string | ISO date, 2015–2025 |
| `price_per_sqft` | number | $180–$450, adjusted for age |
| `assessed_value` | int | 70–95% of last sale price |
| `num_sales` | int | 1–8 |
| `num_permits` | int | 0–6 |

### `data/sales/{account}.json`

Per-parcel detail files for 10 parcels (the first 10 in parcels.json). Each contains:

- **sales** — Array of sale records (`date`, `price`, `buyer`, `type`)
- **permits** — Array of permits (`number`, `type`, `date`, `status`)
- **improvements** — Array of structures (`type`, `sqft`, `year_built`, `condition`)

### `data/aggregates/hexbin-price-sqft.json`

Pre-computed hex-binned aggregate of price per sqft.

| Field | Description |
|-------|-------------|
| `hex_size_deg` | Hex bin size in degrees (~500m) |
| `metric` | The metric aggregated (`price_per_sqft`) |
| `bins[].lat/lng` | Bin center coordinates |
| `bins[].median_price_sqft` | Median $/sqft in bin |
| `bins[].mean_price_sqft` | Mean $/sqft in bin |
| `bins[].count` | Number of parcels in bin |
| `bins[].min/max_price_sqft` | Range |

## Notes

- Coordinates are randomized within Ashland city bounds but don't correspond to real parcel locations.
- Street names are real Ashland streets; addresses are fabricated.
- Price distributions roughly match Ashland's market ($180–$450/sqft range).
- The generator script (`data/generate_mock.py`) can be modified to produce more parcels or different distributions.

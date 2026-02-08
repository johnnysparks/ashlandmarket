# Mock Data

Mock data for frontend development before the scraper pipeline is complete.

## Files

| File | Description |
|------|-------------|
| `data/parcels.json` | Master index with 50 mock parcels in Ashland |
| `data/sales/{account}.json` | Per-parcel detail files (sales, permits, improvements) |
| `data/aggregates/hexbin-price-sqft.json` | Precomputed hex-grid aggregation of $/sqft |
| `data/generate_mock_data.py` | Script that generates all of the above |

## Regenerating

```bash
cd data && python generate_mock_data.py
```

Uses a fixed random seed (`42`) for reproducibility.

## Schema

All files follow the data contract defined in `CLAUDE.md`. Key points:

- `parcels.json` has a `generated` timestamp and a `parcels` array
- Each parcel has: `account`, `lat`, `lng`, `address`, `sqft_living`, `sqft_lot`, `year_built`, `last_sale_price`, `last_sale_date`, `price_per_sqft`, `assessed_value`, `num_sales`, `num_permits`
- Per-account files have: `sales` array, `permits` array, `improvements` array
- Aggregate files have hex cell centers with median/mean/min/max stats

## Limitations

- Coordinates are randomized around Ashland center, not tied to real addresses
- Street names are real Ashland streets but house numbers are random
- Price distributions are approximate, not calibrated to actual market data
- 50 parcels (real Ashland has ~8,000-12,000)

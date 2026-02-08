#!/usr/bin/env python3
"""Generate realistic mock data for Ashland Market Heat Map.

Produces:
  - data/parcels.json  (~50 parcels)
  - data/sales/{account}.json  (detail files for ~10 parcels)
  - data/aggregates/hexbin-price-sqft.json
"""

import json
import math
import os
import random
from datetime import datetime, timedelta

random.seed(42)

# Ashland, OR center and bounding box
CENTER_LAT = 42.1945
CENTER_LNG = -122.7095
# Rough bounding box for residential Ashland
LAT_MIN, LAT_MAX = 42.175, 42.215
LNG_MIN, LNG_MAX = -122.730, -122.690

# Realistic Ashland street names
STREETS = [
    "Main St", "Oak St", "Siskiyou Blvd", "A St", "B St", "C St",
    "Granite St", "Beach St", "Helman St", "Iowa St", "Laurel St",
    "Mountain Ave", "N Mountain Ave", "S Mountain Ave", "Walker Ave",
    "Nutley St", "Palm Ave", "Union St", "Wimer St", "Gresham St",
    "Church St", "Pioneer St", "Scenic Dr", "Fordyce St", "Liberty St",
    "Van Ness Ave", "Holly St", "Terrace St", "Morton St", "Sherman St",
    "Morse Ave", "Coolidge St", "Clay St", "Hillview Dr", "Normal Ave",
    "Meade St", "E Main St", "N Main St", "Water St", "Winburn Way",
    "Ashland St", "Tolman Creek Rd", "Faith Ave", "Park St", "Almond St",
    "Orange Ave", "Lit Way", "Elkader St", "Harmony Ln", "Strawberry Ln",
]

FIRST_NAMES = [
    "SMITH", "JOHNSON", "WILLIAMS", "JONES", "BROWN", "DAVIS", "MILLER",
    "WILSON", "MOORE", "TAYLOR", "ANDERSON", "THOMAS", "JACKSON", "WHITE",
    "HARRIS", "MARTIN", "THOMPSON", "GARCIA", "MARTINEZ", "ROBINSON",
    "CLARK", "RODRIGUEZ", "LEWIS", "LEE", "WALKER", "HALL", "ALLEN",
    "YOUNG", "KING", "WRIGHT",
]

DEED_TYPES = [
    "WARRANTY DEED", "BARGAIN AND SALE DEED", "QUIT CLAIM DEED",
    "SPECIAL WARRANTY DEED", "TRUST DEED",
]

PERMIT_TYPES = [
    "REMODEL", "ADDITION", "NEW CONSTRUCTION", "MECHANICAL", "PLUMBING",
    "ELECTRICAL", "ROOFING", "FENCE", "DEMOLITION", "SOLAR",
]

PERMIT_STATUSES = ["FINAL", "ISSUED", "EXPIRED", "UNDER REVIEW"]

IMPROVEMENT_TYPES = ["DWELLING", "GARAGE", "SHOP", "CARPORT", "DECK", "SHED"]

CONDITIONS = ["EXCELLENT", "GOOD", "AVERAGE", "FAIR", "POOR"]


def random_date(start_year: int, end_year: int) -> str:
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    rand_days = random.randint(0, delta.days)
    return (start + timedelta(days=rand_days)).strftime("%Y-%m-%d")


def generate_account_id() -> str:
    return str(random.randint(10000000, 10999999))


def generate_parcels(n: int = 50) -> list[dict]:
    parcels = []
    used_accounts: set[str] = set()

    for i in range(n):
        account = generate_account_id()
        while account in used_accounts:
            account = generate_account_id()
        used_accounts.add(account)

        # Position: cluster parcels in a realistic pattern
        lat = random.uniform(LAT_MIN, LAT_MAX)
        lng = random.uniform(LNG_MIN, LNG_MAX)

        street = random.choice(STREETS)
        house_num = random.randint(10, 2500)
        address = f"{house_num} {street}"

        year_built = random.randint(1890, 2024)
        sqft_living = random.randint(600, 4500)
        sqft_lot = random.randint(2000, 40000)

        # Price correlates with size, age, and some randomness
        base_price_sqft = random.uniform(180, 450)
        # Newer homes cost more per sqft
        age_factor = max(0.7, 1.0 - (2025 - year_built) * 0.003)
        price_per_sqft = round(base_price_sqft * age_factor, 2)

        num_sales = random.randint(1, 8)
        last_sale_price = round(sqft_living * price_per_sqft)
        last_sale_date = random_date(2015, 2025)

        assessed_value = round(last_sale_price * random.uniform(0.7, 0.95))
        num_permits = random.randint(0, 6)

        parcels.append({
            "account": account,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "address": address,
            "sqft_living": sqft_living,
            "sqft_lot": sqft_lot,
            "year_built": year_built,
            "last_sale_price": last_sale_price,
            "last_sale_date": last_sale_date,
            "price_per_sqft": price_per_sqft,
            "assessed_value": assessed_value,
            "num_sales": num_sales,
            "num_permits": num_permits,
        })

    return parcels


def generate_sales_detail(parcel: dict) -> dict:
    """Generate detailed sales/permits/improvements for one parcel."""
    account = parcel["account"]

    # Sales history
    sales = []
    current_price = parcel["last_sale_price"]
    current_date = parcel["last_sale_date"]
    for j in range(parcel["num_sales"]):
        if j == 0:
            price = current_price
            date = current_date
        else:
            # Earlier sales at lower prices
            price = round(current_price * random.uniform(0.5, 0.95))
            date = random_date(max(1985, parcel["year_built"]), 2025)
        buyer = f"{random.choice(FIRST_NAMES)} {random.choice(FIRST_NAMES)}"
        sales.append({
            "date": date,
            "price": price,
            "buyer": buyer,
            "type": random.choice(DEED_TYPES),
        })
    sales.sort(key=lambda s: s["date"], reverse=True)

    # Permits
    permits = []
    for _ in range(parcel["num_permits"]):
        year = random.randint(max(parcel["year_built"], 2000), 2025)
        permits.append({
            "number": f"B-{year}-{random.randint(100, 9999):04d}",
            "type": random.choice(PERMIT_TYPES),
            "date": random_date(year, min(year, 2025)),
            "status": random.choice(PERMIT_STATUSES),
        })
    permits.sort(key=lambda p: p["date"], reverse=True)

    # Improvements
    improvements = [{
        "type": "DWELLING",
        "sqft": parcel["sqft_living"],
        "year_built": parcel["year_built"],
        "condition": random.choice(CONDITIONS),
    }]
    # Maybe add an outbuilding
    if random.random() > 0.5:
        improvements.append({
            "type": random.choice(IMPROVEMENT_TYPES[1:]),
            "sqft": random.randint(100, 800),
            "year_built": random.randint(parcel["year_built"], 2024),
            "condition": random.choice(CONDITIONS),
        })

    return {
        "account": account,
        "sales": sales,
        "permits": permits,
        "improvements": improvements,
    }


def generate_hexbin_aggregate(parcels: list[dict]) -> dict:
    """Generate a hex-binned aggregate of price per sqft."""
    hex_size = 0.005  # ~500m hex radius in degrees

    bins: dict[str, list[float]] = {}
    for p in parcels:
        # Simple hex binning by rounding coordinates
        hx = round(p["lng"] / hex_size) * hex_size
        hy = round(p["lat"] / hex_size) * hex_size
        key = f"{round(hy, 6)},{round(hx, 6)}"
        if key not in bins:
            bins[key] = []
        bins[key].append(p["price_per_sqft"])

    hexbins = []
    for key, values in bins.items():
        lat_str, lng_str = key.split(",")
        hexbins.append({
            "lat": float(lat_str),
            "lng": float(lng_str),
            "median_price_sqft": round(sorted(values)[len(values) // 2], 2),
            "mean_price_sqft": round(sum(values) / len(values), 2),
            "count": len(values),
            "min_price_sqft": round(min(values), 2),
            "max_price_sqft": round(max(values), 2),
        })

    return {
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hex_size_deg": hex_size,
        "metric": "price_per_sqft",
        "bins": hexbins,
    }


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Generate parcels
    parcels = generate_parcels(50)

    # Write parcels.json
    parcels_data = {
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "parcels": parcels,
    }
    parcels_path = os.path.join(base_dir, "parcels.json")
    with open(parcels_path, "w") as f:
        json.dump(parcels_data, f, indent=2)
    print(f"Wrote {len(parcels)} parcels to {parcels_path}")

    # Write sales detail for first 10 parcels
    sales_dir = os.path.join(base_dir, "sales")
    os.makedirs(sales_dir, exist_ok=True)
    detail_parcels = parcels[:10]
    for p in detail_parcels:
        detail = generate_sales_detail(p)
        detail_path = os.path.join(sales_dir, f"{p['account']}.json")
        with open(detail_path, "w") as f:
            json.dump(detail, f, indent=2)
    print(f"Wrote {len(detail_parcels)} sales detail files to {sales_dir}/")

    # Write hexbin aggregate
    agg_dir = os.path.join(base_dir, "aggregates")
    os.makedirs(agg_dir, exist_ok=True)
    hexbin = generate_hexbin_aggregate(parcels)
    hexbin_path = os.path.join(agg_dir, "hexbin-price-sqft.json")
    with open(hexbin_path, "w") as f:
        json.dump(hexbin, f, indent=2)
    print(f"Wrote hexbin aggregate ({len(hexbin['bins'])} bins) to {hexbin_path}")


if __name__ == "__main__":
    main()

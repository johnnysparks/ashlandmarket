#!/usr/bin/env python3
"""Generate realistic mock data for Ashland Market Heat Map development.

Creates:
- data/parcels.json — master index with ~50 parcels
- data/sales/{account}.json — per-parcel detail files
- data/aggregates/hexbin-price-sqft.json — precomputed hex aggregation
"""

import json
import random
import math
from datetime import datetime, timedelta

random.seed(42)

# Ashland OR center and bounds
CENTER_LAT = 42.1945
CENTER_LNG = -122.7095
SPREAD_LAT = 0.025  # ~2.8km north-south
SPREAD_LNG = 0.035  # ~2.8km east-west

# Ashland street names (real streets)
STREETS = [
    "Main St", "Oak St", "Siskiyou Blvd", "N Mountain Ave", "S Mountain Ave",
    "A St", "B St", "C St", "Iowa St", "Beach St", "Helman St",
    "Granite St", "Nutley St", "Walker Ave", "Gresham St", "High St",
    "Laurel St", "Church St", "Pioneer St", "Water St", "E Main St",
    "Scenic Dr", "Ashland St", "Tolman Creek Rd", "Clay St", "Palm Ave",
    "Orange Ave", "Maple St", "Holly St", "Liberty St", "Wimer St",
    "Fourth St", "Third St", "Second St", "First St", "Meade St",
    "Morse Ave", "Sherman St", "Grant St", "Van Ness Ave",
    "Linda Ave", "Normal Ave", "Fordyce St", "Terrace St",
    "Union St", "Park St", "Winburn Way", "Lithia Way"
]

BUYER_FIRST = ["JOHN", "SARAH", "MICHAEL", "JENNIFER", "DAVID", "LISA",
               "ROBERT", "MARIA", "WILLIAM", "PATRICIA", "JAMES", "LINDA",
               "THOMAS", "ELIZABETH", "DANIEL", "SUSAN", "MARK", "NANCY",
               "BRIAN", "KAREN", "KEVIN", "DONNA", "STEVE", "HELEN"]
BUYER_LAST = ["SMITH", "JOHNSON", "WILLIAMS", "JONES", "BROWN", "DAVIS",
              "MILLER", "WILSON", "MOORE", "TAYLOR", "ANDERSON", "THOMAS",
              "JACKSON", "WHITE", "HARRIS", "MARTIN", "THOMPSON", "GARCIA",
              "MARTINEZ", "ROBINSON", "CLARK", "LEWIS", "LEE", "WALKER",
              "HALL", "ALLEN", "YOUNG", "KING", "WRIGHT", "HILL"]

DEED_TYPES = ["WARRANTY DEED", "BARGAIN & SALE DEED", "QUIT CLAIM DEED",
              "TRUST DEED", "SPECIAL WARRANTY DEED"]

PERMIT_TYPES = ["REMODEL", "ADDITION", "ELECTRICAL", "PLUMBING", "MECHANICAL",
                "ROOF", "FENCE", "DECK", "NEW CONSTRUCTION", "DEMOLITION",
                "SOLAR", "WATER HEATER"]

PERMIT_STATUS = ["FINAL", "ISSUED", "EXPIRED", "ACTIVE"]

DWELLING_CONDITIONS = ["EXCELLENT", "GOOD", "AVERAGE", "FAIR", "POOR"]

IMPROVEMENT_TYPES = ["DWELLING", "GARAGE", "CARPORT", "SHED", "SHOP",
                     "BARN", "POOL", "DECK"]


def random_date(start_year: int, end_year: int) -> str:
    start = datetime(start_year, 1, 1)
    end = datetime(end_year, 12, 31)
    delta = end - start
    offset = random.randint(0, delta.days)
    return (start + timedelta(days=offset)).strftime("%Y-%m-%d")


def generate_parcel(idx: int) -> dict:
    account = str(10059000 + idx)
    house_num = random.randint(10, 2500)
    street = random.choice(STREETS)
    address = f"{house_num} {street}"

    # Distribute parcels around Ashland center with slight clustering
    cluster_offset_lat = random.gauss(0, 0.003)
    cluster_offset_lng = random.gauss(0, 0.004)
    lat = round(CENTER_LAT + random.uniform(-SPREAD_LAT, SPREAD_LAT) + cluster_offset_lat, 6)
    lng = round(CENTER_LNG + random.uniform(-SPREAD_LNG, SPREAD_LNG) + cluster_offset_lng, 6)

    year_built = random.choice(
        [random.randint(1890, 1940)] * 2 +
        [random.randint(1941, 1970)] * 3 +
        [random.randint(1971, 2000)] * 3 +
        [random.randint(2001, 2025)] * 2
    )

    sqft_living = random.choice([
        random.randint(600, 1000),
        random.randint(1000, 1600),
        random.randint(1200, 2200),
        random.randint(1800, 3500),
        random.randint(2500, 5000),
    ])

    sqft_lot = random.choice([
        random.randint(3000, 5000),
        random.randint(5000, 8000),
        random.randint(7000, 12000),
        random.randint(10000, 20000),
        random.randint(15000, 43560),
    ])

    # Price influenced by sqft, year, and some randomness
    base_price_sqft = random.uniform(180, 450)
    if year_built > 2000:
        base_price_sqft *= random.uniform(1.1, 1.4)
    if sqft_living > 2500:
        base_price_sqft *= random.uniform(0.85, 1.0)
    price_per_sqft = round(base_price_sqft, 2)

    num_sales = random.choices([1, 2, 3, 4, 5, 6], weights=[15, 25, 25, 20, 10, 5])[0]
    num_permits = random.choices([0, 1, 2, 3, 4, 5], weights=[20, 25, 25, 15, 10, 5])[0]

    last_sale_price = round(sqft_living * price_per_sqft / 100) * 100
    last_sale_date = random_date(2018, 2025)

    assessed_value = round(last_sale_price * random.uniform(0.7, 0.95) / 1000) * 1000

    return {
        "account": account,
        "lat": lat,
        "lng": lng,
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
    }


def generate_sales_detail(parcel: dict) -> dict:
    account = parcel["account"]
    num_sales = parcel["num_sales"]
    num_permits = parcel["num_permits"]

    # Generate sales history going backwards in time
    sales = []
    current_price = parcel["last_sale_price"]
    current_date = parcel["last_sale_date"]

    for i in range(num_sales):
        if i == 0:
            price = current_price
            date = current_date
        else:
            # Each prior sale is 2-8 years earlier, price 5-30% less
            years_back = random.randint(2, 8)
            prev_year = int(current_date[:4]) - years_back
            if prev_year < 1980:
                prev_year = random.randint(1980, 1995)
            date = random_date(prev_year, prev_year)
            price = round(current_price * random.uniform(0.55, 0.88) / 100) * 100
            current_price = price
            current_date = date

        buyer = f"{random.choice(BUYER_LAST)} {random.choice(BUYER_FIRST)}"
        deed = random.choice(DEED_TYPES) if i < num_sales - 1 else random.choice(DEED_TYPES[:2])

        sales.append({
            "date": date,
            "price": price,
            "buyer": buyer,
            "type": deed,
        })

    # Generate permits
    permits = []
    for _ in range(num_permits):
        year = random.randint(max(parcel["year_built"], 2000), 2025)
        permits.append({
            "number": f"B-{year}-{random.randint(100, 9999):04d}",
            "type": random.choice(PERMIT_TYPES),
            "date": random_date(year, min(year, 2025)),
            "status": random.choice(PERMIT_STATUS),
        })
    permits.sort(key=lambda p: p["date"], reverse=True)

    # Generate improvements
    improvements = [{
        "type": "DWELLING",
        "sqft": parcel["sqft_living"],
        "year_built": parcel["year_built"],
        "condition": random.choice(DWELLING_CONDITIONS),
    }]

    # Maybe add garage/other structures
    if random.random() > 0.3:
        improvements.append({
            "type": random.choice(["GARAGE", "CARPORT"]),
            "sqft": random.randint(200, 800),
            "year_built": parcel["year_built"] + random.randint(0, 20),
            "condition": random.choice(DWELLING_CONDITIONS),
        })
    if random.random() > 0.7:
        improvements.append({
            "type": random.choice(["SHED", "SHOP", "DECK"]),
            "sqft": random.randint(80, 400),
            "year_built": random.randint(parcel["year_built"], 2025),
            "condition": random.choice(DWELLING_CONDITIONS),
        })

    return {
        "account": account,
        "sales": sales,
        "permits": permits,
        "improvements": improvements,
    }


def generate_hexbin_aggregates(parcels: list[dict]) -> dict:
    """Create a simple hex-grid aggregation of price per sqft."""
    hex_size = 0.005  # ~500m hex cells

    bins: dict[str, list[float]] = {}
    for p in parcels:
        # Simple hex-like grid binning
        col = round(p["lng"] / hex_size)
        row = round(p["lat"] / hex_size)
        key = f"{col},{row}"
        if key not in bins:
            bins[key] = []
        bins[key].append(p["price_per_sqft"])

    hexagons = []
    for key, values in bins.items():
        col, row = key.split(",")
        hexagons.append({
            "center_lat": round(int(row) * hex_size, 6),
            "center_lng": round(int(col) * hex_size, 6),
            "median_price_sqft": round(sorted(values)[len(values) // 2], 2),
            "mean_price_sqft": round(sum(values) / len(values), 2),
            "count": len(values),
            "min_price_sqft": round(min(values), 2),
            "max_price_sqft": round(max(values), 2),
        })

    return {
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "hex_size_degrees": hex_size,
        "metric": "price_per_sqft",
        "hexagons": hexagons,
    }


def main():
    # Generate parcels
    parcels = [generate_parcel(i) for i in range(50)]

    # Write master index
    parcels_index = {
        "generated": datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "parcels": parcels,
    }
    with open("data/parcels.json", "w") as f:
        json.dump(parcels_index, f, indent=2)
    print(f"Wrote data/parcels.json with {len(parcels)} parcels")

    # Write per-account detail files
    for parcel in parcels:
        detail = generate_sales_detail(parcel)
        path = f"data/sales/{parcel['account']}.json"
        with open(path, "w") as f:
            json.dump(detail, f, indent=2)
    print(f"Wrote {len(parcels)} files to data/sales/")

    # Write aggregate
    hexbin = generate_hexbin_aggregates(parcels)
    with open("data/aggregates/hexbin-price-sqft.json", "w") as f:
        json.dump(hexbin, f, indent=2)
    print(f"Wrote data/aggregates/hexbin-price-sqft.json with {len(hexbin['hexagons'])} hexagons")


if __name__ == "__main__":
    main()

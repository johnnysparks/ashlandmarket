"""
Precompute spatial aggregations for the Ashland heat map.

Produces:
- Hexbin aggregation (H3-style hex grid): median $/sqft per hex cell
- Grid-square aggregation: median $/sqft per rectangular grid cell
"""

import json
import logging
import math
from collections import defaultdict
from typing import Any

from config import (
    AGGREGATES_DIR,
    ASHLAND_CENTER_LAT,
    ASHLAND_CENTER_LNG,
)

logger = logging.getLogger(__name__)

# ── Hexbin (flat-top hex grid) ─────────────────────────────────────────────

# Hex cell size in degrees (roughly 100m at Ashland's latitude)
HEX_SIZE_DEG = 0.001


def _hex_coords(lat: float, lng: float, size: float = HEX_SIZE_DEG) -> tuple[int, int]:
    """
    Convert lat/lng to axial hex coordinates (q, r) on a flat-top hex grid.

    This is a simplified hex binning using offset coordinates.
    """
    # Adjust for longitude compression at this latitude
    lng_scale = math.cos(math.radians(lat))

    q = int(round(lng / (size * 1.5)))
    r_offset = 0.5 * (q % 2)
    r = int(round((lat / (size * math.sqrt(3) / lng_scale)) - r_offset))

    return q, r


def _hex_center(q: int, r: int, size: float = HEX_SIZE_DEG) -> tuple[float, float]:
    """Convert axial hex coordinates back to lat/lng center point."""
    lng_scale = math.cos(math.radians(ASHLAND_CENTER_LAT))

    lng = q * size * 1.5
    r_offset = 0.5 * (q % 2)
    lat = (r + r_offset) * (size * math.sqrt(3) / lng_scale)

    return round(lat, 6), round(lng, 6)


def compute_hexbin_aggregation(
    parcels: list[dict[str, Any]],
    metric: str = "price_per_sqft",
) -> list[dict[str, Any]]:
    """
    Compute hexbin aggregation of a metric across parcels.

    Returns list of hex cells with:
    - q, r (hex coordinates)
    - lat, lng (center of hex)
    - count (number of parcels in cell)
    - median, mean, min, max of the metric
    """
    # Group parcels by hex cell
    cells: dict[tuple[int, int], list[float]] = defaultdict(list)

    for parcel in parcels:
        lat = parcel.get("lat")
        lng = parcel.get("lng")
        value = parcel.get(metric)

        if lat is None or lng is None or value is None:
            continue

        q, r = _hex_coords(lat, lng)
        cells[(q, r)].append(value)

    # Compute statistics per cell
    hex_data: list[dict[str, Any]] = []
    for (q, r), values in cells.items():
        if not values:
            continue

        values_sorted = sorted(values)
        n = len(values_sorted)
        center_lat, center_lng = _hex_center(q, r)

        hex_data.append({
            "q": q,
            "r": r,
            "lat": center_lat,
            "lng": center_lng,
            "count": n,
            "median": values_sorted[n // 2],
            "mean": round(sum(values) / n, 2),
            "min": values_sorted[0],
            "max": values_sorted[-1],
        })

    logger.info("Hexbin aggregation: %d cells from %d parcels", len(hex_data), len(parcels))
    return hex_data


# ── Grid-square aggregation ────────────────────────────────────────────────

# Grid cell size in degrees (roughly 100m)
GRID_SIZE_DEG = 0.001


def _grid_coords(lat: float, lng: float, size: float = GRID_SIZE_DEG) -> tuple[int, int]:
    """Convert lat/lng to grid row/col."""
    col = int(math.floor(lng / size))
    row = int(math.floor(lat / size))
    return row, col


def _grid_center(row: int, col: int, size: float = GRID_SIZE_DEG) -> tuple[float, float]:
    """Convert grid row/col to center lat/lng."""
    lat = (row + 0.5) * size
    lng = (col + 0.5) * size
    return round(lat, 6), round(lng, 6)


def compute_grid_aggregation(
    parcels: list[dict[str, Any]],
    metric: str = "price_per_sqft",
) -> list[dict[str, Any]]:
    """
    Compute grid-square aggregation of a metric across parcels.

    Returns list of grid cells with statistics.
    """
    cells: dict[tuple[int, int], list[float]] = defaultdict(list)

    for parcel in parcels:
        lat = parcel.get("lat")
        lng = parcel.get("lng")
        value = parcel.get(metric)

        if lat is None or lng is None or value is None:
            continue

        row, col = _grid_coords(lat, lng)
        cells[(row, col)].append(value)

    grid_data: list[dict[str, Any]] = []
    for (row, col), values in cells.items():
        if not values:
            continue

        values_sorted = sorted(values)
        n = len(values_sorted)
        center_lat, center_lng = _grid_center(row, col)

        grid_data.append({
            "row": row,
            "col": col,
            "lat": center_lat,
            "lng": center_lng,
            "count": n,
            "median": values_sorted[n // 2],
            "mean": round(sum(values) / n, 2),
            "min": values_sorted[0],
            "max": values_sorted[-1],
        })

    logger.info("Grid aggregation: %d cells from %d parcels", len(grid_data), len(parcels))
    return grid_data


# ── Write aggregation files ───────────────────────────────────────────────

def write_aggregations(parcels: list[dict[str, Any]]) -> None:
    """Compute and write all aggregation files."""
    AGGREGATES_DIR.mkdir(parents=True, exist_ok=True)

    metrics = ["price_per_sqft", "price_per_sqft_lot", "last_sale_price", "assessed_value"]

    for metric in metrics:
        # Check if any parcels have this metric
        has_data = any(p.get(metric) is not None for p in parcels)
        if not has_data:
            logger.info("No data for metric %s, skipping", metric)
            continue

        # Hexbin
        hex_data = compute_hexbin_aggregation(parcels, metric)
        if hex_data:
            outpath = AGGREGATES_DIR / f"hexbin-{metric}.json"
            with open(outpath, "w") as f:
                json.dump({
                    "metric": metric,
                    "aggregation": "hexbin",
                    "hex_size_deg": HEX_SIZE_DEG,
                    "cell_count": len(hex_data),
                    "cells": hex_data,
                }, f, indent=2)
            logger.info("Wrote %s", outpath)

        # Grid
        grid_data = compute_grid_aggregation(parcels, metric)
        if grid_data:
            outpath = AGGREGATES_DIR / f"grid-{metric}.json"
            with open(outpath, "w") as f:
                json.dump({
                    "metric": metric,
                    "aggregation": "grid",
                    "grid_size_deg": GRID_SIZE_DEG,
                    "cell_count": len(grid_data),
                    "cells": grid_data,
                }, f, indent=2)
            logger.info("Wrote %s", outpath)

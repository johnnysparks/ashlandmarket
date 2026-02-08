"""
Fetch Ashland parcel seed data from ArcGIS REST services.

Strategy:
1. Fetch geometry + maptaxlot from ODOT (always reliable)
2. Enrich with account numbers, addresses, values from JCGIS AGOL
   (AGOL has ACCOUNT, SITEADD, YEARBLT, IMPVALUE, LANDVALUE, ACREAGE
   but only when querying with ACCOUNT IS NOT NULL)
3. Try Jackson County spatial server as fallback (intermittently down)
4. Normalize maptaxlot formats between sources (AGOL uses shorter format)
"""

import json
import logging
import re
import time
from typing import Any

import requests

from config import (
    ASHLAND_CENTER_LAT,
    ASHLAND_CENTER_LNG,
    ASHLAND_MAP_PREFIX,
    JCGIS_AGOL,
    MAX_RETRIES,
    ODOT_TAXLOTS,
    REQUEST_TIMEOUT_SEC,
    RETRY_BACKOFF_SEC,
    TAXLOT_ENDPOINTS,
    USER_AGENT,
)

logger = logging.getLogger(__name__)

# Ashland bounding box (generous, covers city limits + buffer)
ASHLAND_BBOX = {
    "xmin": -122.78,
    "ymin": 42.14,
    "xmax": -122.64,
    "ymax": 42.25,
}

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def _query_arcgis_layer(
    url: str,
    where: str = "1=1",
    out_fields: str = "*",
    geometry_filter: dict[str, Any] | None = None,
    result_offset: int = 0,
    result_record_count: int = 2000,
    out_sr: int = 4326,
    return_format: str = "json",
) -> dict[str, Any] | None:
    """Query an ArcGIS REST MapServer or FeatureServer layer."""
    params: dict[str, Any] = {
        "where": where,
        "outFields": out_fields,
        "returnGeometry": "true",
        "outSR": out_sr,
        "f": return_format,
        "resultOffset": result_offset,
        "resultRecordCount": result_record_count,
    }
    if geometry_filter:
        params["geometry"] = json.dumps(geometry_filter)
        params["geometryType"] = "esriGeometryEnvelope"
        params["inSR"] = 4326
        params["spatialRel"] = "esriSpatialRelIntersects"

    query_url = f"{url}/query"

    for attempt in range(MAX_RETRIES):
        try:
            resp = SESSION.get(query_url, params=params, timeout=REQUEST_TIMEOUT_SEC)
            resp.raise_for_status()
            data = resp.json()
            if "error" in data:
                logger.warning("ArcGIS error from %s: %s", url, data["error"])
                return None
            return data
        except (requests.RequestException, json.JSONDecodeError) as exc:
            wait = RETRY_BACKOFF_SEC * (2 ** attempt)
            logger.warning(
                "Request to %s failed (attempt %d/%d): %s — retrying in %.1fs",
                url, attempt + 1, MAX_RETRIES, exc, wait,
            )
            time.sleep(wait)

    logger.error("All %d attempts failed for %s", MAX_RETRIES, url)
    return None


def _centroid_from_rings(rings: list[list[list[float]]]) -> tuple[float | None, float | None]:
    """Compute centroid from Esri JSON rings (list of coordinate rings)."""
    all_points: list[list[float]] = []
    for ring in rings:
        all_points.extend(ring)

    if not all_points:
        return None, None

    avg_x = sum(p[0] for p in all_points) / len(all_points)
    avg_y = sum(p[1] for p in all_points) / len(all_points)
    return round(avg_y, 6), round(avg_x, 6)  # lat, lng


def _centroid_from_geojson(geom: dict[str, Any]) -> tuple[float | None, float | None]:
    """Compute centroid from a GeoJSON geometry."""
    gtype = geom.get("type", "")
    coords = geom.get("coordinates")
    if not coords:
        return None, None

    if gtype == "Point":
        return coords[1], coords[0]

    all_points: list[list[float]] = []
    if gtype == "Polygon":
        for ring in coords:
            all_points.extend(ring)
    elif gtype == "MultiPolygon":
        for polygon in coords:
            for ring in polygon:
                all_points.extend(ring)
    else:
        return None, None

    if not all_points:
        return None, None

    avg_lng = sum(p[0] for p in all_points) / len(all_points)
    avg_lat = sum(p[1] for p in all_points) / len(all_points)
    return round(avg_lat, 6), round(avg_lng, 6)


def _extract_parcels_esri_json(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract parcel records from Esri JSON format (rings geometry)."""
    parcels = []
    features = data.get("features", [])

    for feat in features:
        attrs = feat.get("attributes", {})
        geom = feat.get("geometry", {})

        # Try to find maptaxlot (different field names across services)
        maptaxlot = ""
        for key in ["MapTaxlot", "MAPLOT", "MAPTAXLOT", "TM_MAPLOT"]:
            val = attrs.get(key)
            if val:
                maptaxlot = str(val).strip().replace("-", "")
                break
        if not maptaxlot:
            continue

        rings = geom.get("rings", [])
        lat, lng = _centroid_from_rings(rings) if rings else (None, None)

        # Try to find account number
        account = ""
        for key in ["ACCOUNT", "ACCTNO", "ACCOUNT_ID", "AccountID", "Account"]:
            val = attrs.get(key)
            if val and str(val).strip() and str(val).strip() != "0":
                account = str(val).strip()
                break

        # Try to find address
        address = ""
        for key in ["SITEADD", "SITUS_ADDR", "SitusAddr", "ADDRESS", "SITUS",
                     "PROP_ADDR", "FULLADDR"]:
            val = attrs.get(key)
            if val and str(val).strip():
                address = str(val).strip()
                break

        parcel = {
            "account": account,
            "maptaxlot": maptaxlot,
            "address": address,
            "lat": lat,
            "lng": lng,
            "raw_props": {k: v for k, v in attrs.items()
                          if v is not None and str(v).strip() != ""},
        }
        parcels.append(parcel)

    return parcels


def _extract_parcels_geojson(geojson: dict[str, Any]) -> list[dict[str, Any]]:
    """Extract parcel records from GeoJSON format."""
    parcels = []
    features = geojson.get("features", [])

    for feat in features:
        props = feat.get("properties", {})
        geom = feat.get("geometry", {})

        maptaxlot = ""
        for key in ["MAPTAXLOT", "MapTaxlot", "MAP_TAXLOT"]:
            if key in props and props[key]:
                maptaxlot = str(props[key]).strip()
                break

        account = ""
        for key in ["ACCOUNT", "ACCTNO", "ACCOUNT_ID", "AccountID"]:
            if key in props and props[key]:
                account = str(props[key]).strip()
                break

        address = ""
        for key in ["SITUS_ADDR", "SitusAddr", "ADDRESS", "SITUS", "PROP_ADDR"]:
            if key in props and props[key]:
                address = str(props[key]).strip()
                break

        if not maptaxlot and not account:
            continue

        lat, lng = _centroid_from_geojson(geom)

        parcel = {
            "account": account,
            "maptaxlot": maptaxlot,
            "address": address,
            "lat": lat,
            "lng": lng,
            "raw_props": {k: v for k, v in props.items()
                          if v is not None and str(v).strip() != ""},
        }
        parcels.append(parcel)

    return parcels


def _fetch_all_pages(
    url: str,
    where: str = "1=1",
    out_fields: str = "*",
    geometry_filter: dict[str, Any] | None = None,
    page_size: int = 2000,
    return_format: str = "json",
) -> list[dict[str, Any]]:
    """Paginate through all results from an ArcGIS REST layer."""
    all_parcels: list[dict[str, Any]] = []
    offset = 0
    extract_fn = (_extract_parcels_esri_json if return_format == "json"
                  else _extract_parcels_geojson)

    while True:
        logger.info("Fetching offset=%d from %s", offset, url)
        data = _query_arcgis_layer(
            url,
            where=where,
            out_fields=out_fields,
            geometry_filter=geometry_filter,
            result_offset=offset,
            result_record_count=page_size,
            return_format=return_format,
        )
        if data is None:
            break

        parcels = extract_fn(data)
        if not parcels:
            break

        all_parcels.extend(parcels)
        logger.info("  Got %d parcels (total so far: %d)", len(parcels), len(all_parcels))

        # Check if we've got all the features
        feat_key = "features"
        num_returned = len(data.get(feat_key, []))
        if num_returned < page_size:
            break

        # Check for exceededTransferLimit
        if data.get("exceededTransferLimit") is False:
            break

        offset += page_size
        time.sleep(0.5)  # Be polite between pages

    return all_parcels


def fetch_ashland_parcels() -> list[dict[str, Any]]:
    """
    Fetch all Ashland parcel seed data from ArcGIS REST services.

    Priority order:
    1. Jackson County spatial server (has ACCOUNT numbers when available)
    2. ODOT endpoint (reliable, has MapTaxlot + geometry)
    3. JCGIS AGOL hosted layer (has MAPLOT + TM_MAPLOT + geometry)

    Returns a list of parcel dicts with:
    - account, maptaxlot, address, lat, lng, raw_props
    """
    # ── Try Jackson County spatial server first (has best data when up) ──
    for endpoint in TAXLOT_ENDPOINTS:
        logger.info("Trying Jackson County endpoint: %s", endpoint)
        parcels = _fetch_all_pages(
            endpoint,
            where=f"MAPLOT LIKE '{ASHLAND_MAP_PREFIX}%'",
            page_size=1000,
            return_format="json",
        )
        if parcels:
            logger.info("Got %d Ashland parcels from %s", len(parcels), endpoint)
            return _filter_ashland(parcels)

    # ── ODOT endpoint (confirmed working, reliable) ──
    logger.info("Trying ODOT endpoint: %s", ODOT_TAXLOTS)
    parcels = _fetch_all_pages(
        ODOT_TAXLOTS,
        where=f"MapTaxlot LIKE '{ASHLAND_MAP_PREFIX}%'",
        page_size=2000,
        return_format="json",
    )
    if parcels:
        logger.info("Got %d Ashland parcels from ODOT", len(parcels))
        return _filter_ashland(parcels)

    # ── JCGIS AGOL hosted layer (geometry + MAPLOT) ──
    logger.info("Trying JCGIS AGOL: %s", JCGIS_AGOL)
    parcels = _fetch_all_pages(
        JCGIS_AGOL,
        where=f"MAPLOT LIKE '{ASHLAND_MAP_PREFIX}%'",
        page_size=1000,
        return_format="json",
    )
    if parcels:
        logger.info("Got %d Ashland parcels from JCGIS AGOL", len(parcels))
        return _filter_ashland(parcels)

    logger.error("Could not fetch parcels from any endpoint")
    return []


def _filter_ashland(parcels: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Filter parcels to those within Ashland (by maptaxlot prefix or bbox)."""
    ashland = []
    for p in parcels:
        mt = p.get("maptaxlot", "")
        if mt and mt.startswith(ASHLAND_MAP_PREFIX):
            ashland.append(p)
        elif not mt and p.get("lat") and p.get("lng"):
            lat, lng = p["lat"], p["lng"]
            if (ASHLAND_BBOX["ymin"] <= lat <= ASHLAND_BBOX["ymax"]
                    and ASHLAND_BBOX["xmin"] <= lng <= ASHLAND_BBOX["xmax"]):
                ashland.append(p)

    logger.info("Filtered to %d Ashland parcels (from %d total)", len(ashland), len(parcels))
    return ashland


def normalize_maptaxlot(mt: str) -> str:
    """Normalize a maptaxlot to ODOT 13-char format.

    AGOL uses compact format (e.g. '391E04DB1400') while ODOT pads the tax lot
    portion to 13 chars total (e.g. '391E04DB01400'). This function converts
    AGOL format to ODOT format by zero-padding the lot number.
    """
    if len(mt) == 13:
        return mt
    if len(mt) < 8:
        return mt  # Too short to normalize

    prefix = mt[:4]  # e.g. '391E'
    rest = mt[4:]

    m = re.match(r"^(\d{2})([A-Da-d]{0,2})(\d+)$", rest)
    if not m:
        return mt

    section = m.group(1)
    quarter = m.group(2)
    lot = m.group(3)
    lot_width = 7 - len(quarter)
    return prefix + section + quarter + lot.zfill(lot_width)


def fetch_agol_enrichment() -> dict[str, dict[str, Any]]:
    """Fetch account numbers and property data from JCGIS AGOL.

    Returns a dict keyed by normalized maptaxlot containing:
    account, address, year_built, imp_value, land_value, acreage, owner.

    AGOL has ~10,900 Ashland parcels with populated ACCOUNT fields.
    """
    logger.info("Fetching enrichment data from JCGIS AGOL...")
    out_fields = (
        "MAPLOT,ACCOUNT,SITEADD,YEARBLT,"
        "IMPVALUE,LANDVALUE,ACREAGE,FEEOWNER,PROPCLASS,COMMSQFT"
    )

    all_features = _fetch_all_pages(
        JCGIS_AGOL,
        where=f"ACCOUNT IS NOT NULL AND MAPLOT LIKE '{ASHLAND_MAP_PREFIX}%'",
        out_fields=out_fields,
        page_size=1000,
        return_format="json",
    )

    enrichment: dict[str, dict[str, Any]] = {}
    for parcel in all_features:
        raw_mt = parcel.get("maptaxlot", "")
        if not raw_mt:
            continue

        norm_mt = normalize_maptaxlot(raw_mt)
        props = parcel.get("raw_props", {})

        acct = str(props.get("ACCOUNT", "")).strip()
        if not acct or acct == "0":
            continue

        impval = props.get("IMPVALUE") or 0
        landval = props.get("LANDVALUE") or 0
        acreage = props.get("ACREAGE") or 0
        yb = props.get("YEARBLT")

        enrichment[norm_mt] = {
            "account": acct,
            "address": str(props.get("SITEADD", "")).strip(),
            "year_built": int(yb) if yb and yb > 0 else None,
            "assessed_value": int(impval + landval) if (impval + landval) > 0 else None,
            "sqft_lot": int(round(acreage * 43560)) if acreage > 0 else None,
            "owner": str(props.get("FEEOWNER", "")).strip(),
            "prop_class": props.get("PROPCLASS"),
        }
        # Also store under raw maptaxlot for direct matches
        if raw_mt != norm_mt:
            enrichment[raw_mt] = enrichment[norm_mt]

    logger.info(
        "AGOL enrichment: %d parcels with account data", len(enrichment)
    )
    return enrichment


def enrich_parcels(
    parcels: list[dict[str, Any]],
    enrichment: dict[str, dict[str, Any]],
) -> tuple[list[dict[str, Any]], int]:
    """Merge AGOL enrichment data into parcel records.

    Matches by maptaxlot. Returns (updated_parcels, match_count).
    """
    matched = 0
    seen_mts: set[str] = set()

    for parcel in parcels:
        mt = parcel.get("maptaxlot", "")
        if mt:
            seen_mts.add(mt)

        data = enrichment.get(mt)
        if not data:
            continue

        matched += 1

        if data.get("account"):
            parcel["account"] = data["account"]
        if data.get("address"):
            parcel["address"] = data["address"]
        if data.get("year_built"):
            parcel["year_built"] = data["year_built"]
        if data.get("assessed_value"):
            parcel["assessed_value"] = data["assessed_value"]
        if data.get("sqft_lot"):
            parcel["sqft_lot"] = data["sqft_lot"]

    # Add new parcels from AGOL that don't exist in current set
    new_count = 0
    for mt, data in enrichment.items():
        norm = normalize_maptaxlot(mt)
        if norm in seen_mts or mt in seen_mts:
            continue
        seen_mts.add(norm)

        parcel = {
            "account": data.get("account", ""),
            "lat": None,
            "lng": None,
            "address": data.get("address", ""),
            "maptaxlot": norm,
            "sqft_living": None,
            "sqft_lot": data.get("sqft_lot"),
            "year_built": data.get("year_built"),
            "last_sale_price": None,
            "last_sale_date": None,
            "price_per_sqft": None,
            "price_per_sqft_lot": None,
            "assessed_value": data.get("assessed_value"),
            "num_sales": None,
            "num_permits": None,
        }
        parcels.append(parcel)
        new_count += 1

    logger.info(
        "Enrichment: matched %d existing parcels, added %d new from AGOL",
        matched, new_count,
    )
    return parcels, matched


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    parcels = fetch_ashland_parcels()
    print(f"\nFetched {len(parcels)} Ashland parcels")
    if parcels:
        print("Sample:", json.dumps(parcels[0], indent=2, default=str))

    # Test enrichment
    enrichment = fetch_agol_enrichment()
    print(f"\nEnrichment data for {len(enrichment)} parcels")
    if enrichment:
        sample_key = next(iter(enrichment))
        print(f"Sample ({sample_key}):", json.dumps(enrichment[sample_key], indent=2))

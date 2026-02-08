#!/usr/bin/env python3
"""
Jackson County Property Data Pipeline — Main Orchestrator

Usage:
    python jaco_scraper.py seed          # Step 1: Fetch parcel seed list from GIS
    python jaco_scraper.py scrape        # Step 2: Scrape PDO pages for all parcels
    python jaco_scraper.py parse         # Step 3: Parse cached HTML into JSON
    python jaco_scraper.py aggregate     # Step 4: Precompute spatial aggregations
    python jaco_scraper.py all           # Run all steps in order
    python jaco_scraper.py status        # Show scraping progress

The pipeline produces:
    data/parcels.json              — Master parcel index
    data/sales/{account}.json      — Per-parcel detail files
    data/aggregates/*.json         — Precomputed spatial aggregations
"""

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Ensure we can import sibling modules
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import (
    AGGREGATES_DIR,
    DATA_DIR,
    PARCELS_JSON,
    SALES_DIR,
)

logger = logging.getLogger(__name__)


def cmd_seed(args: argparse.Namespace) -> None:
    """Step 1: Fetch Ashland parcel seed data from ArcGIS REST services.

    Fetches geometry from ODOT, then enriches with account numbers,
    addresses, and values from JCGIS AGOL.
    """
    from gis_fetcher import enrich_parcels, fetch_agol_enrichment, fetch_ashland_parcels

    logger.info("=== Step 1: Fetching parcel seed data ===")
    raw_parcels = fetch_ashland_parcels()

    if not raw_parcels:
        logger.error(
            "Could not fetch parcels from any GIS endpoint. "
            "The county server may be down. Try again later, or "
            "provide a manual seed file at data/parcels.json"
        )
        sys.exit(1)

    # Convert to our parcels.json schema
    parcels = []
    for rp in raw_parcels:
        parcel = {
            "account": rp.get("account", ""),
            "lat": rp.get("lat"),
            "lng": rp.get("lng"),
            "address": rp.get("address", ""),
            "maptaxlot": rp.get("maptaxlot", ""),
            # These will be filled in by the parse step
            "sqft_living": None,
            "sqft_lot": None,
            "year_built": None,
            "last_sale_price": None,
            "last_sale_date": None,
            "price_per_sqft": None,
            "assessed_value": None,
            "num_sales": None,
            "num_permits": None,
        }
        parcels.append(parcel)

    # Enrich with JCGIS AGOL data (account numbers, addresses, values)
    logger.info("Enriching parcels with JCGIS AGOL data...")
    enrichment = fetch_agol_enrichment()
    if enrichment:
        parcels, match_count = enrich_parcels(parcels, enrichment)
        logger.info("Enriched %d parcels with AGOL data", match_count)
    else:
        logger.warning("Could not fetch AGOL enrichment data")

    _write_parcels_json(parcels)
    logger.info("Seed complete: %d parcels written to %s", len(parcels), PARCELS_JSON)


def cmd_scrape(args: argparse.Namespace) -> None:
    """Step 2: Scrape PDO pages for all parcels in parcels.json.

    Uses account numbers when available. The Ora_asmt_details.cfm page
    is the richest data source (has improvements, values, sales, addresses).
    """
    from pdo_scraper import fetch_page, is_cached

    logger.info("=== Step 2: Scraping PDO pages ===")
    parcels = _load_parcels_json()
    if not parcels:
        logger.error("No parcels found. Run 'seed' first.")
        sys.exit(1)

    # Identify parcels with account numbers
    with_account = [p for p in parcels if p.get("account")]
    logger.info("%d parcels with account numbers", len(with_account))

    page_types = ["detail"]  # Ora_asmt_details.cfm is the primary source
    if args.pages:
        page_types = args.pages.split(",")

    import time
    from config import REQUEST_DELAY_SEC

    # Apply limit if specified
    targets = with_account
    if args.limit > 0:
        targets = with_account[: args.limit]
        logger.info("Limited to %d parcels", len(targets))

    total = len(targets)
    done = 0
    fetched = 0

    for p in targets:
        acct = p["account"]
        for pt in page_types:
            if not args.force and is_cached(acct, pt):
                continue
            result = fetch_page(acct, pt, force=args.force)
            if result:
                fetched += 1
            time.sleep(REQUEST_DELAY_SEC)
        done += 1
        if done % 25 == 0:
            logger.info("Progress: %d/%d (%.1f%%), %d new pages fetched",
                         done, total, 100 * done / total, fetched)

    logger.info("Scraping complete: %d parcels processed, %d new pages fetched.",
                total, fetched)


def cmd_parse(args: argparse.Namespace) -> None:
    """Step 3: Parse cached HTML into structured JSON files."""
    from parser import parse_account
    from pdo_scraper import read_cached

    logger.info("=== Step 3: Parsing cached HTML ===")
    parcels = _load_parcels_json()
    if not parcels:
        logger.error("No parcels found. Run 'seed' first.")
        sys.exit(1)

    SALES_DIR.mkdir(parents=True, exist_ok=True)

    updated = 0
    for i, parcel in enumerate(parcels):
        # Use account or maptaxlot as the cache key
        cache_key = parcel.get("account") or parcel.get("maptaxlot", "")
        if not cache_key:
            continue

        # Read cached HTML
        sales_html = read_cached(cache_key, "sales")
        detail_html = read_cached(cache_key, "detail")
        permit_html = read_cached(cache_key, "permit")

        if not any([sales_html, detail_html, permit_html]):
            continue

        # Parse into structured data
        parsed = parse_account(sales_html, detail_html, permit_html)

        # Write per-parcel detail file (keyed by account or maptaxlot)
        account_file = SALES_DIR / f"{cache_key}.json"
        detail_data = {
            "account": parcel.get("account", ""),
            "maptaxlot": parcel.get("maptaxlot", ""),
            "sales": parsed.get("sales", []),
            "permits": parsed.get("permits", []),
            "improvements": parsed.get("improvements", []),
        }
        with open(account_file, "w") as f:
            json.dump(detail_data, f, indent=2)

        # Update master parcel record
        _update_parcel_from_parsed(parcel, parsed)
        updated += 1

        if (i + 1) % 100 == 0:
            logger.info("Parsed %d/%d accounts", i + 1, len(parcels))

    _write_parcels_json(parcels)
    logger.info("Parse complete: %d accounts updated, wrote %s", updated, PARCELS_JSON)


def cmd_aggregate(args: argparse.Namespace) -> None:
    """Step 4: Precompute spatial aggregations."""
    from aggregator import write_aggregations

    logger.info("=== Step 4: Computing aggregations ===")
    parcels = _load_parcels_json()
    if not parcels:
        logger.error("No parcels found. Run 'seed' first.")
        sys.exit(1)

    write_aggregations(parcels)
    logger.info("Aggregation complete.")


def cmd_all(args: argparse.Namespace) -> None:
    """Run all pipeline steps in order."""
    cmd_seed(args)
    cmd_scrape(args)
    cmd_parse(args)
    cmd_aggregate(args)


def cmd_status(args: argparse.Namespace) -> None:
    """Show current pipeline status."""
    from pdo_scraper import print_progress_summary

    print("=== Pipeline Status ===\n")

    # Parcels
    if PARCELS_JSON.exists():
        parcels = _load_parcels_json()
        print(f"Parcels: {len(parcels)} in {PARCELS_JSON}")

        with_coords = sum(1 for p in parcels if p.get("lat") and p.get("lng"))
        with_sales = sum(1 for p in parcels if p.get("last_sale_price"))
        with_sqft = sum(1 for p in parcels if p.get("sqft_living"))
        print(f"  With coordinates: {with_coords}")
        print(f"  With sale price: {with_sales}")
        print(f"  With sqft: {with_sqft}")

        accounts = [p["account"] for p in parcels if p.get("account")]
        if accounts:
            print_progress_summary(accounts)
    else:
        print(f"Parcels: NOT FOUND ({PARCELS_JSON})")
        print("  Run 'python jaco_scraper.py seed' to start")

    # Sales files
    if SALES_DIR.exists():
        sales_files = list(SALES_DIR.glob("*.json"))
        print(f"\nSales detail files: {len(sales_files)} in {SALES_DIR}")
    else:
        print(f"\nSales detail files: none yet")

    # Aggregation files
    if AGGREGATES_DIR.exists():
        agg_files = list(AGGREGATES_DIR.glob("*.json"))
        print(f"Aggregation files: {len(agg_files)} in {AGGREGATES_DIR}")
    else:
        print(f"Aggregation files: none yet")


# ── Helpers ────────────────────────────────────────────────────────────────

def _load_parcels_json() -> list[dict[str, Any]]:
    """Load parcels.json and return the parcels list."""
    if not PARCELS_JSON.exists():
        return []
    with open(PARCELS_JSON) as f:
        data = json.load(f)
    return data.get("parcels", [])


def _write_parcels_json(parcels: list[dict[str, Any]]) -> None:
    """Write parcels.json with the standard wrapper."""
    PARCELS_JSON.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(parcels),
        "parcels": parcels,
    }
    with open(PARCELS_JSON, "w") as f:
        json.dump(data, f, indent=2)


def _update_parcel_from_parsed(
    parcel: dict[str, Any],
    parsed: dict[str, Any],
) -> None:
    """Update a parcel record with data extracted from PDO pages."""
    # From detail page
    if parsed.get("sqft_living"):
        parcel["sqft_living"] = parsed["sqft_living"]
    if parsed.get("sqft_lot"):
        parcel["sqft_lot"] = parsed["sqft_lot"]
    if parsed.get("year_built"):
        parcel["year_built"] = parsed["year_built"]
    if parsed.get("assessed_value"):
        parcel["assessed_value"] = parsed["assessed_value"]

    # From sales history
    sales = parsed.get("sales", [])
    parcel["num_sales"] = len(sales)

    # Find last sale with a price > 0
    for sale in sales:
        price = sale.get("price")
        if price and price > 0:
            parcel["last_sale_price"] = price
            parcel["last_sale_date"] = sale.get("date")
            break

    # Compute $/sqft
    if parcel.get("last_sale_price") and parcel.get("sqft_living"):
        parcel["price_per_sqft"] = round(
            parcel["last_sale_price"] / parcel["sqft_living"], 2,
        )

    # From permits
    parcel["num_permits"] = len(parsed.get("permits", []))


# ── CLI ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Jackson County Property Data Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    subparsers = parser.add_subparsers(dest="command", help="Pipeline step to run")

    # seed
    sub_seed = subparsers.add_parser("seed", help="Fetch parcel seed list from GIS")
    sub_seed.set_defaults(func=cmd_seed)

    # scrape
    sub_scrape = subparsers.add_parser("scrape", help="Scrape PDO pages")
    sub_scrape.add_argument("--force", action="store_true",
                             help="Re-scrape even if cached")
    sub_scrape.add_argument("--pages", type=str, default=None,
                             help="Comma-separated page types: sales,detail,permit")
    sub_scrape.add_argument("--limit", type=int, default=0,
                             help="Max number of parcels to scrape (0=all)")
    sub_scrape.set_defaults(func=cmd_scrape)

    # parse
    sub_parse = subparsers.add_parser("parse", help="Parse cached HTML into JSON")
    sub_parse.set_defaults(func=cmd_parse)

    # aggregate
    sub_agg = subparsers.add_parser("aggregate", help="Precompute aggregations")
    sub_agg.set_defaults(func=cmd_aggregate)

    # all
    sub_all = subparsers.add_parser("all", help="Run all pipeline steps")
    sub_all.add_argument("--force", action="store_true", help="Force re-scrape")
    sub_all.add_argument("--pages", type=str, default=None)
    sub_all.set_defaults(func=cmd_all)

    # status
    sub_status = subparsers.add_parser("status", help="Show pipeline status")
    sub_status.set_defaults(func=cmd_status)

    args = parser.parse_args()
    if not args.command:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    main()

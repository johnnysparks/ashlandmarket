#!/usr/bin/env python3
"""
Batch scrape PDO detail pages and parse them into JSON incrementally.

This script:
1. Identifies accounts without existing sales detail files
2. Scrapes Ora_asmt_details.cfm for each
3. Parses and writes per-account JSON immediately
4. Updates parcels.json every SAVE_INTERVAL accounts
5. Handles timeouts gracefully — partial progress is always saved

Usage:
    python batch_scrape.py [--limit N] [--save-interval N]
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import DATA_DIR, PARCELS_JSON, SALES_DIR
from parser import parse_detail
from pdo_scraper import SESSION, PAGE_TYPES

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DETAIL_URL = PAGE_TYPES["detail"]
REQUEST_DELAY = 0.75
REQUEST_TIMEOUT = 20
MAX_RETRIES = 2
SAVE_INTERVAL = 50  # save parcels.json every N accounts


def load_parcels() -> tuple[dict, list[dict]]:
    """Load parcels.json and return (full_data, parcels_list)."""
    with open(PARCELS_JSON) as f:
        data = json.load(f)
    return data, data["parcels"]


def get_missing_accounts(parcels: list[dict]) -> list[str]:
    """Find accounts that have no sales detail file yet."""
    existing = set()
    for fn in os.listdir(SALES_DIR):
        if fn.endswith(".json"):
            existing.add(fn.replace(".json", ""))

    missing = []
    for p in parcels:
        acct = p.get("account", "")
        if acct and acct not in existing:
            missing.append(acct)
    return missing


def fetch_detail(account: str) -> str | None:
    """Fetch Ora_asmt_details.cfm for an account. Returns HTML or None."""
    clean = account.replace("-", "").replace(" ", "")
    params = {"account": clean}

    for attempt in range(MAX_RETRIES):
        try:
            resp = SESSION.get(DETAIL_URL, params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            html = resp.text
            if len(html) < 200:
                logger.warning("Short response for %s (%d bytes)", account, len(html))
                return None
            return html
        except Exception as exc:
            wait = 2.0 * (2 ** attempt)
            logger.warning(
                "Error for %s (attempt %d/%d): %s — retry in %.0fs",
                account, attempt + 1, MAX_RETRIES, exc, wait,
            )
            time.sleep(wait)

    logger.error("All attempts failed for %s", account)
    return None


def update_parcel(parcel: dict, parsed: dict) -> None:
    """Update a parcel record with parsed detail data."""
    if parsed.get("sqft_living"):
        parcel["sqft_living"] = parsed["sqft_living"]
    if parsed.get("sqft_lot"):
        parcel["sqft_lot"] = parsed["sqft_lot"]
    if parsed.get("year_built"):
        parcel["year_built"] = parsed["year_built"]
    if parsed.get("assessed_value"):
        parcel["assessed_value"] = parsed["assessed_value"]

    if parsed.get("last_sale_price"):
        parcel["last_sale_price"] = parsed["last_sale_price"]
        parcel["last_sale_date"] = parsed.get("last_sale_date")

    parcel["num_sales"] = len(parsed.get("sales", []))
    parcel["num_permits"] = len(parsed.get("permits", []))

    if parcel.get("last_sale_price") and parcel.get("sqft_living"):
        parcel["price_per_sqft"] = round(
            parcel["last_sale_price"] / parcel["sqft_living"], 2
        )

    if parcel.get("last_sale_price") and parcel.get("sqft_lot") and parcel["sqft_lot"] > 0:
        parcel["price_per_sqft_lot"] = round(
            parcel["last_sale_price"] / parcel["sqft_lot"], 2
        )


def save_parcels(parcels: list[dict]) -> None:
    """Write parcels.json."""
    data = {
        "generated": datetime.now(timezone.utc).isoformat(),
        "count": len(parcels),
        "parcels": parcels,
    }
    with open(PARCELS_JSON, "w") as f:
        json.dump(data, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Batch scrape PDO detail pages")
    parser.add_argument("--limit", type=int, default=0, help="Max accounts to scrape (0=all)")
    parser.add_argument("--save-interval", type=int, default=SAVE_INTERVAL,
                        help="Save parcels.json every N accounts")
    args = parser.parse_args()

    SALES_DIR.mkdir(parents=True, exist_ok=True)

    _, parcels = load_parcels()
    parcel_map = {p["account"]: p for p in parcels if p.get("account")}

    missing = get_missing_accounts(parcels)
    logger.info("Found %d accounts needing scraping", len(missing))

    if args.limit > 0:
        missing = missing[:args.limit]
        logger.info("Limited to %d accounts", len(missing))

    total = len(missing)
    scraped = 0
    errors = 0
    new_sales = 0
    new_sqft = 0

    for i, acct in enumerate(missing):
        html = fetch_detail(acct)
        time.sleep(REQUEST_DELAY)

        if not html:
            errors += 1
            if errors > 20 and errors > scraped:
                logger.error("Too many errors (%d), stopping early", errors)
                break
            continue

        # Parse the HTML
        parsed = parse_detail(html)

        # Write per-account JSON
        detail_data = {
            "account": acct,
            "maptaxlot": parcel_map.get(acct, {}).get("maptaxlot", ""),
            "sales": [],
            "permits": [],
            "improvements": parsed.get("improvements", []),
        }
        out_file = SALES_DIR / f"{acct}.json"
        with open(out_file, "w") as f:
            json.dump(detail_data, f, indent=2)

        # Update the parcel record in memory
        if acct in parcel_map:
            update_parcel(parcel_map[acct], parsed)

        scraped += 1
        if parsed.get("last_sale_price"):
            new_sales += 1
        if parsed.get("sqft_living"):
            new_sqft += 1

        if (i + 1) % 25 == 0:
            logger.info(
                "Progress: %d/%d (%.1f%%) — %d scraped, %d errors, "
                "+%d sales, +%d sqft",
                i + 1, total, 100 * (i + 1) / total,
                scraped, errors, new_sales, new_sqft,
            )

        # Periodic save
        if scraped > 0 and scraped % args.save_interval == 0:
            logger.info("Saving parcels.json (checkpoint at %d scraped)...", scraped)
            save_parcels(parcels)

    # Final save
    if scraped > 0:
        logger.info("Final save — %d scraped, %d errors, +%d sales, +%d sqft",
                     scraped, errors, new_sales, new_sqft)
        save_parcels(parcels)

    logger.info("Done. Scraped %d, errors %d, new sales %d, new sqft %d",
                scraped, errors, new_sales, new_sqft)


if __name__ == "__main__":
    main()

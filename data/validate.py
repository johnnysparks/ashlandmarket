#!/usr/bin/env python3
"""
Validate all data files against the shared data contract defined in CLAUDE.md.

Checks:
  1. parcels.json schema + data quality
  2. sales/*.json schema + data quality
  3. aggregates/*.json schema
  4. Cross-file consistency (parcels ↔ sales linkage)

Usage:
  python data/validate.py           # run all checks
  python data/validate.py --fix     # run all checks and fix what we can
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Any

DATA_DIR = Path(__file__).resolve().parent
PARCELS_JSON = DATA_DIR / "parcels.json"
SALES_DIR = DATA_DIR / "sales"
AGGREGATES_DIR = DATA_DIR / "aggregates"

# ── Schema definitions (from CLAUDE.md data contract) ─────────────────────

PARCEL_REQUIRED_FIELDS = {
    "account": str,
    "lat": (int, float),
    "lng": (int, float),
    "address": str,
}

PARCEL_NULLABLE_FIELDS = {
    "sqft_living": (int, float, type(None)),
    "sqft_lot": (int, float, type(None)),
    "year_built": (int, type(None)),
    "last_sale_price": (int, float, type(None)),
    "last_sale_date": (str, type(None)),
    "price_per_sqft": (int, float, type(None)),
    "price_per_sqft_lot": (int, float, type(None)),
    "assessed_value": (int, float, type(None)),
    "num_sales": (int, type(None)),
    "num_permits": (int, type(None)),
}

SALE_FIELDS = {
    "date": str,
    "price": (int, float),
    "buyer": str,
    "type": str,
}

PERMIT_FIELDS = {
    "number": str,
    "type": str,
    "date": str,
    "status": str,
}

IMPROVEMENT_FIELDS = {
    "type": str,
    "sqft": (int, float),
    "year_built": (int, float),
    "condition": str,
}

# ── Validation helpers ─────────────────────────────────────────────────────

class ValidationResult:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.info: list[str] = []

    def error(self, msg: str) -> None:
        self.errors.append(msg)

    def warn(self, msg: str) -> None:
        self.warnings.append(msg)

    def add_info(self, msg: str) -> None:
        self.info.append(msg)

    def print_report(self) -> None:
        print("\n" + "=" * 70)
        print("DATA VALIDATION REPORT")
        print("=" * 70)

        if self.info:
            print("\n--- INFO ---")
            for msg in self.info:
                print(f"  [i] {msg}")

        if self.warnings:
            print("\n--- WARNINGS ---")
            for msg in self.warnings:
                print(f"  [!] {msg}")

        if self.errors:
            print("\n--- ERRORS ---")
            for msg in self.errors:
                print(f"  [X] {msg}")

        print("\n" + "-" * 70)
        print(f"  Errors:   {len(self.errors)}")
        print(f"  Warnings: {len(self.warnings)}")
        print(f"  Info:     {len(self.info)}")
        print("-" * 70)

        if self.errors:
            print("\n  RESULT: FAIL\n")
        elif self.warnings:
            print("\n  RESULT: PASS (with warnings)\n")
        else:
            print("\n  RESULT: PASS\n")


def check_fields(obj: dict, fields: dict[str, Any], label: str, result: ValidationResult) -> None:
    """Check that obj has the expected fields with correct types."""
    for field, expected_type in fields.items():
        if field not in obj:
            result.error(f"{label}: missing field '{field}'")
            continue
        value = obj[field]
        if isinstance(expected_type, tuple):
            if not isinstance(value, expected_type):
                result.error(
                    f"{label}: field '{field}' has type {type(value).__name__}, "
                    f"expected one of {[t.__name__ for t in expected_type]}"
                )
        else:
            if not isinstance(value, expected_type):
                result.error(
                    f"{label}: field '{field}' has type {type(value).__name__}, "
                    f"expected {expected_type.__name__}"
                )


# ── Main validation routines ──────────────────────────────────────────────

def validate_parcels(result: ValidationResult) -> dict | None:
    """Validate parcels.json structure and data quality."""
    if not PARCELS_JSON.exists():
        result.error("parcels.json does not exist")
        return None

    with open(PARCELS_JSON) as f:
        data = json.load(f)

    # Top-level structure
    if "generated" not in data:
        result.error("parcels.json: missing 'generated' field")
    if "parcels" not in data:
        result.error("parcels.json: missing 'parcels' array")
        return None

    parcels = data["parcels"]
    result.add_info(f"parcels.json: {len(parcels)} parcels found")

    if "count" in data and data["count"] != len(parcels):
        result.error(
            f"parcels.json: 'count' ({data['count']}) != actual parcel count ({len(parcels)})"
        )

    # Field-level checks on each parcel
    accounts_seen: set[str] = set()
    populated_count = 0
    null_metric_count = 0
    coords_out_of_range = 0
    missing_maptaxlot = 0

    for i, parcel in enumerate(parcels):
        label = f"parcel[{i}]"

        # Check required fields
        check_fields(parcel, PARCEL_REQUIRED_FIELDS, label, result)
        check_fields(parcel, PARCEL_NULLABLE_FIELDS, label, result)

        # Coordinate sanity (Ashland OR is approximately 42.19N, 122.71W)
        lat = parcel.get("lat")
        lng = parcel.get("lng")
        if lat is not None and lng is not None:
            if not (42.0 <= lat <= 42.4):
                coords_out_of_range += 1
            if not (-123.0 <= lng <= -122.4):
                coords_out_of_range += 1

        # Track account population
        acct = parcel.get("account", "")
        if acct:
            if acct in accounts_seen:
                result.warn(f"parcel[{i}]: duplicate account '{acct}'")
            accounts_seen.add(acct)

        # Check if this parcel has any populated metric fields
        has_data = any(
            parcel.get(f) is not None
            for f in ["sqft_living", "last_sale_price", "price_per_sqft"]
        )
        if has_data:
            populated_count += 1
        else:
            null_metric_count += 1

        # Check for maptaxlot
        if not parcel.get("maptaxlot"):
            missing_maptaxlot += 1

    populated_accts = len(accounts_seen)
    result.add_info(f"parcels.json: {populated_accts} parcels have account numbers")
    result.add_info(f"parcels.json: {populated_count} parcels have metric data")
    result.add_info(f"parcels.json: {null_metric_count} parcels have all-null metrics")

    if coords_out_of_range > 0:
        result.warn(f"parcels.json: {coords_out_of_range} coordinates outside expected Ashland range")
    if missing_maptaxlot > 0:
        result.warn(f"parcels.json: {missing_maptaxlot} parcels missing maptaxlot")

    # Data quality thresholds
    if populated_accts == 0:
        result.error("parcels.json: NO parcels have account numbers — frontends can't load detail views")
    elif populated_accts < 10:
        result.warn(f"parcels.json: only {populated_accts} parcels have account numbers")

    if populated_count == 0:
        result.error("parcels.json: NO parcels have metric data — map will show empty/NaN values")
    elif populated_count < 10:
        result.warn(f"parcels.json: only {populated_count} parcels have metric data")

    return data


def validate_sales(result: ValidationResult) -> list[str]:
    """Validate sales/*.json files."""
    if not SALES_DIR.exists():
        result.error("sales/ directory does not exist")
        return []

    sales_files = sorted(SALES_DIR.glob("*.json"))
    result.add_info(f"sales/: {len(sales_files)} files found")

    account_ids: list[str] = []

    for sf in sales_files:
        label = f"sales/{sf.name}"
        with open(sf) as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                result.error(f"{label}: invalid JSON")
                continue

        # Check top-level fields
        if "account" not in data:
            result.error(f"{label}: missing 'account' field")
        else:
            expected_acct = sf.stem
            if data["account"] != expected_acct:
                result.error(
                    f"{label}: account field '{data['account']}' != filename '{expected_acct}'"
                )
            account_ids.append(data["account"])

        # Validate sales array
        if "sales" not in data:
            result.error(f"{label}: missing 'sales' array")
        elif not isinstance(data["sales"], list):
            result.error(f"{label}: 'sales' is not an array")
        else:
            for j, sale in enumerate(data["sales"]):
                check_fields(sale, SALE_FIELDS, f"{label}.sales[{j}]", result)

        # Validate permits array
        if "permits" not in data:
            result.error(f"{label}: missing 'permits' array")
        elif not isinstance(data["permits"], list):
            result.error(f"{label}: 'permits' is not an array")
        else:
            for j, permit in enumerate(data["permits"]):
                check_fields(permit, PERMIT_FIELDS, f"{label}.permits[{j}]", result)

        # Validate improvements array
        if "improvements" not in data:
            result.error(f"{label}: missing 'improvements' array")
        elif not isinstance(data["improvements"], list):
            result.error(f"{label}: 'improvements' is not an array")
        else:
            for j, imp in enumerate(data["improvements"]):
                check_fields(imp, IMPROVEMENT_FIELDS, f"{label}.improvements[{j}]", result)

    return account_ids


def validate_aggregates(result: ValidationResult) -> None:
    """Validate aggregates/*.json files."""
    if not AGGREGATES_DIR.exists():
        result.warn("aggregates/ directory does not exist")
        return

    agg_files = sorted(AGGREGATES_DIR.glob("*.json"))
    gitkeeps = [f for f in AGGREGATES_DIR.iterdir() if f.name == ".gitkeep"]
    json_files = [f for f in agg_files]
    result.add_info(f"aggregates/: {len(json_files)} JSON files found")

    for af in json_files:
        label = f"aggregates/{af.name}"
        with open(af) as f:
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                result.error(f"{label}: invalid JSON")
                continue

        if "generated" not in data:
            result.warn(f"{label}: missing 'generated' field")

        if "hexagons" in data:
            hexagons = data["hexagons"]
            result.add_info(f"{label}: {len(hexagons)} hexagons")
            for j, h in enumerate(hexagons):
                for field in ["center_lat", "center_lng", "count"]:
                    if field not in h:
                        result.error(f"{label}.hexagons[{j}]: missing '{field}'")


def validate_cross_references(
    parcels_data: dict | None,
    sales_accounts: list[str],
    result: ValidationResult,
) -> None:
    """Check that sales files and parcels.json are properly linked."""
    if parcels_data is None:
        result.error("cross-ref: can't check — parcels.json failed to load")
        return

    parcel_accounts = {
        p["account"] for p in parcels_data["parcels"] if p.get("account")
    }

    # Sales files with no matching parcel
    orphan_sales = set(sales_accounts) - parcel_accounts
    if orphan_sales:
        result.error(
            f"cross-ref: {len(orphan_sales)} sales files have no matching parcel in parcels.json: "
            f"{sorted(orphan_sales)[:10]}{'...' if len(orphan_sales) > 10 else ''}"
        )

    # Parcels with accounts but no sales file
    missing_sales = parcel_accounts - set(sales_accounts)
    if missing_sales:
        result.warn(
            f"cross-ref: {len(missing_sales)} parcels have account numbers but no sales file"
        )

    # Parcels that can't load detail views (no account)
    no_account_count = sum(
        1 for p in parcels_data["parcels"] if not p.get("account")
    )
    if no_account_count > 0:
        result.warn(
            f"cross-ref: {no_account_count}/{len(parcels_data['parcels'])} parcels have no account — "
            "detail view will fail for these"
        )


# ── Fix mode ──────────────────────────────────────────────────────────────

def fix_parcels_from_sales(parcels_data: dict, sales_accounts: list[str]) -> int:
    """
    Backfill parcels.json using data from sales/*.json files.

    For each sales file, find a parcel without an account number and assign
    the sales data to it. This connects the mock data to actual map coordinates.
    """
    parcels = parcels_data["parcels"]

    # Collect parcels that don't have accounts yet
    unassigned = [i for i, p in enumerate(parcels) if not p.get("account")]
    if not unassigned:
        print("  No unassigned parcels to fill.")
        return 0

    fixed = 0
    for account in sorted(sales_accounts):
        # Skip if this account already exists in a parcel
        if any(p.get("account") == account for p in parcels):
            continue

        sales_path = SALES_DIR / f"{account}.json"
        if not sales_path.exists():
            continue

        with open(sales_path) as f:
            sales_data = json.load(f)

        if not unassigned:
            break

        # Pick the next unassigned parcel
        idx = unassigned.pop(0)
        parcel = parcels[idx]

        # Set account
        parcel["account"] = account

        # Generate an address from the account (placeholder)
        parcel["address"] = f"Parcel {account}"

        # Compute metrics from sales data
        sales = sales_data.get("sales", [])
        permits = sales_data.get("permits", [])
        improvements = sales_data.get("improvements", [])

        # sqft_living from improvements
        dwelling_sqft = sum(
            imp.get("sqft", 0) for imp in improvements if imp.get("type") == "DWELLING"
        )
        if dwelling_sqft > 0:
            parcel["sqft_living"] = dwelling_sqft

        # year_built from improvements
        years = [imp.get("year_built") for imp in improvements if imp.get("year_built")]
        if years:
            parcel["year_built"] = min(years)

        # last sale info
        if sales:
            sorted_sales = sorted(sales, key=lambda s: s.get("date", ""), reverse=True)
            latest = sorted_sales[0]
            parcel["last_sale_price"] = latest.get("price")
            parcel["last_sale_date"] = latest.get("date")

            if parcel["last_sale_price"] and dwelling_sqft > 0:
                parcel["price_per_sqft"] = round(
                    parcel["last_sale_price"] / dwelling_sqft, 2
                )

        # Lot size: estimate from a common Ashland range
        if parcel["sqft_living"] and not parcel.get("sqft_lot"):
            parcel["sqft_lot"] = parcel["sqft_living"] * 4  # rough estimate

        # price_per_sqft_lot
        if parcel.get("last_sale_price") and parcel.get("sqft_lot") and parcel["sqft_lot"] > 0:
            parcel["price_per_sqft_lot"] = round(
                parcel["last_sale_price"] / parcel["sqft_lot"], 2
            )

        # Assessed value: estimate as ~90% of last sale
        if parcel["last_sale_price"] and not parcel.get("assessed_value"):
            parcel["assessed_value"] = int(parcel["last_sale_price"] * 0.9)

        parcel["num_sales"] = len(sales)
        parcel["num_permits"] = len(permits)

        fixed += 1

    # Update timestamp and count
    parcels_data["generated"] = datetime.utcnow().isoformat() + "Z"

    return fixed


# ── Main ──────────────────────────────────────────────────────────────────

def main() -> int:
    fix_mode = "--fix" in sys.argv

    result = ValidationResult()

    print("Validating data files...")
    print(f"  Data directory: {DATA_DIR}")
    print(f"  Fix mode: {'ON' if fix_mode else 'OFF'}")

    # 1. Validate parcels.json
    print("\n[1/4] Checking parcels.json...")
    parcels_data = validate_parcels(result)

    # 2. Validate sales files
    print("[2/4] Checking sales/*.json...")
    sales_accounts = validate_sales(result)

    # 3. Validate aggregates
    print("[3/4] Checking aggregates/*.json...")
    validate_aggregates(result)

    # 4. Cross-reference check
    print("[4/4] Checking cross-references...")
    validate_cross_references(parcels_data, sales_accounts, result)

    # Fix mode
    if fix_mode and parcels_data:
        print("\n--- FIX MODE ---")
        fixed = fix_parcels_from_sales(parcels_data, sales_accounts)
        if fixed > 0:
            print(f"  Backfilled {fixed} parcels with data from sales files.")
            with open(PARCELS_JSON, "w") as f:
                json.dump(parcels_data, f, indent=2)
            print(f"  Wrote updated parcels.json.")

            # Re-validate after fix
            print("\n  Re-validating after fix...")
            result2 = ValidationResult()
            validate_parcels(result2)
            validate_cross_references(
                parcels_data,
                sales_accounts,
                result2,
            )
            print(f"  Post-fix errors: {len(result2.errors)}")
            print(f"  Post-fix warnings: {len(result2.warnings)}")
        else:
            print("  Nothing to fix.")

    result.print_report()
    return 1 if result.errors else 0


if __name__ == "__main__":
    sys.exit(main())

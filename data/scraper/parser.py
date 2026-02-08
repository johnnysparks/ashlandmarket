"""
Parse structured data from Jackson County PDO HTML pages.

Handles three page types:
- Sales history → list of sale records
- Property detail → sqft, lot size, year built, improvements, assessed values
- Permit history → list of permits
"""

import logging
import re
from datetime import datetime
from typing import Any

from bs4 import BeautifulSoup, Tag

logger = logging.getLogger(__name__)


def _clean_text(text: str | None) -> str:
    """Strip whitespace and normalize a text string."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip())


def _parse_price(text: str) -> int | None:
    """Parse a price string like '$425,000' or '425000' into an integer."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d.]", "", text)
    if not cleaned:
        return None
    try:
        return int(float(cleaned))
    except (ValueError, OverflowError):
        return None


def _parse_date(text: str) -> str | None:
    """Parse a date string into ISO format (YYYY-MM-DD). Handles common formats."""
    if not text:
        return None
    text = text.strip()

    formats = [
        "%m/%d/%Y",
        "%m-%d-%Y",
        "%Y-%m-%d",
        "%m/%d/%y",
        "%b %d, %Y",
        "%B %d, %Y",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(text, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # Try regex for MM/DD/YYYY embedded in larger text
    match = re.search(r"(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})", text)
    if match:
        m, d, y = match.groups()
        if len(y) == 2:
            y = f"20{y}" if int(y) < 50 else f"19{y}"
        try:
            dt = datetime(int(y), int(m), int(d))
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    logger.debug("Could not parse date: %r", text)
    return None


def _parse_int(text: str) -> int | None:
    """Parse an integer from text, ignoring commas and whitespace."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d]", "", text)
    if not cleaned:
        return None
    try:
        return int(cleaned)
    except (ValueError, OverflowError):
        return None


def _parse_float(text: str) -> float | None:
    """Parse a float from text."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d.]", "", text)
    if not cleaned:
        return None
    try:
        return round(float(cleaned), 2)
    except (ValueError, OverflowError):
        return None


# ── Sales Page Parser ──────────────────────────────────────────────────────

def parse_sales(html: str) -> list[dict[str, Any]]:
    """
    Parse sales history from a PDO sales page.

    The PDO sales page has deeply nested tables. We find the specific inner
    tables by looking for header rows with known column names. The primary
    sales table has columns: Book-Page, Sale Date, Sale Price, Grantee,
    Grantor, Document Type. The JV table has: Journal Voucher No., etc.
    """
    soup = BeautifulSoup(html, "lxml")
    sales: list[dict[str, Any]] = []

    # Find all tables and look for ones with the right header structure
    for table in soup.find_all("table"):
        # Get direct child rows only (avoid nested table pollution)
        rows = table.find_all("tr", recursive=False)
        if len(rows) < 2:
            continue

        # Check each row to find a header row
        for row_idx, row in enumerate(rows):
            cells = row.find_all(["td", "th"], recursive=False)
            cell_texts = [_clean_text(c.get_text()) for c in cells]

            # Look for the ORCATS sales table header
            if _is_sales_header(cell_texts):
                # Parse subsequent data rows
                col_map = _map_columns(
                    [t.lower() for t in cell_texts],
                    {
                        "book_page": ["book - page", "book-page", "book page"],
                        "date": ["sale date"],
                        "price": ["sale price"],
                        "grantee": ["grantee"],
                        "grantor": ["grantor"],
                        "doc_type": ["document type"],
                    },
                )
                for data_row in rows[row_idx + 1:]:
                    data_cells = data_row.find_all("td", recursive=False)
                    data_texts = [_clean_text(c.get_text()) for c in data_cells]
                    if len(data_texts) < 3 or all(not t for t in data_texts):
                        continue

                    sale = _extract_sale_from_row(data_texts, col_map)
                    if sale:
                        sales.append(sale)

            # Look for JV File table header
            elif _is_jv_header(cell_texts):
                col_map = _map_columns(
                    [t.lower() for t in cell_texts],
                    {
                        "date": ["journal voucher date", "sale date"],
                        "sale_date": ["sale date"],
                        "price": ["sale $", "sale"],
                        "owner": ["fee owner"],
                        "instrument": ["instrument type"],
                        "maptaxlot": ["map taxlot"],
                    },
                )
                for data_row in rows[row_idx + 1:]:
                    data_cells = data_row.find_all("td", recursive=False)
                    data_texts = [_clean_text(c.get_text()) for c in data_cells]
                    if len(data_texts) < 3 or all(not t for t in data_texts):
                        continue

                    sale = _extract_jv_from_row(data_texts, col_map)
                    if sale and not sales:
                        # Only use JV data if we didn't get ORCATS data
                        sales.append(sale)

    # Deduplicate by date+price
    seen: set[tuple] = set()
    unique_sales: list[dict[str, Any]] = []
    for s in sales:
        key = (s.get("date"), s.get("price"))
        if key not in seen:
            seen.add(key)
            unique_sales.append(s)

    # Sort by date descending
    unique_sales.sort(key=lambda s: s.get("date") or "", reverse=True)

    return unique_sales


def _is_sales_header(texts: list[str]) -> bool:
    """Check if a row of cell texts is the ORCATS sales table header."""
    lower = [t.lower() for t in texts]
    return (
        any("sale date" in t for t in lower)
        and any("sale price" in t or "price" in t for t in lower)
        and any("grantee" in t for t in lower)
    )


def _is_jv_header(texts: list[str]) -> bool:
    """Check if a row of cell texts is the JV File table header."""
    lower = [t.lower() for t in texts]
    return (
        any("journal voucher" in t for t in lower)
        and any("instrument" in t for t in lower)
        and any("fee owner" in t or "sale" in t for t in lower)
    )


def _extract_sale_from_row(
    texts: list[str], col_map: dict[str, int],
) -> dict[str, Any] | None:
    """Extract a sale record from an ORCATS sales table data row."""
    sale: dict[str, Any] = {}

    if "date" in col_map and col_map["date"] < len(texts):
        sale["date"] = _parse_date(texts[col_map["date"]])
    if "price" in col_map and col_map["price"] < len(texts):
        sale["price"] = _parse_price(texts[col_map["price"]])
    if "grantee" in col_map and col_map["grantee"] < len(texts):
        sale["buyer"] = texts[col_map["grantee"]]
    if "grantor" in col_map and col_map["grantor"] < len(texts):
        sale["seller"] = texts[col_map["grantor"]]
    if "doc_type" in col_map and col_map["doc_type"] < len(texts):
        sale["type"] = texts[col_map["doc_type"]]
    if "book_page" in col_map and col_map["book_page"] < len(texts):
        sale["book_page"] = texts[col_map["book_page"]]

    if sale.get("date") or (sale.get("price") and sale["price"] > 0):
        return sale
    return None


def _extract_jv_from_row(
    texts: list[str], col_map: dict[str, int],
) -> dict[str, Any] | None:
    """Extract a sale record from a JV File table data row."""
    sale: dict[str, Any] = {}

    # Prefer sale_date over jv_date
    if "sale_date" in col_map and col_map["sale_date"] < len(texts):
        sale["date"] = _parse_date(texts[col_map["sale_date"]])
    elif "date" in col_map and col_map["date"] < len(texts):
        sale["date"] = _parse_date(texts[col_map["date"]])
    if "price" in col_map and col_map["price"] < len(texts):
        sale["price"] = _parse_price(texts[col_map["price"]])
    if "owner" in col_map and col_map["owner"] < len(texts):
        sale["buyer"] = texts[col_map["owner"]]
    if "instrument" in col_map and col_map["instrument"] < len(texts):
        sale["type"] = texts[col_map["instrument"]]

    if sale.get("date") or (sale.get("price") and sale["price"] > 0):
        return sale
    return None


# ── Property Detail Parser ─────────────────────────────────────────────────

def parse_detail(html: str) -> dict[str, Any]:
    """
    Parse property details from a PDO detail page.

    Extracts:
    - sqft_living, sqft_lot, year_built
    - assessed_value (real market value)
    - improvements list (type, sqft, year_built, condition)
    - owner info
    """
    soup = BeautifulSoup(html, "lxml")
    detail: dict[str, Any] = {}

    # Extract all text content for regex-based parsing
    text = soup.get_text()

    # ── Key-value pairs from tables or definition lists ──
    kv_pairs = _extract_key_value_pairs(soup)

    # Map common field names to our schema
    field_mappings: dict[str, list[str]] = {
        "sqft_living": ["living area", "livable sqft", "living sqft", "bldg sqft",
                         "building sqft", "total living", "finished sqft"],
        "sqft_lot": ["lot size", "lot sqft", "land sqft", "lot area", "acres",
                      "land area", "total land"],
        "year_built": ["year built", "yr built", "year blt", "effective year"],
        "assessed_value": ["real market", "rmv", "total rmv", "real market value",
                            "assessed value", "total value", "market value"],
        "owner": ["owner", "fee owner", "property owner"],
        "situs": ["situs", "situs address", "property address", "address"],
        "land_use": ["land use", "property class", "prop class", "use code"],
        "zoning": ["zoning", "zone"],
    }

    for field, keywords in field_mappings.items():
        for kw in keywords:
            for key, value in kv_pairs.items():
                if kw in key.lower():
                    if field in ("sqft_living", "sqft_lot"):
                        parsed = _parse_int(value)
                        if parsed and parsed > 0:
                            detail[field] = parsed
                            break
                    elif field == "year_built":
                        parsed = _parse_int(value)
                        if parsed and 1800 <= parsed <= 2030:
                            detail[field] = parsed
                            break
                    elif field == "assessed_value":
                        parsed = _parse_price(value)
                        if parsed and parsed > 0:
                            detail[field] = parsed
                            break
                    else:
                        if value:
                            detail[field] = value
                            break
            if field in detail:
                break

    # ── Improvements table ──
    detail["improvements"] = _parse_improvements(soup)

    # ── Fallback: regex extraction from full text ──
    if "sqft_living" not in detail:
        match = re.search(r"(?:living|bldg|building)\s*(?:area|sqft|sq\s*ft)[:\s]*([0-9,]+)", text, re.I)
        if match:
            detail["sqft_living"] = _parse_int(match.group(1))

    if "year_built" not in detail:
        match = re.search(r"(?:year|yr)\s*(?:built|blt)[:\s]*(\d{4})", text, re.I)
        if match:
            yr = int(match.group(1))
            if 1800 <= yr <= 2030:
                detail["year_built"] = yr

    if "assessed_value" not in detail:
        match = re.search(r"(?:real\s*market|rmv|total\s*rmv|assessed)[:\s]*\$?([0-9,]+)", text, re.I)
        if match:
            detail["assessed_value"] = _parse_price(match.group(1))

    return detail


def _extract_key_value_pairs(soup: BeautifulSoup) -> dict[str, str]:
    """Extract key-value pairs from tables and definition lists."""
    pairs: dict[str, str] = {}

    # From tables with two columns (label, value)
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])
            if len(cells) == 2:
                key = _clean_text(cells[0].get_text())
                val = _clean_text(cells[1].get_text())
                if key and val:
                    pairs[key] = val
            elif len(cells) >= 4:
                # Some pages use label-value-label-value in a single row
                for i in range(0, len(cells) - 1, 2):
                    key = _clean_text(cells[i].get_text())
                    val = _clean_text(cells[i + 1].get_text())
                    if key and val:
                        pairs[key] = val

    # From definition lists
    for dl in soup.find_all("dl"):
        dts = dl.find_all("dt")
        dds = dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            key = _clean_text(dt.get_text())
            val = _clean_text(dd.get_text())
            if key and val:
                pairs[key] = val

    # From labeled spans/divs (e.g., <span class="label">Year Built:</span> <span>1952</span>)
    for label in soup.find_all(["span", "div", "b", "strong"],
                                string=re.compile(r":\s*$")):
        key = _clean_text(label.get_text()).rstrip(":")
        next_sib = label.find_next_sibling()
        if next_sib:
            val = _clean_text(next_sib.get_text())
            if key and val:
                pairs[key] = val

    return pairs


def _parse_improvements(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Parse the improvements/structures table from a detail page."""
    improvements: list[dict[str, Any]] = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        headers = [_clean_text(th.get_text()).lower()
                    for th in rows[0].find_all(["th", "td"])]

        # Check if this looks like an improvements table
        is_impr = any(
            keyword in " ".join(headers)
            for keyword in ["improvement", "structure", "dwelling", "building",
                             "bldg", "condition"]
        )
        if not is_impr:
            continue

        col_map = _map_columns(headers, {
            "type": ["type", "improvement", "structure", "description", "bldg"],
            "sqft": ["sqft", "sq ft", "area", "size", "living"],
            "year": ["year", "yr built", "year built"],
            "condition": ["condition", "cond", "grade"],
        })

        for row in rows[1:]:
            cells = [_clean_text(td.get_text()) for td in row.find_all("td")]
            if not cells or all(not c for c in cells):
                continue

            impr: dict[str, Any] = {}
            if "type" in col_map and col_map["type"] < len(cells):
                impr["type"] = cells[col_map["type"]]
            if "sqft" in col_map and col_map["sqft"] < len(cells):
                impr["sqft"] = _parse_int(cells[col_map["sqft"]])
            if "year" in col_map and col_map["year"] < len(cells):
                yr = _parse_int(cells[col_map["year"]])
                if yr and 1800 <= yr <= 2030:
                    impr["year_built"] = yr
            if "condition" in col_map and col_map["condition"] < len(cells):
                impr["condition"] = cells[col_map["condition"]]

            if impr.get("type"):
                improvements.append(impr)

    return improvements


# ── Permit Page Parser ─────────────────────────────────────────────────────

def parse_permits(html: str) -> list[dict[str, Any]]:
    """
    Parse permit history from a PDO permit page.

    Extracts:
    - permit number, type, date, status, description
    """
    soup = BeautifulSoup(html, "lxml")
    permits: list[dict[str, Any]] = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2:
            continue

        headers = [_clean_text(th.get_text()).lower()
                    for th in rows[0].find_all(["th", "td"])]

        is_permit = any(
            keyword in " ".join(headers)
            for keyword in ["permit", "application", "building"]
        )
        if not is_permit:
            continue

        col_map = _map_columns(headers, {
            "number": ["permit", "number", "permit no", "permit number",
                        "application", "app"],
            "type": ["type", "permit type", "work type", "description"],
            "date": ["date", "issue date", "issued", "applied", "app date"],
            "status": ["status", "state", "disposition"],
            "description": ["description", "desc", "work description", "scope"],
        })

        for row in rows[1:]:
            cells = [_clean_text(td.get_text()) for td in row.find_all("td")]
            if not cells or all(not c for c in cells):
                continue

            permit: dict[str, Any] = {}
            if "number" in col_map and col_map["number"] < len(cells):
                permit["number"] = cells[col_map["number"]]
            if "type" in col_map and col_map["type"] < len(cells):
                permit["type"] = cells[col_map["type"]]
            if "date" in col_map and col_map["date"] < len(cells):
                permit["date"] = _parse_date(cells[col_map["date"]])
            if "status" in col_map and col_map["status"] < len(cells):
                permit["status"] = cells[col_map["status"]]
            if "description" in col_map and col_map["description"] < len(cells):
                permit["description"] = cells[col_map["description"]]

            if permit.get("number") or permit.get("type") or permit.get("date"):
                permits.append(permit)

    # Sort by date descending
    permits.sort(key=lambda p: p.get("date") or "", reverse=True)

    return permits


# ── Utilities ──────────────────────────────────────────────────────────────

def _map_columns(headers: list[str], mappings: dict[str, list[str]]) -> dict[str, int]:
    """
    Map logical field names to column indices based on header text matching.

    Args:
        headers: List of lowercase header strings
        mappings: Dict of {field_name: [possible_header_texts]}

    Returns:
        Dict of {field_name: column_index}
    """
    col_map: dict[str, int] = {}

    for field, keywords in mappings.items():
        for i, header in enumerate(headers):
            for kw in keywords:
                if kw in header:
                    col_map[field] = i
                    break
            if field in col_map:
                break

    return col_map


def parse_account(
    sales_html: str | None,
    detail_html: str | None,
    permit_html: str | None,
) -> dict[str, Any]:
    """
    Parse all available HTML pages for a single account into a structured record.

    Returns dict with keys: sales, detail, permits
    """
    result: dict[str, Any] = {
        "sales": [],
        "improvements": [],
        "permits": [],
    }

    if sales_html:
        result["sales"] = parse_sales(sales_html)

    if detail_html:
        detail = parse_detail(detail_html)
        result.update({
            k: v for k, v in detail.items()
            if k != "improvements"
        })
        if detail.get("improvements"):
            result["improvements"] = detail["improvements"]

    if permit_html:
        result["permits"] = parse_permits(permit_html)

    return result

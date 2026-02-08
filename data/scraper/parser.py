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


# ── Property Detail Parser (Ora_asmt_details.cfm) ────────────────────────

def parse_detail(html: str) -> dict[str, Any]:
    """
    Parse property details from the Ora_asmt_details.cfm page.

    This is the richest PDO data source. It contains:
    - Account info (account number, maptaxlot, owner)
    - Situs address
    - Land info (acreage, tax code, property class)
    - Last sale price and date (AS400 or ORCATS source)
    - Market Value Summary (RMV, M5, MAV, AV)
    - Improvements (building #, year built, type, sqft)
    """
    soup = BeautifulSoup(html, "lxml")
    detail: dict[str, Any] = {}

    # ── Last Sale (from "Sales Data" section) ──
    _parse_last_sale(soup, detail)

    # ── Market Value Summary ──
    _parse_market_values(soup, detail)

    # ── Improvements table ──
    detail["improvements"] = _parse_improvements_asmt(soup)

    # ── Get year_built and sqft_living from improvements ──
    if detail["improvements"]:
        # Use the first residential improvement
        for imp in detail["improvements"]:
            imp_type = (imp.get("type") or "").upper()
            if imp_type in ("RESIDENCE", "DWELLING", "MULTI-FAMILY",
                            "MANUFACTURED", "CONDO", "TOWNHOUSE"):
                if imp.get("year_built") and "year_built" not in detail:
                    detail["year_built"] = imp["year_built"]
                if imp.get("sqft") and "sqft_living" not in detail:
                    detail["sqft_living"] = imp["sqft"]
                break
        # Fallback: use any improvement with sqft
        if "sqft_living" not in detail:
            for imp in detail["improvements"]:
                if imp.get("sqft") and imp["sqft"] > 0:
                    detail["sqft_living"] = imp["sqft"]
                    break
        if "year_built" not in detail:
            for imp in detail["improvements"]:
                if imp.get("year_built"):
                    detail["year_built"] = imp["year_built"]
                    break

    # ── Acreage (from Land Info section) ──
    for td in soup.find_all("td", class_="asmt_hd"):
        if _clean_text(td.get_text()).lower() == "acreage":
            val_td = td.find_next_sibling("td", class_="asmt_info")
            if val_td:
                acreage = _parse_float(val_td.get_text())
                if acreage and acreage > 0:
                    detail["sqft_lot"] = int(round(acreage * 43560))
            break

    return detail


def _parse_last_sale(soup: BeautifulSoup, detail: dict[str, Any]) -> None:
    """Extract last sale price and date from the Sales Data section."""
    # Find "Last Sale" header cell
    for td in soup.find_all("td", class_="asmt_hd"):
        text = _clean_text(td.get_text())
        if "last sale" in text.lower():
            # The data row follows in the next <tr>
            header_row = td.find_parent("tr")
            if not header_row:
                continue
            data_row = header_row.find_next_sibling("tr")
            if not data_row:
                continue

            cells = data_row.find_all("td", class_="asmt_info")
            if len(cells) >= 2:
                # First cell: price, second cell: date
                price = _parse_price(cells[0].get_text())
                date = _parse_date(cells[1].get_text())
                if price and price > 0:
                    detail["last_sale_price"] = price
                    detail["last_sale_date"] = date
            return


def _parse_market_values(soup: BeautifulSoup, detail: dict[str, Any]) -> None:
    """Extract total RMV/AV from Market Value Summary table."""
    # Find the MarketTable by id or by header text
    market_table = soup.find("table", id="MarketTable")
    if not market_table:
        # Fallback: find by header text
        for th in soup.find_all("th", class_="asmt_hd"):
            if "market value summary" in _clean_text(th.get_text()).lower():
                parent_tr = th.find_parent("tr")
                if parent_tr:
                    next_tr = parent_tr.find_next_sibling("tr")
                    if next_tr:
                        market_table = next_tr.find("table")
                break

    if not market_table:
        return

    # Find the "Total:" row
    for row in market_table.find_all("tr"):
        cells = row.find_all("td")
        cell_texts = [_clean_text(c.get_text()) for c in cells]
        if any("total" in t.lower() for t in cell_texts):
            # Parse RMV, M5, MAV, AV from the total row
            # Layout: [PSO link, "Total:", RMV, M5, MAV, AV]
            values = []
            for c in cells:
                text = _clean_text(c.get_text())
                val = _parse_price(text)
                if val is not None and val >= 0:
                    values.append(val)

            if values:
                # RMV is typically the first/largest value
                detail["assessed_value"] = max(values) if values else None
            return


def _parse_improvements_asmt(soup: BeautifulSoup) -> list[dict[str, Any]]:
    """Parse improvements from the Ora_asmt_details.cfm Improvements section.

    The table has columns:
    Building # | Code Area | Year Built | Eff Year | Stat Class |
    Description | Type | SqFt | % Complete
    """
    improvements: list[dict[str, Any]] = []

    # Find the "Improvements" header
    impr_header = None
    for th in soup.find_all("th", class_="asmt_hd"):
        text = _clean_text(th.get_text())
        if text.lower() == "improvements":
            impr_header = th
            break

    if not impr_header:
        return improvements

    # Find the header row with "Building #"
    parent = impr_header.find_parent("table")
    if not parent:
        return improvements

    # Look for the column headers row
    header_row = None
    col_indices: dict[str, int] = {}
    for row in parent.find_all("tr"):
        cells = row.find_all("td", class_="asmt_hd")
        if not cells:
            continue
        texts = [_clean_text(c.get_text()).lower() for c in cells]
        if any("building" in t for t in texts) and any("sqft" in t for t in texts):
            header_row = row
            for i, t in enumerate(texts):
                if "building" in t:
                    col_indices["building"] = i
                elif "year" in t and "eff" not in t:
                    col_indices["year_built"] = i
                elif "eff" in t and "year" in t:
                    col_indices["eff_year"] = i
                elif "description" in t:
                    col_indices["description"] = i
                elif "type" in t:
                    col_indices["type"] = i
                elif "sqft" in t:
                    col_indices["sqft"] = i
                elif "stat" in t and "class" in t:
                    col_indices["stat_class"] = i
            break

    if not header_row or not col_indices:
        return improvements

    # Parse data rows after the header
    for row in header_row.find_next_siblings("tr"):
        cells = row.find_all("td", class_="asmt_info")
        if not cells:
            # Stop at next header/section
            if row.find("th"):
                break
            continue

        texts = [_clean_text(c.get_text()) for c in cells]
        if not texts or all(not t for t in texts):
            continue

        impr: dict[str, Any] = {}

        idx = col_indices.get("type")
        if idx is not None and idx < len(texts):
            impr["type"] = texts[idx]

        idx = col_indices.get("sqft")
        if idx is not None and idx < len(texts):
            sqft = _parse_int(texts[idx])
            if sqft and sqft > 0:
                impr["sqft"] = sqft

        idx = col_indices.get("year_built")
        if idx is not None and idx < len(texts):
            yr = _parse_int(texts[idx])
            if yr and 1800 <= yr <= 2030:
                impr["year_built"] = yr

        idx = col_indices.get("description")
        if idx is not None and idx < len(texts):
            impr["description"] = texts[idx]

        idx = col_indices.get("stat_class")
        if idx is not None and idx < len(texts):
            impr["stat_class"] = texts[idx]

        if impr.get("type") or impr.get("sqft"):
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

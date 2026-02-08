"""
Scraper for Jackson County Property Data Online (PDO).

Fetches and caches raw HTML from three page types:
- Sales history:    /pdo/sales.cfm?account={ACCOUNT_ID}
- Property detail:  /pdo/detail.cfm?account={ACCOUNT_ID}
- Permit history:   /pdo/permit.cfm?account={ACCOUNT_ID}

Features:
- Rate limiting (configurable delay between requests)
- Raw HTML caching (don't re-fetch what we already have)
- Resume capability (skip already-cached accounts)
- Retry with exponential backoff on failures
"""

import hashlib
import logging
import time
from pathlib import Path

import requests

from config import (
    CACHE_DIR,
    MAX_RETRIES,
    PDO_BASE,
    REQUEST_DELAY_SEC,
    REQUEST_TIMEOUT_SEC,
    RETRY_BACKOFF_SEC,
    USER_AGENT,
)

logger = logging.getLogger(__name__)

SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
})

# Page types and their URL templates
PAGE_TYPES = {
    "sales": f"{PDO_BASE}/sales.cfm",
    "detail": f"{PDO_BASE}/Ora_asmt_details.cfm",
    "permit": f"{PDO_BASE}/permit.cfm",
}


def _cache_path(account: str, page_type: str) -> Path:
    """Return the cache file path for a given account and page type."""
    subdir = CACHE_DIR / page_type
    subdir.mkdir(parents=True, exist_ok=True)
    # Sanitize account ID for filename
    safe_account = account.replace("-", "").replace(" ", "")
    return subdir / f"{safe_account}.html"


def is_cached(account: str, page_type: str) -> bool:
    """Check if a page is already cached."""
    path = _cache_path(account, page_type)
    return path.exists() and path.stat().st_size > 0


def read_cached(account: str, page_type: str) -> str | None:
    """Read cached HTML for an account/page_type. Returns None if not cached."""
    path = _cache_path(account, page_type)
    if path.exists() and path.stat().st_size > 0:
        return path.read_text(encoding="utf-8", errors="replace")
    return None


def _save_cache(account: str, page_type: str, html: str) -> None:
    """Save raw HTML to cache."""
    path = _cache_path(account, page_type)
    path.write_text(html, encoding="utf-8")


def fetch_page(
    account: str,
    page_type: str,
    force: bool = False,
    maptaxlot: str | None = None,
) -> str | None:
    """
    Fetch a PDO page for the given account or maptaxlot.

    Args:
        account: The property account ID (e.g. "10059095" or "1-005909-5")
        page_type: One of "sales", "detail", "permit"
        force: If True, fetch even if cached
        maptaxlot: Optional maptaxlot to use instead of account for lookup

    Returns:
        Raw HTML string, or None on failure
    """
    if page_type not in PAGE_TYPES:
        raise ValueError(f"Unknown page_type: {page_type}. Use one of: {list(PAGE_TYPES)}")

    # Use maptaxlot as cache key if no account
    cache_key = account if account else (maptaxlot or "")
    if not cache_key:
        return None

    # Check cache first
    if not force and is_cached(cache_key, page_type):
        logger.debug("Cache hit: %s/%s", page_type, cache_key)
        return read_cached(cache_key, page_type)

    url = PAGE_TYPES[page_type]

    # Build query params — prefer account, fall back to maptaxlot
    if account:
        clean_account = account.replace("-", "").replace(" ", "")
        params = {"account": clean_account}
    elif maptaxlot:
        params = {"maptaxlot": maptaxlot}
    else:
        return None

    for attempt in range(MAX_RETRIES):
        try:
            resp = SESSION.get(url, params=params, timeout=REQUEST_TIMEOUT_SEC)
            resp.raise_for_status()

            html = resp.text

            # Basic validation — check we got actual content
            if len(html) < 200:
                logger.warning(
                    "Suspiciously short response for %s/%s (%d bytes)",
                    page_type, account, len(html),
                )

            # Cache the response
            _save_cache(cache_key, page_type, html)
            logger.info("Fetched and cached: %s/%s (%d bytes)", page_type, cache_key, len(html))
            return html

        except requests.HTTPError as exc:
            if exc.response is not None and exc.response.status_code == 404:
                logger.warning("404 for %s/%s — account may not exist", page_type, cache_key)
                return None
            wait = RETRY_BACKOFF_SEC * (2 ** attempt)
            logger.warning(
                "HTTP error for %s/%s (attempt %d/%d): %s — retrying in %.1fs",
                page_type, account, attempt + 1, MAX_RETRIES, exc, wait,
            )
            time.sleep(wait)

        except requests.RequestException as exc:
            wait = RETRY_BACKOFF_SEC * (2 ** attempt)
            logger.warning(
                "Request error for %s/%s (attempt %d/%d): %s — retrying in %.1fs",
                page_type, account, attempt + 1, MAX_RETRIES, exc, wait,
            )
            time.sleep(wait)

    logger.error("All attempts failed for %s/%s", page_type, account)
    return None


def fetch_all_pages(account: str, force: bool = False) -> dict[str, str | None]:
    """
    Fetch all three page types for an account.

    Returns dict mapping page_type -> HTML (or None on failure).
    Respects rate limiting between requests.
    """
    results: dict[str, str | None] = {}

    for page_type in PAGE_TYPES:
        # Skip if already cached (no need to rate-limit cache hits)
        if not force and is_cached(account, page_type):
            results[page_type] = read_cached(account, page_type)
            continue

        results[page_type] = fetch_page(account, page_type, force=force)
        # Rate limit between actual network requests
        time.sleep(REQUEST_DELAY_SEC)

    return results


def scrape_accounts(
    accounts: list[str],
    page_types: list[str] | None = None,
    force: bool = False,
    progress_callback: callable = None,
) -> dict[str, dict[str, str | None]]:
    """
    Scrape PDO pages for a list of accounts.

    Args:
        accounts: List of account IDs to scrape
        page_types: Which page types to fetch (default: all three)
        force: Re-fetch even if cached
        progress_callback: Called with (current_index, total, account) for progress

    Returns:
        Dict mapping account -> {page_type: HTML}
    """
    if page_types is None:
        page_types = list(PAGE_TYPES)

    results: dict[str, dict[str, str | None]] = {}
    total = len(accounts)

    for i, account in enumerate(accounts):
        if progress_callback:
            progress_callback(i, total, account)

        account_results: dict[str, str | None] = {}
        for page_type in page_types:
            if not force and is_cached(account, page_type):
                account_results[page_type] = read_cached(account, page_type)
                continue

            account_results[page_type] = fetch_page(account, page_type, force=force)
            time.sleep(REQUEST_DELAY_SEC)

        results[account] = account_results

    return results


def get_scrape_progress(accounts: list[str]) -> dict[str, dict[str, bool]]:
    """
    Check which accounts/pages are already cached.

    Returns dict mapping account -> {page_type: is_cached}
    """
    progress: dict[str, dict[str, bool]] = {}
    for account in accounts:
        progress[account] = {
            pt: is_cached(account, pt)
            for pt in PAGE_TYPES
        }
    return progress


def print_progress_summary(accounts: list[str]) -> None:
    """Print a summary of scraping progress."""
    progress = get_scrape_progress(accounts)
    total_pages = len(accounts) * len(PAGE_TYPES)
    cached_pages = sum(
        1 for acct in progress.values()
        for is_done in acct.values()
        if is_done
    )
    print(f"\nScraping progress: {cached_pages}/{total_pages} pages cached")
    print(f"  Accounts: {len(accounts)}")
    for pt in PAGE_TYPES:
        done = sum(1 for acct in progress.values() if acct[pt])
        print(f"  {pt}: {done}/{len(accounts)} cached")

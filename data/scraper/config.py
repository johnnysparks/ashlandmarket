"""Configuration constants for the Jackson County data pipeline."""

from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
SALES_DIR = DATA_DIR / "sales"
AGGREGATES_DIR = DATA_DIR / "aggregates"
CACHE_DIR = DATA_DIR / "cache"
PARCELS_JSON = DATA_DIR / "parcels.json"

# ── Jackson County PDO URLs ────────────────────────────────────────────────
PDO_BASE = "https://pdo.jacksoncountyor.gov/pdo"
PDO_SALES_URL = f"{PDO_BASE}/sales.cfm"       # ?account={{ACCOUNT_ID}}
PDO_DETAIL_URL = f"{PDO_BASE}/detail.cfm"      # ?account={{ACCOUNT_ID}}
PDO_PERMIT_URL = f"{PDO_BASE}/permit.cfm"      # ?account={{ACCOUNT_ID}}
PDO_TEXT_URL = f"{PDO_BASE}/index.cfm"          # ?bTextOnly=True

# ── PSO (Assessor Property Search) ────────────────────────────────────────
PSO_BASE = "https://apps.jacksoncountyor.gov/PSO"

# ── ArcGIS REST endpoints for tax lots ────────────────────────────────────
# JCGIS hosted on ArcGIS Online (geometry + MAPLOT, no account data in public layer)
JCGIS_AGOL = "https://services1.arcgis.com/DwYBkWQPdaJNWrPG/arcgis/rest/services/Taxlots/FeatureServer/0"

# Jackson County's own spatial server (may have account numbers — intermittently down)
JCGIS_ARCGIS_BASE = "https://spatial.jacksoncountyor.gov/arcgis/rest/services"
TAXLOT_ENDPOINTS = [
    f"{JCGIS_ARCGIS_BASE}/OpenData/ReferenceData/MapServer/3",
    f"{JCGIS_ARCGIS_BASE}/Survey/SurveyIndexingV2/MapServer/75",
]

# ODOT endpoint — always available, has MapTaxlot + geometry, no account numbers
ODOT_TAXLOTS = "https://gis.odot.state.or.us/arcgis1006/rest/services/ames/ames/MapServer/34"

# ── Ashland-specific ──────────────────────────────────────────────────────
ASHLAND_CENTER_LAT = 42.1945
ASHLAND_CENTER_LNG = -122.7095
# All Ashland map/taxlot numbers begin with 391E
ASHLAND_MAP_PREFIX = "391E"

# ── Scraper settings ──────────────────────────────────────────────────────
REQUEST_DELAY_SEC = 0.75        # seconds between requests (be polite)
MAX_RETRIES = 3
RETRY_BACKOFF_SEC = 2.0
REQUEST_TIMEOUT_SEC = 30
USER_AGENT = (
    "AshlandMarketHeatMap/1.0 "
    "(personal real estate research; "
    "contact: github.com/johnnysparks/ashlandmarket)"
)

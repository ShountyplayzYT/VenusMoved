"""Client for the DAT Rateview linehaul rates API.

Used as a fallback when a lane can't be found in our own shipment
history (see api/index.py): instead of coming back empty-handed, we ask
DAT for a market rate estimate on that lane.

Docs:
- Rateview lookups: https://developer.dat.com/developer-portal/lookup-freight-rates/rates-linehaul
- Auth (Access API): https://developer.dat.com/developer-portal/authentication/access

Authentication
--------------
DAT uses a two-step, org-then-individual JWT exchange instead of a single
static API token:

1. POST {DAT_IDENTITY_BASE_URL}/v1/token/organization
   with the Service Account username/password -> organization access token.
   This token is *only* good for minting an individual token; it can't be
   used against Rateview directly.
2. POST {DAT_IDENTITY_BASE_URL}/v1/token/user
   with `Authorization: Bearer <organization token>` and the individual
   user's login -> individual access token.
3. The individual access token is what's sent as `Authorization: Bearer`
   on the actual /v1/lookups call.

Both tokens expire after 30 minutes. We cache the individual token
in-process and transparently refresh it (fetching a fresh org token first)
once it's within a short buffer of expiring, so callers of get_rate()
don't need to think about any of this.

DAT also requires an `x-dat-partner-id` header (our integration's partner
ID, provided by DAT) on every request - auth calls and product endpoints
alike. Set it via the DAT_PARTNER_ID env var. Missing this header is a
common cause of every DAT call failing outright.

NOTE ON REQUEST BODY FIELD NAMES: the DAT docs excerpt we were given
confirms the endpoints, the org-token-in-header handoff, the 30 minute
expiry, and the organization-token response shape
(`{"accessToken": ..., "expiresIn": ...}`), but not the literal JSON key
names DAT expects for the username/password fields on the request body.
We use `username`/`password` (org token) and `username` (user token),
which matches DAT's documented terminology ("Service Account username",
"Individual username"). If DAT's actual schema differs, only
`_ORG_TOKEN_REQUEST_FIELDS` / `_USER_TOKEN_REQUEST_FIELDS` below need to
change - everything else (caching, refresh, Rateview payload/parsing) is
independent of that detail.
"""

import os
import threading
import time

import requests

DAT_LOOKUPS_PATH = "/v1/lookups"
DAT_ORG_TOKEN_PATH = "/v1/token/organization"
DAT_USER_TOKEN_PATH = "/v1/token/user"

# How long before a cached individual token's reported expiry we treat it
# as "expired" and proactively refresh, to avoid racing a real request
# against the clock.
_TOKEN_REFRESH_BUFFER_SECONDS = 60

# See the "NOTE ON REQUEST BODY FIELD NAMES" docstring section above.
_ORG_TOKEN_REQUEST_FIELDS = ("username", "password")
_USER_TOKEN_REQUEST_FIELDS = ("username",)


class DatApiError(Exception):
    """Raised when the DAT API can't be reached or isn't configured.

    Callers should treat this the same as "no DAT data available" and
    fail soft rather than surfacing a hard error to the user.
    """


class DatAuthError(DatApiError):
    """Raised specifically when the org/individual token exchange fails."""


def _base_url():
    return os.environ.get("DAT_API_BASE_URL", "https://analytics.api.dat.com/linehaulrates")


def _identity_base_url():
    return os.environ.get("DAT_IDENTITY_BASE_URL", "https://identity.api.dat.com/access")


def _required_env(name):
    value = os.environ.get(name)
    if not value:
        raise DatApiError(f"{name} is not configured")
    return value


def _partner_id_header():
    """The x-dat-partner-id header DAT requires on every request."""
    return {"x-dat-partner-id": _required_env("DAT_PARTNER_ID")}


class _TokenCache:
    """In-memory cache for the individual access token.

    A tiny wrapper (rather than plain module globals) so tests can create
    isolated instances instead of mutating shared state.
    """

    def __init__(self):
        self._lock = threading.Lock()
        self._token = None
        self._expires_at = 0.0  # monotonic seconds

    def get(self, now=None):
        now = time.monotonic() if now is None else now
        with self._lock:
            if self._token and now < self._expires_at:
                return self._token
        return None

    def set(self, token, expires_in_seconds, now=None):
        now = time.monotonic() if now is None else now
        with self._lock:
            self._token = token
            self._expires_at = now + expires_in_seconds - _TOKEN_REFRESH_BUFFER_SECONDS

    def clear(self):
        with self._lock:
            self._token = None
            self._expires_at = 0.0


_individual_token_cache = _TokenCache()


def _post_json(url, json_body=None, headers=None, error_prefix="DAT auth request"):
    try:
        resp = requests.post(url, json=json_body, headers=headers, timeout=10)
    except requests.RequestException as e:
        raise DatAuthError(f"{error_prefix} failed: {e}") from e

    if resp.status_code >= 400:
        raise DatAuthError(f"{error_prefix} returned {resp.status_code}: {resp.text[:300]}")

    try:
        return resp.json()
    except ValueError as e:
        raise DatAuthError(f"{error_prefix} returned a non-JSON response") from e


def _extract_token_and_ttl(data, error_prefix):
    token = data.get("accessToken")
    if not token:
        raise DatAuthError(f"{error_prefix} response did not include an accessToken")

    # expiresIn (seconds) is what the docs show for the org token response;
    # fall back defensively in case the user-token response instead sends
    # an absolute expiresAt-style field.
    expires_in = data.get("expiresIn")
    if expires_in is None:
        expires_in = 30 * 60  # DAT tokens are documented as 30-minute lifetimes
    return token, float(expires_in)


def _get_organization_token():
    """Exchange the Service Account username/password for an org token.

    The org token is never cached: it's cheap to fetch and its only job
    is to authorize the very next /v1/token/user call.
    """
    username = _required_env("DAT_SERVICE_USERNAME")
    password = _required_env("DAT_SERVICE_PASSWORD")

    field_names = _ORG_TOKEN_REQUEST_FIELDS
    body = {field_names[0]: username, field_names[1]: password}

    url = f"{_identity_base_url()}{DAT_ORG_TOKEN_PATH}"
    headers = {**_partner_id_header(), "Content-Type": "application/json"}
    data = _post_json(url, json_body=body, headers=headers, error_prefix="DAT organization token request")
    token, _ttl = _extract_token_and_ttl(data, "DAT organization token")
    return token


def _get_individual_token(force_refresh=False):
    """Return a valid individual access token, refreshing if necessary."""
    if not force_refresh:
        cached = _individual_token_cache.get()
        if cached:
            return cached

    individual_username = _required_env("DAT_INDIVIDUAL_USERNAME")
    org_token = _get_organization_token()

    field_names = _USER_TOKEN_REQUEST_FIELDS
    body = {field_names[0]: individual_username}
    headers = {
        "Authorization": f"Bearer {org_token}",
        "Content-Type": "application/json",
        **_partner_id_header(),
    }

    url = f"{_identity_base_url()}{DAT_USER_TOKEN_PATH}"
    data = _post_json(url, json_body=body, headers=headers, error_prefix="DAT individual token request")
    token, ttl = _extract_token_and_ttl(data, "DAT individual token")

    _individual_token_cache.set(token, ttl)
    return token


def _headers(force_refresh_token=False):
    return {
        "Authorization": f"Bearer {_get_individual_token(force_refresh=force_refresh_token)}",
        "Content-Type": "application/json",
        # Lets DAT cache the response for later /get lookups; also tends
        # to be cheaper/faster for repeat lanes.
        "x-cache-response": "true",
        **_partner_id_header(),
    }


def _split_city_state(location_text):
    """'Sayreville, NJ' -> ('Sayreville', 'NJ'); 'Sayreville' -> ('Sayreville', None)."""
    if not location_text:
        return None, None
    parts = [p.strip() for p in location_text.split(",")]
    if len(parts) == 2 and parts[1] and 2 <= len(parts[1]) <= 3:
        return parts[0], parts[1].upper()
    return parts[0], None


def _resolve_state_abbr(state_name):
    if not state_name:
        return None
    from . import pricing  # local import avoids a circular import at module load time
    return pricing.US_STATE_ABBR.get(state_name.strip().lower())


def build_location(location_text, geo_lookup=None):
    """Turns a parsed 'City' or 'City, ST' string into a DAT location object.

    Falls back to `geo_lookup` (e.g. geocode.get_geo_info) to resolve a
    missing state when the parser didn't catch one. Returns None if a
    state still can't be determined, since DAT requires either a postal
    code or a city/state pair to identify the lane.
    """
    city, state = _split_city_state(location_text)
    if not city:
        return None

    if not state and geo_lookup:
        try:
            geo = geo_lookup(location_text)
        except Exception:
            geo = None
        state = _resolve_state_abbr(geo.get("state") if geo else None)

    if not state:
        return None

    return {"city": city, "stateOrProvince": state}


def _extract_rate(entry):
    response = entry.get("response") or {}
    if "errors" in response or "statusCode" in response:
        return None

    rate = response.get("rate")
    if not rate:
        return None

    per_mile = rate.get("perMile") or {}
    per_trip = rate.get("perTrip") or {}
    escalation = response.get("escalation") or {}
    origin_area = escalation.get("origin") or {}

    return {
        "mileage": rate.get("mileage"),
        "perTripRateUsd": per_trip.get("rateUsd"),
        "perTripLowUsd": per_trip.get("lowUsd"),
        "perTripHighUsd": per_trip.get("highUsd"),
        "perMileRateUsd": per_mile.get("rateUsd"),
        "perMileLowUsd": per_mile.get("lowUsd"),
        "perMileHighUsd": per_mile.get("highUsd"),
        "reports": rate.get("reports"),
        "companies": rate.get("companies"),
        "rateStrength": rate.get("rateStrength"),
        "timeframe": escalation.get("timeframe"),
        "areaType": origin_area.get("type"),
    }


def get_rate(origin_text, destination_text, geo_lookup=None, equipment=None, rate_type=None):
    """Looks up a linehaul rate from the DAT Rateview API for a single lane.

    Returns a normalized rate dict, or None if the lane couldn't be
    resolved to a city+state pair, or DAT had no rate for it.

    Raises DatApiError if the integration isn't configured or the HTTP
    call itself fails - see the class docstring for how to handle that.
    """
    origin = build_location(origin_text, geo_lookup)
    destination = build_location(destination_text, geo_lookup)
    if not origin or not destination:
        return None

    equipment = equipment or os.environ.get("DAT_DEFAULT_EQUIPMENT", "VAN")
    rate_type = rate_type or os.environ.get("DAT_DEFAULT_RATE_TYPE", "CONTRACT")

    payload = [{
        "origin": origin,
        "destination": destination,
        "rateType": rate_type,
        "equipment": equipment,
        "includeMyRate": False,
        "targetEscalation": {"escalationType": "BEST_FIT"},
    }]

    url = f"{_base_url()}{DAT_LOOKUPS_PATH}"
    try:
        resp = requests.post(url, json=payload, headers=_headers(), timeout=10)
    except requests.RequestException as e:
        raise DatApiError(f"DAT request failed: {e}") from e

    if resp.status_code == 401:
        # Individual token may have expired/been revoked server-side even
        # though our cache thought it was still valid - force a fresh
        # org -> individual token exchange and retry exactly once.
        _individual_token_cache.clear()
        try:
            resp = requests.post(url, json=payload, headers=_headers(force_refresh_token=True), timeout=10)
        except requests.RequestException as e:
            raise DatApiError(f"DAT request failed: {e}") from e

    if resp.status_code >= 400:
        raise DatApiError(f"DAT API returned {resp.status_code}: {resp.text[:300]}")

    data = resp.json()
    entries = data.get("rateResponses") or []
    if not entries:
        return None

    return _extract_rate(entries[0])
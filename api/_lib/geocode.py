import os
import time

import requests

from . import db

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "http://router.project-osrm.org/route/v1/driving"


def _headers():
    contact = os.environ.get("NOMINATIM_CONTACT_EMAIL", "contact@example.com")
    return {"User-Agent": f"LineHaulVoiceLookup/1.0 (contact: {contact})"}


def get_geo_info(city_name: str):
    cached = db.get_cached_geocode(city_name)
    if cached:
        return cached

    query_str = city_name if "USA" in city_name.upper() else f"{city_name}, USA"
    params = {"q": query_str, "format": "json", "limit": 1, "addressdetails": 1}

    resp = None
    for attempt in range(3):
        try:
            resp = requests.get(NOMINATIM_URL, params=params, headers=_headers(), timeout=8)
        except requests.RequestException as e:
            print(f"[geocode] request error for '{city_name}': {e}")
            return None
        if resp.status_code == 429:
            print(f"[geocode] 429 rate limited for '{city_name}', attempt {attempt + 1}")
            time.sleep(1.5 * (attempt + 1))
            continue
        break

    if resp is None or resp.status_code != 200:
        print(f"[geocode] non-200 for '{city_name}': status={resp.status_code if resp else 'no response'} body={resp.text[:300] if resp is not None else ''}")
        return None

    data = resp.json()
    if not data:
        print(f"[geocode] no results for '{city_name}' (query='{query_str}')")
        return None

    lon = float(data[0]["lon"])
    lat = float(data[0]["lat"])
    state = data[0].get("address", {}).get("state")
    info = {"lon": lon, "lat": lat, "state": state}
    db.set_cached_geocode(city_name, lon, lat, state)
    return info


def get_route_info(origin_name: str, destination_name: str, origin_geo=None, dest_geo=None):
    route_key = f"{origin_name}|||{destination_name}"
    cached = db.get_cached_route(route_key)
    if cached and cached.get("km") is not None:
        return cached

    origin_geo = origin_geo or get_geo_info(origin_name)
    dest_geo = dest_geo or get_geo_info(destination_name)
    if not origin_geo or not dest_geo:
        print(f"[route] missing geocode: origin_geo={bool(origin_geo)} dest_geo={bool(dest_geo)}")
        return None

    url = (
        f"{OSRM_URL}/{origin_geo['lon']},{origin_geo['lat']};"
        f"{dest_geo['lon']},{dest_geo['lat']}?overview=false"
    )
    try:
        resp = requests.get(url, timeout=8)
    except requests.RequestException as e:
        print(f"[route] request error: {e}")
        return None

    if resp.status_code != 200:
        print(f"[route] non-200 from OSRM: status={resp.status_code} body={resp.text[:300]}")
        return None

    data = resp.json()
    if not data or not data.get("routes"):
        print(f"[route] OSRM returned no routes: {data}")
        return None

    route = data["routes"][0]
    info = {
        "km": round(route["distance"] / 1000, 1),
        "hours": round(route["duration"] / 3600, 1),
    }
    db.set_cached_route(route_key, info["km"], info["hours"])
    return info

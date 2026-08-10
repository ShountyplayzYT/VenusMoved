import os

import requests


def get_weather(lat, lon):
    api_key = os.environ.get("OPENWEATHER_KEY", "")
    if not api_key:
        print("[weather] OPENWEATHER_KEY is not set")
        return None

    url = (
        f"https://api.openweathermap.org/data/2.5/weather?"
        f"lat={lat}&lon={lon}&appid={api_key}&units=metric"
    )
    try:
        resp = requests.get(url, timeout=5)
    except requests.RequestException as e:
        print(f"[weather] request error: {e}")
        return None

    if resp.status_code != 200:
        print(f"[weather] non-200: status={resp.status_code} body={resp.text[:300]}")
        return None

    data = resp.json()
    temp = data.get("main", {}).get("temp")
    wind = data.get("wind", {}).get("speed")
    desc = data.get("weather", [{}])[0].get("description", "Unknown")

    return {
        "tempC": round(temp, 1) if temp is not None else None,
        "windKmh": round(wind * 3.6, 1) if wind else None,
        "description": str(desc).title(),
    }

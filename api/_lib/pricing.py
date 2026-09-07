import json
import re

US_STATE_ABBR = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
    "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
    "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
    "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS",
    "missouri": "MO", "montana": "MT", "nebraska": "NE", "nevada": "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
    "north carolina": "NC", "north dakota": "ND", "ohio": "OH", "oklahoma": "OK",
    "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
    "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
    "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI",
    "wyoming": "WY", "district of columbia": "DC",
}


def parse_lane_text(client, lane_text, require_states=False):
    response_shape = (
        '{"origin": "City, ST", "destination": "City, ST"}'
        if require_states
        else
        '{"origin": "CityName", "destination": "CityName"}'
    )
    state_instruction = (
        "For each city, also determine its most likely US state and return "
        'the location as "City, ST". This is required for a DAT rate lookup. '
        "Use the complete spoken lane to resolve phonetic or misspelled city "
        "names before choosing the state."
        if require_states
        else
        "If a state IS spoken for a city (as a full name like \"New Jersey\" "
        "or an abbreviation like \"NJ\"), format that city as \"City, ST\" "
        "using the standard 2-letter USPS abbreviation (e.g. \"Sayreville, "
        "NJ\"). If no state was spoken for a city, return just the city name "
        "with no state and no trailing comma."
    )
    prompt = (
        f"The following text describes a shipment lane, in the format "
        f"'CityA to CityB': \"{lane_text}\". "
        "This text came from imperfect browser speech-to-text, so city names "
        "may be misheard or misspelled (e.g. \"cerebral\" or \"terrible\" instead of "
        "\"Sayreville\", \"boston\" run into another word, etc). " 
        "Treat the first city mentioned as the ORIGIN and the second city "
        "mentioned as the DESTINATION. Mostly what happens, is that real words are heard. Remember. It is always a city.  "
        "Using your own knowledge of real US city names, correct each city "
        "to its most likely intended spelling. You may guess if you think it must be this.  "
        f"{state_instruction} "
        "Respond with ONLY raw JSON, no markdown, no code fences, in this "
        f"exact shape: {response_shape}"
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.choices[0].message.content.strip()
    text = re.sub(r"^```(json)?|```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)


def resolve_dat_lane(client, lane_text, parsed_lane):
    """Return DAT-ready city/state locations using the full lane resolver.

    The normal lookup intentionally preserves an omitted state. DAT cannot:
    it requires one. If either side has no state, run the same city-correction
    algorithm again against the complete spoken lane, this time requiring both
    city/state pairs. This avoids the weaker per-city state-only guess.
    """
    origin_city, origin_state = split_city_state(parsed_lane.get("origin"))
    dest_city, dest_state = split_city_state(parsed_lane.get("destination"))
    if origin_city and origin_state and dest_city and dest_state:
        return parsed_lane
    return parse_lane_text(client, lane_text, require_states=True)


def guess_state_abbr(client, city_name):
    """Best-guess the US state a city is in, using the model's own
    knowledge, for cities where the caller didn't say a state out loud.

    Used specifically to fill in the state DAT Rateview requires - we
    used to do this via a free third-party geocoding API, but that
    endpoint isn't reliable/allowed for production server-side traffic,
    so we ask the LLM we already have instead. Returns a 2-letter USPS
    abbreviation, or None if the model isn't confident.
    """
    prompt = (
        f'What US state is the city "{city_name}" most commonly understood '
        "to be in? If it's a well-known major city, answer with its state. "
        "If the name is too ambiguous, obscure, or not a real US city to "
        'be confident, respond with exactly "UNKNOWN". '
        "Respond with ONLY the 2-letter USPS state abbreviation (e.g. "
        '"MA") or "UNKNOWN" - no other text, no punctuation.'
    )
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
        )
    except Exception:
        return None

    text = (response.choices[0].message.content or "").strip().upper()
    if text == "UNKNOWN" or len(text) != 2 or not text.isalpha():
        return None
    return text


def split_city_state(location_text):
    """'Sayreville, NJ' -> ('Sayreville', 'NJ'); 'Sayreville' -> ('Sayreville', None)."""
    if not location_text:
        return None, None
    parts = [p.strip() for p in location_text.split(",")]
    if len(parts) == 2 and parts[1] and 2 <= len(parts[1]) <= 3:
        return parts[0], parts[1].upper()
    return parts[0], None


def resolve_state_abbr(client, location_text):
    """Given a 'City' or 'City, ST' string, return a 2-letter state
    abbreviation - either parsed directly out of the text, or guessed via
    the LLM using its own knowledge of major US cities when no state was
    given. Returns None if we can't confidently determine one.
    """
    city, state = split_city_state(location_text)
    if state:
        return state
    if not city:
        return None
    return guess_state_abbr(client, city)


def make_llm_geo_lookup(client):
    """Adapts guess_state_abbr to the `geo_lookup(location_text) -> dict`
    shape dat.build_location() expects, so DAT's fallback state
    resolution runs through the LLM instead of a third-party geocoder.
    """
    def _lookup(location_text):
        state = guess_state_abbr(client, location_text)
        return {"state": state} if state else None
    return _lookup

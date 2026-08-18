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


def parse_lane_text(client, lane_text):
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
        "If a state IS spoken for a city (as a full name like \"New Jersey\" "
        "or an abbreviation like \"NJ\"), format that city as \"City, ST\" "
        "using the standard 2-letter USPS abbreviation (e.g. \"Sayreville, "
        "NJ\"). If no state was spoken for a city, return just the city name "
        "with no state and no trailing comma. "
        "Respond with ONLY raw JSON, no markdown, no code fences, in this "
        'exact shape: {"origin": "CityName", "destination": "CityName"}'
    )
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.choices[0].message.content.strip()
    text = re.sub(r"^```(json)?|```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)
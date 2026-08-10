import os
import difflib
from contextlib import contextmanager

import psycopg

TABLE_NAME = "shipmentsdb"
COL_ORIGIN = "Origin"
COL_DEST = "Destination"
COL_SHIP_DATE = "Ship/Date"
COL_LINE_HAUL = "Line Haul"
COL_ADDL_CHARGES = "Additional Charges"
COL_CARRIER_PAY = "Carrier Pay"
COL_NET_PROFIT = "Net Profit"
COL_PCT = "%"


@contextmanager
def get_conn():
    conn = psycopg.connect(os.environ["DATABASE_URL"], sslmode="require")
    try:
        yield conn
    finally:
        conn.close()


def to_number(val):
    if val is None:
        return None
    s = str(val).strip()
    if s == "" or s.upper() == "EMPTY":
        return None
    s = s.replace("$", "").replace(",", "").replace("%", "")
    try:
        return float(s)
    except ValueError:
        return None


def safe_get(row, index):
    if isinstance(row, (tuple, list)) and len(row) > index:
        return row[index]
    return None


def rows_to_records(rows):
    results = []
    for r in rows:
        results.append({
            "origin": safe_get(r, 0),
            "destination": safe_get(r, 1),
            "shipDate": str(safe_get(r, 2)) if safe_get(r, 2) is not None else None,
            "lineHaul": to_number(safe_get(r, 3)),
            "additionalCharges": to_number(safe_get(r, 4)),
            "carrierPay": to_number(safe_get(r, 5)),
            "netProfit": to_number(safe_get(r, 6)),
            "pct": to_number(safe_get(r, 7)),
        })
    return results


def get_known_cities():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(f'''
            SELECT "{COL_ORIGIN}" FROM "{TABLE_NAME}"
            UNION
            SELECT "{COL_DEST}" FROM "{TABLE_NAME}"
        ''')
        rows = cur.fetchall()
    cities = set()
    for r in rows:
        val = safe_get(r, 0)
        if val:
            city_part = str(val).split(",")[0].strip()
            if city_part:
                cities.add(city_part)
    return cities


def correct_city(heard_name, known_cities):
    if not heard_name:
        return None
    for c in known_cities:
        if c.lower() == heard_name.lower():
            return c
    matches = difflib.get_close_matches(heard_name, list(known_cities), n=1, cutoff=0.4)
    return matches[0] if matches else None


def query_shipment_details(origin_city, destination_city):
    with get_conn() as conn, conn.cursor() as cur:
        safe_pct_col = COL_PCT.replace("%", "%%")
        query = f'''
            SELECT "{COL_ORIGIN}", "{COL_DEST}", "{COL_SHIP_DATE}",
                   "{COL_LINE_HAUL}", "{COL_ADDL_CHARGES}",
                   "{COL_CARRIER_PAY}", "{COL_NET_PROFIT}", "{safe_pct_col}"
            FROM "{TABLE_NAME}"
            WHERE "{COL_ORIGIN}" ILIKE %s
              AND "{COL_DEST}" ILIKE %s
            ORDER BY "{COL_SHIP_DATE}" DESC
        '''
        cur.execute(query, (f"{origin_city}%", f"{destination_city}%"))
        rows = cur.fetchall()
    return rows_to_records(rows)


def query_state_to_state_details(origin_abbr, dest_abbr, limit=25):
    with get_conn() as conn, conn.cursor() as cur:
        safe_pct_col = COL_PCT.replace("%", "%%")
        query = f'''
            SELECT "{COL_ORIGIN}", "{COL_DEST}", "{COL_SHIP_DATE}",
                   "{COL_LINE_HAUL}", "{COL_ADDL_CHARGES}",
                   "{COL_CARRIER_PAY}", "{COL_NET_PROFIT}", "{safe_pct_col}"
            FROM "{TABLE_NAME}"
            WHERE "{COL_ORIGIN}" ILIKE %s
              AND "{COL_DEST}" ILIKE %s
            ORDER BY "{COL_SHIP_DATE}" DESC
            LIMIT %s
        '''
        cur.execute(query, (f"%, {origin_abbr}", f"%, {dest_abbr}", limit))
        rows = cur.fetchall()
    return rows_to_records(rows)


def get_comparable_loads(origin_city, destination_city, limit=5):
    with get_conn() as conn, conn.cursor() as cur:
        query = f'''
            SELECT "{COL_ORIGIN}", "{COL_DEST}", "{COL_SHIP_DATE}", "{COL_LINE_HAUL}"
            FROM "{TABLE_NAME}"
            WHERE "{COL_ORIGIN}" ILIKE %s OR "{COL_DEST}" ILIKE %s
            ORDER BY "{COL_SHIP_DATE}" DESC
            LIMIT %s
        '''
        cur.execute(query, (f"{origin_city}%", f"{destination_city}%", limit))
        rows = cur.fetchall()
    results = []
    for r in rows:
        results.append({
            "origin": safe_get(r, 0),
            "destination": safe_get(r, 1),
            "shipDate": str(safe_get(r, 2)) if safe_get(r, 2) is not None else None,
            "lineHaul": to_number(safe_get(r, 3)),
        })
    return results


# ---------- users ----------

def get_user_by_email(email):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT email, name, salt, password_hash FROM app_users WHERE email = %s",
            (email.strip().lower(),),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"email": row[0], "name": row[1], "salt": row[2], "passwordHash": row[3]}


def create_user(name, email, salt, password_hash):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO app_users (email, name, salt, password_hash) VALUES (%s, %s, %s, %s)",
            (email.strip().lower(), name.strip(), salt, password_hash),
        )
        conn.commit()


# ---------- geocode / distance cache ----------

def get_cached_geocode(city_name):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT lon, lat, state FROM geocode_cache WHERE city_name = %s",
            (city_name,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"lon": row[0], "lat": row[1], "state": row[2]}


def set_cached_geocode(city_name, lon, lat, state):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO geocode_cache (city_name, lon, lat, state, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (city_name) DO UPDATE
                SET lon = EXCLUDED.lon, lat = EXCLUDED.lat,
                    state = EXCLUDED.state, updated_at = now()
            """,
            (city_name, lon, lat, state),
        )
        conn.commit()


def get_cached_route(route_key):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT km, hours FROM distance_cache WHERE route_key = %s",
            (route_key,),
        )
        row = cur.fetchone()
    if not row:
        return None
    return {"km": row[0], "hours": row[1]}


def set_cached_route(route_key, km, hours):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO distance_cache (route_key, km, hours, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (route_key) DO UPDATE
                SET km = EXCLUDED.km, hours = EXCLUDED.hours, updated_at = now()
            """,
            (route_key, km, hours),
        )
        conn.commit()

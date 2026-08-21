import os
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
COL_LOAD_TYPE = "Load Type"
COL_LOAD_NUM = "Load #"
COL_COMPANY = "Company"


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


def to_integer(val):
    if val is None:
        return None

    s = str(val).strip()

    if s == "" or s.upper() == "EMPTY":
        return None

    s = s.replace(",", "")

    try:
        number = float(s)

        if not number.is_integer():
            return None

        return int(number)
    except (ValueError, TypeError):
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
            "loadType": safe_get(r, 8),
            "company": safe_get(r, 9),
        })
    return results


def query_shipment_details(origin_city, destination_city):
    with get_conn() as conn, conn.cursor() as cur:
        safe_pct_col = COL_PCT.replace("%", "%%")
        query = f'''
            SELECT "{COL_ORIGIN}", "{COL_DEST}", "{COL_SHIP_DATE}",
                   "{COL_LINE_HAUL}", "{COL_ADDL_CHARGES}",
                   "{COL_CARRIER_PAY}", "{COL_NET_PROFIT}", "{safe_pct_col}",
                   "{COL_LOAD_TYPE}", "{COL_COMPANY}"
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
                   "{COL_CARRIER_PAY}", "{COL_NET_PROFIT}", "{safe_pct_col}",
                   "{COL_LOAD_TYPE}", "{COL_COMPANY}"
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


def ensure_import_schema():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            f'ALTER TABLE "{TABLE_NAME}" ADD COLUMN IF NOT EXISTS "{COL_COMPANY}" TEXT;'
        )

        cur.execute(
            f"""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'shipmentsdb_load_unique'
                ) THEN
                    ALTER TABLE "{TABLE_NAME}"
                    ADD CONSTRAINT shipmentsdb_load_unique
                    UNIQUE ("{COL_LOAD_NUM}");
                END IF;
            END $$;
            """
        )

        conn.commit()


def insert_new_shipment_records(records):
    if not records:
        return 0, 0

    ensure_import_schema()

    deduped = {}

    for r in records:
        r[COL_LOAD_NUM] = to_integer(r.get(COL_LOAD_NUM))

        if r[COL_LOAD_NUM] is not None:
            deduped[r[COL_LOAD_NUM]] = r

    records = list(deduped.values())

    if not records:
        return 0, 0

    col_names = list(records[0].keys())

    def esc(name):
        return name.replace("%", "%%")

    table_q = f'"{TABLE_NAME}"'
    company_q = f'"{esc(COL_COMPANY)}"'
    key_q = f'"{esc(COL_LOAD_NUM)}"'
    cols_q = ", ".join(f'"{esc(c)}"' for c in col_names)

    inserted = 0
    matched_existing = 0
    batch_size = 500

    with get_conn() as conn, conn.cursor() as cur:
        for start in range(0, len(records), batch_size):
            batch = records[start:start + batch_size]

            row_placeholders = ", ".join(
                "(" + ", ".join(["%s"] * len(col_names)) + ")"
                for _ in batch
            )

            params = []

            for r in batch:
                params.extend(r.get(c) for c in col_names)

            insert_sql = f'''
                INSERT INTO {table_q} ({cols_q})
                VALUES {row_placeholders}
                ON CONFLICT ({key_q}) DO UPDATE SET
                    {company_q} = COALESCE({table_q}.{company_q}, EXCLUDED.{company_q})
                RETURNING (xmax = 0) AS is_new
            '''

            cur.execute(insert_sql, params)

            for (is_new,) in cur.fetchall():
                if is_new:
                    inserted += 1
                else:
                    matched_existing += 1

        conn.commit()

    return inserted, matched_existing


def get_customers_with_recent_loads(start_date):
    with get_conn() as conn, conn.cursor() as cur:
        query = f'''
            SELECT DISTINCT "{COL_COMPANY}"
            FROM "{TABLE_NAME}"
            WHERE "{COL_SHIP_DATE}" ~ '^\\d{{4}}-\\d{{2}}-\\d{{2}}'
              AND LEFT("{COL_SHIP_DATE}", 10)::date >= %s
              AND "{COL_COMPANY}" IS NOT NULL
              AND "{COL_COMPANY}" <> ''
            ORDER BY 1
        '''
        cur.execute(query, (start_date,))
        rows = cur.fetchall()
    return [r[0] for r in rows]


def get_weekly_loads_by_customer(start_date):
    """Weekly load counts per customer (company) since start_date.
    Weeks are bucketed Monday-Sunday via Postgres' ISO date_trunc('week', ...)."""
    with get_conn() as conn, conn.cursor() as cur:
        query = f'''
            SELECT "{COL_COMPANY}" AS company,
                   date_trunc('week', LEFT("{COL_SHIP_DATE}", 10)::date)::date AS week_start,
                   COUNT(*) AS load_count
            FROM "{TABLE_NAME}"
            WHERE "{COL_SHIP_DATE}" ~ '^\\d{{4}}-\\d{{2}}-\\d{{2}}'
              AND LEFT("{COL_SHIP_DATE}", 10)::date >= %s
              AND "{COL_COMPANY}" IS NOT NULL
              AND "{COL_COMPANY}" <> ''
            GROUP BY company, week_start
            ORDER BY company, week_start
        '''
        cur.execute(query, (start_date,))
        rows = cur.fetchall()

    return [
        {"company": company, "weekStart": str(week_start), "loadCount": load_count}
        for company, week_start, load_count in rows
    ]


def get_weekly_loads_by_lane(company, start_date):
    """Weekly load counts per lane (Origin -> Destination) for one customer
    since start_date."""
    with get_conn() as conn, conn.cursor() as cur:
        query = f'''
            SELECT "{COL_ORIGIN}" AS origin,
                   "{COL_DEST}" AS destination,
                   date_trunc('week', LEFT("{COL_SHIP_DATE}", 10)::date)::date AS week_start,
                   COUNT(*) AS load_count
            FROM "{TABLE_NAME}"
            WHERE "{COL_SHIP_DATE}" ~ '^\\d{{4}}-\\d{{2}}-\\d{{2}}'
              AND LEFT("{COL_SHIP_DATE}", 10)::date >= %s
              AND "{COL_COMPANY}" = %s
            GROUP BY origin, destination, week_start
            ORDER BY origin, destination, week_start
        '''
        cur.execute(query, (start_date, company))
        rows = cur.fetchall()

    results = []
    for origin, destination, week_start, load_count in rows:
        lane = f"{origin or 'Unknown'} → {destination or 'Unknown'}"
        results.append({"lane": lane, "weekStart": str(week_start), "loadCount": load_count})
    return results


def get_user_by_email(email):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT email, name, salt, password_hash FROM app_users WHERE email = %s",
            (email.strip().lower(),),
        )
        row = cur.fetchone()

    if not row:
        return None

    return {
        "email": row[0],
        "name": row[1],
        "salt": row[2],
        "passwordHash": row[3],
    }


def create_user(name, email, salt, password_hash):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "INSERT INTO app_users (email, name, salt, password_hash) VALUES (%s, %s, %s, %s)",
            (email.strip().lower(), name.strip(), salt, password_hash),
        )
        conn.commit()


def get_cached_geocode(city_name):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            "SELECT lon, lat, state FROM geocode_cache WHERE city_name = %s",
            (city_name,),
        )
        row = cur.fetchone()

    if not row:
        return None

    return {
        "lon": row[0],
        "lat": row[1],
        "state": row[2],
    }


def set_cached_geocode(city_name, lon, lat, state):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO geocode_cache (city_name, lon, lat, state, updated_at)
            VALUES (%s, %s, %s, %s, now())
            ON CONFLICT (city_name) DO UPDATE
                SET lon = EXCLUDED.lon,
                    lat = EXCLUDED.lat,
                    state = EXCLUDED.state,
                    updated_at = now()
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

    return {
        "km": row[0],
        "hours": row[1],
    }


def set_cached_route(route_key, km, hours):
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO distance_cache (route_key, km, hours, updated_at)
            VALUES (%s, %s, %s, now())
            ON CONFLICT (route_key) DO UPDATE
                SET km = EXCLUDED.km,
                    hours = EXCLUDED.hours,
                    updated_at = now()
            """,
            (route_key, km, hours),
        )
        conn.commit()
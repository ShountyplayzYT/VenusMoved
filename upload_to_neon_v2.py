"""
Upload Customer_Report_*.xlsx ("Load Data" sheet) into the existing
'shipmentsdb' Neon Postgres table, matching its real column names/types.

Setup:
    pip install psycopg2-binary openpyxl

Usage:
    export NEON_DATABASE_URL="postgresql://user:password@host/dbname?sslmode=require"
    python3 upload_to_neon_v2.py "/path/to/Customer_Report_2026-08-11_cleaned (1).xlsx"
"""

import os
import sys
import openpyxl
import psycopg2
from psycopg2.extras import execute_values

TABLE_NAME = "shipmentsdb"

# (excel column index, db column name) -- db column matches shipmentsdb exactly, all TEXT
COLUMNS = [
    (0, "Load #"),
    (1, "Ship/Date"),
    (2, "Del/Date"),
    (3, "ProMiles"),
    (4, "Total Empty Miles"),
    (5, "Origin"),
    (6, "Destination"),
    (7, "PO Numbers"),
    (10, "Equipment Type"),
    (11, "Load Type"),
    (12, "Weight"),
    (13, "Line Haul"),
    (19, "Additional Charges"),
    (21, "Revenue"),
    (23, "Carrier Name"),
    (24, "Carrier Pay"),
    (26, "Carrier P&D"),
    (28, "Carrier FSC"),
    (30, "Carrier Other Charges"),
    (32, "Driver Name"),
    (33, "Gross Driver Pay"),
    (35, "Net Driver Pay"),
    (44, "Gross Margin"),
    (46, "Net Profit"),
    (48, "%"),
]

KEY_COL = "Load #"


def read_rows(xlsx_path):
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    ws = wb["Load Data"]
    all_rows = ws.iter_rows(min_row=2, values_only=True)
    indices = [c[0] for c in COLUMNS]
    out = []
    for r in all_rows:
        if r[0] is None:
            continue
        # cast everything to text/string since the table columns are all TEXT
        out.append(tuple(None if r[i] is None else str(r[i]) for i in indices))
    return out


def main():
    if len(sys.argv) < 2:
        print("Usage: python upload_to_neon_v2.py /path/to/file.xlsx")
        sys.exit(1)

    xlsx_path = sys.argv[1]
    db_url = os.environ.get("NEON_DATABASE_URL")
    if not db_url:
        print("ERROR: set NEON_DATABASE_URL environment variable first.")
        sys.exit(1)

    rows = read_rows(xlsx_path)
    print(f"Read {len(rows)} rows from {xlsx_path}")

    col_names = [name for _, name in COLUMNS]
    quoted_cols = [f'"{c}"' for c in col_names]

    conn = psycopg2.connect(db_url)
    try:
        with conn.cursor() as cur:
            # Ensure Load # is unique so ON CONFLICT works. Safe to re-run.
            cur.execute(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint WHERE conname = 'shipmentsdb_load_unique'
                    ) THEN
                        ALTER TABLE {TABLE_NAME}
                        ADD CONSTRAINT shipmentsdb_load_unique UNIQUE ("{KEY_COL}");
                    END IF;
                END $$;
            """)

            update_cols = [c for c in col_names if c != KEY_COL]
            set_clause = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)

            insert_sql = f"""
                INSERT INTO {TABLE_NAME} ({', '.join(quoted_cols)})
                VALUES %s
                ON CONFLICT ("{KEY_COL}") DO UPDATE SET
                    {set_clause}
            """
            # Escape literal '%' characters (e.g. from the "%" column name) so
            # psycopg2's execute_values doesn't mistake them for format specifiers.
            # Protect the real VALUES %s placeholder first, then escape the rest.
            insert_sql = insert_sql.replace("VALUES %s", "VALUES \x00PLACEHOLDER\x00")
            insert_sql = insert_sql.replace("%", "%%")
            insert_sql = insert_sql.replace("\x00PLACEHOLDER\x00", "%s")

            cur.execute(f"SELECT COUNT(*) FROM {TABLE_NAME};")
            count_before = cur.fetchone()[0]

            execute_values(cur, insert_sql, rows, page_size=500)

            cur.execute(f"SELECT COUNT(*) FROM {TABLE_NAME};")
            count_after = cur.fetchone()[0]

        conn.commit()
        inserted = count_after - count_before
        updated = len(rows) - inserted
        print(f"Done. New rows inserted: {inserted}. Existing rows updated: {updated}.")
        print(f"Table '{TABLE_NAME}' now has {count_after} total rows.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
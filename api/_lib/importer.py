"""
Parses the RAW/uncleaned "Customer_Report_*.xlsx" export — the one where
each customer's loads sit under their own section, like:

    Accu-Crete Inc
    Upper Marlboro, MD
    Tel: 703-477-7042
    Load #   Ship/Date   Del/Date   ...
    14332    2025-09-03  2025-09-05 ...
    ...
    Totals

    AllTrans Logistics Group
    ...

into a flat list of row dicts — one per load — each tagged with the
company name that section belonged to, ready to insert into shipmentsdb.

This mirrors the column layout used by upload_to_neon_v2.py (the raw file
uses the exact same column positions as the already-cleaned "Load Data"
sheet), it just also walks the company section headers to build the new
"Company" field.
"""

import io
import openpyxl

# (excel column index, db column name) — same positions upload_to_neon_v2.py
# uses for the cleaned sheet; the raw sheet's per-block header row lines up
# with the same indices.
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


def _cell_text(value):
    return value.strip() if isinstance(value, str) else value


def parse_raw_workbook(file_bytes):
    """
    Returns a list of dicts, one per load row, with keys matching the
    COLUMNS db column names above plus "Company".
    """
    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    records = []
    current_company = None
    awaiting_address = False

    for row in ws.iter_rows(values_only=True):
        col0 = row[0] if len(row) > 0 else None

        if col0 is None:
            # blank spacer row between blocks
            continue

        if isinstance(col0, str):
            text = _cell_text(col0)
            lowered = text.lower()

            if lowered.startswith("report -"):
                continue  # report title row
            if text == "Load #":
                continue  # per-block header row
            if "total" in lowered:
                # "Totals" / "GRAND TOTAL:" rows — also means the next
                # string row is a new company name, not an address line
                awaiting_address = False
                continue

            # otherwise this is either a company name line or the
            # address/phone line right under it
            if not awaiting_address:
                current_company = text
                awaiting_address = True
            else:
                awaiting_address = False
            continue

        # numeric col0 => an actual load row
        record = {}
        for idx, name in COLUMNS:
            val = row[idx] if len(row) > idx else None
            record[name] = None if val is None else str(val)
        record["Company"] = current_company
        records.append(record)

    return records
import os
import sys
import traceback
import logging
from datetime import date, timedelta

from dateutil.relativedelta import relativedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, HTTPException, Response, UploadFile, File
from openai import OpenAI

from _lib import db, auth, geocode, pricing, importer, dat
from _lib.models import SignupRequest, LoginRequest, LookupRequest, QuoteCreateRequest

logger = logging.getLogger("linehaul.api")

# Explicit config (rather than relying on Python's default "handler of
# last resort") so INFO-level diagnostics show up in Vercel's function
# logs, not just WARNING+. Safe to call once at import time.
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI()


def get_openai_client():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured")
    return OpenAI(api_key=api_key)


def set_session_cookie(response: Response, token: str):
    response.set_cookie(
        key=auth.COOKIE_NAME,
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=auth.SESSION_TTL_SECONDS,
        path="/",
    )


# ---------------------------------------------------------------- auth ----

@app.post("/api/auth/signup")
def signup(payload: SignupRequest, response: Response):
    if not payload.name.strip() or not payload.email.strip() or not payload.password:
        raise HTTPException(status_code=400, detail="Please fill in all fields.")
    if "@" not in payload.email or "." not in payload.email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password should be at least 6 characters.")
    if db.get_user_by_email(payload.email):
        raise HTTPException(status_code=409, detail="An account with that email already exists.")

    password_hash = auth.hash_password(payload.password)
    db.create_user(payload.name, payload.email, salt="", password_hash=password_hash)

    token = auth.create_session_token(payload.email.strip().lower(), payload.name.strip())
    set_session_cookie(response, token)
    return {"email": payload.email.strip().lower(), "name": payload.name.strip()}


@app.post("/api/auth/login")
def login(payload: LoginRequest, response: Response):
    user = auth.authenticate(payload.identifier, payload.password)
    if not user:
        raise HTTPException(status_code=401, detail="Incorrect email/username or password")
    token = auth.create_session_token(user["email"], user["name"])
    set_session_cookie(response, token)
    return user


@app.post("/api/auth/logout")
def logout(response: Response):
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
def me(user=Depends(auth.get_current_user)):
    return user


# --------------------------------------------------------------- lookup ----

def _state_fallback(client, origin_text, destination_text):
    origin_abbr = pricing.resolve_state_abbr(client, origin_text)
    dest_abbr = pricing.resolve_state_abbr(client, destination_text)

    if not origin_abbr or not dest_abbr:
        return None

    try:
        return db.query_state_to_state_details(origin_abbr, dest_abbr)
    except Exception:
        return []


@app.post("/api/lookup")
def lookup(payload: LookupRequest, user=Depends(auth.get_current_user)):
    client = get_openai_client()

    try:
        parsed = pricing.parse_lane_text(client, payload.laneText)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Parsing failed: {e}")

    try:
        details = db.query_shipment_details(parsed["origin"], parsed["destination"])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")

    # Always ask DAT Rateview for a market rate on this lane, regardless
    # of whether we already have our own historical data - it's shown
    # alongside whatever else we find, not just used as a last resort.
    dat_rate = None
    dat_locations = None
    try:
        dat_locations = pricing.resolve_dat_lane(client, payload.laneText, parsed)
        dat_rate = dat.get_rate(
            dat_locations["origin"],
            dat_locations["destination"],
        )
    except Exception as e:
        # Logged (not swallowed silently) so failures are visible in
        # Vercel function logs even though we still return a normal
        # response to the user with datRate: null.
        logger.warning("DAT lookup failed for %s -> %s: %s", parsed["origin"], parsed["destination"], e)

    # Case 1: no exact lane match -> try state-level fallback
    if not details:
        state_details = _state_fallback(client, parsed["origin"], parsed["destination"])
        if state_details:
            return {
                "mode": "state",
                "parsed": parsed,
                "datParsed": dat_locations,
                "historical": state_details,
                "datRate": dat_rate,
            }

        return {
            "mode": "dat" if dat_rate else "none",
            "parsed": parsed,
            "datParsed": dat_locations,
            "historical": None,
            "datRate": dat_rate,
        }

    # Case 3: exact lane match
    return {
        "mode": "exact",
        "parsed": parsed,
        "datParsed": dat_locations,
        "historical": details,
        "datRate": dat_rate,
    }


# --------------------------------------------------------------- import ----

@app.post("/api/import")
async def import_report(file: UploadFile = File(...), user=Depends(auth.get_current_user)):
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Please upload the raw .xlsx report.")

    file_bytes = await file.read()

    try:
        records = importer.parse_raw_workbook(file_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Couldn't read that file: {e}")

    if not records:
        raise HTTPException(status_code=400, detail="No load rows found in that file.")

    try:
        inserted, updated = db.insert_new_shipment_records(records)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database import error: {e}")

    companies = sorted({r["Company"] for r in records if r.get("Company")})

    return {
        "parsed": len(records),
        "inserted": inserted,
        "updated": updated,
        "companies": companies,
    }


# -------------------------------------------------------------- insights ----

def _insights_month_range() -> tuple[date, date]:
    """The two most recently completed calendar months.

    For example, when today is September 7 this returns July 1 through
    September 1, covering July and August while excluding the partial
    current month.
    """
    end_date = date.today().replace(day=1)
    return end_date - relativedelta(months=2), end_date


@app.get("/api/insights/customer-loads")
def insights_customer_loads(user=Depends(auth.get_current_user)):
    start_date, end_date = _insights_month_range()
    try:
        rows = db.get_monthly_loads_by_customer(start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")
    return {"startDate": str(start_date), "endDate": str(end_date), "rows": rows}


@app.get("/api/insights/customers")
def insights_customers(user=Depends(auth.get_current_user)):
    start_date, _ = _insights_month_range()
    try:
        customers = db.get_customers_with_recent_loads(start_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")
    return {"customers": customers}


@app.get("/api/insights/customer-lanes")
def insights_customer_lanes(company: str, user=Depends(auth.get_current_user)):
    if not company.strip():
        raise HTTPException(status_code=400, detail="A customer must be selected.")
    start_date, _ = _insights_month_range()
    try:
        rows = db.get_monthly_loads_by_lane(company, start_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")
    return {"startDate": str(start_date), "company": company, "rows": rows}


@app.get("/api/insights/customer-lane-changes")
def insights_customer_lane_changes(
    company: str, threshold: float = 20, user=Depends(auth.get_current_user)
):
    if not company.strip():
        raise HTTPException(status_code=400, detail="A customer must be selected.")
    start_date, _ = _insights_month_range()
    try:
        rows = db.get_lane_load_changes(company, start_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")
    filtered = [r for r in rows if r["pctDecrease"] >= threshold]
    return {"startDate": str(start_date), "company": company, "threshold": threshold, "rows": filtered}


@app.get("/api/insights/lane-decreases")
def insights_lane_decreases(user=Depends(auth.get_current_user)):
    start_date, end_date = _insights_month_range()
    try:
        rows = db.get_lane_load_changes_all(start_date, end_date)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")

    # Show meaningful increases and decreases, ordered by largest magnitude.
    rows = [row for row in rows if abs(row["pctChange"]) > 30]
    return {"startDate": str(start_date), "endDate": str(end_date), "rows": rows}


@app.get("/api/insights/uninvoiced-loads")
def insights_uninvoiced_loads(user=Depends(auth.get_current_user)):
    try:
        rows = db.get_uninvoiced_loads()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")
    return {"criteria": "Line Haul = 0", "rows": rows}


# ---------------------------------------------------------------- quotes ----

@app.post("/api/quotes")
def create_quote(payload: QuoteCreateRequest, user=Depends(auth.get_current_user)):
    if not payload.origin.strip() or not payload.destination.strip() or not payload.customer.strip():
        raise HTTPException(status_code=400, detail="Origin, destination, and customer are required.")
    try:
        quote = db.create_quote(
            payload.origin, payload.destination, payload.customer, payload.quotedRate, user["email"]
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save quote: {e}")
    return quote


@app.get("/api/quotes")
def quote_history(user=Depends(auth.get_current_user)):
    try:
        rows = db.get_quote_history()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not load quote history: {e}")
    return {"rows": rows}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": f"{exc}", "trace": traceback.format_exc()},
    )

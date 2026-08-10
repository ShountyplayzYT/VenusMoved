import os
import sys
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, Depends, HTTPException, Response
from openai import OpenAI

from _lib import db, auth, geocode, pricing
from _lib.models import SignupRequest, LoginRequest, LookupRequest

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

def _state_fallback(origin_text, destination_text):
    origin_geo = geocode.get_geo_info(origin_text)
    dest_geo = geocode.get_geo_info(destination_text)

    origin_state = origin_geo.get("state") if origin_geo else None
    dest_state = dest_geo.get("state") if dest_geo else None

    origin_abbr = pricing.US_STATE_ABBR.get(origin_state.strip().lower()) if origin_state else None
    dest_abbr = pricing.US_STATE_ABBR.get(dest_state.strip().lower()) if dest_state else None

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
        known_cities = db.get_known_cities()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection error: {e}")

    origin_corrected = db.correct_city(parsed["origin"], known_cities)
    destination_corrected = db.correct_city(parsed["destination"], known_cities)

    # Case 1: couldn't confidently match one or both cities -> try state-level fallback
    if not origin_corrected or not destination_corrected:
        state_details = _state_fallback(parsed["origin"], parsed["destination"])
        return {
            "mode": "state" if state_details else "none",
            "parsed": parsed,
            "historical": state_details,
        }

    try:
        details = db.query_shipment_details(origin_corrected, destination_corrected)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database query error: {e}")

    # Case 2: exact city match found in DB, but no shipments on that lane -> state fallback
    if not details:
        state_details = _state_fallback(origin_corrected, destination_corrected)
        return {
            "mode": "state" if state_details else "none",
            "parsed": {"origin": origin_corrected, "destination": destination_corrected},
            "historical": state_details,
        }

    # Case 3: exact lane match
    return {
        "mode": "exact",
        "parsed": {"origin": origin_corrected, "destination": destination_corrected},
        "historical": details,
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=500,
        content={"detail": f"{exc}", "trace": traceback.format_exc()},
    )

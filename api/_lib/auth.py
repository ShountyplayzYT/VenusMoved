import os
import time

import bcrypt
import jwt
from fastapi import Request, HTTPException

from . import db

COOKIE_NAME = "lh_session"
JWT_ALG = "HS256"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 14  # 14 days


def _secret():
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise RuntimeError("JWT_SECRET environment variable is not set")
    return secret


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except Exception:
        return False


def create_session_token(email: str, name: str) -> str:
    payload = {
        "sub": email,
        "name": name,
        "iat": int(time.time()),
        "exp": int(time.time()) + SESSION_TTL_SECONDS,
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALG)


def decode_session_token(token: str):
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None


def authenticate(identifier: str, password: str):
    """Returns {'email': ..., 'name': ...} on success, else None.
    Checks the app_users table first, then falls back to ADMIN_USERNAME/
    ADMIN_PASSWORD env vars for a single ops account."""
    if not identifier or not password:
        return None

    user = db.get_user_by_email(identifier)
    if user and verify_password(password, user["passwordHash"]):
        return {"email": user["email"], "name": user["name"]}

    admin_user = os.environ.get("ADMIN_USERNAME")
    admin_pass = os.environ.get("ADMIN_PASSWORD")
    if admin_user and admin_pass and identifier == admin_user and password == admin_pass:
        return {"email": admin_user, "name": admin_user}

    return None


def get_current_user(request: Request):
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_session_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Session expired or invalid")
    return {"email": payload["sub"], "name": payload["name"]}

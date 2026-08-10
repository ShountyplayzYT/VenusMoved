from typing import Optional, List
from pydantic import BaseModel


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class LookupRequest(BaseModel):
    laneText: str

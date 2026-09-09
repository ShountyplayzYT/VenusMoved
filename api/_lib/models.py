from typing import Optional, List
from pydantic import BaseModel, Field


class SignupRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    identifier: str
    password: str


class LookupRequest(BaseModel):
    laneText: str


class QuoteCreateRequest(BaseModel):
    origin: str
    destination: str
    customer: str
    quotedRate: float = Field(gt=0)

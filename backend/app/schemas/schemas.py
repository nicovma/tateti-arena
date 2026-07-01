from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


# --- Auth ---

class GoogleAuthRequest(BaseModel):
    token: str

class UserResponse(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: str | None

    model_config = {"from_attributes": True}

class AuthResponse(BaseModel):
    jwt: str
    user: UserResponse


# --- Profile ---

class MatchHistoryItem(BaseModel):
    game_id: UUID
    opponent: str
    result: str          # "WIN", "LOSS", "DRAW"
    date: datetime

class StatsResponse(BaseModel):
    id: UUID
    email: str
    name: str
    avatar_url: str | None
    wins: int
    losses: int
    draws: int
    match_history: list[MatchHistoryItem]

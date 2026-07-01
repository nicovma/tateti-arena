import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.models import models  # noqa: F401
from app.api import auth, profile

from app.core.database import engine, Base

fastapi_app = FastAPI(title="Ta-Te-Ti Arena")

fastapi_app.include_router(auth.router)
fastapi_app.include_router(profile.router)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["http://localhost:3000", "http://localhost:5173"],
)

@fastapi_app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = socketio.ASGIApp(sio, fastapi_app)
from app.socket import events  # noqa: F401


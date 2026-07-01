# Ta-Te-Ti Real-Time Arena — Plan de Implementación

> **Para workers agénticos:** USA superpowers:subagent-driven-development o superpowers:executing-plans para ejecutar tarea por tarea.

**Objetivo:** Construir una aplicación web multijugador de Ta-Te-Ti con autenticación Google, dashboard de stats y gameplay en tiempo real via Socket.IO.

**Arquitectura:** Backend FastAPI + python-socketio montado como ASGI; estado del juego híbrido (memoria durante la partida, Supabase al finalizar); frontend React con Zustand manejando la conexión del socket.

**Tech Stack:** Python 3.12, FastAPI, python-socketio, SQLAlchemy 2.0 async, asyncpg, Supabase (PostgreSQL), python-jose, google-auth, React 18, Vite, Zustand, MUI v5, Axios, Socket.IO Client 4.

---

## Restricciones Globales

- Todo el código, commits, comentarios y variables en inglés
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:`
- Git Flow: `main` → `develop` → `feature/<nombre>`
- Nunca commitear `.env`; sí commitear `.env.example`
- JWT solo en backend; nunca exponer `SECRET_KEY` al frontend
- Cada router de FastAPI solo delega a un service; nunca accede a la DB directamente
- Los event handlers de Socket.IO solo delegan a services/repositories

---

## Mapa de Archivos

```
tateti-arena/
├── .gitignore
├── .env.example
├── docker-compose.yml
├── README.md
├── DEFENSE_NOTES.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   └── app/
│       ├── main.py                  # FastAPI app + ASGI socket mount + startup
│       ├── core/
│       │   ├── config.py            # Settings con pydantic-settings
│       │   ├── database.py          # Engine async + session maker + Base
│       │   └── jwt_utils.py         # create_token, decode_token
│       ├── models/
│       │   └── models.py            # SQLAlchemy: User, Game, GameStatus enum
│       ├── schemas/
│       │   └── schemas.py           # Pydantic: todos los request/response shapes
│       ├── repositories/
│       │   ├── user_repo.py         # UserRepository: get_by_email, create, get_by_id, increment_stats
│       │   └── game_repo.py         # GameRepository: create, finish, get_history
│       ├── services/
│       │   ├── auth_service.py      # verify_google_token, upsert_user
│       │   └── game_service.py      # check_winner, in-memory active_games + waiting_player
│       ├── api/
│       │   ├── auth.py              # POST /auth/google
│       │   └── profile.py           # GET /profile/stats
│       └── socket/
│           └── events.py            # connect, find_match, make_move, send_message, rejoin_game, disconnect
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── main.jsx                 # ReactDOM.render + GoogleOAuthProvider
        ├── App.jsx                  # React Router: rutas públicas y protegidas
        ├── api/
        │   └── axios.js             # Instancia Axios + interceptor JWT
        ├── socket/
        │   └── socket.js            # Socket.IO singleton (se conecta con auth.token)
        ├── store/
        │   ├── authStore.js         # { user, jwt, isAuthenticated }, login, logout
        │   ├── gameStore.js         # { board, mySymbol, ... }, connectSocket, makeMove, etc.
        │   └── uiStore.js           # { toasts }, addToast, removeToast
        ├── components/
        │   ├── Toast.jsx            # MUI Snackbar wrapper, consume uiStore
        │   ├── StatsCard.jsx        # Tarjeta wins/losses/draws
        │   ├── Cell.jsx             # Celda individual del tablero
        │   ├── Board.jsx            # Grid 3x3, recibe board + onCellClick
        │   └── ChatBox.jsx          # Lista de mensajes + input
        └── pages/
            ├── LoginPage.jsx        # Botón GoogleLogin centrado
            ├── DashboardPage.jsx    # Perfil + StatsCard + botón Buscar Partida
            └── GamePage.jsx         # Board + ChatBox + status del juego
```

---

## Tarea 1: Init del Repositorio y Scaffolding

**Archivos:**
- Crear: `.gitignore`, estructura de carpetas, `DEFENSE_NOTES.md` (ya existe)

- [ ] **Paso 1: Inicializar el repositorio git**

```bash
cd /Users/nico/Desktop/Develop/Claude/activo/tateti-arena
git init
git checkout -b develop
```

- [ ] **Paso 2: Crear .gitignore**

```
# Python
__pycache__/
*.py[cod]
.venv/
*.egg-info/
.pytest_cache/
htmlcov/

# Node
node_modules/
dist/
.DS_Store

# Environment
.env
*.env.local

# IDE
.vscode/
.idea/
```

- [ ] **Paso 3: Crear la estructura de carpetas**

```bash
mkdir -p backend/app/{core,models,schemas,repositories,services,api,socket}
mkdir -p backend/tests
mkdir -p frontend/src/{api,socket,store,components,pages}
touch backend/app/__init__.py
touch backend/app/{core,models,schemas,repositories,services,api,socket}/__init__.py
touch backend/tests/__init__.py
```

- [ ] **Paso 4: Primer commit en develop**

```bash
git add .gitignore
git commit -m "chore: initialize repository with git flow structure"
```

- [ ] **Paso 5: Crear rama feature**

```bash
git checkout -b feature/backend-core
```

---

## Tarea 2: Backend Core — Config, Database, Main

**Archivos:**
- Crear: `backend/requirements.txt`, `backend/pytest.ini`, `backend/app/core/config.py`, `backend/app/core/database.py`, `backend/app/main.py`

- [ ] **Paso 1: Crear requirements.txt**

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
python-socketio==5.11.4
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
python-jose[cryptography]==3.3.0
google-auth==2.35.0
pydantic-settings==2.5.2
python-multipart==0.0.12
httpx==0.27.2
pytest==8.3.3
pytest-asyncio==0.24.0
aiosqlite==0.20.0
```

- [ ] **Paso 2: Crear pytest.ini**

```ini
[pytest]
asyncio_mode = auto
```

- [ ] **Paso 3: Crear `app/core/config.py`**

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    GOOGLE_CLIENT_ID: str
    JWT_EXPIRE_DAYS: int = 7

    class Config:
        env_file = ".env"

settings = Settings()
```

- [ ] **Paso 4: Crear `app/core/database.py`**

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with async_session_maker() as session:
        yield session
```

- [ ] **Paso 5: Crear `app/main.py`**

```python
import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base

fastapi_app = FastAPI(title="Ta-Te-Ti Arena")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=["http://localhost:3000"],
)

@fastapi_app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app = socketio.ASGIApp(sio, fastapi_app)
```

> **Nota:** `sio` se define aquí y se importa desde `socket/events.py`. El objeto `app` (no `fastapi_app`) es el que corre uvicorn.

- [ ] **Paso 6: Crear `.env` local (no se commitea) y `.env.example`**

`.env` (solo local, gitignored):
```
DATABASE_URL=postgresql+asyncpg://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
SECRET_KEY=cambia-esto-por-una-clave-secreta-larga
GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

`.env.example` (se commitea):
```
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
SECRET_KEY=change-this-to-a-long-random-secret
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

- [ ] **Paso 7: Verificar que el servidor arranca**

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Esperado: servidor corriendo en `http://127.0.0.1:8000`. Swagger disponible en `http://127.0.0.1:8000/docs`.

- [ ] **Paso 8: Commit**

```bash
git add backend/
git commit -m "feat: add backend core setup (FastAPI + SQLAlchemy + Socket.IO mount)"
```

---

## Tarea 3: Modelos de Base de Datos

**Archivos:**
- Crear: `backend/app/models/models.py`

- [ ] **Paso 1: Crear `app/models/models.py`**

```python
import enum
import uuid
from sqlalchemy import Column, String, Integer, ForeignKey, Enum as SAEnum, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.core.database import Base


class GameStatus(enum.Enum):
    waiting = "waiting"
    in_progress = "in_progress"
    finished = "finished"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String, nullable=False)
    avatar_url = Column(String)
    wins = Column(Integer, default=0, nullable=False)
    losses = Column(Integer, default=0, nullable=False)
    draws = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    games_as_x = relationship("Game", foreign_keys="Game.player_x_id", back_populates="player_x")
    games_as_o = relationship("Game", foreign_keys="Game.player_o_id", back_populates="player_o")


class Game(Base):
    __tablename__ = "games"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    player_x_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    player_o_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    winner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(SAEnum(GameStatus), default=GameStatus.waiting, nullable=False)
    board = Column(String(9), default=" " * 9, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    finished_at = Column(DateTime(timezone=True), nullable=True)

    player_x = relationship("User", foreign_keys=[player_x_id], back_populates="games_as_x")
    player_o = relationship("User", foreign_keys=[player_o_id], back_populates="games_as_o")
```

- [ ] **Paso 2: Importar los modelos en `main.py` para que `create_all` los descubra**

Agregar al inicio de `main.py`, después de los otros imports:
```python
from app.models import models  # noqa: F401 — registers models with Base.metadata
```

- [ ] **Paso 3: Reiniciar el servidor y verificar que las tablas se crean en Supabase**

```bash
uvicorn app.main:app --reload
```

Abrir el dashboard de Supabase → Table Editor → verificar que existen `users` y `games`.

- [ ] **Paso 4: Commit**

```bash
git add backend/app/models/ backend/app/main.py
git commit -m "feat: add SQLAlchemy models for User and Game"
```

---

## Tarea 4: Schemas Pydantic

**Archivos:**
- Crear: `backend/app/schemas/schemas.py`

- [ ] **Paso 1: Crear `app/schemas/schemas.py`**

```python
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
    username: str
    avatar_url: str | None
    wins: int
    losses: int
    draws: int
    match_history: list[MatchHistoryItem]
```

- [ ] **Paso 2: Commit**

```bash
git add backend/app/schemas/
git commit -m "feat: add Pydantic schemas for auth and profile endpoints"
```

---

## Tarea 5: JWT Utils y Auth Service

**Archivos:**
- Crear: `backend/app/core/jwt_utils.py`, `backend/app/services/auth_service.py`

- [ ] **Paso 1: Crear `app/core/jwt_utils.py`**

```python
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt

from app.core.config import settings


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.JWT_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")


def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    user_id: str = payload.get("sub")
    if user_id is None:
        raise JWTError("Missing subject")
    return user_id
```

- [ ] **Paso 2: Crear `app/services/auth_service.py`**

```python
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.repositories.user_repo import UserRepository
from app.models.models import User


async def verify_google_token(token: str) -> dict:
    idinfo = id_token.verify_oauth2_token(
        token,
        google_requests.Request(),
        settings.GOOGLE_CLIENT_ID,
    )
    return idinfo


async def upsert_user(db: AsyncSession, idinfo: dict) -> User:
    repo = UserRepository(db)
    user = await repo.get_by_email(idinfo["email"])
    if user is None:
        user = await repo.create(
            email=idinfo["email"],
            name=idinfo.get("name", ""),
            avatar_url=idinfo.get("picture"),
        )
    return user
```

- [ ] **Paso 3: Commit**

```bash
git add backend/app/core/jwt_utils.py backend/app/services/
git commit -m "feat: add JWT utils and Google token verification service"
```

---

## Tarea 6: User Repository y Auth Endpoint

**Archivos:**
- Crear: `backend/app/repositories/user_repo.py`, `backend/app/api/auth.py`
- Modificar: `backend/app/main.py`

- [ ] **Paso 1: Crear `app/repositories/user_repo.py`**

```python
import uuid
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import User


class UserRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_email(self, email: str) -> User | None:
        result = await self.session.execute(select(User).where(User.email == email))
        return result.scalar_one_or_none()

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    async def create(self, email: str, name: str, avatar_url: str | None) -> User:
        user = User(email=email, name=name, avatar_url=avatar_url)
        self.session.add(user)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def increment_winner(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(wins=User.wins + 1)
        )

    async def increment_loser(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(losses=User.losses + 1)
        )

    async def increment_draw(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(User).where(User.id == user_id).values(draws=User.draws + 1)
        )
```

- [ ] **Paso 2: Crear `app/api/auth.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.jwt_utils import create_access_token
from app.schemas.schemas import GoogleAuthRequest, AuthResponse, UserResponse
from app.services.auth_service import verify_google_token, upsert_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/google", response_model=AuthResponse)
async def google_login(body: GoogleAuthRequest, db: AsyncSession = Depends(get_db)):
    try:
        idinfo = await verify_google_token(body.token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")

    user = await upsert_user(db, idinfo)
    token = create_access_token(str(user.id))

    return AuthResponse(
        jwt=token,
        user=UserResponse.model_validate(user),
    )
```

- [ ] **Paso 3: Registrar el router en `main.py`**

Agregar después de los imports existentes en `main.py`:
```python
from app.api import auth

fastapi_app.include_router(auth.router)
```

- [ ] **Paso 4: Probar el endpoint con curl (sin Google real aún)**

```bash
curl -X POST http://localhost:8000/auth/google \
  -H "Content-Type: application/json" \
  -d '{"token": "token-invalido"}'
```

Esperado: `{"detail": "Invalid Google token"}` con status 401.

- [ ] **Paso 5: Commit**

```bash
git add backend/app/repositories/user_repo.py backend/app/api/auth.py backend/app/main.py
git commit -m "feat: add auth endpoint POST /auth/google with Google token verification"
```

---

## Tarea 7: Game Repository y Profile Endpoint

**Archivos:**
- Crear: `backend/app/repositories/game_repo.py`, `backend/app/api/profile.py`
- Modificar: `backend/app/main.py`

- [ ] **Paso 1: Crear `app/repositories/game_repo.py`**

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import select, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.models import Game, GameStatus, User


class GameRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, player_x_id: uuid.UUID) -> Game:
        game = Game(player_x_id=player_x_id, status=GameStatus.in_progress)
        self.session.add(game)
        await self.session.commit()
        await self.session.refresh(game)
        return game

    async def add_player_o(self, game_id: uuid.UUID, player_o_id: uuid.UUID) -> None:
        await self.session.execute(
            update(Game)
            .where(Game.id == game_id)
            .values(player_o_id=player_o_id, status=GameStatus.in_progress)
        )
        await self.session.commit()

    async def finish(
        self,
        game_id: uuid.UUID,
        winner_id: uuid.UUID | None,
        board: str,
    ) -> None:
        await self.session.execute(
            update(Game)
            .where(Game.id == game_id)
            .values(
                winner_id=winner_id,
                status=GameStatus.finished,
                board=board,
                finished_at=datetime.now(timezone.utc),
            )
        )
        # No commit here — caller commits everything atomically

    async def get_history(self, user_id: uuid.UUID, limit: int = 20) -> list[Game]:
        result = await self.session.execute(
            select(Game)
            .options(selectinload(Game.player_x), selectinload(Game.player_o))
            .where(
                or_(Game.player_x_id == user_id, Game.player_o_id == user_id),
                Game.status == GameStatus.finished,
            )
            .order_by(Game.finished_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
```

- [ ] **Paso 2: Crear `app/api/profile.py`**

```python
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.jwt_utils import decode_access_token
from app.repositories.user_repo import UserRepository
from app.repositories.game_repo import GameRepository
from app.schemas.schemas import StatsResponse, MatchHistoryItem

router = APIRouter(prefix="/profile", tags=["profile"])
bearer = HTTPBearer()


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
) -> uuid.UUID:
    try:
        user_id = decode_access_token(credentials.credentials)
        return uuid.UUID(user_id)
    except (JWTError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    user_id: uuid.UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    game_repo = GameRepository(db)

    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    games = await game_repo.get_history(user_id)

    history = []
    for game in games:
        opponent = game.player_o if game.player_x_id == user_id else game.player_x
        if game.winner_id is None:
            result = "DRAW"
        elif game.winner_id == user_id:
            result = "WIN"
        else:
            result = "LOSS"
        history.append(MatchHistoryItem(
            game_id=game.id,
            opponent=opponent.name if opponent else "Unknown",
            result=result,
            date=game.finished_at,
        ))

    return StatsResponse(
        username=user.name,
        avatar_url=user.avatar_url,
        wins=user.wins,
        losses=user.losses,
        draws=user.draws,
        match_history=history,
    )
```

- [ ] **Paso 3: Registrar el router en `main.py`**

```python
from app.api import auth, profile

fastapi_app.include_router(auth.router)
fastapi_app.include_router(profile.router)
```

- [ ] **Paso 4: Commit**

```bash
git add backend/app/repositories/game_repo.py backend/app/api/profile.py backend/app/main.py
git commit -m "feat: add game repository and GET /profile/stats endpoint"
```

---

## Tarea 8: Game Service y Socket.IO — Matchmaking + Gameplay

**Archivos:**
- Crear: `backend/app/services/game_service.py`, `backend/app/socket/events.py`
- Modificar: `backend/app/main.py`

- [ ] **Paso 1: Crear `app/services/game_service.py`**

```python
from dataclasses import dataclass, field

WINNING_COMBINATIONS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
]


def check_winner(board: list[str]) -> str | None:
    """Returns 'X', 'O', 'draw', or None if game is still in progress."""
    for a, b, c in WINNING_COMBINATIONS:
        if board[a] != " " and board[a] == board[b] == board[c]:
            return board[a]
    if " " not in board:
        return "draw"
    return None


@dataclass
class PlayerState:
    sid: str
    user_id: str
    name: str
    symbol: str


@dataclass
class GameState:
    game_id: str
    board: list[str] = field(default_factory=lambda: [" "] * 9)
    current_turn: str = "X"
    player_x: PlayerState | None = None
    player_o: PlayerState | None = None

    def get_player_by_sid(self, sid: str) -> PlayerState | None:
        if self.player_x and self.player_x.sid == sid:
            return self.player_x
        if self.player_o and self.player_o.sid == sid:
            return self.player_o
        return None

    def get_player_by_user_id(self, user_id: str) -> PlayerState | None:
        if self.player_x and self.player_x.user_id == user_id:
            return self.player_x
        if self.player_o and self.player_o.user_id == user_id:
            return self.player_o
        return None


# In-memory shared state
active_games: dict[str, GameState] = {}
waiting_player: dict | None = None  # {"sid": str, "user_id": str, "name": str}
```

- [ ] **Paso 2: Crear `app/socket/events.py`**

```python
import uuid
from jose import JWTError

from app.main import sio
from app.core.jwt_utils import decode_access_token
from app.core.database import async_session_maker
from app.repositories.user_repo import UserRepository
from app.repositories.game_repo import GameRepository
from app.services.game_service import (
    GameState, PlayerState, check_winner,
    active_games, waiting_player,
)
import app.services.game_service as game_svc


# ── Auth middleware ──────────────────────────────────────────────────────────

@sio.event
async def connect(sid, environ, auth):
    token = (auth or {}).get("token")
    if not token:
        raise ConnectionRefusedError("Authentication required")
    try:
        user_id = decode_access_token(token)
        async with async_session_maker() as db:
            user = await UserRepository(db).get_by_id(uuid.UUID(user_id))
        if user is None:
            raise ConnectionRefusedError("User not found")
        await sio.save_session(sid, {"user_id": user_id, "name": user.name})
    except (JWTError, ValueError):
        raise ConnectionRefusedError("Invalid token")


@sio.event
async def disconnect(sid):
    session = await sio.get_session(sid)
    if not session:
        return
    # Remove from waiting queue if applicable
    if game_svc.waiting_player and game_svc.waiting_player["sid"] == sid:
        game_svc.waiting_player = None
    # Notify opponent if in active game
    for game_id, game in list(active_games.items()):
        if game.get_player_by_sid(sid):
            await sio.emit("opponent_disconnected", {}, room=game_id, skip_sid=sid)
            break


# ── Matchmaking ──────────────────────────────────────────────────────────────

@sio.event
async def find_match(sid, data):
    session = await sio.get_session(sid)
    user_id = session["user_id"]
    name = session["name"]

    if game_svc.waiting_player is None:
        game_svc.waiting_player = {"sid": sid, "user_id": user_id, "name": name}
        await sio.emit("waiting", {}, to=sid)
        return

    opponent = game_svc.waiting_player
    game_svc.waiting_player = None

    # Create game in DB
    game_id = str(uuid.uuid4())
    async with async_session_maker() as db:
        game_repo = GameRepository(db)
        db_game = await game_repo.create(uuid.UUID(opponent["user_id"]))
        await game_repo.add_player_o(db_game.id, uuid.UUID(user_id))
        game_id = str(db_game.id)

    # Build in-memory game state
    player_x = PlayerState(sid=opponent["sid"], user_id=opponent["user_id"], name=opponent["name"], symbol="X")
    player_o = PlayerState(sid=sid, user_id=user_id, name=name, symbol="O")
    active_games[game_id] = GameState(game_id=game_id, player_x=player_x, player_o=player_o)

    # Add both to the Socket.IO room
    await sio.enter_room(opponent["sid"], game_id)
    await sio.enter_room(sid, game_id)

    await sio.emit("game_start", {"game_id": game_id, "symbol": "X", "opponent": name}, to=opponent["sid"])
    await sio.emit("game_start", {"game_id": game_id, "symbol": "O", "opponent": opponent["name"]}, to=sid)


# ── Gameplay ─────────────────────────────────────────────────────────────────

@sio.event
async def make_move(sid, data):
    game_id = data.get("game_id")
    position = data.get("position")

    game = active_games.get(game_id)
    if game is None:
        return

    player = game.get_player_by_sid(sid)
    if player is None or player.symbol != game.current_turn:
        return  # not this player's turn

    if not (0 <= position <= 8) or game.board[position] != " ":
        return  # invalid move

    game.board[position] = player.symbol
    next_turn = "O" if game.current_turn == "X" else "X"
    game.current_turn = next_turn

    result = check_winner(game.board)
    board_str = "".join(game.board)

    if result is None:
        await sio.emit(
            "board_update",
            {"board": board_str, "next_turn": next_turn},
            room=game_id,
        )
        return

    # Game over
    winner_player = None
    loser_player = None
    winner_id = None

    if result == "draw":
        pass
    else:
        winner_player = game.player_x if result == "X" else game.player_o
        loser_player = game.player_o if result == "X" else game.player_x
        winner_id = uuid.UUID(winner_player.user_id)

    async with async_session_maker() as db:
        game_repo = GameRepository(db)
        user_repo = UserRepository(db)
        await game_repo.finish(uuid.UUID(game_id), winner_id, board_str)
        if result == "draw":
            await user_repo.increment_draw(uuid.UUID(game.player_x.user_id))
            await user_repo.increment_draw(uuid.UUID(game.player_o.user_id))
        else:
            await user_repo.increment_winner(winner_id)
            await user_repo.increment_loser(uuid.UUID(loser_player.user_id))
        await db.commit()

    await sio.emit(
        "game_over",
        {"winner_id": str(winner_id) if winner_id else None, "board": board_str},
        room=game_id,
    )

    del active_games[game_id]
```

- [ ] **Paso 3: Importar events en `main.py` para registrar los handlers**

Agregar al final de `main.py`, después de `app = socketio.ASGIApp(...)`:
```python
from app.socket import events  # noqa: F401 — registers Socket.IO event handlers
```

- [ ] **Paso 4: Commit**

```bash
git add backend/app/services/game_service.py backend/app/socket/events.py backend/app/main.py
git commit -m "feat: add Socket.IO matchmaking and real-time gameplay events"
```

---

## Tarea 9: Socket.IO — Chat y Reconexión

**Archivos:**
- Modificar: `backend/app/socket/events.py`

- [ ] **Paso 1: Agregar handler de chat al final de `events.py`**

```python
@sio.event
async def send_message(sid, data):
    game_id = data.get("game_id")
    text = data.get("text", "").strip()

    if not text or game_id not in active_games:
        return

    game = active_games[game_id]
    player = game.get_player_by_sid(sid)
    if player is None:
        return

    await sio.emit(
        "chat_message",
        {"sender": player.name, "text": text},
        room=game_id,
    )
```

- [ ] **Paso 2: Agregar handler de reconexión al final de `events.py`**

```python
@sio.event
async def rejoin_game(sid, data):
    game_id = data.get("game_id")
    session = await sio.get_session(sid)
    user_id = session["user_id"]

    game = active_games.get(game_id)
    if game is None:
        await sio.emit("game_not_found", {}, to=sid)
        return

    player = game.get_player_by_user_id(user_id)
    if player is None:
        return

    # Update the player's sid to the new connection
    player.sid = sid
    await sio.enter_room(sid, game_id)

    opponent = game.player_o if player.symbol == "X" else game.player_x
    await sio.emit(
        "game_rejoined",
        {
            "game_id": game_id,
            "symbol": player.symbol,
            "board": "".join(game.board),
            "current_turn": game.current_turn,
            "opponent": opponent.name if opponent else None,
        },
        to=sid,
    )
```

- [ ] **Paso 3: Commit**

```bash
git add backend/app/socket/events.py
git commit -m "feat: add in-game chat and reconnection via Socket.IO"
```

---

## Tarea 10: Backend Tests

**Archivos:**
- Crear: `backend/tests/conftest.py`, `backend/tests/test_game_logic.py`, `backend/tests/test_auth_endpoint.py`, `backend/tests/test_game_repository.py`

- [ ] **Paso 1: Crear `tests/conftest.py`**

```python
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.database import Base, get_db
from app.main import fastapi_app

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(TEST_DATABASE_URL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with session_maker() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    fastapi_app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(transport=ASGITransport(app=fastapi_app), base_url="http://test") as c:
        yield c
    fastapi_app.dependency_overrides.clear()
```

- [ ] **Paso 2: Crear `tests/test_game_logic.py`**

```python
from app.services.game_service import check_winner


def test_check_winner_detects_row_win():
    board = ["X", "X", "X", " ", " ", " ", " ", " ", " "]
    assert check_winner(board) == "X"


def test_check_winner_detects_column_win():
    board = ["O", " ", " ", "O", " ", " ", "O", " ", " "]
    assert check_winner(board) == "O"


def test_check_winner_detects_diagonal_win():
    board = ["X", " ", " ", " ", "X", " ", " ", " ", "X"]
    assert check_winner(board) == "X"


def test_check_winner_detects_draw():
    board = ["X", "O", "X", "X", "O", "O", "O", "X", "X"]
    assert check_winner(board) == "draw"


def test_check_winner_returns_none_when_in_progress():
    board = ["X", " ", " ", " ", " ", " ", " ", " ", " "]
    assert check_winner(board) is None
```

- [ ] **Paso 3: Ejecutar y verificar que pasan**

```bash
cd backend
pytest tests/test_game_logic.py -v
```

Esperado: 5 tests PASSED.

- [ ] **Paso 4: Crear `tests/test_auth_endpoint.py`**

```python
from unittest.mock import patch, AsyncMock
import pytest


@pytest.mark.asyncio
async def test_google_login_returns_401_with_invalid_token(client):
    response = await client.post("/auth/google", json={"token": "invalid-token"})
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid Google token"


@pytest.mark.asyncio
async def test_google_login_returns_jwt_with_valid_token(client):
    mock_idinfo = {
        "email": "test@example.com",
        "name": "Test User",
        "picture": "https://example.com/avatar.jpg",
    }
    with patch(
        "app.services.auth_service.verify_google_token",
        new=AsyncMock(return_value=mock_idinfo),
    ):
        response = await client.post("/auth/google", json={"token": "valid-token"})

    assert response.status_code == 200
    data = response.json()
    assert "jwt" in data
    assert data["user"]["email"] == "test@example.com"
```

- [ ] **Paso 5: Crear `tests/test_game_repository.py`**

```python
import uuid
import pytest

from app.repositories.game_repo import GameRepository
from app.repositories.user_repo import UserRepository
from app.models.models import GameStatus


@pytest.mark.asyncio
async def test_create_game_persists_to_db(db_session):
    user_repo = UserRepository(db_session)
    user = await user_repo.create(
        email="player@example.com",
        name="Player One",
        avatar_url=None,
    )

    game_repo = GameRepository(db_session)
    game = await game_repo.create(player_x_id=user.id)

    assert game.id is not None
    assert game.player_x_id == user.id
    assert game.status == GameStatus.in_progress
    assert game.board == " " * 9
```

- [ ] **Paso 6: Ejecutar todos los tests**

```bash
pytest tests/ -v
```

Esperado: todos los tests PASSED.

- [ ] **Paso 7: Commit**

```bash
git add backend/tests/
git commit -m "test: add unit, API and repository tests"
```

- [ ] **Paso 8: Mergear a develop**

```bash
git checkout develop
git merge feature/backend-core --no-ff -m "feat: complete backend implementation"
git checkout -b feature/frontend
```

---

## Tarea 11: Frontend Setup — Vite, Axios, Socket Singleton

**Archivos:**
- Crear: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/src/main.jsx`, `frontend/src/api/axios.js`, `frontend/src/socket/socket.js`

- [ ] **Paso 1: Crear el proyecto con Vite**

```bash
cd /Users/nico/Desktop/Develop/Claude/activo/tateti-arena
npm create vite@latest frontend -- --template react
cd frontend
npm install
```

- [ ] **Paso 2: Instalar dependencias**

```bash
npm install @mui/material @mui/icons-material @emotion/react @emotion/styled
npm install zustand axios socket.io-client react-router-dom
npm install @react-oauth/google
```

- [ ] **Paso 3: Crear `src/api/axios.js`**

```js
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
})

api.interceptors.request.use((config) => {
  const jwt = localStorage.getItem('jwt')
  if (jwt) {
    config.headers.Authorization = `Bearer ${jwt}`
  }
  return config
})

export default api
```

- [ ] **Paso 4: Crear `src/socket/socket.js`**

```js
import { io } from 'socket.io-client'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:8000'

let socket = null

export function getSocket(token) {
  if (!socket) {
    socket = io(SOCKET_URL, {
      auth: { token },
      autoConnect: false,
    })
  }
  return socket
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect()
    socket = null
  }
}
```

- [ ] **Paso 5: Crear `.env.local` en frontend/ (gitignored por Vite por defecto)**

```
VITE_API_URL=http://localhost:8000
VITE_SOCKET_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
```

- [ ] **Paso 6: Commit**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with Vite, Axios interceptor and Socket.IO singleton"
```

---

## Tarea 12: Zustand Stores

**Archivos:**
- Crear: `frontend/src/store/authStore.js`, `frontend/src/store/gameStore.js`, `frontend/src/store/uiStore.js`

- [ ] **Paso 1: Crear `src/store/authStore.js`**

```js
import { create } from 'zustand'
import api from '../api/axios'

const useAuthStore = create((set) => ({
  user: null,
  jwt: localStorage.getItem('jwt') || null,
  isAuthenticated: !!localStorage.getItem('jwt'),

  login: async (googleToken) => {
    const { data } = await api.post('/auth/google', { token: googleToken })
    localStorage.setItem('jwt', data.jwt)
    set({ jwt: data.jwt, user: data.user, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('jwt')
    localStorage.removeItem('game_id')
    set({ jwt: null, user: null, isAuthenticated: false })
  },

  loadProfile: async () => {
    const { data } = await api.get('/profile/stats')
    set({ user: data })
  },
}))

export default useAuthStore
```

- [ ] **Paso 2: Crear `src/store/uiStore.js`**

```js
import { create } from 'zustand'

const useUiStore = create((set) => ({
  toasts: [],

  addToast: (message, severity = 'info') => {
    const id = Date.now()
    set((s) => ({ toasts: [...s.toasts, { id, message, severity }] }))
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export default useUiStore
```

- [ ] **Paso 3: Crear `src/store/gameStore.js`**

```js
import { create } from 'zustand'
import { getSocket, disconnectSocket } from '../socket/socket'
import useUiStore from './uiStore'

const useGameStore = create((set, get) => ({
  gameId: null,
  board: Array(9).fill(' '),
  mySymbol: null,
  currentTurn: 'X',
  status: 'idle',        // idle | waiting | playing | finished
  opponent: null,
  messages: [],
  winnerId: null,

  connectSocket: (jwt) => {
    const socket = getSocket(jwt)

    socket.on('waiting', () => set({ status: 'waiting' }))

    socket.on('game_start', ({ game_id, symbol, opponent }) => {
      localStorage.setItem('game_id', game_id)
      set({
        gameId: game_id,
        mySymbol: symbol,
        opponent,
        status: 'playing',
        board: Array(9).fill(' '),
        currentTurn: 'X',
        messages: [],
        winnerId: null,
      })
    })

    socket.on('board_update', ({ board, next_turn }) => {
      set({ board: board.split(''), currentTurn: next_turn })
    })

    socket.on('game_over', ({ winner_id, board }) => {
      localStorage.removeItem('game_id')
      set({ board: board.split(''), status: 'finished', winnerId: winner_id })
    })

    socket.on('chat_message', ({ sender, text }) => {
      set((s) => ({ messages: [...s.messages, { sender, text }] }))
    })

    socket.on('game_rejoined', ({ game_id, symbol, board, current_turn, opponent }) => {
      set({
        gameId: game_id,
        mySymbol: symbol,
        board: board.split(''),
        currentTurn: current_turn,
        opponent,
        status: 'playing',
      })
    })

    socket.on('opponent_disconnected', () => {
      useUiStore.getState().addToast('El oponente se desconectó', 'warning')
    })

    socket.on('connect_error', (err) => {
      useUiStore.getState().addToast(`Error de conexión: ${err.message}`, 'error')
    })

    socket.connect()
  },

  findMatch: () => {
    const socket = getSocket()
    socket.emit('find_match', {})
    set({ status: 'waiting' })
  },

  makeMove: (position) => {
    const { gameId, mySymbol, currentTurn, board } = get()
    if (mySymbol !== currentTurn || board[position] !== ' ') return
    const socket = getSocket()
    socket.emit('make_move', { game_id: gameId, position })
  },

  sendMessage: (text) => {
    const { gameId } = get()
    const socket = getSocket()
    socket.emit('send_message', { game_id: gameId, text })
  },

  rejoinIfNeeded: () => {
    const savedGameId = localStorage.getItem('game_id')
    if (savedGameId) {
      const socket = getSocket()
      socket.emit('rejoin_game', { game_id: savedGameId })
    }
  },

  resetGame: () => {
    localStorage.removeItem('game_id')
    set({
      gameId: null,
      board: Array(9).fill(' '),
      mySymbol: null,
      currentTurn: 'X',
      status: 'idle',
      opponent: null,
      messages: [],
      winnerId: null,
    })
  },

  disconnect: () => {
    disconnectSocket()
    set({ status: 'idle' })
  },
}))

export default useGameStore
```

- [ ] **Paso 4: Commit**

```bash
git add frontend/src/store/
git commit -m "feat: add Zustand stores for auth, game state and UI notifications"
```

---

## Tarea 13: App Shell y LoginPage

**Archivos:**
- Crear: `frontend/src/components/Toast.jsx`, `frontend/src/pages/LoginPage.jsx`
- Modificar: `frontend/src/main.jsx`, `frontend/src/App.jsx`

- [ ] **Paso 1: Crear `src/components/Toast.jsx`**

```jsx
import { Snackbar, Alert } from '@mui/material'
import useUiStore from '../store/uiStore'

export default function Toast() {
  const { toasts, removeToast } = useUiStore()

  return toasts.map((toast) => (
    <Snackbar
      key={toast.id}
      open
      autoHideDuration={4000}
      onClose={() => removeToast(toast.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert severity={toast.severity} onClose={() => removeToast(toast.id)}>
        {toast.message}
      </Alert>
    </Snackbar>
  ))
}
```

- [ ] **Paso 2: Crear `src/pages/LoginPage.jsx`**

```jsx
import { Box, Typography, Paper } from '@mui/material'
import { GoogleLogin } from '@react-oauth/google'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import useUiStore from '../store/uiStore'

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const addToast = useUiStore((s) => s.addToast)
  const navigate = useNavigate()

  const handleSuccess = async (credentialResponse) => {
    try {
      await login(credentialResponse.credential)
      navigate('/dashboard')
    } catch {
      addToast('Error al iniciar sesión. Intentá de nuevo.', 'error')
    }
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" bgcolor="grey.100">
      <Paper elevation={3} sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
        <Typography variant="h4" fontWeight="bold" mb={1}>
          Ta-Te-Ti Arena
        </Typography>
        <Typography variant="body1" color="text.secondary" mb={4}>
          Jugá en tiempo real contra otro jugador
        </Typography>
        <GoogleLogin onSuccess={handleSuccess} onError={() => addToast('Login fallido', 'error')} />
      </Paper>
    </Box>
  )
}
```

- [ ] **Paso 3: Crear `src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import GamePage from './pages/GamePage'
import Toast from './components/Toast'

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/game" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  )
}
```

- [ ] **Paso 4: Crear `src/main.jsx`**

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')).render(
  <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
    <App />
  </GoogleOAuthProvider>
)
```

- [ ] **Paso 5: Verificar que el login page renderiza**

```bash
cd frontend && npm run dev
```

Abrir `http://localhost:5173` y verificar que aparece la pantalla de login con el botón de Google.

- [ ] **Paso 6: Commit**

```bash
git add frontend/src/
git commit -m "feat: add App shell with routing and LoginPage with Google OAuth"
```

---

## Tarea 14: DashboardPage

**Archivos:**
- Crear: `frontend/src/components/StatsCard.jsx`, `frontend/src/pages/DashboardPage.jsx`

- [ ] **Paso 1: Crear `src/components/StatsCard.jsx`**

```jsx
import { Card, CardContent, Typography, Stack } from '@mui/material'

function StatItem({ label, value, color }) {
  return (
    <Stack alignItems="center">
      <Typography variant="h4" fontWeight="bold" color={color}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  )
}

export default function StatsCard({ wins, losses, draws }) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" mb={2}>Estadísticas</Typography>
        <Stack direction="row" justifyContent="space-around">
          <StatItem label="Ganadas" value={wins} color="success.main" />
          <StatItem label="Perdidas" value={losses} color="error.main" />
          <StatItem label="Empatadas" value={draws} color="warning.main" />
        </Stack>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Paso 2: Crear `src/pages/DashboardPage.jsx`**

```jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Button, Avatar, Typography, Container,
  AppBar, Toolbar, Stack, Divider, List,
  ListItem, ListItemText, Chip
} from '@mui/material'
import useAuthStore from '../store/authStore'
import useGameStore from '../store/gameStore'
import StatsCard from '../components/StatsCard'

const RESULT_COLOR = { WIN: 'success', LOSS: 'error', DRAW: 'default' }

export default function DashboardPage() {
  const { user, logout, loadProfile } = useAuthStore()
  const { connectSocket, findMatch } = useGameStore()
  const jwt = useAuthStore((s) => s.jwt)
  const navigate = useNavigate()

  useEffect(() => {
    loadProfile()
    connectSocket(jwt)
  }, [])

  const handleFindMatch = () => {
    findMatch()
    navigate('/game')
  }

  if (!user) return null

  return (
    <>
      <AppBar position="static">
        <Toolbar sx={{ justifyContent: 'space-between' }}>
          <Typography variant="h6" fontWeight="bold">Ta-Te-Ti Arena</Typography>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar src={user.avatar_url} sx={{ width: 32, height: 32 }} />
            <Typography>{user.username || user.name}</Typography>
            <Button color="inherit" onClick={logout}>Salir</Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ mt: 4 }}>
        <StatsCard wins={user.wins || 0} losses={user.losses || 0} draws={user.draws || 0} />

        <Button variant="contained" size="large" fullWidth onClick={handleFindMatch} sx={{ mb: 4 }}>
          Buscar Partida
        </Button>

        <Typography variant="h6" mb={1}>Historial</Typography>
        <Divider sx={{ mb: 1 }} />
        <List>
          {(user.match_history || []).map((match) => (
            <ListItem key={match.game_id} divider>
              <ListItemText
                primary={`vs ${match.opponent}`}
                secondary={new Date(match.date).toLocaleString('es-AR')}
              />
              <Chip label={match.result} color={RESULT_COLOR[match.result]} size="small" />
            </ListItem>
          ))}
        </List>
      </Container>
    </>
  )
}
```

- [ ] **Paso 3: Commit**

```bash
git add frontend/src/components/StatsCard.jsx frontend/src/pages/DashboardPage.jsx
git commit -m "feat: add Dashboard with stats, match history and find-match button"
```

---

## Tarea 15: GamePage — Tablero, Chat y Estados

**Archivos:**
- Crear: `frontend/src/components/Cell.jsx`, `frontend/src/components/Board.jsx`, `frontend/src/components/ChatBox.jsx`, `frontend/src/pages/GamePage.jsx`

- [ ] **Paso 1: Crear `src/components/Cell.jsx`**

```jsx
import { Box } from '@mui/material'

const SYMBOL_COLOR = { X: 'primary.main', O: 'error.main' }

export default function Cell({ value, onClick, disabled }) {
  return (
    <Box
      onClick={disabled || value !== ' ' ? undefined : onClick}
      sx={{
        width: 100,
        height: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2.5rem',
        fontWeight: 'bold',
        border: '2px solid',
        borderColor: 'divider',
        color: SYMBOL_COLOR[value] || 'transparent',
        cursor: disabled || value !== ' ' ? 'default' : 'pointer',
        transition: 'background-color 0.15s',
        '&:hover': {
          bgcolor: disabled || value !== ' ' ? undefined : 'action.hover',
        },
      }}
    >
      {value !== ' ' ? value : ''}
    </Box>
  )
}
```

- [ ] **Paso 2: Crear `src/components/Board.jsx`**

```jsx
import { Grid } from '@mui/material'
import Cell from './Cell'

export default function Board({ board, onCellClick, disabled }) {
  return (
    <Grid container sx={{ width: 306, border: '2px solid', borderColor: 'divider' }}>
      {board.map((value, index) => (
        <Grid item key={index} xs={4}>
          <Cell value={value} onClick={() => onCellClick(index)} disabled={disabled} />
        </Grid>
      ))}
    </Grid>
  )
}
```

- [ ] **Paso 3: Crear `src/components/ChatBox.jsx`**

```jsx
import { useState, useRef, useEffect } from 'react'
import { Box, TextField, IconButton, List, ListItem, ListItemText, Typography, Paper } from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import useGameStore from '../store/gameStore'

export default function ChatBox() {
  const { messages, sendMessage } = useGameStore()
  const [text, setText] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage(text.trim())
    setText('')
  }

  return (
    <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: 300, width: 300 }}>
      <Typography variant="subtitle2" sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        Chat
      </Typography>
      <List dense sx={{ flex: 1, overflowY: 'auto', p: 1 }}>
        {messages.map((msg, i) => (
          <ListItem key={i} disableGutters>
            <ListItemText
              primary={<><strong>{msg.sender}:</strong> {msg.text}</>}
            />
          </ListItem>
        ))}
        <div ref={bottomRef} />
      </List>
      <Box sx={{ display: 'flex', p: 1, borderTop: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          fullWidth
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Escribí un mensaje..."
        />
        <IconButton onClick={handleSend} color="primary">
          <SendIcon />
        </IconButton>
      </Box>
    </Paper>
  )
}
```

- [ ] **Paso 4: Crear `src/pages/GamePage.jsx`**

```jsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, CircularProgress, Button, Stack, Chip } from '@mui/material'
import useGameStore from '../store/gameStore'
import useAuthStore from '../store/authStore'
import Board from '../components/Board'
import ChatBox from '../components/ChatBox'

export default function GamePage() {
  const { board, mySymbol, currentTurn, status, opponent, winnerId, makeMove, rejoinIfNeeded, resetGame } = useGameStore()
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  useEffect(() => {
    rejoinIfNeeded()
  }, [])

  const handleLeave = () => {
    resetGame()
    navigate('/dashboard')
  }

  const isMyTurn = mySymbol === currentTurn && status === 'playing'

  const getStatusMessage = () => {
    if (status === 'waiting') return 'Buscando oponente...'
    if (status === 'playing') return isMyTurn ? 'Tu turno' : `Turno de ${opponent}`
    if (status === 'finished') {
      if (!winnerId) return '¡Empate!'
      return winnerId === String(user?.id) ? '¡Ganaste!' : '¡Perdiste!'
    }
    return ''
  }

  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={3}>
      <Typography variant="h5" fontWeight="bold">
        {status === 'playing' || status === 'finished' ? `Vos (${mySymbol}) vs ${opponent}` : 'Ta-Te-Ti Arena'}
      </Typography>

      <Chip
        label={getStatusMessage()}
        color={status === 'finished' && winnerId === String(user?.id) ? 'success' : 'default'}
        sx={{ fontSize: '1rem', p: 1 }}
      />

      {status === 'waiting' && <CircularProgress />}

      {(status === 'playing' || status === 'finished') && (
        <Stack direction="row" spacing={3} alignItems="flex-start">
          <Board board={board} onCellClick={makeMove} disabled={!isMyTurn} />
          <ChatBox />
        </Stack>
      )}

      {status === 'finished' && (
        <Button variant="contained" onClick={handleLeave}>Volver al Lobby</Button>
      )}
    </Box>
  )
}
```

- [ ] **Paso 5: Verificar el flujo completo en el navegador**

```bash
# Terminal 1 — backend
cd backend && uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend && npm run dev
```

Abrir dos tabs en `http://localhost:5173`, loguear con dos cuentas de Google distintas, y verificar que se empareja, el tablero sincroniza en tiempo real y el chat funciona.

- [ ] **Paso 6: Commit**

```bash
git add frontend/src/components/ frontend/src/pages/GamePage.jsx
git commit -m "feat: add game board, chat and GamePage with real-time sync"
```

---

## Tarea 16: Docker Compose, Dockerfiles y README

**Archivos:**
- Crear: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`, `README.md`

- [ ] **Paso 1: Crear `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Paso 2: Crear `frontend/nginx.conf`**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Paso 3: Crear `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json .
RUN npm install
COPY . .
ARG VITE_API_URL=http://localhost:8000
ARG VITE_SOCKET_URL=http://localhost:8000
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Paso 4: Crear `docker-compose.yml` en la raíz**

```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file:
      - .env

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: http://localhost:8000
        VITE_SOCKET_URL: http://localhost:8000
        VITE_GOOGLE_CLIENT_ID: ${VITE_GOOGLE_CLIENT_ID}
    ports:
      - "3000:80"
    depends_on:
      - backend
```

- [ ] **Paso 5: Crear `README.md`**

```markdown
# Ta-Te-Ti Real-Time Arena

Multiplayer Tic-Tac-Toe with Google authentication and real-time gameplay via Socket.IO.

## Stack

- **Frontend:** React 18, Zustand, MUI v5, Axios, Socket.IO Client
- **Backend:** Python 3.12, FastAPI, python-socketio, SQLAlchemy 2.0
- **Database:** PostgreSQL (Supabase)
- **Infra:** Docker Compose

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A Google Cloud project with OAuth 2.0 credentials
- A Supabase project (free tier)

### Setup

1. Clone the repo and copy the env file:

\`\`\`bash
git clone <repo-url>
cd tateti-arena
cp .env.example .env
\`\`\`

2. Fill in `.env` with your credentials.

3. Run with Docker Compose:

\`\`\`bash
docker compose up --build
\`\`\`

- Frontend: http://localhost:3000
- Backend API + Docs: http://localhost:8000/docs

### Local Development (without Docker)

**Backend:**
\`\`\`bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
\`\`\`

**Frontend:**
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/google` | Public | Exchange Google token for app JWT |
| GET | `/profile/stats` | JWT | Get user profile, stats and match history |

### Example response — `GET /profile/stats`

\`\`\`json
{
  "username": "Nicolás Valentini",
  "wins": 12,
  "losses": 5,
  "draws": 2,
  "match_history": [
    {
      "game_id": "uuid",
      "opponent": "Player2",
      "result": "WIN",
      "date": "2026-06-30T10:00:00Z"
    }
  ]
}
\`\`\`

## Running Tests

\`\`\`bash
cd backend
pytest tests/ -v
\`\`\`

## Architecture

\`\`\`
tateti-arena/
├── frontend/   React + Zustand + MUI
└── backend/
    ├── api/          Controllers (routers)
    ├── services/     Business logic
    ├── repositories/ Data access layer
    ├── models/       SQLAlchemy models
    └── socket/       Socket.IO event handlers
\`\`\`
```

- [ ] **Paso 6: Commit final y merge a develop → main**

```bash
git add docker-compose.yml backend/Dockerfile frontend/Dockerfile frontend/nginx.conf README.md .env.example
git commit -m "chore: add Docker Compose, Dockerfiles and README"

git checkout develop
git merge feature/frontend --no-ff -m "feat: complete frontend implementation"

git checkout main
git merge develop --no-ff -m "feat: initial release — Ta-Te-Ti Real-Time Arena v1.0"
git tag v1.0.0
```

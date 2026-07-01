# Ta-Te-Ti Arena

Real-time multiplayer Tic-Tac-Toe with Google SSO, in-game chat, reconnection support and a stats dashboard.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, python-socketio |
| Database | PostgreSQL (Supabase) + SQLAlchemy 2.0 async |
| Auth | Google OAuth 2.0 + JWT |
| Frontend | React 18, TypeScript, Vite, MUI v9, Zustand |
| Realtime | Socket.IO |
| Infra | Docker + Docker Compose |

## Prerequisites

- Docker and Docker Compose, **or** Python 3.12 + Node.js 20
- A PostgreSQL database (Supabase free tier works)
- A Google Cloud OAuth 2.0 Client ID

## Run with Docker

Create a root `.env` file:

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

Create `backend/.env` using `.env.example` as reference and fill in `DATABASE_URL`, `SECRET_KEY` and `GOOGLE_CLIENT_ID`.

Then build and start:

```
docker compose up --build
```

Open http://localhost:3000

## Run in Development Mode

**Backend:**

```
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**

```
cd frontend
npm install
npm run dev
```

Environment files needed:

- `backend/.env` — see `.env.example` for required variables
- `frontend/.env.local` — `VITE_API_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_CLIENT_ID`

## Run Tests

Activate the virtual environment first:

    source .venv/bin/activate

Then run:

    pytest

## Architecture

```
tateti-arena/
├── backend/
│   └── app/
│       ├── api/          # FastAPI routers (auth, profile)
│       ├── services/     # Business logic (game rules, matchmaking)
│       ├── repositories/ # DB access layer
│       ├── models/       # SQLAlchemy models
│       ├── schemas/      # Pydantic request/response schemas
│       ├── socket/       # Socket.IO event handlers
│       └── core/         # Config, JWT utils, DB session
└── frontend/
    └── src/
        ├── api/          # Axios instance + JWT interceptor
        ├── components/   # Board, Cell, ChatBox, StatsCard
        ├── pages/        # LoginPage, DashboardPage, GamePage
        ├── store/        # Zustand stores (auth, game, ui)
        └── socket/       # Socket.IO client singleton
```

**Key design decisions:**

- **Hybrid game state:** board lives in memory during play, persisted to DB only on game end — no DB round-trip per move
- **Denormalized stats counters:** `wins/losses/draws` stored on the `users` table, updated atomically with the game result in a single transaction
- **Socket.IO rooms:** `game_id` doubles as the Socket.IO room — no extra mapping needed
- **Reconnection:** `game_id` saved in `localStorage`; on refresh, client emits `rejoin_game` and server re-adds the socket to the existing room

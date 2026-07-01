# Spec de Diseño: Ta-Te-Ti Real-Time Arena
**Fecha:** 2026-06-30  
**Autor:** Nicolás Valentini  
**Challenge:** Snoop Consulting — Senior Full Stack

---

## 1. Objetivo y Alcance

Aplicación web multijugador de Ta-Te-Ti con autenticación via Google, dashboard de estadísticas del jugador y partidas en tiempo real via Socket.IO.

**Dentro del alcance:**
- Google SSO → sesión basada en JWT
- Dashboard con perfil y estadísticas
- Emparejamiento y gameplay en tiempo real (Socket.IO)
- Persistencia de historial de partidas y estadísticas
- Bonus: reconexión, chat en partida, Docker Compose

**Fuera del alcance:**
- Modo espectador, torneos, ranking ELO
- Aplicación móvil, PWA

---

## 2. Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React + Zustand + MUI + Axios + Socket.IO Client |
| Backend | Python 3.12 + FastAPI + python-socketio |
| ORM | SQLAlchemy 2.0 |
| Base de datos | PostgreSQL via Supabase (plan gratuito) |
| Autenticación | Google OAuth 2.0 → JWT propio (python-jose) |
| Testing | pytest + httpx + SQLite en memoria |
| Infraestructura | Docker Compose (frontend + backend; Supabase es cloud) |

---

## 3. Estructura del Repositorio

Monorepo único `tateti-arena/`:

```
tateti-arena/
├── docker-compose.yml
├── .env.example
├── DEFENSE_NOTES.md
├── README.md
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── api/          # Instancia de Axios + interceptor JWT
│       ├── components/   # Board, Cell, ChatBox, StatsCard, Toast
│       ├── pages/        # LoginPage, DashboardPage, GamePage
│       ├── store/        # authStore, gameStore, uiStore (Zustand)
│       └── socket/       # Singleton del cliente Socket.IO
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── app/
    │   ├── main.py
    │   ├── api/          # Routers de FastAPI: auth, profile
    │   ├── services/     # auth_service, game_service
    │   ├── repositories/ # user_repo, game_repo
    │   ├── models/       # SQLAlchemy: User, Game
    │   ├── schemas/      # Pydantic: formas de request/response
    │   ├── socket/       # Eventos Socket.IO: matchmaking, movimientos, chat
    │   └── core/         # config, jwt_utils, sesión de DB
    └── tests/
        ├── test_game_logic.py
        ├── test_auth_endpoint.py
        └── test_game_repository.py
```

---

## 4. Esquema de Base de Datos

### `users`
| columna | tipo | notas |
|---------|------|-------|
| `id` | UUID PK | generado por la DB |
| `email` | VARCHAR UNIQUE | viene de Google |
| `name` | VARCHAR | viene de Google |
| `avatar_url` | VARCHAR | viene de Google |
| `wins` | INTEGER DEFAULT 0 | contador denormalizado |
| `losses` | INTEGER DEFAULT 0 | contador denormalizado |
| `draws` | INTEGER DEFAULT 0 | contador denormalizado |
| `created_at` | TIMESTAMPTZ | |

### `games`
| columna | tipo | notas |
|---------|------|-------|
| `id` | UUID PK | también se usa como room_id de Socket.IO |
| `player_x_id` | UUID FK → users | primer jugador en unirse |
| `player_o_id` | UUID FK → users | segundo jugador |
| `winner_id` | UUID FK → users, nullable | NULL = empate o en curso |
| `status` | ENUM: `waiting` / `in_progress` / `finished` | |
| `board` | VARCHAR(9) | estado final del tablero, ej: `"XOX OX  O"` |
| `created_at` | TIMESTAMPTZ | |
| `finished_at` | TIMESTAMPTZ, nullable | |

**Índices:** `player_x_id` y `player_o_id` en `games`.

Los **contadores de estadísticas** se actualizan atómicamente dentro de la misma transacción que cierra la partida, garantizando consistencia sin queries de agregación costosas en cada carga del dashboard.

---

## 5. Flujo de Autenticación

```
Frontend          Backend           Google
   │                 │                 │
   │ 1. Botón login  │                 │
   │ Google SDK popup│                 │
   │<──────────────────────────────────>
   │ 2. google_token │                 │
   │                 │                 │
   │ POST /auth/google                 │
   │ { token }──────>│                 │
   │                 │ 3. verifica ───>│
   │                 │ { email, name, avatar }
   │                 │<────────────────│
   │                 │ 4. upsert user  │
   │                 │ 5. firma JWT    │
   │ { jwt, user }   │                 │
   │<────────────────│                 │
   │ 6. guarda en Zustand + localStorage
```

**Restricciones de seguridad:**
- El `google_token` nunca se persiste, se usa una vez para verificar identidad
- El JWT de la app se firma con `SECRET_KEY` del `.env`, nunca expuesto al frontend
- El interceptor de Axios inyecta `Authorization: Bearer <token>` en cada request
- El middleware de Socket.IO valida el JWT en cada conexión

---

## 6. Flujo de Juego (Eventos Socket.IO)

### Cliente → Servidor
| evento | payload | descripción |
|--------|---------|-------------|
| `find_match` | `{}` | entrar a la cola de emparejamiento |
| `make_move` | `{ game_id, position }` | jugar en posición 0–8 |
| `send_message` | `{ game_id, text }` | chat en partida |
| `rejoin_game` | `{ game_id }` | reconectarse tras refrescar la página |

### Servidor → Cliente
| evento | payload | descripción |
|--------|---------|-------------|
| `waiting` | `{}` | sin oponente todavía |
| `game_start` | `{ game_id, symbol, opponent }` | partida encontrada |
| `board_update` | `{ board, next_turn }` | tras cada movimiento |
| `game_over` | `{ winner_id, board }` | partida finalizada |
| `chat_message` | `{ sender, text, timestamp }` | relay del chat |

### Estrategia de Estado del Juego: Híbrido (memoria + DB)
1. Se crea la partida → se persiste en DB con `status=in_progress` + se carga en el diccionario en memoria `{ game_id: GameState }`
2. Durante el juego → los movimientos se validan y aplican solo en memoria (cero queries por movimiento)
3. La partida termina → resultado persistido en DB, contadores actualizados en una sola transacción, se elimina de memoria
4. Reconexión → el cliente envía `rejoin_game`, el servidor busca el `game_id` en memoria y reincorpora al jugador al room de Socket.IO

---

## 7. Estado del Frontend (Zustand)

### `authStore`
```ts
{ user, jwt, isAuthenticated }
login(googleToken): llama a POST /auth/google, guarda el resultado
logout(): limpia el store + localStorage
```

### `gameStore`
```ts
{ gameId, board, mySymbol, currentTurn, status, opponent, messages }
connectSocket(jwt): crea el socket, registra todos los listeners de eventos
findMatch(): emite find_match
makeMove(position): emite make_move
sendMessage(text): emite send_message
disconnectSocket(): limpieza
```

La lógica de Socket.IO vive dentro del store — los componentes nunca importan el socket directamente.

### `uiStore`
```ts
{ toasts, isLoading }
addToast(message, severity): notificación push
removeToast(id): descartar
```

---

## 8. Endpoints de la API

| método | ruta | auth | descripción |
|--------|------|------|-------------|
| POST | `/auth/google` | público | intercambia token de Google por JWT de la app |
| GET | `/profile/stats` | JWT | obtiene perfil + estadísticas + historial de partidas |

---

## 9. Tests

Tres tests representativos que demuestran comprensión en cada capa:

| archivo | capa | qué testea |
|---------|------|-----------|
| `test_game_logic.py` | lógica pura | `check_winner()`: detección de ganador, empate, en curso |
| `test_auth_endpoint.py` | API | `POST /auth/google` con token inválido devuelve 401 |
| `test_game_repository.py` | repositorio | `create_game()` persiste correctamente en SQLite en memoria |

---

## 10. Docker Compose

Dos servicios: `frontend` (React, puerto 3000) y `backend` (FastAPI, puerto 8000).  
Supabase es cloud — no se necesita container de DB.  
El archivo `.env` en la raíz se inyecta en ambos servicios en tiempo de ejecución.

---

## 11. Git Flow

- `main` — solo código listo para producción
- `develop` — rama de integración
- `feature/<nombre>` — una rama por funcionalidad
- `hotfix/<nombre>` — fixes urgentes desde main

Formato de commits: `feat:`, `fix:`, `chore:`, `test:`, `docs:` (Conventional Commits).

---

## 12. Fases de Implementación

| fase | alcance |
|------|---------|
| 1 | Init del repo, setup de Git Flow, scaffolding del proyecto |
| 2 | Backend: modelos de DB, migraciones, config central |
| 3 | Backend: endpoint de auth (Google → JWT) |
| 4 | Backend: endpoint de perfil/estadísticas |
| 5 | Backend: Socket.IO — emparejamiento + gameplay |
| 6 | Backend: Socket.IO — chat + reconexión |
| 7 | Backend: Tests |
| 8 | Frontend: Axios + stores de Zustand + singleton del socket |
| 9 | Frontend: LoginPage |
| 10 | Frontend: DashboardPage |
| 11 | Frontend: GamePage (tablero + chat) |
| 12 | Docker Compose + .env.example + README |

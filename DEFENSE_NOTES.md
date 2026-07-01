# Notas de Defensa — Ta-Te-Ti Real-Time Arena

Este archivo concentra las decisiones técnicas y el razonamiento detrás de cada elección.
Está pensado para repasar antes de la entrevista de defensa técnica.

---

## Decisiones Tecnológicas

### Backend: Python + FastAPI + python-socketio

**Elección descartada:** .NET C# (ASP.NET + SignalR), Java (Spring Boot + netty-socketio)

**Por qué FastAPI:**
- Sintaxis limpia y legible — permite releer el código en la defensa sin fricción
- Genera documentación Swagger/OpenAPI automáticamente → la API queda documentada sin código extra
- Modelo `async/await` idéntico conceptualmente al de Swift → curva de aprendizaje reducida
- Testing con `pytest` es el más simple de los tres stacks (fixtures declarativos, mínimo boilerplate)
- `python-socketio` se integra limpio vía ASGI con FastAPI
- `SQLAlchemy` como ORM: maduro, bien documentado, define modelos como clases Python
- Muy bien considerado en el mercado 2025 (no es una elección de nicho)

**Punto a defender si preguntan "¿por qué no .NET?":**
> El challenge permite libre elección de backend. Elegí FastAPI porque el modelo async de Python
> es conceptualmente equivalente al de Swift (que manejo profundamente), lo que me permitió
> aprender el stack sin deuda cognitiva adicional sobre el modelo de concurrencia.

---

### Base de Datos: PostgreSQL en Supabase

**Por qué PostgreSQL:**
- Relacional → las entidades (usuarios, partidas) tienen relaciones claras. Usar NoSQL aquí sería sobreingeniería.
- ORM de primera clase con SQLAlchemy
- El challenge valora explícitamente el uso de ORM

**Por qué Supabase (y no Neon, Railway, etc.):**
- Interfaz visual para explorar la DB durante el desarrollo
- Experiencia previa en otros proyectos
- Gratuito, sin tarjeta de crédito, disponible de inmediato
- Supabase expone PostgreSQL estándar → SQLAlchemy conecta igual que a cualquier Postgres

**Punto a defender si preguntan "¿consideraste MongoDB?":**
> Los datos tienen estructura fija y relaciones bien definidas (un usuario tiene muchas partidas,
> una partida tiene dos jugadores). El modelo relacional es más natural y correcto aquí.
> MongoDB hubiera agregado complejidad sin beneficio real para este dominio.

---

### Bonus Features incluidos

| Feature | Incluido | Razonamiento |
|---------|----------|--------------|
| Reconexión | ✅ Sí | python-socketio soporta rooms persistentes; el cliente puede re-unirse a la misma sala por `game_id` |
| Chat in-game | ✅ Sí | Socket.IO ya está levantado; agregar un canal de chat es mínimo overhead |
| Docker Compose | ✅ Sí | Frontend + Backend en containers; Supabase es cloud (no necesita container propio) |

> Estos tres bonus están contemplados desde el diseño, no son un after-thought.
> Demuestran criterio y capacidad de terminar ahead of schedule.

---

## Decisiones Arquitecturales

### Estructura del repositorio: Monorepo

**Opción descartada:** Dos repos separados (`tateti-arena-frontend` / `tateti-arena-backend`)

**Por qué monorepo:**
- Un solo link para entregar → el evaluador clona y tiene todo
- El `docker-compose.yml` vive en la raíz y levanta frontend + backend con un comando
- Para un proyecto de este scope, la separación en dos repos no aporta ningún beneficio real
- Carpetas: `frontend/`, `backend/`, `docker-compose.yml` en la raíz

**Punto a defender si preguntan:**
> Para proyectos pequeños con un único equipo, el monorepo simplifica el onboarding y
> el setup de CI/CD. La separación de responsabilidades se mantiene a nivel de carpetas,
> no de repositorios.

---

### Estado del juego durante la partida: Híbrido (memoria + DB)

**Opciones evaluadas:**

| Opción | Descripción | Descartada porque |
|--------|-------------|-------------------|
| Solo en memoria | Diccionario Python `{ game_id: GameState }` | Se pierde con restart del server; rompe el bonus de reconexión |
| Solo en DB | Cada movimiento hace un UPDATE en Supabase | Latencia innecesaria por query en cada jugada de un tablero de 9 celdas |
| **Híbrido (elegida)** | En memoria durante la partida, DB al finalizar | Equilibrio correcto entre velocidad y persistencia |

**Cómo funciona el híbrido:**
1. Al crear la partida: se guarda en DB con estado `in_progress` + se carga en memoria
2. Durante el juego: cada movimiento se valida y actualiza solo en memoria (sin queries)
3. Al terminar: se persiste el resultado en DB (ganador, estado `finished`, historial)
4. Reconexión: si el jugador se reconecta, el server busca su `game_id` activo en memoria y lo reincorpora a la sala de Socket.IO

**Punto a defender si preguntan "¿qué pasa si el server se cae en mitad de la partida?":**
> Es una limitación conocida y aceptada para este scope. En producción real se resolvería
> con Redis como store compartido (permite escalar a múltiples instancias y sobrevivir
> reinicios). Para este challenge, la decisión es consciente: simplicidad operacional
> sobre resiliencia ante fallos de infraestructura.

---

## Arquitectura General

### Estructura de carpetas

```
tateti-arena/
├── docker-compose.yml
├── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/          # Axios instance + interceptors JWT
│   │   ├── components/   # Board, Cell, ChatBox, StatsCard...
│   │   ├── pages/        # LoginPage, DashboardPage, GamePage
│   │   ├── store/        # Zustand stores (authStore, gameStore)
│   │   └── socket/       # Socket.IO client singleton
│   └── Dockerfile
└── backend/
    ├── app/
    │   ├── api/          # Routers FastAPI (auth, profile)
    │   ├── services/     # Lógica de negocio (auth_service, game_service)
    │   ├── repositories/ # Acceso a DB (user_repo, game_repo)
    │   ├── models/       # SQLAlchemy models (User, Game)
    │   ├── schemas/      # Pydantic schemas (request/response shapes)
    │   ├── socket/       # Eventos Socket.IO (matchmaking, moves, chat)
    │   └── core/         # Config, JWT utils, DB session
    ├── tests/
    └── Dockerfile
```

**Por qué esta estructura responde al criterio de evaluación "Arquitectura":**
- `api/` → Controllers: solo reciben el request y delegan
- `services/` → Business logic: reglas del juego, validaciones, matchmaking
- `repositories/` → Data access: toda query a DB pasa por acá, las demás capas no saben de SQL
- Cada capa solo conoce a la capa inmediatamente inferior (api → service → repository → model)

**Punto a defender si preguntan sobre la separación de capas:**
> Esta separación permite testear cada capa de forma aislada. El service se testea
> mockeando el repository. El repository se testea con una DB de test. El router
> se testea con un cliente HTTP falso. Ninguna capa tiene más de una responsabilidad.

---

### Esquema de Base de Datos

**Tabla `users`**
| columna | tipo | notas |
|---------|------|-------|
| `id` | UUID (PK) | generado por la DB |
| `email` | VARCHAR UNIQUE | viene de Google |
| `name` | VARCHAR | viene de Google |
| `avatar_url` | VARCHAR | foto de perfil de Google |
| `wins` | INTEGER DEFAULT 0 | contador denormalizado |
| `losses` | INTEGER DEFAULT 0 | contador denormalizado |
| `draws` | INTEGER DEFAULT 0 | contador denormalizado |
| `created_at` | TIMESTAMPTZ | |

**Tabla `games`**
| columna | tipo | notas |
|---------|------|-------|
| `id` | UUID (PK) | también es el `room_id` de Socket.IO |
| `player_x_id` | UUID (FK → users) | primer jugador en unirse |
| `player_o_id` | UUID (FK → users) | segundo jugador |
| `winner_id` | UUID (FK → users, nullable) | NULL = empate o en curso |
| `status` | ENUM: `waiting` / `in_progress` / `finished` | |
| `board` | VARCHAR(9) | estado final del tablero, ej: `"XOX OX  O"` |
| `created_at` | TIMESTAMPTZ | |
| `finished_at` | TIMESTAMPTZ, nullable | |

**Índices:** `player_x_id` y `player_o_id` en `games` → PostgreSQL solo escanea las filas del jugador, no toda la tabla.

---

### Decisión: contadores denormalizados en `users`

**Alternativa descartada: calcular stats con aggregate query**

Sin contadores en `users`, el endpoint de stats requeriría:
```sql
SELECT
  COUNT(*) FILTER (WHERE winner_id = $1) AS wins,
  COUNT(*) FILTER (WHERE winner_id != $1 AND winner_id IS NOT NULL) AS losses,
  COUNT(*) FILTER (WHERE winner_id IS NULL AND status = 'finished') AS draws
FROM games
WHERE player_x_id = $1 OR player_o_id = $1;
```
Con índices en `player_x_id` y `player_o_id`, PostgreSQL **no escanea toda la tabla** — solo las filas del jugador. Pero el query es verboso y difícil de leer.

**Por qué elegí contadores en `users`:**
- El endpoint de stats queda como un simple `SELECT wins, losses, draws FROM users WHERE id = $1`
- Al terminar una partida, una única transacción actualiza `games` + ambos `users` → consistencia garantizada: si algo falla, ningún contador se actualiza parcialmente
- Es un patrón de denormalización válido y muy común en producción

**Punto a defender si preguntan "¿no es inconsistente tener los contadores separados?":**
> Los contadores se actualizan dentro de la misma transacción de base de datos que cierra
> la partida. O todo se escribe junto, o nada. La transacción es la garantía de consistencia,
> no la normalización. Es una denormalización intencional para optimizar lecturas frecuentes
> (el dashboard se carga en cada login) a costa de una escritura levemente más compleja
> (que solo ocurre al finalizar cada partida).

---

### Flujo de Autenticación (Google OAuth + JWT)

```
Frontend                    Backend                     Google
   │                           │                           │
   │  1. Click "Sign in"        │                           │
   │──────────────────────────>│                           │
   │  Google SDK → popup        │                           │
   │<─────────────────────────>│<─────────────────────────>│
   │  2. Recibe google_token    │                           │
   │                           │                           │
   │  3. POST /auth/google      │                           │
   │     { token: "..." }      │                           │
   │──────────────────────────>│                           │
   │                           │  4. Verifica token con    │
   │                           │     Google API            │
   │                           │──────────────────────────>│
   │                           │  5. { email, name, avatar}│
   │                           │<──────────────────────────│
   │                           │  6. ¿existe email en DB?  │
   │                           │     - No → crea usuario   │
   │                           │     - Sí → lo busca       │
   │                           │  7. Genera JWT propio     │
   │  8. { jwt, user }         │                           │
   │<──────────────────────────│                           │
   │  9. Guarda JWT en         │                           │
   │     Zustand + localStorage│                           │
```

**Puntos de seguridad clave (criterio evaluado explícitamente):**
- El `google_token` nunca se persiste — se usa una vez para verificar identidad y se descarta
- El JWT propio lo firma el backend con `SECRET_KEY` que vive en `.env` — nunca expuesto al frontend
- Axios interceptor agrega `Authorization: Bearer <token>` automáticamente en cada request
- Socket.IO valida el JWT en la conexión inicial vía middleware del server — no solo en los endpoints REST

**Punto a defender si preguntan "¿por qué JWT propio y no usar el token de Google directamente?":**
> Usar el token de Google directamente acoplaría el frontend al proveedor de identidad.
> Si mañana cambia el proveedor (Apple, GitHub), el frontend no cambia nada.
> El JWT propio también permite definir el tiempo de expiración y el payload
> según las necesidades de la app (incluir el `user_id` interno, por ejemplo).

---

### Flujo de Juego (Socket.IO)

```
Jugador A                   Server                      Jugador B
   │                           │                           │
   │  emit: find_match         │                           │
   │──────────────────────────>│                           │
   │                           │  (cola vacía → espera)    │
   │  [estado: Esperando...]   │                           │
   │                           │    emit: find_match       │
   │                           │<──────────────────────────│
   │                           │  (hay jugador en cola)    │
   │                           │  crea game en DB          │
   │                           │  ambos join room(game_id) │
   │  emit: game_start         │    emit: game_start       │
   │  { game_id, symbol: 'X' } │──────────────────────────>│
   │<──────────────────────────│    { game_id, symbol: 'O'}│
   │                           │                           │
   │  emit: make_move          │                           │
   │  { game_id, position: 4 } │                           │
   │──────────────────────────>│                           │
   │                           │  valida movimiento        │
   │                           │  actualiza estado en mem  │
   │                           │  broadcast a la room      │
   │  emit: board_update       │    emit: board_update     │
   │  { board, next_turn }     │──────────────────────────>│
   │<──────────────────────────│                           │
   │                           │                           │
   │         [... más turnos ...]                          │
   │                           │                           │
   │                           │  detecta ganador/empate   │
   │                           │  persiste resultado en DB │
   │                           │  actualiza contadores     │
   │  emit: game_over          │    emit: game_over        │
   │  { winner, board }        │──────────────────────────>│
   │<──────────────────────────│                           │
```

**Reconexión (bonus):**
Si el jugador refresca el navegador, el frontend recupera el `game_id` de localStorage,
se reconecta al socket con el JWT y emite `rejoin_game { game_id }`.
El server verifica que el `user_id` del JWT corresponde a un jugador de esa partida activa en memoria
y lo reincorpora al room.

---

## Convenciones de Desarrollo

### Conventional Commits

Estándar para mensajes de commit legibles y predecibles:

| prefijo | cuándo usarlo |
|---------|--------------|
| `feat:` | funcionalidad nueva |
| `fix:` | corrección de bug |
| `chore:` | mantenimiento sin impacto en lógica de negocio (setup, configs, scaffolding) |
| `test:` | agregar o modificar tests |
| `docs:` | cambios en documentación |
| `refactor:` | reorganización de código sin cambio de comportamiento |

### Git Flow — por qué el primer commit va en `develop` y no en `main`

`main` representa siempre el estado deployable a producción. Un proyecto vacío no lo es.
El flujo es:

```
develop ← feature/backend-core   (trabajo en progreso)
develop ← feature/frontend
main    ← develop                 (solo cuando todo está listo para entregar)
```

`main` solo recibe merges cuando hay algo que mostrar como entregable completo.

---

## Preguntas frecuentes en defensa técnica

_(Se irá completando durante el desarrollo)_

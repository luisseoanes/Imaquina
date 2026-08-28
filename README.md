# Plataforma Imaquina Robótica

Plataforma de robótica educativa: 36 proyectos por grado (Transición → 11°), seis momentos metodológicos por proyecto, chatbot consultor técnico y evaluación exportable. Bilingüe ES/EN.

- **Levantar el proyecto en local:** [`docs/desarrollo.md`](docs/desarrollo.md)
- **Preguntas abiertas con el cliente:** [`docs/preguntas-cliente.md`](docs/preguntas-cliente.md)
- **Alcance y fases:** [`docs/scope-mvp.md`](docs/scope-mvp.md)
- **Decisiones de arquitectura:** [`docs/arquitectura.md`](docs/arquitectura.md)
- **Brief original del cliente:** [`docs/plataforma-imaquina-robotica.md`](docs/plataforma-imaquina-robotica.md)
- **Qué falta y en qué orden:** [`docs/backlog.md`](docs/backlog.md)

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI (async) · SQLAlchemy 2.0 · Alembic |
| Base de datos | PostgreSQL 16 + pgvector |
| Cola / caché | Redis + ARQ |
| Cliente web | React 19 · Vite · TypeScript · TanStack Query · Tailwind |
| IA | Claude (`claude-opus-5`) con RAG y prompt caching |
| Media | S3 / Cloudflare R2 con URLs prefirmadas |

## Arrancar en local

Requisitos: Docker, [uv](https://docs.astral.sh/uv/getting-started/installation/), Node 20+.
(uv se encarga de Python: `uv sync` instala el 3.12 si no lo tienes.)

```bash
# 1. Infraestructura
make up                       # Postgres (pgvector) + Redis

# 2. Backend
cd backend
cp .env.example .env          # dejar ANTHROPIC_API_KEY vacío → StubProvider
uv sync                       # crea .venv exactamente segun uv.lock
uv run alembic upgrade head
uv run uvicorn app.main:app --reload   # http://localhost:8000/docs

# 3. Worker (otra terminal)
cd backend && uv run arq app.workers.worker.WorkerSettings
```

Sin `ANTHROPIC_API_KEY`, el asistente usa `StubProvider`: cero red, cero costo. Todo lo demás funciona igual.

## Estructura

```
backend/app/
├─ core/           config · security · deps (TenantContext) · errors
├─ db/             session · base · all_models
├─ modules/
│  ├─ identity/    usuarios, roles, instituciones, licencias con vigencia
│  ├─ catalog/     proyectos, momentos, bloques, traducciones (autoría)
│  ├─ publishing/  borrador→publicado, versiones, snapshot
│  ├─ media/       assets, URLs prefirmadas
│  ├─ learning/    consumo del estudiante (lee del snapshot)
│  ├─ assessment/  preguntas, intentos, calificación, export
│  └─ assistant/   chat, RAG, guardrails · provider.py = el único puerto
└─ workers/        ARQ: reindexado, exportaciones
```

## Las reglas que no se rompen

Son las decisiones de `docs/arquitectura.md` convertidas en invariantes revisables:

1. **Un módulo puede leer modelos de otro, pero nunca escribe sobre ellos.** Cuando se pueda, se llama a su capa de servicio.
2. **Toda consulta de datos por institución pasa por `TenantContext`.** Son datos de menores; el cruce entre colegios es un incidente, no un bug.
3. **La guía docente se filtra en el backend** (`learning/service.serialize_moment_for`), nunca en el cliente: ahí es cosmético, quien abra las DevTools lee el JSON igual.
4. **Los estudiantes leen del snapshot publicado**, no de las tablas normalizadas.
5. **El reindexado del RAG es idempotente y automático al publicar.** Nadie se acuerda de apretar "reindexar".
6. **Nada volátil en el prompt de sistema** — el caché es match de prefijo y una fecha lo invalida entero.

## Tests

Separados en dos niveles, a propósito:

| | Qué cubren | Infraestructura |
|---|---|---|
| `tests/unit/` | Reglas de negocio: filtro de guía docente, aislamiento de tenant, vigencias, validación de publicación, guardrails del asistente | **Ninguna** — corren siempre |
| `tests/integration/` | Endpoints contra Postgres real, con rollback por test | Postgres (`make up`) |

Los de integración **se saltan solos** con un mensaje claro si la base no está levantada, en vez de reventar con un error de conexión que no dice nada.

```bash
make test-unit   # sin Docker, siempre corren
make test-int    # requiere: make up && make testdb
make test        # todo
make lint        # ruff
```

Los de integración usan Postgres real porque **los mocks de base de datos mienten**. Base de datos de test: `imaquina_test`.

### Qué protegen realmente

- **`test_teacher_note.py`** — que la guía docente no llegue al JSON del estudiante (R4). No basta ocultarla en el cliente.
- **`test_tenant_isolation.py`** — incluye un guard estructural que falla si un modelo con datos de alumnos pierde su `institution_id`.
- **`test_security.py`** — que la licencia **recorte** la duración del token: si vence el viernes, un refresh emitido el jueves no puede durar 30 días (R2).
- **`test_assistant.py`** — que no haya nada volátil en el prompt de sistema; una fecha ahí invalida el prompt caching y dispara el costo.

## Comandos

```bash
make             # lista todos los targets
make sync        # instala backend/.venv segun uv.lock
make up          # Postgres + Redis
make api         # backend
make worker      # cola de background
make migrate     # alembic upgrade head
make revision m="añade tabla X"
make lock        # sube dependencias y reescribe uv.lock (cambio deliberado)
```

Las versiones las fija `backend/uv.lock`, que **va versionado**: los dos entornos de
desarrollo y la imagen de Docker instalan exactamente lo mismo. `pyproject.toml` solo
declara rangos; el lock es lo que manda. Tras un `git pull` que lo toque, `make sync`.

El `Makefile` detecta el intérprete por `uv run`, así que funciona igual en Linux y en
Windows — pero en Windows hay que llamarlo desde Git Bash o WSL.

## Estado

**El backend está completo**: autoría del Content Studio, publicación por snapshot,
recorrido del estudiante con progreso lineal, cuentas y cursos, evaluación con export a
Excel y el chat con sus sesiones, historial y rate limit. Esquema migrado, semillas de
desarrollo y verificación automática antes de cada release.

**El cliente web tiene sus dos primeras pantallas**: acceso (`/login`) y 404, sobre un
andamiaje ya completo — enrutado con guards por rol, sesión, cliente generado desde el
OpenAPI, i18n y tokens de diseño. El resto de rutas existen y compilan, pero montan
marcadores. Ver [`frontend/CLAUDE.md`](frontend/CLAUDE.md).

Del lado del modelo quedan los embeddings reales del RAG y la calidad de la recuperación,
que viven detrás de `AssistantProvider` (ver `CLAUDE.md`).

**El estado detallado, con dependencias y orden de ejecución, está en
[`docs/backlog.md`](docs/backlog.md)** — no se duplica aquí para que no diverja.

# Plataforma Imaquina Robótica

Plataforma de robótica educativa: 36 proyectos por grado (Transición → 11°), seis momentos metodológicos por proyecto, chatbot consultor técnico y evaluación exportable. Bilingüe ES/EN.

- **Alcance y fases:** [`docs/SCOPE-MVP.md`](docs/SCOPE-MVP.md)
- **Decisiones de arquitectura:** [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)

## Stack

| Capa | Tecnología |
|---|---|
| Backend | FastAPI (async) · SQLAlchemy 2.0 · Alembic |
| Base de datos | PostgreSQL 16 + pgvector |
| Cola / caché | Redis + ARQ |
| Frontend | React 18 · Vite · TypeScript · TanStack Query · Tailwind |
| IA | Claude (`claude-opus-5`) con RAG y prompt caching |
| Media | S3 / Cloudflare R2 con URLs prefirmadas |

## Arrancar en local

Requisitos: Docker, Python 3.12+, Node 20+.

```bash
# 1. Infraestructura
make up                       # Postgres (pgvector) + Redis

# 2. Backend
cd backend
cp .env.example .env          # dejar ANTHROPIC_API_KEY vacío → StubProvider
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload # http://localhost:8000/docs

# 3. Worker (otra terminal)
cd backend && arq app.workers.worker.WorkerSettings

# 4. Frontend (otra terminal)
cd frontend && npm install && npm run dev   # http://localhost:5173
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

frontend/src/
├─ lib/            http (fetch + SSE) · queryClient
├─ i18n/           es.json · en.json
└─ features/       auth · projects · moment · chat · studio (lazy)
```

## Las reglas que no se rompen

Son las decisiones de `docs/ARQUITECTURA.md` convertidas en invariantes revisables:

1. **Un módulo no importa modelos ni queries de otro módulo.** Sólo su capa de servicio.
2. **Toda consulta de datos por institución pasa por `TenantContext`.** Son datos de menores; el cruce entre colegios es un incidente, no un bug.
3. **La guía docente se filtra en el backend** (`learning/service.serialize_moment_for`), nunca en React.
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
make test-unit   # 36 tests, sin Docker, ~3s
make test-int    # requiere: make up && make testdb
make test        # todo
make lint        # ruff
```

Los de integración usan Postgres real porque **los mocks de base de datos mienten**. Base de datos de test: `imaquina_test`.

### Qué protegen realmente

- **`test_teacher_note.py`** — que la guía docente no llegue al JSON del estudiante (R4). No basta ocultarla en React.
- **`test_tenant_isolation.py`** — incluye un guard estructural que falla si un modelo con datos de alumnos pierde su `institution_id`.
- **`test_security.py`** — que la licencia **recorte** la duración del token: si vence el viernes, un refresh emitido el jueves no puede durar 30 días (R2).
- **`test_assistant.py`** — que no haya nada volátil en el prompt de sistema; una fecha ahí invalida el prompt caching y dispara el costo.

## Comandos

```bash
make up          # Postgres + Redis
make api         # backend
make web         # frontend
make worker      # cola de background
make migrate     # alembic upgrade head
make revision m="añade tabla X"
```

## Estado

Esqueleto ejecutable con la arquitectura ya cableada. Falta, según el cronograma de `SCOPE-MVP.md`: el editor del Content Studio (F2), el módulo de evaluación completo (F3), y los embeddings reales del RAG (F4 — hoy hay un placeholder en `workers/worker.py`).

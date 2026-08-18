# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Plataforma de robótica educativa (36 proyectos × 6 momentos, bilingüe ES/EN, chatbot
con RAG, evaluación exportable). Monolito modular: FastAPI async + React/Vite.

Las decisiones y su porqué están en `docs/arquitectura.md` (léelo antes de tocar
fronteras entre módulos, caché de prompts o el camino de lectura). Los códigos `R1`–`R10`
que aparecen en docstrings y tests son los requisitos de `docs/scope-mvp.md`.

## Estado del entorno local

El backend se maneja con **uv**. `backend/uv.lock` va versionado y fija todas las
versiones transitivas: los dos entornos de desarrollo (uno Linux, otro Windows) y la
imagen de Docker instalan exactamente lo mismo. `pyproject.toml` solo declara rangos —
**el lock es lo que manda**. Tras un pull que lo toque: `make sync`.

- Las dev deps están en `[dependency-groups]` (PEP 735), no en `optional-dependencies`:
  `uv sync` las instala, `uv sync --no-dev` las excluye (lo que hace el Dockerfile).
  `pip install -e ".[dev]"` ya **no** funciona.
- **Nunca escribas una ruta de intérprete fija** en el Makefile ni en los docs: `uv run`
  la resuelve sola en ambos SO. En Windows hay que invocar `make` desde Git Bash o WSL
  (cmd.exe no resuelve rutas de ejecutable con barras normales).
- En la imagen, el venv vive en `/opt/venv`, **fuera de `/app`**: docker-compose monta
  `./backend` en `/app` y taparía un venv que estuviera ahí dentro.

Arranque desde cero: `make sync && make up`.

Dos cosas que el README da por hechas y **no existen**:

- **No hay migraciones**: `alembic/versions/` está vacío, así que `alembic upgrade head`
  no crea nada. El esquema real sale hoy de `Base.metadata.create_all` en las fixtures de
  integración. La primera revisión está por autogenerar.
- **Frontend sin tooling instalado**: no hay `node_modules` y **no hay config de ESLint**
  pese al script `npm run lint`; `vitest` y `msw` están en `devDependencies` pero no hay
  ningún test escrito.

## Comandos

```bash
make               # lista los targets
make sync          # backend/.venv exactamente segun uv.lock
make lock          # sube dependencias y reescribe el lock (cambio deliberado)
make up            # Postgres (pgvector) + Redis
make testdb        # crea la base imaquina_test (requiere make up)
make api           # uvicorn --reload en :8000
make worker        # worker ARQ de background
make test-unit     # sin infraestructura, siempre corre
make test-int      # requiere Postgres; si no está, se salta solo
make lint / fix    # ruff

# un test suelto: no hay target
cd backend && uv run pytest tests/unit/test_security.py::test_nombre -q

# frontend (desde frontend/)
npm run dev        # 5173, proxy /api → :8000
npm run build      # tsc -b && vite build
npm run api:gen    # orval: regenera src/api/generated desde el OpenAPI vivo
```

`npm run api:gen` **necesita el backend corriendo** en `localhost:8000`; el código
generado está en `.gitignore`, así que tras clonar hay que regenerarlo antes de usar
hooks de `src/api/generated`.

Sin `ANTHROPIC_API_KEY`, `get_assistant_provider()` devuelve `StubProvider`: cero red,
cero costo. Los tests lo dan por hecho — `tests/conftest.py` fuerza la key vacía.

## Commits y releases

**Los commits siguen Conventional Commits** — `.github/workflows/release.yml` los analiza
en cada push a `master` y publica tag + release de GitHub sin intervención. Las reglas
están en `.releaserc.json`:

- `feat:` → **minor** · `fix:` → **patch** · `feat!:` o pie `BREAKING CHANGE:` → **major**
- **Todo lo demás no publica nada**: `docs`, `chore`, `refactor`, `test`, `ci`, `build`,
  `style`, `perf` y `revert` están puestos a `false` explícitamente. Ojo: `perf` y `revert`
  publicarían patch por las reglas por defecto del preset si se quitaran de esa lista.
- Aquí se empujan **commits sueltos** a la rama, no PRs con squash: si cualquier tipo
  publicara, saldría una release por commit.

Los commits que no publican **sí aparecen en las notas** de la release que acabe cortando
un `feat` o un `fix`, agrupados por sección. No se pierde nada.

No hay `CHANGELOG.md` a propósito: las notas van en el cuerpo de la release y no se
commitea nada de vuelta al repo. No lo añadas sin que sea una decisión explícita.

## Arquitectura: lo que hay que respetar

**Camino de lectura ≠ camino de escritura.** Al publicar, `publishing/service.build_snapshot`
serializa el proyecto entero a `ProjectVersion.snapshot` (JSONB). Los estudiantes se
sirven **sólo** de ese snapshot (`learning/service`), nunca de las tablas normalizadas;
el Content Studio escribe contra las tablas. No añadas queries de estudiante que hagan
joins sobre `catalog`.

**`TenantContext` (`app/core/deps.py`) es la frontera de datos.** Se resuelve del JWT y
toda consulta por institución pasa por `require_institution()`. Alias listos para firmas
de endpoint: `Db`, `Tenant`, `Author` (editor/admin), `Staff` (docente+). Son datos de
menores: cruzar instituciones es un incidente, no un bug.

**La guía docente se filtra en el backend.** `learning/service.serialize_moment_for`
elimina `teacher_note` salvo `tenant.is_staff`. El snapshot **sí** la contiene a propósito
(una sola copia sirve a ambos roles); el filtro ocurre al servir. Nunca ocultarla en React.

**`AssistantProvider` (`assistant/provider.py`) es el único puerto del sistema.** No
abstraigas Postgres, S3 ni nada más "por simetría" — `docs/arquitectura.md` §10 lo
descarta explícitamente.

**El prompt de sistema es el prefijo cacheado: nada volátil dentro.** Ni fechas, ni
nombres, ni IDs. Estable primero, `cache_control` en el último bloque estable, la
pregunta del turno al final. `tests/unit/test_assistant.py` falla si se rompe.

**El reindexado del RAG es idempotente y automático al publicar.** `workers/worker.reindex_project`
borra los chunks del proyecto y los regenera; se encola desde el router de publishing.
Los embeddings son hoy un placeholder de ceros (`EMBEDDING_DIM`), pendiente de F4.

**Errores de negocio como excepciones, no `HTTPException`.** Se lanza `NotFound`,
`PermissionDenied`, `Conflict`, `LicenseExpired`, `ValidationFailed` (`core/errors.py`)
y el handler global las traduce a `{"error": {"code", "message"}}` — formato que el
cliente HTTP del frontend ya parsea.

**La licencia recorta la vigencia del token** (`core/security.create_token`): el `exp`
nunca supera `license_valid_to`.

### Regla de dependencia entre módulos (y sus excepciones actuales)

La regla de `docs/arquitectura.md` §2: un módulo llama a la **capa de servicio** de otro,
nunca importa sus modelos. Hoy hay tres importaciones que la incumplen — tenlas presentes
antes de añadir una cuarta "porque ya se hace":

- `publishing/service.py` → `catalog.models` (intrínseco: publishing serializa catalog)
- `learning/service.py` → `catalog.models`, `publishing.models`
- `assistant/router.py` → `identity.models.User`

Dentro de cada módulo: `router` (HTTP) → `service` (lógica) → SQLAlchemy directo. **No hay
capa de repositorio** y no debe añadirse. Modelos nuevos deben quedar alcanzables desde
`app/db/all_models.py` o Alembic autogenera migraciones vacías.

## Tests

- `tests/unit/` — reglas de negocio puras, sin infraestructura (guía docente, aislamiento
  de tenant, vigencia de licencia, validación de publicación, guardrails). Corren siempre.
- `tests/integration/` — endpoints contra Postgres real, transacción revertida por test.
  `tests/integration/conftest.py` comprueba la conexión y **se salta con mensaje claro**
  si no hay DB; no cambies eso por un fallo duro.
- `test_tenant_isolation.py` incluye un guard estructural parametrizado: si un modelo con
  datos de alumnos (`Progress`, `Attempt`, `ChatSession`, `Course`, `License`) pierde
  `institution_id`, el test falla. Añade ahí los modelos nuevos que lleven datos por
  institución.
- `asyncio_mode = "auto"`: los tests async no llevan decorador.

## Frontend

Feature-sliced en `src/features/` (auth · projects · moment · chat · studio). El **Content
Studio va en chunk aparte** con `lazy()` y `manualChunks` en `vite.config.ts`: los
estudiantes son el 95% del tráfico y no deben descargar el editor. Estado de servidor con
TanStack Query, sin Redux. Alias `@/` → `src/`. El chat consume SSE con `streamChat()` de
`src/lib/http.ts` (no pasa por orval). Texto de UI siempre vía i18next (`es.json`/`en.json`),
nunca literales en los componentes.

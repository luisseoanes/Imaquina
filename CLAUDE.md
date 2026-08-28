# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Plataforma de robótica educativa (36 proyectos × 6 momentos, bilingüe ES/EN, chatbot
con RAG, evaluación exportable). **Backend: FastAPI async, monolito modular.**

> El frontend se eliminó del repositorio el 27/08/2026 para rehacerlo desde cero. No hay
> cliente elegido, ni framework, ni paleta, ni tipografía, ni convenciones de UI: cuando
> se retome, esas decisiones están abiertas y **este fichero no las condiciona**. Lo único
> que sigue en pie es el contrato HTTP que expone el backend (`/api/v1`, OpenAPI en
> `/docs`) y las reglas de negocio de más abajo, que son del servidor y no del cliente.

Las decisiones y su porqué están en `docs/arquitectura.md` (léelo antes de tocar
fronteras entre módulos, caché de prompts o el camino de lectura). Los códigos `R1`–`R10`
que aparecen en docstrings y tests son los requisitos de `docs/scope-mvp.md`.

## Frontera del trabajo de modelo

El trabajo de modelo vive **detrás de `AssistantProvider`** (`assistant/provider.py`), y
sólo ahí: `SYSTEM_PROMPT` con su `cache_control`, `ClaudeProvider`, la estrategia de
recuperación (chunking, ranking, top-k), los embeddings de `worker.reindex_project`,
`EMBEDDING_DIM` y el índice pgvector.

Delante del puerto todo es backend normal: `assistant/router.py` (endpoint, SSE, permisos,
rate limit) y `assistant/service.py` (sesiones, historial, persistencia).
**Esa mitad se construye y se testea entera contra `StubProvider`**, sin red y sin tocar
nada de modelo. Para eso existe el puerto.

**Infra, hosting y despliegue no condicionan ninguna decisión técnica.** El PO asume la
inversión. El análisis de hosting de `docs/scope-mvp.md` §2 y el bloque de hosting del
brief están **desactualizados**: da por disponibles Postgres 16 + pgvector, Redis y S3/R2.

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
- **Si mueves o renombras el directorio del repo**, el venv conserva la ruta vieja y
  `uv run` deja de encontrar `pytest`: `rm -rf backend/.venv && make sync`. Los
  contenedores cuelgan del nombre del directorio, así que `make up` crea unos nuevos y
  hay que rehacer `make testdb && make migrate && make seed`.

Arranque desde cero: `make sync && make up && make migrate && make seed`.

`make seed` (`app/db/seeds.py`) crea institución, licencia vigente, un usuario por rol y
un proyecto publicado. Es idempotente y **se niega a correr si `ENV != local`** (crea
contraseñas conocidas). Los emails van en `@imaquina.example.com`: `EmailStr` **rechaza**
`.test` y `.local` por ser special-use, y con esos dominios el login es imposible.

**Migraciones.** `alembic upgrade head` crea el esquema completo (24 tablas) desde
`3f4c4a30a463 esquema inicial`. Dos cosas que autogenerate NO resuelve solo:

- El tipo `Vector` se renderiza sin su import. `alembic/env.py` tiene un `render_item` que
  lo arregla; si se toca ese fichero, comprobar que una migración con `DocumentChunk`
  sigue saliendo con `import pgvector.sqlalchemy`.
- `CREATE EXTENSION vector` va a mano. Ya está en la revisión inicial; el `downgrade` no
  la borra a propósito.

Las fixtures de integración crean el esquema con `Base.metadata.create_all`, no con
migraciones — es más rápido. Lo que impide que modelos y migraciones deriven es
`tests/integration/test_migrations.py`: levanta una base desechable con `alembic upgrade
head` y la compara contra `Base.metadata`. **Si añades un modelo sin migración, ese test
falla y te dice qué columna falta.**


## Comandos

```bash
make               # lista los targets
make sync          # backend/.venv exactamente segun uv.lock
make lock          # sube dependencias y reescribe el lock (cambio deliberado)
make up            # Postgres (pgvector) + Redis
make testdb        # crea la base imaquina_test (requiere make up)
make migrate       # alembic upgrade head
make seed          # datos de desarrollo: 4 roles + un proyecto publicado
make api           # uvicorn --reload en :8000
make worker        # worker ARQ de background
make test-unit     # sin infraestructura, siempre corre
make test-int      # requiere Postgres; si no está, se salta solo
make lint / fix    # ruff

# un test suelto: no hay target
cd backend && uv run pytest tests/unit/test_security.py::test_nombre -q
```

Sin `ANTHROPIC_API_KEY`, `get_assistant_provider()` devuelve `StubProvider`: cero red,
cero costo. Los tests lo dan por hecho — `tests/conftest.py` fuerza la key vacía.

## Commits y releases

**Los commits siguen Conventional Commits** — `.github/workflows/release.yml` los analiza
en cada push a `master` y publica tag + release de GitHub sin intervención. Antes de
publicar corre el job `backend` (ruff + pytest contra un Postgres con pgvector **y un
Redis**) y el release **sólo arranca si pasa**. Los dos servicios son obligatorios: 12
tests de integración tocan Redis de verdad —publicar, duplicar y borrar media encolan un
job ARQ, y el rate limit del chat cuenta ahí—, así que sin ese service container el paso
`Tests` falla entero con `ConnectionError` al 6379. Pasó: el release estuvo bloqueado por
esto y no por el código. Usa los mismos targets del Makefile que en local. Las
reglas están en `.releaserc.json`:

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
serializa el proyecto entero a `ProjectVersion.snapshot` (JSONB), **con todos los idiomas
dentro**: `snapshot["content"][lang]`, y `snapshot["langs"]` lista los completos. Un
snapshot por idioma no vale — solo hay una versión `is_current`, así que publicar en
inglés sustituiría a la española y R6 se rompe. Para leerlo, `publishing.service.contenido_en`,
que cae al idioma disponible si el pedido no está. Los estudiantes se
sirven **sólo** de ese snapshot (`learning/service`), nunca de las tablas normalizadas;
el Content Studio escribe contra las tablas. No añadas queries de estudiante que hagan
joins sobre `catalog`.

**`TenantContext` (`app/core/deps.py`) es la frontera de datos.** Se resuelve del JWT y
toda consulta por institución pasa por `require_institution()`. Alias listos para firmas
de endpoint: `Db`, `Tenant`, `Author` (editor/admin), `Staff` (docente+). Son datos de
menores: cruzar instituciones es un incidente, no un bug.

**La guía docente se filtra en el backend.** `learning/service.serialize_moment_for`
elimina `teacher_note` salvo `tenant.is_staff`. El snapshot **sí** la contiene a propósito
(una sola copia sirve a ambos roles); el filtro ocurre al servir. **Nunca la ocultes en el
cliente**: ahí es cosmética, y quien abra las DevTools lee el JSON igual.

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
cliente HTTP consuma.

**La licencia recorta la vigencia del token** (`core/security.create_token`): el `exp`
nunca supera `license_valid_to`.

### Regla de dependencia entre módulos

`docs/arquitectura.md` §2, revisada en agosto 2026: un módulo puede **leer** modelos de
otro, pero **nunca escribe** sobre ellos. La versión anterior ("nunca importa sus
modelos") acumulaba tres excepciones permanentes y no se defendía en code review.

Leer está bien y se hace en cuatro sitios (`publishing`→`catalog`, `learning`→`catalog` y
`→publishing`, `assistant/router`→`identity`). Cuando puedas, prefiere llamar al
**servicio** del otro módulo: ya lo hacen `media`↔`catalog`, `learning`→`publishing` y
`catalog`→`publishing`.

**La única escritura cruzada es `publishing/service.py`** (`project.status = PUBLISHED` al
publicar). Es intrínseca —publishing posee la transición borrador→publicado— pero es la
que hay que vigilar: no añadas una segunda sin discutirlo.

Dentro de cada módulo: `router` (HTTP) → `service` (lógica) → SQLAlchemy directo. **No hay
capa de repositorio** y no debe añadirse. Modelos nuevos deben quedar alcanzables desde
`app/db/all_models.py` o Alembic autogenera migraciones vacías.

## Tests

- `tests/unit/` — reglas de negocio puras, sin infraestructura (guía docente, aislamiento
  de tenant, vigencia de licencia, validación de publicación, guardrails). Corren siempre.
- `tests/integration/` — endpoints contra Postgres real, transacción revertida por test.
  `tests/integration/conftest.py` comprueba la conexión y **se salta con mensaje claro**
  si no hay DB — en local eso es lo correcto, no lo conviertas en fallo duro. **Con
  `CI=true` sí falla duro** a propósito: si se saltaran en CI, la suite pasaría en verde
  sin haber probado nada y el gate del release no gatearía.
- `test_migrations.py` (integración) es el guard de deriva modelos↔migraciones: usa una
  base propia (`imaquina_paridad`), que crea y borra él mismo.
- `test_tenant_isolation.py` incluye un guard estructural parametrizado: si un modelo con
  datos de alumnos (`Progress`, `Attempt`, `ChatSession`, `Course`, `License`) pierde
  `institution_id`, el test falla. Añade ahí los modelos nuevos que lleven datos por
  institución.
- `asyncio_mode = "auto"`: los tests async no llevan decorador. `fixture_loop_scope` y
  `test_loop_scope` están **los dos** en `session` a propósito: el engine de integración
  es de sesión y sus conexiones asyncpg quedan atadas al loop que las creó; si se
  desalinean, todo test que use la fixture `db` peta con "attached to a different loop".
- **Dos trampas del ORM async que ya han mordido tres veces.** (1) Tocar una relación que
  no venga cargada con `selectinload` revienta con `MissingGreenlet`; si acabas de crear
  el objeto, relee por el camino que sí la carga en vez de parchear el acceso. (2) Si la
  entidad ya está en el identity map con su colección cargada, un `select` posterior
  devuelve **la vieja**: hace falta `.execution_options(populate_existing=True)`, o añadir
  un hijo y volver a listar no lo muestra. Lo llevan ya `catalog._get_moment`,
  `catalog._get_block` y `publishing._load_full` — este último es el crítico: sin él,
  publicar justo después de editar serializaría un snapshot desactualizado.
- **Los tests unitarios de servicios mienten sobre el ORM async**: construyen los objetos
  en memoria, así que las relaciones ya están cargadas y nunca ejercitan el lazy loading.
  Todo servicio que serialice relaciones necesita además un test de integración.

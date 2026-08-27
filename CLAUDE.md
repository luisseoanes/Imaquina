# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Plataforma de robótica educativa (36 proyectos × 6 momentos, bilingüe ES/EN, chatbot
con RAG, evaluación exportable). Monolito modular: FastAPI async + React/Vite.

Las decisiones y su porqué están en `docs/arquitectura.md` (léelo antes de tocar
fronteras entre módulos, caché de prompts o el camino de lectura). Los códigos `R1`–`R10`
que aparecen en docstrings y tests son los requisitos de `docs/scope-mvp.md`.

## Frontera del trabajo de modelo

El trabajo de modelo vive **detrás de `AssistantProvider`** (`assistant/provider.py`), y
sólo ahí: `SYSTEM_PROMPT` con su `cache_control`, `ClaudeProvider`, la estrategia de
recuperación (chunking, ranking, top-k), los embeddings de `worker.reindex_project`,
`EMBEDDING_DIM` y el índice pgvector.

Delante del puerto todo es backend normal: `assistant/router.py` (endpoint, SSE, permisos,
rate limit), `assistant/service.py` (sesiones, historial, persistencia) y el chat en React.
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

# frontend, mismos comandos que usa CI
make web-install   # npm ci, exactamente segun package-lock.json
make web-lint      # eslint
make web-test      # vitest
make web-build     # tsc -b && vite build && guarda de chunks

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
en cada push a `master` y publica tag + release de GitHub sin intervención. Antes de
publicar corren dos jobs en paralelo, `backend` (ruff + pytest contra un Postgres con
pgvector) y `frontend` (eslint + vitest + build); el release **sólo arranca si los dos
pasan**. Usan los mismos targets del Makefile que en local. Las reglas
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
- **Los tests de componente aislado no ven la navegación.** `ProjectsPage` enlazaba a una
  ruta que no existía y el comodín devolvía al listado; ningún test lo detectó.
  `features/projects/navegacion.test.tsx` renderiza `<App>` y navega de verdad: los
  enlaces entre pantallas se prueban ahí, no en el componente.

## Frontend

`package-lock.json` va versionado: `npm ci` instala exactamente eso. **Tras tocar
dependencias, corre `npm ci` en limpio antes de commitear** — `npm install` puede dejar el
lock sin una transitiva y `npm install` sigue funcionando, pero `npm ci` no: al añadir
tiptap faltó `@floating-ui/dom` y el job `frontend` de CI quedó roto 21 commits, sin
release ninguna, hasta que alguien montó el entorno desde cero. ESLint 10 con flat
config en `eslint.config.js` (`npm run lint`, o `make web-lint`); tests con vitest + jsdom
y **MSW en `onUnhandledRequest: "error"`** — una petición que ningún handler simule hace
fallar el test en vez de salir a la red. Los handlers por defecto están en
`src/test/handlers.ts`; sobrescribe con `server.use(...)` en el test que lo necesite.

`src/test/setup.ts` inicializa i18next de verdad, no un mock: los tests afirman sobre el
texto que ve el usuario, así que una clave que falte en `es.json` sale como fallo.

`tsc -b` type-chequea también los `*.test.ts(x)`, así que un test mal tipado rompe
`npm run build`.

**Mobile-first y color por tokens, siempre.** Los estudiantes entran desde el móvil y en
el aula de robótica no hay un PC por cabeza: el estilo base es el de móvil y `sm:`/`md:`
amplían, nunca al revés. Y **ningún color crudo en los componentes** — nada de
`bg-gray-100` ni `text-red-600`. Se usan los tokens semánticos de `src/index.css`
(`surface`, `content`, `content-muted`, `content-subtle`, `brand`, `note`, `success`,
`danger`), que nombran la intención y no el color.

> Los valores actuales son un **neutro provisional**: la paleta de marca la define el PO y
> está pendiente. Cuando llegue se cambia el bloque `:root` de `src/index.css` y nada más.
> Mínimo de contraste AA para texto: 4.5:1 — `content-subtle` es el suelo, con 4.8:1.

Feature-sliced en `src/features/` (auth · projects · moment · chat · studio). El **Content
Studio va en chunk aparte** con `lazy()` en `App.tsx`: los estudiantes son el 95% del
tráfico y no deben descargar el editor. **Sin `manualChunks`** — la config heredada de
Rollup convertía "studio" en el chunk común bajo rolldown y el entry acababa
importándolo. `scripts/check-chunks.mjs` corre en `npm run build` y falla si el bundle de
entrada vuelve a importar el chunk del Studio.

Los datos del Studio se piden con hooks a mano sobre `http()` (`features/studio/api.ts`),
no con el cliente de orval: el generado está gitignored y `api:gen` necesita el backend,
así que importarlo rompería el build en CI y en un clon recién hecho. Estado de servidor con
TanStack Query, sin Redux. Alias `@/` → `src/`. El chat consume SSE con `streamChat()` de
`src/lib/http.ts` (no pasa por orval). Texto de UI siempre vía i18next (`es.json`/`en.json`),
nunca literales en los componentes.

## Exportar un doc HTML a PDF o imagen

`docs/marca/paleta-imaquina.html` se exporta con `google-chrome --headless=new`. Dos cosas sin
las que sale mal: **`print-color-adjust: exact`** —si no, el navegador descarta los fondos
al imprimir y un diseño oscuro queda ilegible— y **`@page { margin: 0 }`** con el aire por
dentro, o el fondo no llega al borde y queda un marco blanco. El tema se fuerza con
`<html data-theme="dark">` en un envoltorio temporal; el fichero de `docs/` no se toca.

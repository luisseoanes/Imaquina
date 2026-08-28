# CLAUDE.md — cliente web

Contexto del cliente. Lo del backend está en el `CLAUDE.md` de la raíz, que se carga
igualmente; aquí sólo va lo que es propio de esta mitad.

SPA en **React 19 + Vite + TypeScript** contra `/api/v1`. Cinco áreas, cada una con **su
propio armazón** (barra lateral, cabecera y, donde toca, panel derecho), su chunk vía
`lazy()` y su `features/<área>/api.ts`: acceso, panel del estudiante, panel del docente,
Content Studio y administración. **No hay layout común por encima**: un envoltorio
compartido sólo metía un `<main>` alrededor de otro.

**La raíz `/` es el 404 a propósito** — no existe un panel común a los cuatro roles.
`homeForRole` (`shared/config/roles.ts`) es quien reparte: al iniciar sesión, cuando un
guard devuelve a alguien de donde no le toca, y como salida del 404. Si se añade un área,
se añade ahí.

`/student/*` **no lleva guard**: el personal docente entra a ver exactamente lo mismo que
el alumno (R4). Lo que no ve quien no es staff es la guía didáctica, y de eso se encarga
el servidor. Cuidado con lo que se importa en ese chunk — los `robot-*.svg` pesan entre
366 y 633 KB y por eso la tarjeta de ayuda del estudiante no lleva ilustración.

## Comandos

```bash
make web-install   # npm ci, exactamente segun package-lock.json
make web           # vite en :5173, proxy /api -> :8000
make web-lint      # oxlint
make web-test      # vitest
make web-build     # tsc -b && vite build
make web-api       # regenera el cliente del OpenAPI (necesita `make api` corriendo)
```

`npm ci`, nunca `npm install`, para instalar: `npm install` tolera un lock incompleto y
`npm ci` no, así que el fallo aparece **sólo en CI**. Ya pasó una vez y dejó el pipeline
roto 21 commits. Tras tocar dependencias, corre `npm ci` en limpio antes de commitear.

## Estructura

`app` (composición: providers, router, layouts) → `features` (un directorio por dominio
del backend) → `shared` (transversal: api, config, hooks, i18n, ui).

**La dependencia va en un solo sentido.** Una feature nunca importa de otra; si dos
necesitan lo mismo, sube a `shared`. Es lo que permite borrar una feature entera sin
perseguir referencias por el árbol.

## Lo que no se toca sin saber por qué

**El cliente de la API se genera del OpenAPI** (`make web-api`) y **se versiona**. Sin
versionarlo, construir exigiría el backend levantado y se rompería CI y un clon recién
hecho. Si tocas un endpoint o su esquema, regenera: el generado desactualizado compila
igual y falla en runtime.

Los nombres se limpian en `orval.config.ts`, porque FastAPI produce operationIds como
`login_api_v1_auth_login_post`. Ese fichero lleva dos listas que hay que mantener:

- `RESERVADAS` — hay un endpoint `export`, y `export` no puede ser nombre de variable.
- `AMBIGUAS` — `get_moment`, `get_project` y `list_projects` existen en `learning` y en
  `studio` a la vez. **Si añades un endpoint que colisione, `tsc` falla con "Duplicate
  identifier"**: se añade el nombre ahí y se regenera.

**Todas las peticiones pasan por `shared/api/httpClient.ts`**, que es el mutator del
generado: autenticación, renovación del token y traducción de errores a `ApiError` en un
solo sitio para los 69 endpoints. Con **una sola renovación en vuelo**, porque el backend
ROTA el refresh token y varios refrescos a la vez harían que todos menos el primero
llegaran con un jti consumido, que el servidor trata como robo. La excepción es
`streamChat`: el chat responde SSE y el generado espera JSON completo.

**Un 403 no cierra la sesión.** 401 es "no sabemos quién eres" (renovar); 403 es "esto no
te toca" — un docente entrando a algo de editor. Confundirlos echa de la aplicación a
quien sí tiene sesión.

**El color se nombra por intención**, nunca por valor: `bg-surface`, `text-content-muted`.
Los tokens están en `styles/tokens.css` y son el único sitio con un color escrito; el modo
oscuro sale de redefinir los mismos tokens. La paleta definitiva sigue sin decidir
(`docs/scope-mvp.md` §9.13).

**Los guards de ruta deciden qué pintar, no qué se permite.** La autorización real la hace
el servidor en cada petición; saltarse un guard en el navegador no da acceso a ningún dato.
El caso claro es el **progreso lineal**: `hooks.estaDesbloqueado` pinta candados, pero
quien devuelve 403 es `get_moment_for`. Si los dos criterios se separan, manda el backend.

**La guía docente no se oculta en el cliente.** `learning.serialize_moment_for` ya la quita
del JSON de quien no es personal docente. Si algún día apareciera en la respuesta del
estudiante, el arreglo va en el servidor: un `if` aquí no sirve ante unas DevTools.

**El estudiante no lista "sus cursos".** `GET /courses` tiene guard `Staff`. Lo que ve en
`/student/courses` es el catálogo publicado filtrado por su grado
(`GET /learn/projects?grade=`), que es lo que el backend sí le ofrece. El nombre de la
ruta viene del prototipo. Sus tareas con fecha son otra cosa y sí son suyas:
`/student/agenda` contra `GET /assignments/mine`.

**Todo texto va por i18next.** La plataforma es bilingüe por requisito del cliente (R6).
La marca se escribe `IMaquina`, y en inglés cambia la segunda palabra: `IMaquina Robótica`
/ `IMaquina Robotics`. Los títulos de pestaña van `<marca> | <sección>` con iniciales en
mayúscula salvo conectores — "Inicio de Sesión", "Sign In", "Página No Encontrada".

**Las rutas se construyen con `shared/config/routes.ts`**, nunca a mano en un `<Link>`.
Una URL escrita a pelo es como se llega a enlaces rotos que ningún test de componente
detecta.

## Tests

vitest + Testing Library + MSW con `onUnhandledRequest: "error"`: una petición que ningún
handler simule hace fallar el test en vez de salir a la red.

`app/router/router.test.tsx` monta `<App>` y navega de verdad. Los guards y los enlaces
entre pantallas se prueban ahí, no en el componente aislado.

**Lo visual se comprueba en Chrome, no leyendo clases.** `jsdom` no calcula layout: un
elemento que se sale de la pantalla en 390px pasa toda la suite.
`scripts/audit-responsive.mjs` conduce Chrome por CDP y sale con código 1 si el documento
scrollea en horizontal (necesita la app levantada, por eso no está en `npm run build`).
Para contraste, tema oscuro o foco vale el mismo patrón: `--headless=new
--remote-debugging-port=9222` y `Emulation.setEmulatedMedia`. Ojo con `el.focus()` por
script: no dispara `:focus-visible` y da un falso positivo de "no hay foco visible"; hay
que mandar un Tab real con `Input.dispatchKeyEvent`.

`tsc -b` type-chequea también los tests, así que un test mal tipado rompe el build.

**jsdom no implementa `scrollIntoView`** y llamarlo lanza. `test/setup.ts` lo rellena: sin
eso, cualquier test que monte un momento revienta por el chat y no por lo que prueba.

## Assets

Ver [`src/assets/README.md`](src/assets/README.md). Lo importante: los `robot-*.svg` y el
logotipo claro llevan un PNG embebido en base64 y pesan entre 366 KB y 620 KB, así que la
pantalla de acceso transfiere ~900 KB en móvil. Exportarlos a WebP conserva la
transparencia y baja `robot-1` de 366 KB a 29 KB.

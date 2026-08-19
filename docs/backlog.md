# Backlog — backend y frontend

Derivado de [`scope-mvp.md`](scope-mvp.md) y contrastado con el código a 17/08/2026.
Cubre **sólo backend y frontend**. Lo que queda fuera está en §7.

**Las secciones están en orden de ejecución.** Dentro de cada una, los ítems también:
si uno depende de otro, lleva `⇠ depende de`. Los identificadores (`B`, `S`, `N`, `A`,
`C`, `I`) son estables y no cambian aunque se reordene.

El Content Studio va antes que el núcleo a propósito (con la excepción de N1/N8, ver §1): `scope-mvp.md` §4 es explícito en
que es el entregable que desbloquea al cliente para cargar los 34 proyectos restantes
mientras se sigue construyendo el resto.

`R1`–`R10` son los requisitos del cliente; `F1`–`F5` las fases del scope.

---

## 1. Bloqueantes transversales

Van primero porque bloquean secciones enteras, no ítems sueltos.

- [x] **B1 · Primera migración de Alembic.** ✅ `3f4c4a30a463 esquema inicial`, 24 tablas.
      `env.py` lleva un `render_item` para que el tipo `Vector` salga con su import, y la
      revisión crea la extensión `vector` a mano. Verificado: upgrade sobre base limpia,
      autogenerate posterior vacío (paridad modelos↔esquema), y downgrade→upgrade limpio.
      La deriva modelos↔migraciones la cierra `tests/integration/test_migrations.py`,
      verificado introduciendo una columna sin migración para ver el test en rojo.
- [x] **B2 · Tooling del frontend.** ✅ `package-lock.json` versionado, ESLint 10 con flat
      config, vitest + jsdom + MSW, y 8 tests reales (`http.ts` y `useAuth`). Targets
      `make web-install|web-lint|web-test|web-build`. De paso: 12 vulnerabilidades → 0.
      El warning de `react-refresh` se resolvió en N8 partiendo el fichero: eslint sale
      sin advertencias.
- [x] **B3 · Semillas de desarrollo.** ✅ `make seed` → institución, licencia vigente, un
      usuario por rol y un proyecto publicado con sus 6 momentos. Idempotente y bloqueado
      fuera de `ENV=local`. Verificado end-to-end contra la API: login de los 4 roles y
      `teacher_note` filtrada al estudiante (R4). Destapó dos bugs, ya corregidos:
      `publishing._load_full` no cargaba `ContentBlock.translations` (publicar reventaba
      contra una BD real) y el loop scope de pytest-asyncio dejaba la fixture `db`
      inservible.
- [x] **B4 · Gate de tests en el release.** ✅ Jobs `backend` (ruff + pytest **con
      Postgres+pgvector**, no sólo unitarios: ahí vive el guard de deriva de migraciones)
      y `frontend` (eslint + vitest + build) en paralelo; `release` lleva
      `needs: [backend, frontend]`. Los tests de integración **fallan duro con `CI=true`**
      en vez de saltarse, que si no el gate pasaría en verde sin probar nada.

### Excepción de orden: N1 y N8 ya están hechos

Se adelantaron a §2 a propósito y **ya están cerrados**: el access token dura 15 minutos y
sin renovación el Studio te echaba la sesión cada cuarto de hora, a ti desarrollando y al
cliente cargando contenido. El resto de §3 sí puede esperar a después del Studio.

---

## 2. F2 — Content Studio

El módulo `catalog` tiene **modelos y nada más**: ni servicio, ni router, ni entrada en
`app/api.py`. Es el grueso del trabajo pendiente. En el frontend, `StudioPage.tsx` son 15
líneas de placeholder.

### Backend ⇠ B1

- [x] **S1 · `catalog/service.py` + `catalog/router.py`** ✅ bajo `/studio/catalog`, con
      guard `Author`. CRUD de `Project` con PATCH parcial y traducción por idioma. Dos
      guardarraíles: slug repetido devuelve 409 en vez de un IntegrityError crudo, y
      **borrar un proyecto publicado devuelve 409** — `project_versions` cuelga con
      CASCADE y se llevaría el snapshot de los estudiantes. `status` no es editable aquí:
      publicar es de `publishing`. 10 tests de integración.
- [x] **S8 · Registrar el router en `app/api.py`.** ✅ Verificado en el esquema OpenAPI:
      `GET,POST /api/v1/studio/catalog/projects` y `DELETE,GET,PATCH .../{project_id}`.
- [x] **S2 · Los 6 momentos se crean solos** ✅ al crear el proyecto, con tipo fijo y el
      orden de `MOMENT_ORDER` (R7). Nacen vacíos: el editor los rellena. El **detalle**
      los devuelve y el **listado** no —serían seis joins por fila para una tabla que no
      los muestra—, y crear relee por el camino del detalle, así que crear y consultar
      devuelven exactamente la misma forma.
- [x] **S3 · CRUD de `ContentBlock`** ✅ añadir (al final), editar parcial, borrar y
      **reordenar mandando el orden completo** — es lo que envía un drag & drop y evita
      el estado intermedio de ir subiendo bloques de uno en uno. Un reordenamiento
      incompleto o con duplicados se rechaza con 422. Nuevo `media/service.asset_existe`
      para que un `media_asset_id` inexistente dé 422 y no un IntegrityError 500.
- [x] **S4 · Traducciones ES/EN** ✅ proyecto, momento y bloque aceptan `lang` y devuelven
      `langs`. `GET /projects/{id}/translations` dice **qué** falta en cada idioma, no un
      booleano, y usa el mismo criterio que decide si un idioma entra al snapshot.
      Destapó que la validación por idioma **no miraba los bloques**: un idioma con los
      títulos puestos entraba al snapshot con todos los cuerpos vacíos. Ahora un bloque de
      texto exige `body` y una imagen exige `alt_text` (accesibilidad), y un título en
      blanco no cuenta como traducido.
- [x] **S5 · Guía docente y prompt de apertura** ✅ `GET,PATCH /studio/catalog/moments/{id}`,
      parcial y por idioma. **Sin POST ni DELETE**: son seis y fijos (R7). En el Studio la
      guía docente NO se oculta —quien entra es editor—; el filtro por rol es del camino
      de lectura.
- [x] **S10 · Librería de media.** ✅ `GET /studio/media/assets` (paginado, filtro por
      familia MIME y búsqueda por nombre) y `DELETE /assets/{id}`. **No se borra un asset
      en uso**: el FK es `ON DELETE SET NULL`, así que borrarlo dejaría los bloques
      apuntando a nada sin aviso y quizá en un proyecto publicado. El listado trae
      `used_in` para avisar antes de intentarlo. La consulta de uso vive en
      `catalog.uso_de_assets` — `ContentBlock` es suyo.
- [ ] **S7 · Preview como estudiante y como docente.** Reutiliza
      `learning/service.serialize_moment_for`, no dupliques el filtro de `teacher_note`.
      ⇠ S5.
- [ ] **S6 · Duplicar proyecto.** El scope §7 lo marca como clave: la mayoría de los 36
      comparten estructura. ⇠ S3.
- [ ] **S18 · Despublicar un proyecto.** `status` solo avanza a `published`; **nadie lo
      devuelve a `draft`**. El mensaje de error al borrar un proyecto publicado dice
      "despublícalo primero" y esa acción no existe. Sale de la revisión de arquitectura.
      ⇠ S1.
- [ ] **S19 · Limpiar los objetos huérfanos de S3.** `DELETE /assets/{id}` sólo da de
      baja el registro; el fichero se queda en el bucket para siempre. Borrarlo dentro de
      la petición no vale: si el commit falla después, queda un fichero destruido que la
      BD sigue referenciando. Trabajo ARQ idempotente que borre el objeto **sólo si ya no
      existe ninguna fila** con esa `s3_key`. ⇠ S10.
- [ ] **S9 · Autoguardado y bloqueo optimista.** Dos editores sobre el mismo proyecto
      deben avisar, no perder trabajo. ⇠ S3.

### Frontend ⇠ B2

- [x] **S11 · Layout y rutas anidadas del Studio.** ✅ Shell con `<Routes>` anidadas
      (índice → listado, `projects/:id` → detalle) y selector del **idioma de edición**,
      distinto del de la interfaz. Destapó que el chunk aparte **estaba roto**: la config
      de `manualChunks` era de Rollup y bajo rolldown convertía "studio" en el chunk
      común, así que el bundle de entrada lo importaba entero. Quitada, y añadido
      `scripts/check-chunks.mjs` al `npm run build` para que no vuelva a pasar en silencio.
- [x] **S12 · Listado y creación de proyectos.** ✅ Listado con estado e idiomas
      traducidos, y alta con el identificador derivado del título (sin acentos, va en la
      URL) editable a mano. El 409 de slug repetido se pinta con el mensaje del backend.
      Hooks a mano sobre `http()` y **no** el cliente de orval: su código está gitignored
      y `api:gen` necesita el backend, así que importarlo rompería el build en CI.
- [ ] **S13 · Editor de momentos y bloques** con reordenación por drag. ⇠ S12, S3.
- [ ] **S14 · Texto enriquecido con esquema acotado** (TipTap con nodos limitados:
      negrita, listas, enlaces, código). **Nunca HTML libre** — es superficie de XSS y
      rompe el diseño. ⇠ S13.
- [ ] **S15 · Subida de media** al presigned URL desde el navegador, sin pasar por
      FastAPI, con `alt` obligatorio. ⇠ S13, S10.
- [ ] **S16 · Vista bilingüe lado a lado.** ⇠ S13, S4.
- [ ] **S17 · Botón de publicar** que muestre los `problems` de `check_publishable` antes
      de dejar publicar. ⇠ S12. *El backend de publicación ya existe.*

## 3. F1 — Núcleo: huecos

Lo que existe: `core` (config, security, deps, errors), `db`, `identity` (login + me),
`learning` (lectura desde snapshot), `publishing`, `media` (presign + register).

### Backend ⇠ B1

- [x] **N1 · `POST /auth/refresh`.** ✅ La vigencia se extrae a `_vigencia()`, compartida
      con el login: se revalida en **cada** emisión, así que refrescar no revive una
      licencia vencida. El rol y la institución se releen de la base, no de los claims.
      Requirió separar autenticación de autorización: un token expirado devolvía **403**,
      el mismo código que "no te toca", y así el cliente no puede saber cuándo renovar.
      Nuevo `Unauthenticated` (401) en `core/errors.py`, usado por `get_tenant`.
      10 tests de integración.
- [ ] **N2 · Rotación de refresh + logout/revocación.** `arquitectura.md` §7 pide refresh
      rotativo; hoy no rota ni se puede invalidar. ⇠ N1.
- [ ] **N3 · Alta y gestión de usuarios.** No hay CRUD. **⇠ bloqueado por §8: ¿cómo se
      crean las cuentas?** Mínimo viable: alta por institución con rol.
- [ ] **N4 · Cursos y matrículas.** `Course` y `Enrollment` existen como modelos y **no
      tienen ni servicio ni endpoints**. ⇠ N3.
- [ ] **N5 · Progreso del estudiante.** `learning/models.Progress` existe y **nadie lo
      escribe**: ningún servicio ni router lo toca. Marcar momento completado + consulta
      por estudiante y por curso. Lleva `institution_id`: mantener verde el guard
      parametrizado de `test_tenant_isolation.py`. **⇠ §8: ¿progreso lineal o libre?**
- [ ] **N6 · Panel docente básico.** Listado de estudiantes de un curso con su progreso
      por momento (el scope lo pide a nivel de momento, no de proyecto). ⇠ N4, N5.
- [ ] **N11 · Desacoplar el listado del estudiante de `catalog`.**
      `learning.list_published_projects` hace **join contra `Project`** para filtrar por
      `status` y ordenar, aunque el snapshot ya lleva `grade`, `slug` y `title` dentro.
      `arquitectura.md` §3.1 vende "una query, un índice, cacheable" y el camino de lectura
      sigue acoplado a las tablas de escritura. Sale de la revisión de arquitectura.
- [ ] **N7 · Rate limit del chat.** `settings.CHAT_RATE_LIMIT_PER_HOUR` está definido y
      **no lo aplica nadie**. Redis ya está levantado. Protege costo y evita abuso (R9).

### Frontend ⇠ B2

- [x] **N8 · Guardar y usar el refresh token.** ✅ `AuthProvider` lo guarda y `http.ts`
      renueva y reintenta al recibir 401, con **una sola renovación en vuelo** y sin
      reintentar en `/auth/login` ni `/auth/refresh`. `streamChat` igual, que es donde más
      importa. De paso: un **403 ya no cierra la sesión** — un docente entrando a un
      endpoint de editor se quedaba fuera. `useAuth.tsx` partido en `useAuth.ts` (hook) y
      `AuthProvider.tsx` (componente).
- [ ] **N9 · Progreso en la UI.** Marcar momento completado desde `MomentPage` y pintar el
      avance en el listado de proyectos. ⇠ N5.
- [ ] **N10 · Manejar el 429 del rate limit** en `ChatPanel` con un mensaje claro en vez
      de un error genérico. ⇠ N7.
- [x] **N12 · El recorrido del estudiante está cortado.** ✅ Nueva `ProjectPage` en
      `/projects/:id` con los seis momentos, y vuelta al proyecto desde el momento. Un
      momento sin bloques no es enlace. Cubierto con un test que **navega la app entera**,
      no componentes aislados — que es por lo que nadie había visto el corte; verificado
      en rojo quitando la ruta.
- [ ] **N13 · No hay botón de cerrar sesión.** `useAuth.logout()` existe y `auth.logout`
      está traducido, pero ningún componente lo usa.

## 4. F3 — Evaluación (R10)

`assessment/models.py` está **completo** (Assessment, Question, Choice, Attempt, Answer y
sus traducciones). No hay servicio, ni router, ni UI.

### Backend ⇠ B1, S1

- [ ] **A7 · Registrar el router en `app/api.py`.** Mismo motivo que S8: primero.
- [ ] **A1 · Constructor de preguntas** (autoría, vive dentro del Studio): opción
      múltiple, V/F, abierta y numérica, con opciones, respuesta correcta y puntaje.
      ⇠ S1. **⇠ §8: ¿hay preguntas abiertas?**
- [ ] **A2 · Endpoints de estudiante**: iniciar intento, guardar respuestas, enviar.
      ⇠ A1. **⇠ §8: ¿individual o por equipo? ¿reintentos?**
- [ ] **A3 · Calificación automática** de mcq / V-F / numérica, respetando `max_attempts`
      y `pass_score`. ⇠ A2. **⇠ §8: ¿reintentos?**
- [ ] **A4 · Calificación manual** del docente para preguntas abiertas
      (`Answer.teacher_score`, `teacher_feedback`). ⇠ A3. **⇠ §8: ¿quién califica?**
- [ ] **A5 · Tablero de resultados** por estudiante para el docente. ⇠ A3.
- [ ] **A6 · Export XLSX.** `workers/worker.export_results` devuelve hoy
      `{"status": "pendiente"}`. `openpyxl` ya está en dependencias. Falta el generador y
      el endpoint de descarga. **Requisito explícito del cliente (R10).** ⇠ A5.

### Frontend ⇠ B2

- [ ] **A10 · Constructor de preguntas** dentro del Content Studio. ⇠ S13, A1.
- [ ] **A8 · Formulario de evaluación** del estudiante. `react-hook-form` y `zod` ya están
      en dependencias. ⇠ A2.
- [ ] **A9 · Tablero docente** con el botón de exportar. ⇠ A5, A6.

## 5. F4 — Chat: la mitad de delante del puerto

Lo de detrás de `AssistantProvider` no está aquí (ver §7). Esto sí es backend y frontend.
Todo se construye y se testea contra `StubProvider`, sin depender de Luis.

- [ ] **C1 · Historial de conversación.** `assistant/service.ask()` construye
      `ChatContext(question, lang, grade, chunks)` **sin pasar `history`**: el campo existe
      en la dataclass y siempre llega vacío, así que el chat **no tiene memoria entre
      turnos**. Cargar los `ChatMessage` de la sesión. ⇠ B1.
- [ ] **C2 · Recuperar sesiones previas** del usuario (listado e histórico). ⇠ C1.
- [ ] **C6 · Pintar el historial en la UI.** `ChatPanel` hace `POST /chat/sessions` en cada
      montaje y **nunca carga mensajes previos**: al reabrir un momento la conversación
      aparece vacía aunque exista en la BD. ⇠ C2, B2.
- [ ] **C3 · Prompt de apertura por momento (R8)** de punta a punta: el campo existe en el
      modelo y `ChatPanel` ya recibe `openingPrompt`; falta verificar el flujo completo.
      ⇠ S5.
- [ ] **C5 · Registro de rechazos** del guardrail para poder afinarlo. La clasificación es
      de Luis; guardarla y consultarla es de aquí.
- [ ] **C4 · Retención acotada del historial.** Son datos de menores (Ley 1581). ⇠ C2.

## 6. F5 — i18n y pulido

- [ ] **I1 · Selector de idioma.** `i18n/index.ts` exporta `setLanguage` y **ningún
      componente lo llama**: hoy no hay forma de cambiar de idioma en la UI (R6). ⇠ B2.
- [ ] **I7 · Persistir el idioma preferido.** `User.preferred_lang` existe y el login lo
      devuelve, pero **no hay endpoint para cambiarlo**: el idioma sólo vive en
      `localStorage` y se pierde al cambiar de equipo. ⇠ I1, B1.
- [ ] **I2 · Completar `en.json`** con los textos de interfaz. Los textos de contenido los
      carga el cliente desde el Studio, no van aquí. ⇠ I1.
- [ ] **I7b · Paleta de marca del PO.** Los tokens semánticos ya están
      (`src/index.css` + `tailwind.config.js`) y **cero colores crudos** en la UI, pero
      los valores son un neutro provisional. Cuando el PO entregue la paleta se cambia
      ese bloque y nada más. Verificar contraste AA (4.5:1 para texto) al sustituirlos:
      `content-subtle` es el suelo actual con 4.8:1.
- [ ] **I3 · Responsive mobile-first.** El scope §5 lo marca: los estudiantes entran desde
      el celular y la sala de robótica no tiene un PC por cabeza.
- [ ] **I4 · Accesibilidad.** `alt_text` ya está en el modelo; falta exigirlo y usarlo en
      la UI. ⇠ S15.
- [ ] **I8 · Caché del contenido publicado en Redis.** `arquitectura.md` §5 justifica
      Redis por partida doble, cola **y caché**; hoy solo se usa de cola, así que el
      argumento de rendimiento del snapshot está a medio cobrar. ⇠ N11.
- [ ] **I5 · Tests de frontend** con vitest + msw (hoy: cero). ⇠ B2.
- [ ] **I6 · Tests de integración** de cada endpoint nuevo, contra Postgres real. *No
      esperar a esta sección: cada endpoint entra con su test.*

## 7. Fuera de este backlog

| Qué | De quién |
|---|---|
| Embeddings reales, prompt de sistema, chunking/ranking/top-k, calidad del RAG, `is_in_domain` | Luis — ver `CLAUDE.md` § Frontera del trabajo de modelo |
| Infra, hosting, servidor, despliegue | PO |
| Carga de los 34 proyectos restantes y los textos en inglés | Cliente, con el Content Studio |
| App nativa, offline, gamificación, LMS, dashboards de directivos, aprobación multinivel | Fuera del MVP (`scope-mvp.md` §3) |

## 8. Preguntas que bloquean ítems concretos

De `scope-mvp.md` §9. Mientras no se cierren, esos ítems no se pueden terminar:

| Pregunta | Bloquea |
|---|---|
| ¿Cómo se crean las cuentas? (§9.6) | N3 → y con él N4, N6 |
| ¿Progreso lineal obligatorio o navegación libre? (§9.14) | N5, N6, N9 |
| ¿Evaluación individual o por equipo? (§9.11) | A2 → y con él toda §4 |
| ¿Se puede reintentar una evaluación? (§9.11) | A2, A3 |
| ¿Preguntas abiertas? ¿Quién las califica? (§9.10) | A1, A4 |
| ¿Video propio o embebido? (§9.7) | S15 |

# Backlog — backend y frontend

Derivado de [`scope-mvp.md`](scope-mvp.md) y contrastado con el código a 23/08/2026.
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

## 2. F2 — Content Studio ✅ completo (18/08/2026)

Backend y frontend cerrados de punta a punta: CRUD, traducciones, media, duplicar,
despublicar, bloqueo optimista, limpieza de huérfanos, preview, editor de bloques con
drag, texto enriquecido, subida de media y publicar. 107 tests de backend (37 unit + 70
integración) y 31 de frontend, todos en verde; `make lint`, `web-lint` y `web-build`
(con `check-chunks.mjs`) también.

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
- [x] **S7 · Preview como estudiante y como docente.** ✅ `GET
      /studio/catalog/moments/{id}/preview?as=student|teacher`. Reutiliza tal cual
      `learning.serialize_moment_for`, construyendo un `TenantContext` con el rol pedido
      en vez de duplicar el filtro de `teacher_note`.
- [x] **S6 · Duplicar proyecto.** ✅ `POST /studio/catalog/projects/{id}/duplicate`, copia
      traducciones, momentos y bloques (mismo `media_asset_id`, no duplica el archivo). El
      nuevo nace siempre `draft`, aunque el original esté publicado.
- [x] **S18 · Despublicar un proyecto.** ✅ `POST /studio/publishing/projects/{id}/unpublish`
      vuelve `status` a `draft` sin borrar el historial de `ProjectVersion`, y reencola el
      reindexado (vacía los chunks del RAG al no haber snapshot publicado).
- [x] **S19 · Limpiar los objetos huérfanos de S3.** ✅ `media.service.borrar` devuelve el
      `s3_key` y el router encola `delete_orphaned_media`, un job ARQ idempotente
      (reconfirma que ninguna fila referencia esa clave antes de borrar en el bucket) — el
      mismo patrón de enqueue inmediato que ya usaba `publish`/`rollback`.
- [x] **S9 · Autoguardado y bloqueo optimista.** ✅ `Project`/`Moment`/`ContentBlock` ya
      serializan `updated_at`; sus `PATCH` aceptan `expected_updated_at` opcional y
      responden 409 si no coincide con la fila actual, antes de escribir nada. El
      autoguardado (debounce al perder foco) y el aviso de conflicto van en el frontend
      (S13).

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
- [x] **S13 · Editor de momentos y bloques.** ✅ `MomentEditor` + `BlockCard`: campos del
      momento (título, guía docente, prompt de apertura) y bloques reordenables por drag
      con `@dnd-kit` (manda el orden completo, como espera `reorder_blocks`). Autoguardado
      al perder foco, con aviso y botón "Recargar" cuando el backend devuelve 409 (S9).
- [x] **S14 · Texto enriquecido con esquema acotado.** ✅ TipTap (`StarterKit` recortado —
      sin encabezados ni cita — más `Link`) en `lib/richTextExtensions.ts`, compartido
      entre `RichTextEditor` (Studio) y `RichTextView` (lectura, `editable: false`). Nunca
      `dangerouslySetInnerHTML`: el mismo esquema acotado gobierna escritura y lectura, en
      el Studio y en `MomentPage` del estudiante.
- [x] **S15 · Subida de media.** ✅ `MediaLibraryPicker`: presign → `PUT` directo al bucket
      → `register`, con `alt` obligatorio para imágenes antes de dejar subir. **Video
      sigue siendo embed de YouTube** (decisión ya cerrada), no pasa por este flujo.
- [x] **S16 · Vista bilingüe lado a lado.** ✅ Toggle en `MomentEditor` que pinta ES/EN en
      dos columnas con los mismos componentes de S13, más el indicador de traducción
      (`EstadoDeTraduccion`, S4) en la cabecera del proyecto.
- [x] **S17 · Botón de publicar.** ✅ Valida primero (`/validate`) y muestra los `problems`
      en un panel antes de publicar de verdad. De paso, con la barra de acciones ya
      montada: despublicar (S18), duplicar (S6) y borrar (backend ya existía, sin UI hasta
      ahora) quedaron en el mismo sitio.

## 3. F1 — Núcleo ✅ completo (23/08/2026)

Cuentas, cursos, matrículas, progreso lineal, panel docente, rotación de refresh y rate
limit del chat — backend y frontend, con su UI mínima de administración/panel docente.

### Backend ⇠ B1

- [x] **N1 · `POST /auth/refresh`.** ✅ La vigencia se extrae a `_vigencia()`, compartida
      con el login: se revalida en **cada** emisión, así que refrescar no revive una
      licencia vencida. El rol y la institución se releen de la base, no de los claims.
      Requirió separar autenticación de autorización: un token expirado devolvía **403**,
      el mismo código que "no te toca", y así el cliente no puede saber cuándo renovar.
      Nuevo `Unauthenticated` (401) en `core/errors.py`, usado por `get_tenant`.
      10 tests de integración.
- [x] **N2 · Rotación de refresh + logout/revocación.** ✅ Nueva tabla `RefreshToken`
      (`jti`, `revoked_at`) — el JWT sigue siendo stateless salvo esta excepción
      deliberada. `/auth/refresh` ahora ROTA: revoca el jti usado y devuelve un refresh
      nuevo (`AccessOut` gana `refresh_token`); reutilizar uno ya rotado da 401 (la señal
      de robo no se puede distinguir de "nunca existió", así que se tratan igual). Nuevo
      `POST /auth/logout`, idempotente. Frontend: `AuthProvider.logout()` revoca en el
      servidor (best-effort) antes de limpiar localStorage; `http.ts` guarda el refresh
      nuevo en cada renovación.
- [x] **N3 · Alta y gestión de usuarios.** ✅ Nuevo `identity/service.py` (antes todo vivía
      en el router). Alias `Admin` nuevo en `deps.py` — ni editor ni docente pueden dar de
      alta cuentas. `POST,GET /admin/users`, `PATCH /admin/users/{id}` (nunca borra,
      `is_active=False` — hay `Attempt`/`Progress` colgando). Todo scopeado a
      `institution_id`: editar la cuenta de otra institución da 404.
- [x] **N4 · Cursos y matrículas.** ✅ `POST,GET /courses`, `POST,DELETE
      /courses/{id}/enrollments`, `GET /courses/{id}/students`. `GET /courses?mine=true`
      filtra a los cursos del docente que pregunta. Relaciones
      `Course.enrollments`/`Enrollment.course` añadidas a los modelos (no existían).
- [x] **N5 · Progreso del estudiante.** ✅ `learning.marcar_completado` +
      `learning.progreso_de`. **Progreso lineal**: `get_moment_for` exige que el momento
      anterior en `MOMENT_ORDER` esté `COMPLETED` antes de servir uno posterior a `intro`
      — `PermissionDenied` si no. El docente no está sujeto al bloqueo (necesita entrar a
      cualquier momento). `POST /learn/projects/{id}/moments/{type}/complete`,
      `GET /learn/projects/{id}/progress`.
- [x] **N6 · Panel docente básico.** ✅ `learning.progreso_del_curso` cruza el roster de
      `identity` (vía `Enrollment`) con `Progress`; `GET
      /learn/teacher/courses/{id}/progress?project_id=`, guard `Staff`.
- [x] **N11 · Desacoplar el listado del estudiante de `catalog`.** ✅
      `list_published_projects` ya no hace join a `Project`: filtra solo por
      `ProjectVersion.is_current`, y `order`/`grade` salen del propio snapshot. Requirió
      corregir un efecto secundario de S18: `unpublish` dejaba `is_current=True` sin
      tocar, así que un proyecto despublicado habría seguido pareciendo publicado sin el
      join. Ahora `unpublish` también apaga `is_current` (el historial de `ProjectVersion`
      se conserva; un republicar reconstruye el snapshot de todas formas).
- [x] **N7 · Rate limit del chat.** ✅ Ventana fija de una hora en Redis
      (`chat_rate:{user_id}:{hora}`, `INCR`+`EXPIRE`). Se revisa en el **router**, antes
      de construir el `StreamingResponse` — dentro del generador de `service.ask` ya es
      tarde para devolver un 429 limpio, la respuesta ya se comprometió a 200. Nuevo
      `RateLimited` (429) en `core/errors.py`.

### Frontend ⇠ B2

- [x] **N8 · Guardar y usar el refresh token.** ✅ `AuthProvider` lo guarda y `http.ts`
      renueva y reintenta al recibir 401, con **una sola renovación en vuelo** y sin
      reintentar en `/auth/login` ni `/auth/refresh`. `streamChat` igual, que es donde más
      importa. De paso: un **403 ya no cierra la sesión** — un docente entrando a un
      endpoint de editor se quedaba fuera. `useAuth.tsx` partido en `useAuth.ts` (hook) y
      `AuthProvider.tsx` (componente).
- [x] **N9 · Progreso en la UI.** ✅ `MomentPage` tiene botón "Marcar completado"
      (estudiante). `ProjectPage` pinta un ✓ en el completado y **bloquea de verdad** el
      siguiente al primero no completado (no solo oculta el enlace — el backend ya lo
      exige, esto evita mandar al estudiante a un 403).
- [x] **N10 · Manejar el 429 del rate limit.** ✅ `ChatPanel` distingue
      `ApiError.status === 429` y pinta `chat.rateLimited` en vez del error genérico,
      retirando la burbuja vacía que se había añadido de más.
- [x] **N12 · El recorrido del estudiante está cortado.** ✅ Nueva `ProjectPage` en
      `/projects/:id` con los seis momentos, y vuelta al proyecto desde el momento. Un
      momento sin bloques no es enlace. Cubierto con un test que **navega la app entera**,
      no componentes aislados — que es por lo que nadie había visto el corte; verificado
      en rojo quitando la ruta.
- [x] **N13 · No hay botón de cerrar sesión.** ✅ Nuevo `AppHeader` compartido (no existía
      ningún nav/header) montado dentro de `RequireAuth`, con el botón y enlaces a
      `/admin`/`/teacher` según el rol.
- [x] **N14 · UI mínima de administración y panel docente.** No estaba numerado en el
      backlog original, pero N3/N4/N6 no tenían ninguna pantalla — sin esto los endpoints
      no eran usables. ✅ `features/admin/` (alta de usuarios, cursos, matrícula, guard
      `RequireAdmin`) y `features/teacher/` (progreso por curso/proyecto, guard
      `RequireStaff`), rutas `/admin/*` y `/teacher/*`.

- [x] **N15 · Cambiar y restablecer contraseñas.** No estaba en el backlog original y
      era un agujero, no un pulido: N3 crea las cuentas con una contraseña que fija el
      administrador y **nadie podía cambiarla nunca** — ni el dueño ni el propio
      administrador. Son cuentas de menores con una credencial que un tercero conoce de
      forma permanente. ✅ `POST /auth/me/password` (exige la actual; sin eso un access
      token robado bastaría para dejar fuera al dueño) y `POST
      /admin/users/{id}/reset-password` (guard `Admin`, scopeado a la institución: una
      cuenta ajena da 404, no 403, para no confirmar que ese correo existe). **Las dos vías
      revocan todos los refresh del usuario**; el cambio propio devuelve un par nuevo en la
      respuesta, o quien acierta su contraseña se quedaría sin sesión. Ojo con el alcance:
      el access token es stateless y sobrevive hasta 15 minutos — esto corta la renovación,
      no el acceso inmediato. Frontend: `/cuenta` (enlazada desde `AppHeader`) y
      restablecer inline en la lista de usuarios de administración. **No hay recuperación
      por correo** y no la habrá: las cuentas de menores se crean sin buzón propio, así que
      el login lo dice explícitamente y la única vía es el administrador. 11 tests de
      integración (los dos de revocación, verificados en rojo) y 3 de frontend que navegan
      la app entera.

## 4. F3 — Evaluación (R10) ✅ completo (23/08/2026)

`assessment/models.py` está **completo** (Assessment, Question, Choice, Attempt, Answer y
sus traducciones). No hay servicio, ni router, ni UI.

### Backend ⇠ B1, S1 — ✅ completo (23/08/2026)

- [x] **A7 · Registrar el router en `app/api.py`.** ✅ Dos routers: `/studio/assessment`
      (autoría + calificación) y `/learn/assessments` (estudiante).
- [x] **A1 · Constructor de preguntas.** ✅ `GET /studio/assessment/moments/{id}` crea la
      evaluación si no existe (una por momento `assess`, idempotente). CRUD de preguntas
      (mcq/V-F/abierta/numérica) y opciones, reordenar mandando la lista completa —
      mismo patrón que los bloques de `catalog`.
- [x] **A2 · Endpoints de estudiante.** ✅ `POST .../attempts` (respeta `max_attempts`
      contando **todos** los intentos previos, no solo los enviados), `PATCH
      .../answers` (parcial), `POST .../submit`. **Equipos, resuelto con lo mínimo que
      cumple "con libertad":** sin entidad `Team` — `Assessment.team_mode` (lo marca el
      editor) + `Attempt.team_label`, una etiqueta libre que escribe quien envía el
      intento, solo para agrupar en el tablero (A5). No hay membresía real que mantener.
- [x] **A3 · Calificación automática.** ✅ Al enviar: mcq/V-F contra `Choice.is_correct`,
      numérica con tolerancia. Las abiertas quedan sin calificar
      (`status=submitted`); si no hay ninguna abierta pasa directo a `graded`.
- [x] **A4 · Calificación manual.** ✅ `PATCH /studio/assessment/answers/{id}`, guard
      `Staff`. Recalcula `Attempt.score` (auto + manual) y pasa a `graded` en cuanto la
      última abierta queda calificada.
- [x] **A5 · Tablero de resultados.** ✅ `GET /studio/assessment/{id}/attempts`, guard
      `Staff`, scopeado a la institución de quien pregunta.
- [x] **A6 · Export XLSX.** ✅ `workers/worker.export_results` genera el libro con
      `openpyxl` y lo sube a una key determinista (`exports/{id}.xlsx` — un segundo
      export sobreescribe, no acumula). `POST .../export` encola,
      `GET .../export` hace `head_object` y devuelve la URL prefirmada cuando está listo
      o `{"status": "pendiente"}` si no.

### Frontend ⇠ B2

- [x] **A10 · Constructor de preguntas** dentro del Content Studio. ✅ `AssessmentEditor`,
      mismo patrón que `MomentEditor`/`BlockCard`: tarjetas por pregunta, opciones para
      mcq/V-F, reordenar con `@dnd-kit`.
- [x] **A8 · Formulario de evaluación** del estudiante. ✅ `AssessmentForm` en
      `features/assessment/`, autoguardado de respuestas (como los bloques del Studio) y
      envío final; respeta `max_attempts` mostrando el error del backend.
- [x] **A9 · Tablero docente** con el botón de exportar. ✅ `AssessmentResults`: lista de
      intentos, calificación manual inline para las abiertas, botón "Exportar a Excel"
      que dispara el job y hace poll de `GET .../export` hasta que hay URL.

## 5. F4 — Chat: la mitad de delante del puerto ✅ completo (23/08/2026, salvo N/A)

Lo de detrás de `AssistantProvider` no está aquí (ver §7). Esto sí es backend y frontend.
Todo se construye y se testea contra `StubProvider`, sin depender de Luis.

- [x] **C1 · Historial de conversación.** ✅ `service.ask()` carga los últimos 20
      `ChatMessage` de la sesión (ANTES de añadir el turno actual, o se duplicaría) y los
      pasa como `history=` — el campo ya existía en `ChatContext` y `ClaudeProvider` ya lo
      consumía, solo faltaba rellenarlo.
- [x] **C2 · Recuperar sesiones previas** del usuario. ✅ `GET /chat/sessions?moment_id=`
      (listado, filtrable por momento) y `GET /chat/sessions/{id}/messages` (histórico;
      404 si la sesión no es del que pregunta, no solo por id).
- [x] **C6 · Pintar el historial en la UI.** ✅ `ChatPanel` primero pregunta por
      `GET /chat/sessions?moment_id=` y reusa la más reciente si existe; solo crea una
      nueva si no hay ninguna. Carga `GET /sessions/{id}/messages` antes de mostrar nada.
      De paso, refactor sin `setState` síncrono en efectos (regla de lint nueva): el
      historial ya no se copia a estado local, se deriva de la query directamente.
- [x] **C3 · Prompt de apertura por momento (R8)** de punta a punta. ✅ Verificado con un
      test de integración que publica un proyecto con `chatbot_opening_prompt` en
      `intro` y confirma que `GET /learn/projects/{id}/moments/intro` lo devuelve tal
      cual al estudiante — no solo en el snapshot (unit), el camino de lectura real.
- [x] **C5 · Registro de rechazos** del guardrail. ✅ `GET /studio/assistant/rejections`
      (guard `Staff`). De paso, un bug real: el flag `was_redirected` estaba en la
      respuesta enlatada del bot (siempre el mismo texto fijo), no en la pregunta
      rechazada — inútil para afinar el clasificador. Movido a la pregunta.
- [x] **C4 · Retención acotada del historial.** ✅ `purge_old_chat_history`, primer uso de
      `cron_jobs` en `WorkerSettings` (antes todo era enqueue al vuelo desde un router).
      Corre a diario, borra de verdad (no marca) `ChatSession` más viejas que
      `settings.CHAT_RETENTION_DAYS` (180 por defecto) — `ChatMessage` cae con CASCADE.

## 6. F5 — i18n y pulido

- [x] **I1 · Selector de idioma.** ✅ `LanguageSwitcher` en `AppHeader`. El ítem se
      quedaba corto: además de que nadie llamaba a `setLanguage`, **el frontend nunca
      mandaba `lang` a los endpoints del estudiante** — `/learn/projects`, el detalle y el
      momento usaban el `lang="es"` por defecto del backend, así que un selector por sí
      solo habría cambiado los botones y dejado el contenido en español. Ahora el idioma
      va en la petición **y en la `queryKey`**, que es lo que hace que TanStack Query
      refetchee solo al cambiarlo, sin invalidación manual. `lib/useLang.ts` lo normaliza
      a "es"/"en": i18next puede devolver "es-CO" según el navegador y el backend caería
      al primer idioma del snapshot sin avisar. El idioma de EDICIÓN del Studio (S11)
      sigue siendo independiente. ⇠ B2.
- [x] **I7 · Persistir el idioma preferido.** ✅ `PATCH /auth/me` (`lang`, con pattern
      `es|en` — es la única puerta de escritura a un `String(2)`). El selector lo guarda
      **best-effort**, mismo criterio que la revocación del logout: si la petición falla el
      idioma ya cambió en pantalla y no tiene sentido bloquear al usuario por no poder
      guardar una preferencia. Al revés también faltaba: `AuthProvider.login` ahora aplica
      el idioma de LA CUENTA, que si no, entrar desde un equipo compartido del aula te
      servía la interfaz en el idioma del último que lo usó. 4 tests de integración y 4 de
      frontend que navegan la app entera (el del `lang` en la petición, verificado en
      rojo). ⇠ I1, B1.
- [x] **I2 · Completar `en.json`** con los textos de interfaz. ✅ Estaba desactualizado,
      como I5/I6: `es.json` y `en.json` tienen hoy las **mismas 178 claves**, cero huecos.
      Las pocas cadenas idénticas entre idiomas son cognados reales (`Studio`, `editor`,
      `video`, `audio`), no traducciones pendientes. Los textos de contenido los carga el
      cliente desde el Studio, no van aquí. ⇠ I1.
- [x] **I7b · Paleta de marca del PO.** ✅ Ámbar #FCB71B (marca) y grises con matiz oliva
      del logo, derivados de las piezas de Curiosear/Descubrir/Inventar/Innovar. Aprobada
      por el PO. Los 20 pares de la interfaz cumplen AA (`content-subtle` es el suelo,
      4.8:1). Modo oscuro incluido — sale de redefinir variables, cero cambios en
      componentes porque ya nombraban intenciones y no colores. `brand` es fondo (botón
      ámbar con texto oscuro, como el logo), `brand-ink` es el mismo tono oscurecido para
      texto/enlaces (el ámbar sobre blanco da 1.76:1, ilegible como texto).
- [ ] **I7c · Mapeo de las 4 etapas de marca a los 6 momentos.** `index.css` ya trae los
      colores de Curiosear/Descubrir/Inventar/Innovar (`--color-curiosear` etc.) pero son
      **4, no 6**, y hoy no se usan en ningún componente. Falta decidir el mapeo a
      `MOMENT_ORDER` (¿se agrupan dos momentos por etapa? ¿se piden 2 tonos más al PO?)
      antes de pintarlos en la UI del estudiante. ⇠ I7b.
- [x] **I3 · Responsive mobile-first.** ✅ Revisado con Chrome de verdad a 390/768/1280 en
      las nueve vistas (estudiante ×3, admin, docente con tabla poblada, Studio ×3,
      evaluación), no leyendo clases de Tailwind. **Un solo defecto real, y era
      transversal:** `AppHeader` era un `flex` sin `wrap` con seis elementos y medía
      **574px en un viewport de 390**, así que arrastraba a scroll horizontal *todas* las
      pantallas autenticadas — el desborde que se veía en admin y docente no era suyo.
      Corregido con `flex-wrap` y ocultando el rol (informativo, no accionable) por debajo
      de `sm`. Lo agravé yo en I1/N15 al meterle el selector de idioma y "Mi cuenta".
      La tabla del panel docente mide 672px en móvil y **eso está bien**: su
      `overflow-x-auto` la hace scrollear dentro de su caja sin mover el documento.
      Queda `frontend/scripts/audit-responsive.mjs`, que conduce Chrome por CDP y sale con
      código 1 si el documento scrollea en horizontal (verificado revirtiendo el arreglo
      del header). **No está en `npm run build`**: necesita la app y la API levantadas, así
      que es herramienta de revisión, no guard de CI — en jsdom esto no se puede detectar,
      vitest no calcula layout.
- [x] **I4 · Accesibilidad.** ✅ Cerrado también: el Content Studio no tenía ningún
      `<h1>` —su título era un `<Link>` suelto—, así que no se podía navegar por
      encabezados. **Corrección a la nota anterior de este ítem: el
      defecto de los `<label>` NO estaba en `AdminPage`, `TeacherPage` ni el Studio.** Esas
      pantallas usan el patrón envolvente (`<label><span>…</span><input/></label>`), que es
      válido y da nombre accesible; el fallo estaba sólo en `LoginPage`, donde el `<label>`
      era hermano del input. Comprobado, no leído: `features/a11y.test.tsx` computa el
      nombre accesible de cada control en ocho pantallas y `test/a11y.ts` implementa las
      cuatro formas de nombrarlo, sin dependencias nuevas (`dom-accessibility-api` sólo
      entra como transitiva de testing-library y añadirla obliga a tocar el lock).
      Cerrado además: `alt_text` se pinta en los tres sitios con imagen; `<html lang>`
      ahora sigue al idioma (WCAG 3.1.1 — `index.html` lo traía fijo en "es" y con el
      selector de I1 un usuario en inglés tenía el documento declarado como español); el
      chat lleva `aria-live="polite"` + `aria-busy` (la respuesta llega por streaming y no
      se anunciaba nada) y su campo tiene `aria-label`, porque sólo tenía `placeholder` y
      ése desaparece al escribir. **Queda:** foco visible, teclado en el drag de bloques
      Cerrados los tres que quedaban, midiendo en Chrome y no a ojo:
      **(1) Reordenar era imposible sin ratón.** `MomentEditor` y `AssessmentEditor`
      registraban sólo `PointerSensor`, así que el asa de arrastre no respondía al
      teclado y no había *ninguna* otra forma de cambiar el orden de bloques o preguntas.
      Añadido `KeyboardSensor` con `sortableKeyboardCoordinates`. Verificado conduciendo
      Chrome: Tab hasta el asa → Espacio → Flecha abajo → Espacio invierte el orden y
      **persiste en la base**; quitando el sensor, la misma secuencia no hace nada.
      **(2) El foco visible NO era un defecto** — la primera medición dio un falso
      positivo porque `el.focus()` por script no dispara `:focus-visible`. Con Tab de
      verdad los 8 controles muestran `outline: auto 1px`: Tailwind 4 no lo elimina en
      preflight. No se tocó nada.
      **(3) `disabled:opacity-50` daba 1.89:1 en modo oscuro** (medido), prácticamente
      ilegible, porque apaga el botón entero contra el fondo de la página. Sustituido en
      los 11 botones por tokens que nombran la intención —`disabled:bg-surface-muted
      disabled:text-content-muted disabled:cursor-not-allowed`—: ahora **7.8:1 en oscuro
      y 6.87:1 en claro**, AA holgado. WCAG 1.4.3 exime los controles inactivos, pero el
      criterio del repo son 4.5:1 y a 1.89 no se leía qué botón había que habilitar. ⇠ S15.
- [x] **N16 · El Studio no tenía salida.** ✅ No estaba en el backlog. `/studio/*` colgaba
      de `RequireAuthor` a secas y no de `RequireAuth`, que es quien monta `AppHeader`: una
      vez dentro del Content Studio no había forma de cerrar sesión ni de volver a
      `/admin`, `/teacher` o `/cuenta` — la única salida era editar la URL a mano. Ahora
      va anidado igual que `/admin` y `/teacher`. Efecto secundario que había que resolver:
      con `AppHeader` montado quedan **dos pares ES/EN** en pantalla, el de la interfaz y
      el de edición del Studio (S11), así que el segundo se etiqueta "Idioma de edición" a
      la vista; su `<nav>` llevaba además un `aria-label` copiado que decía "Proyectos".
      `check-chunks` sigue en verde: `AppHeader` ya estaba en el bundle de entrada, así
      que el Studio no arrastró nada nuevo.
- [~] **I8 · Caché del contenido publicado en Redis. NO SE HACE, hasta tener una
      métrica.** Decisión del PO, 27/08/2026. `arquitectura.md` §5 justificaba Redis por
      partida doble —cola y caché— y hoy sólo se usa de cola, así que ese argumento queda
      a medio cobrar **a propósito**. El motivo de no hacerlo: no hay ni un usuario real
      ni una sola medición de latencia del camino de lectura, así que no se sabe si hay
      algo que optimizar; y a cambio obliga a invalidar en `publish`, `unpublish` y
      `rollback` — tres caminos donde un fallo sirve contenido **viejo** a los alumnos.
      El riesgo es cierto y el beneficio, hipotético.
      **Qué lo reabre:** una medición del p95 de `GET /learn/projects/{id}/moments/{type}`
      bajo carga real que resulte inaceptable. Con ese número se replantea; sin él, no.
      ⇠ N11.
- [x] **I5 · Tests de frontend** con vitest + msw. ✅ Desactualizado desde hace tiempo —
      ya no son cero: crecieron junto con cada feature (Studio, núcleo, evaluación).
      Sigue siendo la práctica esperada para lo que falta de F5. ⇠ B2.
- [x] **I6 · Tests de integración** de cada endpoint nuevo, contra Postgres real. ✅ Nunca
      fue una tarea aparte — cada endpoint de S/N/A/C entró con su test, tal como decía
      esta misma línea.

- [x] **I9 · El estudiante descargaba el editor entero.** ✅ No estaba en el backlog; salió
      al revisar el bundle. `RichTextView` montaba TipTap en `editable:false` para
      renderizar el contenido, así que **565 KB de editor entraban en el bundle de
      entrada** — el 73% de lo que descargaba un estudiante era un editor que no abre
      nunca. `check-chunks.mjs` no lo detectaba: sólo vigila que el entry no importe el
      chunk del *Studio*, y éste era otro. Sustituido por un render propio del esquema
      acotado (`lib/richText.tsx`, ~90 líneas, sin dependencias nuevas) que recorre el
      HTML y lo reconstruye con React contra una lista blanca de etiquetas. **La garantía
      de seguridad no se movió de sitio**: sigue siendo lista blanca en el cliente y sigue
      sin haber `dangerouslySetInnerHTML`; 12 tests la cubren, la mitad adversarios
      (`<script>`, `onclick`, `javascript:`, `data:`, `<iframe>`, `<img onerror>`).
      **Resultado medido: 757 KB → 373 KB** (241 → 115 KB comprimidos), menos de la mitad.
      De paso salió un defecto que llevaba ahí desde S14 y que nadie había visto: las
      listas del contenido **nunca** se vieron con viñetas ni numeración, porque
      `prose prose-sm` venía de `@tailwindcss/typography`, que jamás se instaló — la clase
      no existe en el CSS y el preflight de Tailwind quita `list-style`. Resuelto con
      `.contenido-rico` en `index.css`, compartida por el render y el editor.

## 7. Fuera de este backlog

| Qué | De quién |
|---|---|
| Embeddings reales, prompt de sistema, chunking/ranking/top-k, calidad del RAG, `is_in_domain` | Luis — ver `CLAUDE.md` § Frontera del trabajo de modelo. **Recordado el 27/08/2026**: siguen siendo un vector de ceros, así que el chat responde sin recuperar nada. |
| Infra, hosting, servidor, despliegue | PO |
| Carga de los 34 proyectos restantes y los textos en inglés | Cliente, con el Content Studio |
| App nativa, offline, gamificación, LMS, dashboards de directivos, aprobación multinivel | Fuera del MVP (`scope-mvp.md` §3) |

## 8. Preguntas que bloqueaban ítems concretos — resueltas 18/08/2026

De `scope-mvp.md` §9. Ya cerradas; los ítems de arriba llevan la nota "Resuelto (§8)".

| Pregunta | Respuesta | Ítems que desbloquea |
|---|---|---|
| ¿Cómo se crean las cuentas? (§9.6) | Las crea un tercer rol: un administrador de institución, no autoregistro ni CSV del colegio. | N3 → y con él N4, N6 |
| ¿Progreso lineal obligatorio o navegación libre? (§9.14) | Lineal obligatorio. | N5, N6, N9 |
| ¿Evaluación individual o por equipo? (§9.11) | Depende de lo que asigne el docente en la tarea, no es fijo — libertad por evaluación. **Deja abierta una pregunta de modelo nueva: ¿cómo se forman los equipos?** | A2 → y con él toda §4 |
| ¿Se puede reintentar una evaluación? (§9.11) | Lo define el docente por evaluación (`max_attempts`). | A2, A3 |
| ¿Preguntas abiertas? ¿Quién las califica? (§9.10) | Sí las hay; las califica el docente. | A1, A4 |
| ¿Video propio o embebido? (§9.7) | Embebido, YouTube. | S15 |

**Pendiente de precisar:** cómo se forman/registran los equipos para la evaluación por
equipo (grupos fijos del curso vs. el docente los arma al asignar la tarea). Bloquea el
diseño final de A2.

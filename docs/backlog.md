# Backlog — backend

Derivado de [`scope-mvp.md`](scope-mvp.md) y contrastado con el código a 23/08/2026.
Cubre **sólo el backend**. Lo que queda fuera está en §7.

> **El frontend se eliminó del repositorio el 27/08/2026** para rehacerlo desde cero, y
> con él todos los ítems de cliente que había aquí (S11–S17, N8–N14, A8–A10, C6, I1–I5,
> I7 y I9, más B2 y N16). No se listan como pendientes porque el trabajo no está
> pendiente: está descartado. Cuando se retome el cliente, el backlog nuevo se escribe
> desde cero contra el contrato HTTP que ya expone el backend.

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
- [x] **B3 · Semillas de desarrollo.** ✅ `make seed` → institución, licencia vigente, un
      usuario por rol y un proyecto publicado con sus 6 momentos. Idempotente y bloqueado
      fuera de `ENV=local`. Verificado end-to-end contra la API: login de los 4 roles y
      `teacher_note` filtrada al estudiante (R4). Destapó dos bugs, ya corregidos:
      `publishing._load_full` no cargaba `ContentBlock.translations` (publicar reventaba
      contra una BD real) y el loop scope de pytest-asyncio dejaba la fixture `db`
      inservible.
- [x] **B4 · Gate de tests en el release.** ✅ Job `backend` (ruff + pytest **con
      Postgres+pgvector**, no sólo unitarios: ahí vive el guard de deriva de migraciones);
      `release` lleva `needs: [backend]`. Los tests de integración **fallan duro con
      `CI=true`** en vez de saltarse, que si no el gate pasaría en verde sin probar nada.

### Excepción de orden: N1 ya está hecho

Se adelantó a §2 a propósito y **ya está cerrado**: el access token dura 15 minutos y sin
`/auth/refresh` la sesión se caía cada cuarto de hora, a ti desarrollando y al cliente
cargando contenido. El resto de §3 sí puede esperar a después del Studio.

---

## 2. F2 — Content Studio ✅ completo (18/08/2026)

Backend cerrado de punta a punta: CRUD, traducciones, media, duplicar, despublicar,
bloqueo optimista, limpieza de huérfanos, preview, validación y publicación.

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
      El autoguardado y el aviso de conflicto son cosa del cliente: el backend sólo
      ofrece el 409.

## 3. F1 — Núcleo ✅ completo (23/08/2026)

Cuentas, cursos, matrículas, progreso lineal, panel docente, rotación de refresh y rate
limit del chat.

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
      `POST /auth/logout`, idempotente.
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
      no el acceso inmediato. **No hay recuperación por correo** y no la habrá: las
      cuentas de menores se crean sin buzón propio, así que la única vía es el
      administrador — el cliente que se construya tendrá que decirlo en la pantalla de
      entrada. 11 tests de integración, los dos de revocación verificados en rojo.

## 4. F3 — Evaluación (R10) ✅ completo (23/08/2026)

`assessment/models.py` está **completo** (Assessment, Question, Choice, Attempt, Answer y
sus traducciones).

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

## 5. F4 — Chat: la mitad de delante del puerto ✅ completo (23/08/2026, salvo N/A)

Lo de detrás de `AssistantProvider` no está aquí (ver §7).
Todo se construye y se testea contra `StubProvider`, sin depender de Luis.

- [x] **C1 · Historial de conversación.** ✅ `service.ask()` carga los últimos 20
      `ChatMessage` de la sesión (ANTES de añadir el turno actual, o se duplicaría) y los
      pasa como `history=` — el campo ya existía en `ChatContext` y `ClaudeProvider` ya lo
      consumía, solo faltaba rellenarlo.
- [x] **C2 · Recuperar sesiones previas** del usuario. ✅ `GET /chat/sessions?moment_id=`
      (listado, filtrable por momento) y `GET /chat/sessions/{id}/messages` (histórico;
      404 si la sesión no es del que pregunta, no solo por id).
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

## 6. F5 — pulido


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
- [x] **I6 · Tests de integración** de cada endpoint nuevo, contra Postgres real. ✅ Nunca
      fue una tarea aparte — cada endpoint de S/N/A/C entró con su test, tal como decía
      esta misma línea.

## 7. Fuera de este backlog

| Qué | De quién |
|---|---|
| Embeddings reales, prompt de sistema, chunking/ranking/top-k, calidad del RAG, `is_in_domain` | Luis — ver `CLAUDE.md` § Frontera del trabajo de modelo. **Recordado el 27/08/2026**: siguen siendo un vector de ceros, así que el chat responde sin recuperar nada. |
| Infra, hosting, servidor, despliegue | PO |
| Carga de los 34 proyectos restantes y los textos en inglés | Cliente, con el Content Studio |
| **Todo el cliente web**: framework, paleta, tipografía, componentes, i18n de la interfaz, accesibilidad y responsive | Sin decidir. Se eliminó del repositorio el 27/08/2026 para rehacerlo desde cero; no hay ninguna decisión heredada que respetar. |
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

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
      *Queda 1 warning de `react-refresh` en `useAuth.tsx` (exporta componente + hook);
      se resuelve partiendo el fichero cuando N8 lo toque.*
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

### Excepción de orden: N1 y N8 se adelantan

**Antes de tocar §2, haz `N1` y `N8` de §3** (endpoint de refresh + guardarlo en el
cliente). No son parte del núcleo "para después": el access token dura 15 minutos y hoy
no hay forma de renovarlo, así que en cuanto empieces a editar en el Studio te va a echar
la sesión cada cuarto de hora — a ti mientras desarrollas y al cliente mientras carga
contenido. Y el autoguardado (`S9`) llega tarde en la sección, así que ese logout se lleva
trabajo por delante.

Son dos ítems. El resto de §3 sí puede esperar a después del Studio.

---

## 2. F2 — Content Studio

El módulo `catalog` tiene **modelos y nada más**: ni servicio, ni router, ni entrada en
`app/api.py`. Es el grueso del trabajo pendiente. En el frontend, `StudioPage.tsx` son 15
líneas de placeholder.

### Backend ⇠ B1

- [ ] **S1 · `catalog/service.py` + `catalog/router.py`** bajo `/studio`, con guard
      `Author` (editor/admin). CRUD de `Project`: crear, editar, ordenar, grado, kit.
- [ ] **S8 · Registrar el router en `app/api.py`.** ⇠ S1. *Va aquí y no al final: sin
      esto nada del Studio existe para el frontend.*
- [ ] **S2 · Los 6 momentos se crean solos** al crear el proyecto, con tipo fijo y orden
      de `MOMENT_ORDER`. El editor los llena, no los inventa (R7). ⇠ S1.
- [ ] **S3 · CRUD de `ContentBlock`**: añadir, editar, reordenar, borrar. ⇠ S2.
- [ ] **S4 · Traducciones ES/EN** de proyecto, momento y bloque, con indicador de "falta
      traducir". El proyecto puede publicarse sólo en ES (R6). ⇠ S3.
- [ ] **S5 · Guía docente y prompt de apertura** por momento e idioma
      (`MomentTranslation.teacher_note`, `chatbot_opening_prompt`) — R4 y R8. ⇠ S4.
- [ ] **S10 · Librería de media.** Hoy `media/router.py` sólo tiene `presign` y
      `register`: falta listar y borrar assets.
- [ ] **S7 · Preview como estudiante y como docente.** Reutiliza
      `learning/service.serialize_moment_for`, no dupliques el filtro de `teacher_note`.
      ⇠ S5.
- [ ] **S6 · Duplicar proyecto.** El scope §7 lo marca como clave: la mayoría de los 36
      comparten estructura. ⇠ S3.
- [ ] **S9 · Autoguardado y bloqueo optimista.** Dos editores sobre el mismo proyecto
      deben avisar, no perder trabajo. ⇠ S3.

### Frontend ⇠ B2

- [ ] **S11 · Layout y rutas anidadas del Studio.** Mantenerlo en su chunk (`lazy()` +
      `manualChunks`): los estudiantes no deben descargar el editor.
- [ ] **S12 · Listado y creación de proyectos.** ⇠ S11, S1.
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

- [ ] **N1 · `POST /auth/refresh`.** El login **emite** refresh tokens y no hay endpoint
      que los canjee: la sesión muere a los 15 minutos y no hay forma de renovarla.
      `identity/router.py`. *Es el hueco más urgente del núcleo.*
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
- [ ] **N7 · Rate limit del chat.** `settings.CHAT_RATE_LIMIT_PER_HOUR` está definido y
      **no lo aplica nadie**. Redis ya está levantado. Protege costo y evita abuso (R9).

### Frontend ⇠ B2

- [ ] **N8 · Guardar y usar el refresh token.** `useAuth.login()` **descarta
      `res.refresh_token`**: sólo lee `access_token`, `role` y `lang`, así que el cliente
      no guarda con qué renovar. Y `lib/http.ts` borra el token en 401/403 y manda a login
      **sin intentar refrescar**. Aunque N1 exista, sin esto la sesión sigue muriendo a
      los 15 minutos. ⇠ N1.
- [ ] **N9 · Progreso en la UI.** Marcar momento completado desde `MomentPage` y pintar el
      avance en el listado de proyectos. ⇠ N5.
- [ ] **N10 · Manejar el 429 del rate limit** en `ChatPanel` con un mensaje claro en vez
      de un error genérico. ⇠ N7.

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
- [ ] **I3 · Responsive mobile-first.** El scope §5 lo marca: los estudiantes entran desde
      el celular y la sala de robótica no tiene un PC por cabeza.
- [ ] **I4 · Accesibilidad.** `alt_text` ya está en el modelo; falta exigirlo y usarlo en
      la UI. ⇠ S15.
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

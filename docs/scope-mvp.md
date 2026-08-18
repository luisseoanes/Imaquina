# Plataforma Imaquina Robótica — Scope MVP

> Documento de trabajo. Base: [`plataforma-imaquina-robotica.md`](plataforma-imaquina-robotica.md),
> transcripción del PDF que entregó el cliente.
> Stack objetivo: **Python + FastAPI** (backend) / **React** (frontend).
> Fecha: agosto 2026.

---

## 1. Resumen de lo que pide el cliente

Plataforma web de robótica educativa para colegios, con dos perfiles (docente / estudiante), que entrega **36 proyectos** de robótica asociados a kits, uno o varios por grado desde Transición hasta 11°. Cada proyecto se recorre en **6 momentos metodológicos**. Incluye un **chatbot de IA** especializado en robótica/mecatrónica/programación, disponible 24/7, y un **módulo de evaluación** cuyos resultados el docente puede ver y exportar.

### Requisitos explícitos del documento

| # | Requisito | Tipo |
|---|---|---|
| R1 | 36 proyectos asociados a kits, asignados por grado (Transición → 11°) | Contenido |
| R2 | Acceso con usuario y contraseña, **con vigencia**: calendario A = feb–dic 2027; calendario B = sep 2027–jun 2028 | Auth |
| R3 | Multiusuario concurrente y escalable | No funcional |
| R4 | Dos roles: Docente y Estudiante. El docente ve **el mismo contenido** + un botón que despliega guía didáctica (instrucciones de aula) visible solo para él | Roles |
| R5 | Chatbot consultor técnico 24/7, entrenado con los proyectos y conocimiento de robótica | IA |
| R6 | Plataforma bilingüe **Español / Inglés** | i18n |
| R7 | 6 momentos por proyecto: Introducción+inclusión, Indagación, Diseño, Construcción, Comunicación, Evaluación | Contenido |
| R8 | Chatbot habilitado como asistente en los momentos 1–5 | IA |
| R9 | Chatbot restringido al dominio: redirige la conversación si se sale de tema | IA / guardrails |
| R10 | Momento 6 (Evaluación): formulario de preguntas por estudiante; resultados consultables y **exportables** por el docente (Excel o similar) | Evaluación |

### Preguntas abiertas del cliente (ambas: **sí, es viable**)

- *"¿Es posible que la interacción inicie desde el chatbot al usuario con una pregunta?"*
  → Sí. Cada momento lleva un **prompt de apertura** curado (campo de contenido, no generado): al abrir el momento, el bot lanza la pregunta detonante. Es un campo más del CMS, editable por momento y por idioma.
- *"¿Es posible que la evaluación arroje resultados por estudiante que el docente vea y compile?"*
  → Sí. Cada intento queda persistido; el docente ve tablero por curso/proyecto y exporta CSV/XLSX. El auto-calificado (opción múltiple, V/F) es inmediato; el abierto queda para calificación manual del docente.

---

## 2. El problema serio: el hosting actual no sirve

> **DESACTUALIZADO (agosto 2026).** El PO asume la inversión en infraestructura,
> hosting y servidor. Este análisis se conserva como historia de por qué se llegó
> ahí, pero **no condiciona ninguna decisión técnica**: da por disponibles
> Postgres 16 + pgvector, Redis y S3/R2. Ver `CLAUDE.md` § Reparto de trabajo.

El PDF documenta un **hosting compartido cPanel de Colombia Hosting** (MariaDB, PHP 8.4, migrado en enero 2026 para "soportar Node.js"). Sobre eso hay que ser directo:

- Es hosting compartido con **2 GB de RAM, 100 procesos, 1 core**. Un backend Python + un modelo de embeddings + Postgres no caben ahí con garantías.
- El "soporte Node.js" de cPanel es Passenger — no aplica a FastAPI/ASGI, y aunque cPanel tenga *Setup Python App*, corre bajo WSGI/Passenger con límites de proceso que rompen streaming SSE del chat y workers async.
- Alberga ya **3 dominios y 3 WordPress** (imaquina.com.co usa 615 MB). Meter la plataforma ahí acopla su disponibilidad a los WP.
- Hay PostgreSQL disponible en el panel (0 usado), pero sin extensiones → **no hay pgvector** para el RAG del chatbot.

**Recomendación:** dejar el cPanel para los sitios WordPress y desplegar la plataforma aparte:

| Opción | Cuándo | Costo aprox./mes |
|---|---|---|
| **Railway / Render / Fly.io** (recomendado para MVP) | Deploy en minutos, Postgres gestionado, escala con tráfico | USD 20–60 |
| **VPS (Hetzner / DigitalOcean) + Docker Compose** | Más control, más barato a escala, requiere ops | USD 12–40 |
| AWS/GCP completo | Solo si el cliente lo exige por política | USD 80+ |

Frontend React como estático en **Cloudflare Pages / Vercel** (gratis), apuntando `plataforma.imaquina.com.co` por CNAME. El dominio se queda donde está.

**Esto es una decisión que hay que cerrar con el cliente antes de escribir código de infraestructura**, porque cambia el presupuesto operativo.

---

## 3. Cómo recomiendo hacer el scope

El instinto natural es cotizar "las 36 lecciones + chatbot + evaluación" como un bloque. **No lo hagas.** Tres razones:

1. **El contenido es el cuello de botella, no el código.** 36 proyectos × 6 momentos = **216 unidades de contenido**, cada una con texto, imágenes, audio y/o video, **× 2 idiomas = 432**. Si el cliente no tiene eso producido, el desarrollo termina antes que el contenido y el proyecto se ve "atrasado" por culpa ajena. Hay que separar contractualmente *construir la plataforma* de *cargar el contenido*.
2. **El chatbot es el riesgo técnico.** Calidad de respuesta, costo por token y guardrails no se estiman bien a ciegas. Merece su propio hito con criterios de aceptación medibles.
3. **Las fechas dan aire.** Calendario A arranca febrero 2027; hoy es agosto 2026. Hay ~6 meses. Es holgado *si* el contenido entra a tiempo, y justo si no.

### Estrategia propuesta: MVP vertical, no horizontal

En vez de construir el 20% de las 10 funcionalidades, construir el **100% de un proyecto completo**. Es decir:

> **MVP = 1 grado, 2 proyectos de referencia cargados por nosotros, los 6 momentos, en español, con chatbot y evaluación end-to-end — más el Content Studio con el que el cliente carga los 34 restantes.**

Con eso se puede hacer un piloto real en un colegio. Escalar de 2 a 36 proyectos ya **no es trabajo de desarrollo: es trabajo del cliente**, con la herramienta en sus manos.

### Decisión de alcance: el cliente carga su propio contenido

**El Content Studio entra al MVP** (§7). Es la decisión más importante del proyecto y conviene entender bien el intercambio:

**Lo que se gana:**
- Se elimina la dependencia crítica: el desarrollo ya no espera a que llegue el contenido. Se entrega la plataforma vacía pero funcional y ellos la llenan en paralelo.
- Desaparece el riesgo de que el proyecto "parezca atrasado" por culpa del contenido ajeno.
- El cliente corrige erratas, actualiza un video o ajusta una evaluación **sin pasar por nosotros ni pagar horas**. A dos años vista esto vale más que el desarrollo inicial.
- Las traducciones al inglés entran cuando ellos las tengan, sin releases.
- Se acaba el ciclo "te mando un Word con cambios → lo cargas → lo reviso".

**Lo que cuesta:**
- **+3 a 4 semanas** de desarrollo. El CMS es una aplicación completa: editor, subida de media, traducciones, constructor de evaluaciones, preview, publicación.
- Hay que **capacitar al cliente** y entregar manual. Es un entregable, no un favor.
- Si su equipo no es técnico, la calidad del contenido queda en sus manos. Se mitiga con plantillas y campos obligatorios, no se elimina.

**Vale la pena.** El costo es una sola vez; el beneficio es permanente y elimina el mayor riesgo de cronograma.

### Lo que NO va en el MVP (y hay que decirlo explícito)

- Los 36 proyectos cargados → **los carga el cliente**. Nosotros dejamos 2 completos como plantilla y referencia de calidad.
- Traducción al inglés → la infraestructura i18n y el editor bilingüe sí; **los textos los escribe el cliente**.
- App móvil nativa (web responsive sí)
- Modo offline
- Gamificación, badges, ranking
- Integración con LMS externos (Moodle, Classroom)
- Analítica avanzada / dashboards de directivos
- Editor visual tipo drag-and-drop de layouts (el editor es por bloques estructurados, no maquetación libre)
- Flujo de aprobación multinivel (revisor → aprobador). En MVP: borrador → publicado.

Cada uno de estos es una conversación de alcance adicional. Ponerlos por escrito como *fuera de alcance* es lo que evita el "yo pensé que incluía...".

---

## 4. Fases propuestas

| Fase | Contenido | Duración est. |
|---|---|---|
| **F0 — Descubrimiento** | Cerrar preguntas abiertas (§8), decidir hosting, recibir **1 proyecto de muestra** para validar la estructura de contenido, definir formato de evaluación | 1–2 sem |
| **F1 — Núcleo** | Auth + roles + vigencias, modelo de datos, navegación de proyectos y momentos, render de contenido multimedia, panel docente básico | 3–4 sem |
| **F2 — Content Studio** | CRUD de proyectos/momentos/bloques, subida de media, editor bilingüe, borrador/publicado, preview como estudiante y docente (§7) | 3–4 sem |
| **F3 — Evaluación** | Constructor de preguntas (en el Studio), intentos, calificación auto + manual, tablero docente, export XLSX/CSV | 2–3 sem |
| **F4 — Chatbot** | Ingesta/RAG con **reindexado automático al publicar**, guardrails de dominio, prompt de apertura por momento, historial, límites de uso | 3 sem |
| **F5 — i18n + pulido** | Cambio de idioma, accesibilidad, responsive, seguridad, carga de los 2 proyectos de referencia | 2 sem |
| **F6 — Capacitación + piloto** | Manual del Content Studio, sesión de entrenamiento al equipo del cliente, despliegue, usuarios reales, ajustes | 2 sem |

Total MVP ≈ **16–19 semanas**. Es **~3–4 semanas más** que sin Content Studio, pero a cambio la carga de los 36 proyectos y la traducción salen por completo de nuestro cronograma.

**Cronograma vs. calendario escolar:** arrancando en septiembre 2026, el MVP queda listo hacia **enero 2027**. El calendario A empieza en febrero 2027 — entra justo. Conviene entregar el **Content Studio antes que el resto** (fin de F2, ~noviembre 2026) para que el cliente tenga ~3 meses cargando contenido mientras nosotros seguimos con evaluación y chatbot. Ese solapamiento es precisamente lo que hace que la decisión funcione.

---

## 5. Arquitectura técnica

```
React (Vite + TS)  ──HTTPS/JSON──▶  FastAPI  ──▶  PostgreSQL + pgvector
   TanStack Query                    (async)       ├─ contenido, usuarios, intentos
   react-i18next                       │           └─ embeddings del contenido
   Tailwind + shadcn/ui                │
                                       ├──▶  Anthropic API (Claude) — chatbot
                                       └──▶  S3 / Cloudflare R2 — media (audio, video, img)
```

### Backend — FastAPI

| Pieza | Elección | Por qué |
|---|---|---|
| Framework | FastAPI + Pydantic v2 | Async nativo para el streaming del chat; OpenAPI gratis para el frontend |
| ORM | SQLAlchemy 2.0 (async) + Alembic | Estándar; migraciones versionadas |
| DB | PostgreSQL 16 + **pgvector** | Una sola DB para datos y RAG; evita añadir vector store aparte |
| Auth | JWT (access corto + refresh) vía `python-jose`, hash `argon2` | La vigencia por calendario se valida en cada emisión de token |
| Media | S3/R2 + URLs firmadas | Video y audio no van en la DB ni en el repo |
| Chat LLM | **Claude** (`claude-sonnet-5`) vía SDK oficial | Buen costo/calidad, streaming, `system` fuerte para guardrails |
| Export | `openpyxl` | XLSX nativo para el docente |
| Tests | `pytest` + `httpx` | — |

> Nota: antes de fijar el modelo y calcular costo por token, revisar precios y IDs vigentes — no estimar de memoria.

### Frontend — React

Vite + TypeScript, React Router, **TanStack Query** (server state), **react-i18next** (ES/EN desde el día 1), Tailwind + shadcn/ui, `react-hook-form` + `zod` para la evaluación. Cliente HTTP generado desde el OpenAPI de FastAPI (`orval` o similar) para no escribir tipos a mano.

Diseño **mobile-first responsive**: los estudiantes de bachillerato entran desde celular, y la sala de robótica rara vez tiene un PC por estudiante.

---

## 6. Modelo de datos (borrador)

```
Institution ──< Course ──< Enrollment >── User (role: admin|editor|teacher|student)
                             │
                             └──< Progress >── Moment

Project (grade, kit, order, status: draft|published, published_at)
   └──< Moment (type: intro|inquiry|design|build|communicate|assess, order)
          ├──< ContentBlock (kind: text|image|audio|video|embed, order)
          │        ├── Translation (lang: es|en)   ← i18n de contenido
          │        └── MediaAsset (s3_key, mime, size, duration, alt)
          ├── TeacherNote (i18n)          ← el "botón del docente" (R4)
          ├── chatbot_opening_prompt (i18n)  ← pregunta que abre el bot (R8)
          └── Assessment (solo en moment type=assess)
                 └──< Question (mcq|truefalse|open|numeric)
                        └──< Choice

ProjectVersion (project, snapshot jsonb, published_by, published_at)  ← historial/rollback
MediaAsset (uploaded_by, s3_key, mime, size, alt_text)               ← librería reutilizable

Assessment ──< Attempt (student, started_at, submitted_at, score)
                 └──< Answer (question, value, is_correct, teacher_score, feedback)

ChatSession (user, moment?) ──< ChatMessage (role, content, tokens, created_at)

License (user|institution, calendar: A|B, valid_from, valid_to, seats)
DocumentChunk (moment_id, lang, text, embedding vector(1024))
```

**Decisiones clave del modelo:**

- **i18n en tablas de traducción, no columnas `_es`/`_en`.** Añadir un tercer idioma después no rompe el esquema.
- **Vigencia en `License`, no en `User`.** Un docente puede renovar sin recrear cuenta, y el calendario A/B se modela como fechas, no como enum de negocio dentro del usuario.
- **`Progress` a nivel de momento**, no de proyecto: el docente necesita saber en qué momento va cada equipo.
- **`TeacherNote` en tabla aparte** con control de acceso en el endpoint. Nunca serializarla en la respuesta del estudiante — filtrarla en el backend, no ocultarla con CSS.
- **`DocumentChunk` referencia `moment_id`**: permite que el chat cite y que se pueda dar contexto del momento actual al RAG.
- **`status: draft|published` a nivel de proyecto.** Los estudiantes solo ven publicados. El cliente puede tener 20 proyectos a medio escribir sin que nadie los vea. Es el requisito más importante del Content Studio.
- **`ProjectVersion` guarda snapshot al publicar.** Si el cliente rompe un proyecto en mitad del semestre, se revierte en un clic. Con contenido en manos no técnicas, esto no es opcional.

---

## 7. Content Studio (el cliente carga su propio contenido)

Panel de administración dentro de la misma app React, protegido por rol `admin` / `editor`. No es un CMS genérico: es un editor **estructurado** sobre el modelo de §6, y esa restricción es intencional — evita que el contenido se degrade y garantiza que el chatbot pueda indexarlo.

### Funcionalidades

| Módulo | Qué hace |
|---|---|
| **Proyectos** | Crear/editar/ordenar, asignar grado y kit, estado borrador/publicado, **duplicar proyecto** (clave: la mayoría de los 36 comparten estructura) |
| **Momentos** | Los 6 se crean automáticamente al crear el proyecto, con su tipo fijo. El editor los llena, no los inventa |
| **Editor de bloques** | Añadir/reordenar bloques: texto enriquecido, imagen, audio, video, embed. Drag para reordenar |
| **Media** | Subida directa a S3/R2 con URL prefirmada (no pasa por el backend), librería reutilizable, `alt` obligatorio por accesibilidad |
| **Bilingüe** | Vista ES / EN lado a lado, indicador de "falta traducir", el proyecto puede publicarse solo en ES |
| **Guía docente** | Campo del "botón del docente" (R4) por momento |
| **Prompt del chatbot** | Pregunta de apertura por momento (R8), editable por idioma |
| **Evaluación** | Constructor de preguntas: opción múltiple, V/F, abierta, numérica. Marcar respuesta correcta y puntaje |
| **Preview** | Ver el momento **como estudiante** y **como docente** antes de publicar |
| **Publicación** | Un botón. Valida campos obligatorios, guarda versión y **dispara el reindexado del RAG** |

### Decisiones técnicas

- **Subida de media con presigned URLs.** Un video de 200 MB no puede pasar por FastAPI. El navegador sube directo a S3/R2 y solo registra el `s3_key`. Sin esto, el CMS tumba el servidor.
- **Video: recomiendo embeds (YouTube/Vimeo no listado) en vez de hosting propio.** Alojar y transcodificar video es caro y lento; con embed el costo es cero y el streaming es de ellos. Si el cliente exige video propio, hay que presupuestar transcodificación aparte (Mux/Cloudflare Stream).
- **Texto enriquecido con esquema acotado** (TipTap con nodos limitados: negrita, listas, enlaces, código). No permitir HTML libre — es superficie de XSS y rompe el diseño.
- **Reindexado automático al publicar.** Si el contenido cambia y el RAG no se actualiza, el chatbot responde con información vieja. Va como tarea en background al publicar, no manual: nadie se va a acordar de apretar "reindexar".
- **Autoguardado + bloqueo optimista.** Si dos editores tocan el mismo proyecto, avisar en vez de perder trabajo.
- **Validación al publicar, no al escribir.** Se puede guardar a medias; solo se exige completitud al publicar.

### Entregables de handoff

Esto no termina cuando el código funciona:
1. **Manual del Content Studio** con capturas, en español.
2. **Sesión de capacitación** grabada con el equipo del cliente (2–3 h).
3. **2 proyectos de referencia** cargados por nosotros, que sirven de plantilla y estándar de calidad.
4. **Checklist de calidad** de una página: qué debe tener un proyecto antes de publicarse.

---

## 8. El chatbot en detalle (el punto de mayor riesgo)

**Enfoque: RAG + guardrails, no fine-tuning.** El PDF dice "entrenado con los proyectos" — en la práctica eso es recuperación sobre el contenido, no reentrenar un modelo. Es más barato, se actualiza al instante cuando cambia el contenido y no alucina fechas.

**Flujo:**
1. Se indexa cada `ContentBlock` en chunks con embeddings → `DocumentChunk`.
2. El usuario pregunta desde un momento concreto → se envía `moment_id` como contexto prioritario.
3. Búsqueda híbrida (vector + full-text de Postgres) → top-k chunks.
4. Prompt de sistema con: rol (consultor de robótica), alcance permitido, instrucción de redirigir fuera de tema, nivel del estudiante según grado, idioma.
5. Respuesta en streaming (SSE) al frontend.

**Guardrails (R9)** — en capas, no solo prompt:
- Sistema explícito de dominio + instrucción de redirección amable.
- Clasificador previo barato de "¿es sobre robótica/el proyecto?" para preguntas claramente fuera de tema.
- Registro de rechazos para afinar.
- Rate limit por usuario (protege costo y evita abuso).

**Adaptación por edad:** un estudiante de Transición y uno de 11° no reciben la misma respuesta. El grado entra en el prompt y ajusta vocabulario y profundidad. Esto no está en el PDF pero es indispensable dado el rango Transición–11°.

**Criterios de aceptación medibles** (hay que acordarlos con el cliente):
- ≥ 90% de respuestas dentro del dominio en un set de 50 preguntas de prueba.
- 100% de redirección en 20 preguntas fuera de tema deliberadas.
- Latencia primer token < 2 s.
- Costo por sesión estimado y con tope configurado.

**Moderación:** son menores de edad. Filtro de contenido de entrada y salida, y retención de historial acotada.

---

## 9. Preguntas que hay que cerrar con el cliente (F0)

**Bloqueantes:**
1. **¿Dónde se despliega?** (§2) — cambia infraestructura y costo operativo.
2. **¿Quién del equipo del cliente va a cargar el contenido?** ¿Cuántas personas, con qué perfil técnico, con cuánto tiempo disponible? Ahora que el CMS es de ellos, esto define si el plan es realista: 34 proyectos × 6 momentos × 2 idiomas es trabajo serio. Si no hay alguien asignado a tiempo, el Content Studio no resuelve nada.
3. **¿El contenido existe ya escrito** (en Word, Drive, PDF) o hay que producirlo desde cero? Cambia por completo el esfuerzo de carga.
4. **¿Quién paga el consumo del LLM?** Costo variable mensual — debe estar en el contrato.
5. **¿Cuántos usuarios concurrentes se esperan?** "Escalable" (R3) no es un número. Dimensiona todo.
6. **¿Cómo se crean las cuentas?** ¿El colegio carga un CSV? ¿El docente crea a sus estudiantes? ¿Autoregistro con código de curso?
7. **¿Video propio o embebido?** (§7) — define si hay costo de transcodificación y almacenamiento.

**Importantes:**
8. ¿Necesitan flujo de revisión (alguien escribe, otro aprueba antes de publicar)? En MVP va borrador → publicado, sin aprobador.
9. ¿La evaluación es individual o por equipo? El PDF habla de "equipos de trabajo" en indagación pero de "resultados por estudiante" en evaluación.
10. ¿Preguntas abiertas en la evaluación? Si sí, ¿las califica el docente a mano o se propone asistencia de IA?
11. ¿Un estudiante puede reintentar una evaluación? ¿Cuántas veces?
12. ¿Los datos de menores tienen requisitos de habeas data (Ley 1581 Colombia)? Muy probablemente sí → política de tratamiento de datos y consentimiento.
13. ¿Hay identidad visual / manual de marca?
14. ¿Progreso lineal obligatorio (desbloquear momento a momento) o navegación libre?

---

## 10. Estructura de repo propuesta

```
imaquina/
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ core/          # config, security, deps
│  │  ├─ models/        # SQLAlchemy
│  │  ├─ schemas/       # Pydantic
│  │  ├─ api/v1/        # routers: auth, projects, moments, assessments, chat
│  │  │  └─ studio/     # routers del CMS: authoring, media, publish
│  │  ├─ services/      # lógica: rag, scoring, export, licensing, publishing
│  │  └─ db/            # session, seeds
│  ├─ alembic/
│  ├─ tests/
│  └─ pyproject.toml    # uv
├─ frontend/
│  ├─ src/
│  │  ├─ api/           # cliente generado del OpenAPI
│  │  ├─ features/      # auth, projects, moment, chat, assessment, teacher
│  │  │  └─ studio/     # Content Studio: editor, media, evaluación, preview
│  │  ├─ components/ui/
│  │  └─ i18n/          # es.json, en.json
│  └─ package.json
├─ docs/
├─ docker-compose.yml   # postgres+pgvector, api, web
└─ README.md
```

---

## 11. Primeros pasos concretos

1. Enviar al cliente las preguntas de §9, la alerta de hosting de §2 y la decisión de Content Studio de §3 (con su costo de +3–4 semanas, para que la aprueben explícitamente).
2. Pedir **1 proyecto completo** (los 6 momentos, con su multimedia) — ya no como insumo de producción, sino para **validar que el modelo de contenido de §6 cubre la realidad**. Si su contenido no encaja en la estructura de bloques, hay que saberlo antes de construir el editor, no después.
3. Confirmar **quién carga el contenido** del lado del cliente y bloquear su agenda desde noviembre 2026.
4. Levantar el esqueleto: `docker-compose` con Postgres+pgvector, FastAPI con `/health`, React con login. Un vertical slice mínimo que ya despliegue.
5. Modelar y migrar el esquema de §6.
6. Construir el momento 1 punta a punta → primero el editor, luego la vista de estudiante. **El Content Studio es el entregable que desbloquea al cliente, así que va temprano.**

---

*Documento vivo — actualizar tras F0.*

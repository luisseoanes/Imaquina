# Arquitectura de Software — Plataforma Imaquina

> Complementa `scope-mvp.md`. Aquí van las decisiones de *cómo* se construye.
> Stack: FastAPI + React + PostgreSQL. Equipo pequeño (1–3 devs).

---

## 1. La decisión principal: monolito modular

**Recomiendo un monolito modular, no microservicios.** Un solo repo, un solo despliegue del backend, organizado internamente en módulos por dominio.

Es tentador separar el chatbot en su propio servicio "porque es IA". No lo hagas. Con este equipo y este alcance, microservicios te costarían despliegues coordinados, latencia de red entre servicios, transacciones distribuidas y observabilidad triplicada — a cambio de una independencia que no vas a usar. El único componente con perfil de carga distinto es el worker de background, y ese ya sale del proceso web por otras razones.

Si algún día el chatbot necesita escalar aparte, un módulo bien delimitado se extrae en días. Empezar separado y tener que unir es mucho peor.

```
┌─────────────────────────────────────────────────────┐
│  React SPA (Vite + TS)                              │
│  estudiante · docente · Content Studio (lazy)       │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS / JSON + SSE
┌───────────────────▼─────────────────────────────────┐
│  FastAPI (async) — un solo servicio                 │
│  identity · catalog · publishing · media            │
│  learning · assessment · assistant                  │
└─────┬──────────────┬──────────────┬─────────────────┘
      │              │              │
┌─────▼─────┐  ┌─────▼─────┐  ┌─────▼──────────────┐
│ Postgres  │  │  Redis    │  │  S3 / R2           │
│ +pgvector │  │ cache+cola│  │  media             │
└───────────┘  └─────┬─────┘  └────────────────────┘
                     │
              ┌──────▼──────┐      ┌─────────────┐
              │ Worker ARQ  │─────▶│ Claude API  │
              │ reindex,    │      └─────────────┘
              │ export      │
              └─────────────┘
```

---

## 2. Módulos y la regla de dependencia

| Módulo | Responsabilidad |
|---|---|
| `identity` | Usuarios, auth, roles, instituciones, **licencias y vigencias** (R2) |
| `catalog` | Proyectos, momentos, bloques, traducciones — el dominio de autoría |
| `publishing` | Borrador → publicado, versiones, snapshots, disparo de reindexado |
| `media` | Assets, URLs prefirmadas, librería |
| `learning` | Matrículas, progreso, consumo del estudiante |
| `assessment` | Preguntas, intentos, calificación, exportación |
| `assistant` | Chat, RAG, guardrails |
| `shared` | Config, seguridad, sesión de DB, errores, dependencias comunes |

**La regla que hace que esto funcione:** un módulo puede importar de `shared` y llamar a la **capa de servicio** de otro módulo, pero **nunca importa los modelos ni las queries de otro módulo directamente**. Es simple, se revisa en code review y es lo que mantiene las fronteras vivas. Sin ella, en tres meses tienes un monolito de barro donde `assessment` hace joins contra tablas de `catalog` y ya no puedes tocar nada.

Dentro de cada módulo: `router` (HTTP) → `service` (lógica) → SQLAlchemy.

**Sin capa de repositorio.** SQLAlchemy ya es el repositorio; añadir otra encima es ceremonia que no paga en un proyecto de este tamaño. Los servicios usan la sesión directamente.

---

## 3. Las cuatro decisiones que de verdad importan

### 3.1. Camino de lectura ≠ camino de escritura

Es la decisión con más impacto en rendimiento y la más fácil de pasar por alto.

- **Escritura (Content Studio):** pocos usuarios, datos normalizados, transacciones. Editas `Project → Moment → ContentBlock → Translation` como tablas relacionales normales.
- **Lectura (estudiantes):** cientos de usuarios concurrentes leyendo el mismo contenido inmutable. Armar un momento desde 5 tablas con joins en cada request es desperdicio puro.

**Al publicar, se serializa el proyecto completo a un snapshot JSONB** (`ProjectVersion.snapshot`, que ya está en el modelo de datos por versionado). Los estudiantes se sirven de ese snapshot: **una query, un índice, cacheable**. Los editores siguen trabajando contra las tablas normalizadas.

Es CQRS-lite y sale casi gratis porque el snapshot ya existía para el rollback. Dos beneficios por el mismo trabajo.

### 3.2. Multi-tenancy: aislar por institución desde el día 1

Son varios colegios en la misma base de datos, con datos de menores de edad. Que un docente del Colegio A vea las notas del Colegio B no es un bug: es un incidente de protección de datos.

**Un `TenantContext` inyectado como dependencia de FastAPI**, resuelto del JWT, que toda query de datos por institución debe usar. Se hace en el primer sprint o no se hace nunca — retrofitear aislamiento de tenant sobre 80 endpoints existentes es un proyecto en sí mismo.

```python
# app/core/deps.py
async def get_tenant(user: User = Depends(current_user)) -> TenantContext:
    return TenantContext(institution_id=user.institution_id, role=user.role)
```

Añadir además un test que recorra los endpoints y falle si alguno devuelve datos sin filtro de institución.

### 3.3. La guía docente se filtra en el backend, nunca en el frontend

El requisito R4 dice que el docente ve el mismo contenido más un botón con la guía didáctica. La tentación es mandar todo al cliente y ocultar con CSS o un `if`. **No.** Cualquier estudiante abre DevTools y lee la respuesta JSON.

`TeacherNote` va en tabla aparte y el serializador **no la incluye** si el rol no es docente. La decisión se toma en el servicio, no en el componente React.

### 3.4. El proveedor de LLM detrás de una interfaz — y solo él

Aquí sí vale un puerto/adaptador, y es el único sitio donde lo recomiendo:

```python
class AssistantProvider(Protocol):
    async def stream_answer(self, ctx: ChatContext) -> AsyncIterator[str]: ...
```

Dos razones concretas: puedes **stubearlo en los tests** (sin esto, cada test que toque el chat hace red y cuesta dinero), y puedes cambiar de modelo sin tocar la lógica de negocio. Todo lo demás va directo — abstraer Postgres o S3 "por si acaso" es complejidad sin comprador.

---

## 4. Integración con Claude (verificado, agosto 2026)

| Decisión | Valor |
|---|---|
| Modelo principal | **`claude-opus-5`** — 1M de contexto, $5/$25 por millón de tokens |
| SDK | `anthropic` (oficial Python), cliente async |
| Streaming | Sí, SSE al frontend. Obligatorio para percepción de velocidad |
| Clasificador de guardrail | `claude-haiku-4-5` ($1/$5) — la llamada barata previa de "¿esto es sobre robótica?" |
| Prompt caching | **Sí, y es la decisión de costo más importante** |

**Prompt caching, en concreto.** El prompt de sistema (rol, guardrails, nivel por grado) más los chunks recuperados son largos y estables. Marcándolos con `cache_control`, las lecturas de caché cuestan ~0.1× del precio de entrada. En un chat escolar con cientos de estudiantes sobre los mismos proyectos, esto no es una micro-optimización: cambia el orden de magnitud de la factura.

La regla que hay que respetar: **el caché es un match de prefijo**, así que lo estable va primero y lo volátil al final. Nada de meter `datetime.now()` ni el nombre del estudiante en el prompt de sistema — invalida todo lo que venga después. El mínimo cacheable en Opus 5 son 512 tokens.

Verificar `usage.cache_read_input_tokens` en desarrollo: si sale 0 en peticiones repetidas, algo está invalidando el prefijo.

> El modelo y el nivel de `effort` son palancas de costo. Arranca en `claude-opus-5` y mide; bajar a `claude-sonnet-5` o ajustar `effort` es decisión del cliente cuando vea números reales, no algo que se decide a ciegas.

---

## 5. Trabajos en background

Necesarios para tres cosas: **reindexar el RAG al publicar**, **generar exportaciones XLSX** y enviar correos. Ninguna puede bloquear un request HTTP.

**ARQ** (Redis, async nativo, del autor de pydantic) sobre Celery: encaja con FastAPI sin adaptadores y es mucho menos configuración. Celery es más potente y no lo necesitas.

Redis ya está ahí para la cola, así que sirve también de caché de contenido publicado. Dos usos, una pieza de infraestructura.

**El reindexado debe ser idempotente** — se va a reintentar. Borrar los chunks del proyecto y regenerarlos, no acumular.

---

## 6. Frontend

- **Estado de servidor con TanStack Query. Sin Redux.** Prácticamente todo el estado de esta app es datos del servidor; Redux te haría reimplementar caché e invalidación a mano.
- **Cliente HTTP generado del OpenAPI de FastAPI** (`orval`). Tipos gratis y sincronizados; escribirlos a mano garantiza que se desincronicen.
- **El Content Studio va en bundle aparte, con carga diferida.** Los estudiantes son el 95% del tráfico y no deben descargar el editor.
- **Feature-sliced**: cada carpeta en `features/` lleva sus componentes, hooks y tipos. Se borra completa cuando la feature muere.

---

## 7. Seguridad — hay menores de edad

| Punto | Decisión |
|---|---|
| Aislamiento por institución | Dependencia obligatoria (§3.2) |
| Guía docente | Filtrada en el backend (§3.3) |
| Contraseñas | `argon2` |
| JWT | Access 15 min + refresh rotativo |
| Vigencias | Validadas al emitir token, no solo al login |
| Texto enriquecido | Esquema acotado (TipTap), nunca HTML libre → XSS |
| Subidas | URL prefirmada con tipo MIME y tamaño restringidos |
| Chat | Rate limit por usuario + moderación entrada/salida |
| Datos personales | Retención acotada del historial; política de habeas data (Ley 1581) |

---

## 8. Testing

Pirámide práctica, sin dogma:

- **Servicios (la mayoría):** pytest contra un Postgres real en Docker, con rollback transaccional por test. Los mocks de base de datos mienten.
- **API (unos pocos, críticos):** `httpx.AsyncClient` sobre login, permisos y publicación.
- **Aislamiento de tenant:** un test dedicado que intente cruzar instituciones y espere 403/404.
- **Chat:** contra el `AssistantProvider` stub. Cero red en CI.
- **Frontend:** vitest + MSW para unitarios; Playwright solo para tres flujos: login, completar un momento, y enviar una evaluación.

---

## 9. Lo que deliberadamente NO hacemos

Poner esto por escrito ahorra discusiones más adelante:

- **Microservicios** — §1
- **Event sourcing / CQRS completo** — el snapshot cubre la necesidad real
- **Arquitectura hexagonal en todos los módulos** — puertos solo donde hay volatilidad real (el LLM)
- **GraphQL** — REST + OpenAPI genera el cliente tipado; GraphQL añade caché y complejidad de N+1 sin beneficio aquí
- **Kubernetes** — Docker Compose o una PaaS bastan por años
- **Capa de repositorio sobre SQLAlchemy** — §2
- **Redux** — §6

---

## 10. ¿Esto es DDD? ¿Es hexagonal?

No, ni lo uno ni lo otro. Toma una pieza de cada uno y deja el resto fuera a propósito. El nombre correcto es **monolito modular con módulos por capas** (*modular monolith* / *package by feature*).

### Qué sí toma de DDD

Solo lo **estratégico**:
- **Bounded contexts** → los módulos de §2 son exactamente eso. `catalog` y `learning` hablan de "proyecto" con significados distintos, y esa frontera es real.
- **Regla de dependencia entre contextos** → la de §2 (servicio sí, modelos no).
- **Lenguaje ubicuo** → los nombres del código son los del cliente: `Moment`, `TeacherNote`, `Attempt`, no `ContentNodeType3`.

### Qué NO toma de DDD

Todo lo **táctico**: nada de Aggregates con raíz e invariantes, Value Objects, Domain Events, Factories ni Repositories. La lógica vive en servicios que usan SQLAlchemy directamente — lo que un puritano llamaría *modelo anémico*, y aquí es lo correcto.

**Por qué:** el DDD táctico paga cuando el dominio tiene invariantes de negocio complejas y entrelazadas — banca, seguros, logística — donde la regla de negocio *es* el problema difícil. Aquí el problema difícil es entregar contenido multimedia, RAG y permisos. El resto es CRUD honesto. Envolver CRUD en agregados y objetos de valor es ceremonia: triplica el código y no previene ningún bug que fuéramos a tener.

### Qué toma de hexagonal

**Un puerto. Uno solo:** `AssistantProvider` (§3.4).

Hexagonal de verdad (Cockburn) exige que el núcleo de dominio no sepa nada del exterior: puertos y adaptadores para la base de datos, el almacenamiento, el correo, todo. Aquí los servicios usan SQLAlchemy directamente, así que **no es hexagonal**. Es arquitectura por capas clásica.

Puse el puerto en el LLM porque ahí hay volatilidad real y un beneficio medible: stubear los tests sin red. En Postgres o S3 no hay ni una cosa ni la otra.

### El intercambio que estamos aceptando

Sé explícito sobre lo que esto cuesta, para que sea una decisión y no un descuido:

| Coste | Por qué se acepta |
|---|---|
| El dominio queda acoplado a SQLAlchemy | Nadie cambia de ORM. Y si pasara, sería reescribir el módulo, no un adaptador |
| Los tests necesitan un Postgres real | En realidad es mejor: los mocks de base de datos mienten (§8) |
| Sin agregados, las invariantes complejas se defienden a mano | Casi no hay invariantes complejas. La que hay — "el estudiante solo ve publicado" — se resuelve con el snapshot |

### Cuándo sí valdría la pena lo otro

Si el dominio se volviera pesado en reglas — facturación por institución con prorrateos, certificaciones con requisitos entrelazados, currículo con prerrequisitos entre proyectos — ahí sí introduciría DDD táctico **en ese módulo concreto**, no en todos. La ventaja del monolito modular es exactamente esa: cada módulo puede subir de sofisticación por su cuenta cuando se lo gane.

---

## 11. Orden de construcción

El orden importa: estas dos cosas son carísimas de retrofitear.

1. **`TenantContext` y la dependencia de aislamiento** — sprint 1, sin excepción.
2. **`AssistantProvider` como interfaz** — antes de la primera línea de RAG, o los tests nacen dependiendo de la red.
3. Auth + licencias con vigencia.
4. `catalog` + `publishing` con snapshot (habilita el Content Studio, que es lo que desbloquea al cliente).
5. `learning` (vista del estudiante desde el snapshot).
6. `assessment` + exportación.
7. `assistant` (RAG sobre el contenido ya publicado).

---

*Documento vivo — actualizar cuando una decisión cambie, y anotar por qué.*

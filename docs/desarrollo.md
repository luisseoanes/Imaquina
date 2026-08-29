# Levantar el proyecto en local

Cómo dejar el backend y el cliente corriendo en `localhost` para probar a mano.
Todos los comandos se lanzan **desde la raíz del repositorio** salvo que se diga
otra cosa, y todos están verificados contra este repositorio.

## Lo que necesitas instalado

| | Para qué | Comprobar |
|---|---|---|
| **Docker** | Postgres y Redis | `docker --version` |
| **uv** | entorno y dependencias de Python | `uv --version` |
| **Node 22+** | el cliente web | `node --version` |

Si falta `uv`:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

Se instala en `~/.local/bin`; si el comando no aparece, esa carpeta no está en
tu `PATH`. **Nunca escribas una ruta de intérprete fija** en el Makefile: `uv
run` la resuelve sola en Linux y en Windows. En Windows hay que llamar a `make`
desde Git Bash o WSL — `cmd.exe` no resuelve rutas con barras normales.

---

## Arranque desde cero

La primera vez, en este orden:

```bash
# 1. Dependencias de Python, exactamente las del uv.lock
make sync

# 2. Postgres (con pgvector) y Redis, en Docker
make up

# 3. Base de datos de tests (sólo hace falta para la suite de integración)
make testdb

# 4. Esquema: crea las 24 tablas
make migrate

# 5. Datos de desarrollo: institución, licencia, 4 usuarios y un proyecto
make seed

# 6. Configuración del backend
cp backend/.env.example backend/.env

# 7. Dependencias del cliente, exactamente las del package-lock.json
make web-install
```

Sobre el paso 6: **deja `ANTHROPIC_API_KEY` y `GEMINI_API_KEY` vacías**. Sin
ellas el asistente usa `StubProvider` y la recuperación del RAG queda apagada:
cero red y cero costo. Todo lo demás funciona igual.

---

## El día a día

Tres terminales. La primera se queda con Docker de fondo:

```bash
make up          # Postgres + Redis        (idempotente, si ya están no hace nada)
```

```bash
make api         # backend en :8000        (recarga sola al guardar)
```

```bash
make web         # cliente en :5173        (recarga sola al guardar)
```

Y una cuarta **sólo si vas a probar algo que encole trabajo en segundo plano**
—publicar un proyecto, exportar resultados a Excel, borrar media—:

```bash
make worker      # worker ARQ
```

Sin el worker la aplicación funciona: los trabajos se encolan y se quedan
esperando. Lo notarás en que un proyecto publicado no reindexa el RAG y en que
una exportación se queda en `pendiente` para siempre.

### Dónde entrar

| | |
|---|---|
| Cliente web | <http://localhost:5173> |
| API, documentación interactiva | <http://localhost:8000/docs> |
| Contrato OpenAPI | <http://localhost:8000/api/v1/openapi.json> |
| Salud del backend | <http://localhost:8000/health> |

El cliente habla con `/api` y Vite lo redirige a `:8000`, así que **no hay que
configurar CORS ni URLs absolutas** para trabajar en local.

### Con qué usuario entrar

`make seed` crea uno por rol. Todos comparten la contraseña **`imaquina2027`**:

| Rol | Correo | Qué puede ver |
|---|---|---|
| Estudiante | `estudiante@imaquina.example.com` | El recorrido: proyectos, momentos, chat |
| Docente | `docente@imaquina.example.com` | Progreso por curso y resultados |
| Editor | `editor@imaquina.example.com` | El Content Studio |
| Administrador | `admin@imaquina.example.com` | Cuentas, cursos y matrículas |

Los correos van en `@imaquina.example.com` a propósito: `EmailStr` **rechaza**
`.test` y `.local` por ser dominios de uso especial, y con ellos el login es
imposible.

### Comprobar que está todo arriba

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8000/health   # 200
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/login    # 200

curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"estudiante@imaquina.example.com","password":"imaquina2027"}'
```

Lo último devuelve un `access_token` si las semillas están puestas.

---

## Comprobar antes de commitear

Los mismos comandos que corre el pipeline. Si pasan aquí, pasan allí:

```bash
make lint        # ruff
make test        # pytest: unitarios + integración
make web-lint    # oxlint
make web-test    # vitest
make web-build   # tsc -b && vite build
```

`make test-unit` corre sólo los unitarios y no necesita infraestructura.
`make test-int` corre sólo los de integración y **requiere Postgres y Redis
levantados**.

---

## Cuando cambia el contrato de la API

El cliente no escribe a mano las llamadas: se generan desde el OpenAPI del
backend. Si tocas un endpoint o un esquema, **con el backend corriendo**:

```bash
make web-api
```

El código generado va versionado, así que el cambio aparece en el diff. Si no
lo regeneras, el cliente sigue compilando con los tipos viejos y falla en
tiempo de ejecución, que es justo lo que se quiere evitar.

---

## Cuando algo va mal

### `Falta uv. Instalalo…`

`~/.local/bin` no está en el `PATH`. Ábrete una terminal nueva o añádelo.

### `uv run` no encuentra `pytest` después de mover el repositorio

El entorno virtual guarda la ruta antigua:

```bash
rm -rf backend/.venv && make sync
```

Los contenedores cuelgan del nombre del directorio, así que `make up` creará
unos nuevos y hay que rehacer `make testdb && make migrate && make seed`.

### `Address already in use` al arrancar la API

Quedó un proceso de un arranque anterior. Ocurre más de lo que parece porque
`uvicorn --reload` levanta **dos** procesos —un supervisor y un worker— y el
que abre el puerto es el worker: si se para el supervisor a lo bruto, el worker
sigue vivo, lo adopta `systemd` y deja de aparecer como hijo de tu terminal.
Buscarlo por `pgrep uvicorn` tampoco lo encuentra, porque su línea de comando
es un `multiprocessing.spawn`.

Se localiza por el puerto, que es lo único fiable:

```bash
ss -lptn | grep ':8000'                                   # ver quién lo ocupa
kill -9 $(ss -lptn | grep ':8000' | grep -oP 'pid=\K[0-9]+')
```

Comprueba que quedó libre antes de reintentar:

```bash
ss -lptn | grep -c ':8000'    # 0 = libre
```

Para evitarlo, para la API con `Ctrl+C` en su terminal: así uvicorn se lleva
consigo al worker.

### 12 tests fallan con `ConnectionError` al puerto 6379

Falta Redis. No es opcional: publicar, duplicar y borrar media encolan trabajo,
y el límite de mensajes del chat cuenta ahí.

```bash
make up
```

### Un test de exportación falla con `ValueError: Invalid endpoint:`

Tu `backend/.env` tiene `S3_ENDPOINT_URL=` **vacío**. El valor por defecto del
código es `None`, y `botocore` acepta `None` pero no una cadena vacía. Comenta
esa línea del `.env`. En el pipeline no ocurre porque allí la variable no
existe.

### Media y CDN

Las URLs de los assets nunca se guardan: el snapshot y las tablas guardan
`media_asset_id` / `s3_key`, y `settings.media_url()` compone la URL al servir.
En producción, `S3_PUBLIC_URL` apunta al CDN (no al endpoint del bucket): así
mover el bucket o poner un CDN delante no toca nada del contenido ya publicado.
La transcodificación de vídeo y la generación automática de subtítulos son
trabajo de background pendiente (ARQ + ffmpeg); hoy los subtítulos WebVTT se
pegan a mano en la biblioteca y el alt-text lo sugiere el puerto de modelo
(`AssistantProvider.suggest_alt_text`, vacío con `StubProvider`).

### `make seed` falla con `MultipleResultsFound`

Ya no debería: las semillas buscan cada fila por su identificador propio. Si
vuelve a pasar, es que se ha colado una consulta que busca "el único X de la
institución" — `tests/integration/test_seeds.py` cubre justo ese caso.

### `npm ci` falla con `Missing: … from lock file`

`package.json` y `package-lock.json` no están sincronizados. Ejecuta `npm
install` una vez para regenerar el lock, **y luego `npm ci` en limpio para
confirmar**. Es importante: `npm install` tolera un lock incompleto y `npm ci`
no, así que el fallo aparece sólo en el pipeline. Ya pasó una vez y dejó el
release roto 21 commits.

### Quiero la base de datos como recién clonada

```bash
make down
docker volume rm imaquina_pgdata
make up && make testdb && make migrate && make seed
```

---

## Parar

```bash
make down        # para Postgres y Redis
```

Los servidores de `make api` y `make web` se paran con `Ctrl+C` en su terminal.
Los datos sobreviven en el volumen de Docker: `make up` los recupera.

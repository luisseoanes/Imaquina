# Plataforma Imaquina Robótica — brief del cliente

> Transcripción de [`plataforma-imaquina-robotica.pdf`](plataforma-imaquina-robotica.pdf)
> (Jason Castro Parra, 29 de julio de 2026, 4 páginas). El PDF original se conserva:
> las páginas 2–4 son capturas de pantalla y esto es su contenido en texto.
>
> Este documento es **la fuente**, no la propuesta. El alcance derivado está en
> [`scope-mvp.md`](scope-mvp.md), donde estos requisitos aparecen numerados `R1`–`R10`.

**Imaquina Robótica** — Programa de Robótica educativa.
Plataforma Interactiva Docentes / Estudiantes.

## Características de la plataforma

- La plataforma contiene **36 proyectos** relacionados con kits de robótica asignados por
  grado, desde Transición a grado 11°.
- Estudiantes y docentes acceden con usuario y contraseña **con vigencia**: de febrero a
  diciembre de 2027 para el **calendario A**, y de septiembre del 27 a junio del 28 para
  el **calendario B**.
- Soporta el acceso de **varios usuarios al tiempo**, de manera escalable.
- Dos tipos de usuario: **Docente** y **Estudiante**. El perfil docente ve el mismo
  contenido que el estudiante, y además tiene un botón que despliega información de apoyo
  para las actividades de aula: breves instrucciones escritas **solo para el docente**.
- Incluye un **chatbot** que actúa como consultor técnico de mecatrónica y programación
  para estudiantes y docentes **24/7**, de modo que puedan hacer consultas adicionales en
  casa e incluso configurar nuevos prototipos a partir de sus kits.
- Disponible en **inglés y español**.

## Momentos metodológicos

El usuario avanza en los proyectos a través de estas seis grandes secciones:

| # | Momento | Contenido |
|---|---|---|
| 1 | **Introducción + inclusión** | Texto, imágenes, audio y/o videos de introducción al proyecto |
| 2 | **Indagación** | Texto, imágenes, audio y/o videos que plantean una pequeña investigación a los equipos de trabajo |
| 3 | **Diseño** | Texto, imágenes, audio y/o videos para que los grupos diseñen el prototipo robótico |
| 4 | **Construcción** | Imágenes, audio y/o videos con el paso a paso en mecatrónica y programación |
| 5 | **Comunicación** | Imágenes, audio y/o videos con actividades para que los grupos comuniquen su proceso |
| 6 | **Evaluación** | Plantilla con preguntas relacionadas con el proyecto |

## Necesidades

Desarrollo de un **chatbot de I.A.** entrenado con los proyectos y con los conocimientos de
robótica relacionados: programación, placas controladoras, motores, etc.

- El chatbot **solo responde preguntas relacionadas con los proyectos de robótica**.
  Redirecciona la conversación cuando se plantean temas distintos.
- En los momentos **1, 2, 3, 4 y 5** estará habilitado como asistente para ampliar
  conocimientos y resolver dudas técnicas sobre los proyectos.

### Preguntas abiertas del cliente

1. ¿Es posible que en estas secciones **la interacción inicie desde el chatbot** hacia el
   usuario, con una pregunta?
2. ¿Es posible que en la sección 6 (evaluación), a partir de las preguntas planteadas a los
   estudiantes, la plataforma **arroje resultados por estudiante** que el maestro pueda ver
   y compilar? Puede ser un Excel o cualquier documento que le permita al docente ver los
   resultados del formulario de preguntas por estudiante.

> Ambas se responden en `scope-mvp.md` §1.

## Hosting contratado

> **DESACTUALIZADO (agosto 2026).** El PO asume la inversión en infraestructura,
> hosting y servidor. Este análisis se conserva como historia de por qué se llegó
> ahí, pero **no condiciona ninguna decisión técnica**: da por disponibles
> Postgres 16 + pgvector, Redis y S3/R2. Ver `CLAUDE.md` § Reparto de trabajo.

**Proveedor: Colombia Hosting.** Se solicitó una actualización del servidor en **enero de
2026**. El hosting alberga **3 dominios**.

### Correspondencia con el proveedor

**Primer mensaje** (respuesta a la solicitud):

> Hola Jason. Gracias por ponerse en contacto con nosotros.
>
> Dando respuesta a su solicitud, le informamos que, si lo desea, podemos ofrecerle la
> opción de migrar a un servidor más actualizado que sí soporta el framework Node.js. No
> obstante, es importante tener en cuenta las siguientes consideraciones:

⚠️ **La captura del PDF se corta justo aquí: la lista de consideraciones no aparece en el
documento.** Es información que hay que pedirle al cliente — son las condiciones bajo las
que el proveedor acepta la migración.

**Segundo mensaje** (migración completada):

> Estimado Jason. Nos complace informarle que hemos finalizado la migración de su dominio a
> un entorno compatible con Node.js; el dominio `jasoncastrostudio.com` ya apunta al nuevo
> servidor. Recuerde que si requiere añadir más dominios a su plan de hosting, estos
> dominios deberán contar con los siguientes registros NS para apuntar al servidor:
>
> - `ns1.mysecurecloudhost.com`
> - `ns2.mysecurecloudhost.com`
> - `ns3.mysecurecloudhost.com`
> - `ns4.mysecurecloudhost.com`
>
> Este cambio no representó modificaciones sobre las credenciales de acceso; puede seguir
> accediendo con las mismas claves.

### Cuotas de la cuenta (cPanel)

| Recurso | Uso | Recurso | Uso |
|---|---|---|---|
| Email Accounts | 4 / 40 (10%) | Autoresponders | 0 / ∞ |
| Databases | 3 / 40 (7.5%) | Forwarders | 1 / ∞ |
| Subdomains | 2 / 40 (5%) | Email Filters | 0 / ∞ |
| Disk Usage | 1.77 GB / 39.06 GB (4.54%) | FTP Accounts | 0 / 40 (0%) |
| Database Disk Usage | 218.06 MB / 37.5 GB (0.57%) | PostgreSQL Databases | 0 / 40 (0%) |
| Bandwidth | 2.68 GB / 488.28 GB (0.55%) | CPU Usage | 0 / 100 (0%) |
| File Usage | 53.335 / ∞ | Entry Processes | 0 / 30 (0%) |
| PostgreSQL Disk Usage | 0 bytes / 37.29 GB (0%) | Physical Memory Usage | 0 bytes / 2 GB (0%) |
| Alias Domains | 0 / 10 (0%) | IOPS | 0 / 2.048 (0%) |
| | | I/O Usage | 0 bytes/s / 48.83 GB/s (0%) |
| | | Number Of Processes | 0 / 100 (0%) |

### Uso de disco por directorio

| Ubicación | Tamaño |
|---|---|
| Files in home directory | 3.77 MB |
| Files in hidden subdirectories | 2.05 MB |
| `artour.com.co/` | 124.88 MB |
| `copias/` | 0.00 MB |
| `etc/` | 4.12 MB |
| `imaquina.com.co/` | **615.69 MB** |
| `logs/` | 8.94 MB |
| `lscache/` | 4.84 MB |
| `public_ftp/` | 0.00 MB |
| `public_html/` | **778.02 MB** |
| `sieve/` | 0.01 MB |
| `softaculous_backups/` | 37.30 MB |
| `ssl/` | 0.23 MB |
| `tmp/` | 5.37 MB |
| `wordpress-backups/` | 0.00 MB |
| Databases | 218.06 MB |
| PostgreSQL | 0.00 MB |
| Mailing Lists | 0.00 MB |
| Email Archives | 0.00 MB |
| Email Accounts | 24.84 MB |
| **Total** | **1.828,12 MB usados** de 40.000,00 MB de cuota |

### Servidor de base de datos

| | |
|---|---|
| Servidor | `localhost:3306` — Localhost via UNIX socket |
| Tipo | **MariaDB** 11.4.12 |
| Versión del protocolo | 10 |
| Usuario | `cpses_jazrg9z3xr@localhost` |
| Conjunto de caracteres del servidor | **cp1252 West European (latin1)** |
| Cotejamiento de la conexión | `utf8mb4_unicode_ci` |
| SSL | **No se está utilizando** |

Servidor web: `cpsrvd 11.134.0.47` · cliente de BD `libmysql - mysqlnd 8.4.23` ·
extensiones PHP `mysqli`, `curl`, `mbstring` · **PHP 8.4.23**.

### Bases de datos existentes

| Base de datos | Tamaño | Usuario con privilegios |
|---|---|---|
| `jasoncas_wp134` | 116.68 MB | `jasoncas_wp134` |
| `jasoncas_wp234` | 99.54 MB | `jasoncas_wp234` |
| `jasoncas_wp773` | 1.84 MB | `jasoncas_wp773` |

Las tres son bases de WordPress (prefijo `wp`) de los sitios que ya viven en el hosting. No
hay ninguna base de la plataforma, y **PostgreSQL está a cero** pese a aparecer en las
cuotas.

> El análisis de por qué este hosting no sirve para lo que se quiere construir está en
> `scope-mvp.md` §2.

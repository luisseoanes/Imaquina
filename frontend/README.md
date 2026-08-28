# Cliente web — Imaquina Robótica

SPA en React contra la API de `../backend`. Este repositorio contiene **el
andamiaje, no las pantallas**: las rutas existen y compilan, pero cada vista es
un marcador a la espera de desarrollo.

## Arranque

```bash
make web-install          # npm ci, exactamente segun package-lock.json
make api                  # el backend, en otra terminal (:8000)
make web                  # :5173, con proxy /api -> :8000
```

## Estructura

```
src/
├─ app/                   Composicion raiz: no contiene logica de negocio
│  ├─ App.tsx             Providers + router
│  ├─ providers/          Sesion y cliente de datos
│  ├─ router/             Rutas y guards por rol
│  └─ layouts/            Andamiaje visual compartido
│
├─ features/              Una carpeta por dominio, alineada con el backend
│  ├─ auth/               login, cuenta
│  ├─ dashboard/          panel de inicio
│  ├─ courses/            proyectos publicados y su detalle
│  ├─ moments/            los seis momentos de un proyecto
│  ├─ assessments/        evaluaciones del estudiante
│  ├─ chat/               consultor tecnico (SSE)
│  ├─ teacher/            progreso por curso, resultados   [diferido]
│  ├─ admin/              cuentas, cursos, matriculas      [diferido]
│  └─ studio/             autoria y publicacion            [diferido]
│
├─ shared/                Transversal: no depende de ninguna feature
│  ├─ api/                cliente HTTP, errores, tokens, generado
│  ├─ config/             rutas, roles, entorno
│  ├─ hooks/              hooks reutilizables
│  ├─ i18n/               es.json / en.json
│  └─ ui/                 primitivas de interfaz
│
├─ styles/                tokens.css + global.css
└─ test/                  setup de vitest y handlers de MSW
```

**La dependencia va en un solo sentido**: `app` → `features` → `shared`. Una
feature nunca importa de otra; si dos necesitan lo mismo, sube a `shared`. Esto
es lo que permite borrar una feature completa sin perseguir referencias.

## Reglas del proyecto

**El color se nombra por intención, nunca por valor.** `bg-surface`,
`text-content-muted`, `bg-brand` — nunca `bg-yellow-400`. Los tokens viven en
`styles/tokens.css` y son el único sitio donde hay un color escrito. Cambiar el
tema, o añadir modo oscuro, es tocar ese fichero y nada más.

**El cliente de la API se genera, no se escribe.** El backend publica 69
endpoints tipados en su OpenAPI; `npm run api:generate` produce los hooks de
react-query en `shared/api/generated`. Ese código **se versiona**: si no,
construir exigiría el backend levantado y se rompería CI y un clon recién
hecho. Se regenera a mano cuando el contrato cambia, y el diff lo hace visible
en la revisión.

**Todas las peticiones pasan por `shared/api/httpClient.ts`**, que es el mutator
del generado. Ahí está la autenticación, la renovación del token con una sola
llamada en vuelo y la traducción de errores a `ApiError`. No hagas `fetch` por
tu cuenta: la excepción es `streamChat`, porque el chat responde SSE y el
generado espera JSON completo.

**Los guards deciden qué pintar, no qué se permite.** La autorización real vive
en el servidor y se comprueba en cada petición. Saltarse un guard en el
navegador no da acceso a ningún dato.

**Todo texto va por i18next.** La plataforma es bilingüe por requisito del
cliente (R6). Un literal en un componente es un texto que no se puede traducir
después sin buscarlo a mano.

**Las rutas se construyen con `shared/config/routes.ts`**, nunca a mano en un
`<Link>`. Una URL escrita a pelo es como se llega a enlaces rotos que ningún
test de componente detecta.

## Tests

`vitest` + Testing Library + MSW, con `onUnhandledRequest: "error"`: una
petición que ningún handler simule hace fallar el test en vez de salir a la red.

`src/app/router/router.test.tsx` monta la aplicación entera y navega de verdad.
Los tests de componente aislado no ven si las rutas conectan ni si los guards
están bien anidados, y ese es de los fallos más caros de descubrir tarde.

## Lo que falta decidir

La referencia visual del dashboard está acordada, pero **la identidad definitiva
no**: los valores de `tokens.css` son un punto de partida derivado de esa
referencia y están para ajustarse. Mientras los componentes nombren intenciones,
ese cambio no toca ningún componente.

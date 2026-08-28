# Cliente web — IMaquina Robótica

SPA en React contra la API de `../backend`. Construidas la pantalla de acceso y la de 404;
el resto de rutas existen pero montan marcadores a la espera de desarrollo.

> Las **convenciones del proyecto** —cómo se generan las llamadas a la API, cómo se
> nombran los colores, qué se prueba y cómo— están en
> [`CLAUDE.md`](CLAUDE.md). Este README es solo para arrancar.

## Arrancar

```bash
make web-install          # npm ci, exactamente segun package-lock.json
make api                  # el backend, en otra terminal (:8000)
make web                  # :5173, con proxy /api -> :8000
```

Y entrar en <http://localhost:5173>. Las credenciales de desarrollo y los fallos
habituales están en [`../docs/desarrollo.md`](../docs/desarrollo.md).

## Comprobar antes de commitear

```bash
make web-lint             # oxlint
make web-test             # vitest
make web-build            # tsc -b && vite build
```

## Estructura

```
src/
├─ app/          Composición: providers, router y guards, layouts
├─ features/     Un directorio por dominio del backend
├─ shared/       Transversal: api, config, hooks, i18n, ui
├─ styles/       tokens.css (los colores) + global.css
└─ test/         Setup de vitest y handlers de MSW
```

La dependencia va en un solo sentido: `app` → `features` → `shared`.

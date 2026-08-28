# Assets del cliente

Imágenes que **importa el código**. Al pasar por el bundler llevan hash en el
nombre (cacheables para siempre) y las que no se usan no llegan al bundle.

```tsx
import ubbu from "@/assets/logos/ubbu-claro.svg";
```

Lo que necesite una **URL fija** —favicon, `og:image`, un fichero que enlace un
tercero— va en `public/` y no aquí: esos se sirven tal cual, sin hash.

## Qué hay

- `brand/` — la marca propia. `imaquina-horizontal.svg` es el logotipo.
- `logos/` — marcas de **colaboradores**, no la nuestra. Las variantes
  `-claro` / `-oscuro` dicen **sobre qué fondo van**, no de qué color es el
  logo: `ubbu-oscuro.png` es casi blanco (luminosidad media 245) porque está
  hecho para fondo oscuro. `whalesbot` y `enjoyai` son de tono medio y sirven
  en los dos.
- `illustrations/` — ilustraciones de robots.

## Antes de usarlos, léete esto

**Los `robot-*.svg` y el logotipo no son vectores.** Llevan un PNG embebido en
base64: los robots pesan entre 366 KB y 620 KB cada uno y el logotipo 493 KB.
No escalan como vector, y base64 infla un 33 % sobre el bitmap original. Lo
mismo con `logos/foodcash-*.svg`. Sólo `logos/ubbu-claro.svg` es vector de
verdad (4 KB).

Se nota: la pantalla de acceso transfiere **906 KB en móvil**, y el 80 % son el
logotipo y el robot de turno.

**Conviene exportarlos a WebP**, y no pierdes la transparencia por hacerlo.
Medido sobre `robot-1` rasterizado a 900 px:

| | Peso | ¿Transparente? |
|---|---|---|
| SVG actual | 366 KB | sí |
| WebP 900 px | **29 KB** | **sí** (canal alfa 0–255) |

Con eso la pantalla de acceso bajaría de ~900 KB a ~200 KB.

### Los robots venían con fondo blanco

Cada `robot-*.svg` traía dos `<rect fill="#ffffff">` cubriendo el lienzo
entero, así que sobre cualquier fondo que no fuera blanco aparecía un recuadro.
Se quitaron. **Si vuelves a exportar un robot desde el original, comprueba que
no reaparezcan**: se ven al instante poniendo la ilustración sobre un color.

Ojo al hacerlo: no todo `<rect>` blanco sobra. Los que están dentro de un
`<mask>` definen qué parte se ve, y borrarlos rompe la ilustración. Sólo se
quitan los que están fuera de `<defs>` y cubren el `viewBox` completo.

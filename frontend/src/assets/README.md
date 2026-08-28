# Assets del cliente

Imágenes que **importa el código**. Al pasar por el bundler llevan hash en el
nombre (cacheables para siempre) y las que no se usan no llegan al bundle.

```tsx
import ubbu from "@/assets/logos/ubbu-claro.svg";
```

Lo que necesite una **URL fija** —favicon, `og:image`, un fichero que enlace un
tercero— va en `public/` y no aquí: esos se sirven tal cual, sin hash.

## Qué hay

- `logos/` — marcas de los kits de robótica. Las variantes `-claro` / `-oscuro`
  son para fondo claro y fondo oscuro, no dos temas de la app.
- `illustrations/` — ilustraciones de robots.

## Antes de usarlos, léete esto

**Los `robot-*.svg` no son vectores.** Llevan un PNG de 810×810 embebido en
base64: pesan entre 368 KB y 620 KB cada uno, **2,4 MB los cinco**, no escalan
como vector y base64 infla un 33 % sobre el bitmap original. Metidos en una
pantalla tal cual son más peso que todo el resto del bundle junto.

Lo mismo con `logos/foodcash-claro.svg` y `foodcash-oscuro.svg`.

Antes de usarlos conviene exportarlos a WebP o AVIF a la resolución en la que
se vayan a ver. Como referencia: la versión WebP de `robot-2` que había pesaba
**48 KB** frente a los 620 KB del SVG, y a más resolución.

`logos/ubbu-claro.svg` sí es vector de verdad (4 KB).

import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// Los tests montan `<App>` entero con rutas diferidas y varias peticiones MSW
// en vuelo; con los workers en paralelo, 1 s (el valor por defecto) se queda
// corto en máquinas cargadas y `findBy*` falla de forma intermitente.
configure({ asyncUtilTimeout: 3000 });

// i18n de verdad, no un mock: los tests afirman sobre el texto que ve el
// usuario, así que una clave que falte en es.json sale como fallo del test y
// no como un `nav.courses` pintado en pantalla.
import "@/shared/i18n";

// jsdom no implementa `scrollIntoView`, y llamarlo lanza. Lo usa el chat para
// seguir la conversación; sin este relleno, cualquier test que monte un momento
// revienta con un error que no tiene nada que ver con lo que prueba.
Element.prototype.scrollIntoView = () => {};

// `onUnhandledRequest: "error"`: una petición que ningún handler simule hace
// fallar el test en vez de escaparse a la red de verdad.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});

afterAll(() => server.close());

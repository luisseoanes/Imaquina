import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./server";

// i18n de verdad, no un mock: los tests afirman sobre el texto que ve el
// usuario, así que una clave que falte en es.json sale como fallo del test y
// no como un `nav.courses` pintado en pantalla.
import "@/shared/i18n";

// `onUnhandledRequest: "error"`: una petición que ningún handler simule hace
// fallar el test en vez de escaparse a la red de verdad.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});

afterAll(() => server.close());

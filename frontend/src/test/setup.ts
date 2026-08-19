import "@testing-library/jest-dom/vitest";

// i18next de verdad, no un mock: los tests afirman sobre el texto que ve el
// usuario, y asi una clave que falte en es.json sale como fallo.
import "@/i18n";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);

// `onUnhandledRequest: "error"`: si un test hace una peticion que nadie ha
// simulado, falla en vez de colarse a la red de verdad.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  localStorage.clear();
});

afterAll(() => server.close());

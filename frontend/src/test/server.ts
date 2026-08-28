import { setupServer } from "msw/node";

import { handlers } from "./handlers";

/** Servidor de simulación compartido. Un test concreto sobrescribe lo que
 *  necesite con `server.use(...)`, sin tocar los handlers por defecto. */
export const server = setupServer(...handlers);

import { ApiError } from "./ApiError";
import { tokens } from "./tokens";
import { env } from "@/shared/config/env";

/** Consumo del chat por SSE.
 *
 *  Va a mano y no por el cliente generado a propósito: el endpoint responde un
 *  `text/event-stream` y el generador produce clientes que esperan un JSON
 *  completo. El primer token tiene que verse enseguida, así que no se puede
 *  aguardar a que termine la respuesta.
 *
 *  `EventSource` tampoco sirve: no permite cabeceras, y la sesión va en el
 *  `Authorization`.
 */
export async function* streamChat(
  sessionId: string,
  question: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const res = await fetch(
    `${env.apiBaseUrl}/chat/sessions/${sessionId}/ask`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {}),
      },
      body: JSON.stringify({ question }),
      ...(signal ? { signal } : {}),
    },
  );

  if (!res.ok || !res.body) {
    const cuerpo = (await res.json().catch(() => ({}))) as {
      error?: { code?: string; message?: string };
    };
    throw new ApiError(
      res.status,
      cuerpo.error?.code ?? "unknown",
      cuerpo.error?.message ?? res.statusText,
    );
  }

  const lector = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let resto = "";

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;

    // Un chunk de red puede partir un evento por la mitad: se acumula y sólo
    // se emiten los eventos completos (separados por línea en blanco).
    resto += value;
    const eventos = resto.split("\n\n");
    resto = eventos.pop() ?? "";

    for (const evento of eventos) {
      for (const linea of evento.split("\n")) {
        if (linea.startsWith("data:")) yield linea.slice(5).trimStart();
      }
    }
  }
}

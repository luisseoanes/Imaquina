/** Cliente HTTP base. Orval lo usa como mutator del codigo generado. */

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

let accessToken: string | null = localStorage.getItem("access_token");
let refreshToken: string | null = localStorage.getItem("refresh_token");

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("access_token", token);
  else localStorage.removeItem("access_token");
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (token) localStorage.setItem("refresh_token", token);
  else localStorage.removeItem("refresh_token");
}

export function clearTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function url(path: string, params?: Record<string, string | undefined>) {
  const u = new URL(BASE + path, window.location.origin);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined) u.searchParams.set(k, v);
  }
  return u;
}

function auth(): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

// El access token dura 15 minutos. Una sola renovacion en vuelo: si cinco
// peticiones reciben 401 a la vez, no salen cinco refrescos.
let enVuelo: Promise<boolean> | null = null;

function renovarAcceso(): Promise<boolean> {
  enVuelo ??= (async () => {
    if (!refreshToken) return false;
    try {
      const res = await fetch(url("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!res.ok) return false;
      setAccessToken(((await res.json()) as { access_token: string }).access_token);
      return true;
    } catch {
      return false;
    }
  })().finally(() => {
    enVuelo = null;
  });
  return enVuelo;
}

/** Las rutas de sesion no se reintentan: un 401 ahi ES la respuesta. */
const SIN_REINTENTO = ["/auth/login", "/auth/refresh"];

export async function http<T>(
  config: {
    url: string;
    method?: string;
    data?: unknown;
    params?: Record<string, string | undefined>;
    signal?: AbortSignal;
  },
  _reintento = false,
): Promise<T> {
  const res = await fetch(url(config.url, config.params), {
    method: config.method ?? "GET",
    headers: { "Content-Type": "application/json", ...auth() },
    body: config.data ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
  });

  if (!res.ok) {
    // 401 = no sabemos quien eres -> renovar y reintentar UNA vez.
    // 403 = sabemos quien eres y esto no te toca -> no se toca la sesion.
    if (res.status === 401 && !_reintento && !SIN_REINTENTO.includes(config.url)) {
      if (await renovarAcceso()) return http<T>(config, true);
      clearTokens();
    }
    const body = await res.json().catch(() => ({}));
    const err = (body as { error?: { code?: string; message?: string } })?.error ?? {};
    throw new ApiError(res.status, err.code ?? "unknown", err.message ?? res.statusText);
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

/** Streaming SSE para el chat. El primer token debe verse en <2s. */
export async function* streamChat(
  sessionId: string,
  question: string,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const pedir = () =>
    fetch(url(`/chat/sessions/${sessionId}/ask`), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth() },
      body: JSON.stringify({ question }),
      signal,
    });

  let res = await pedir();
  // Una conversacion larga sobrevive de sobra a los 15 minutos del access
  // token, asi que aqui el 401 es lo normal, no la excepcion.
  if (res.status === 401 && (await renovarAcceso())) res = await pedir();

  if (!res.ok || !res.body) {
    if (res.status === 401) clearTokens();
    throw new ApiError(res.status, "stream_failed", "Fallo el chat");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6);
      if (payload === "[DONE]") return;
      yield payload;
    }
  }
}

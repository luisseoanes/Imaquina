/** Cliente HTTP base. Orval lo usa como mutator del codigo generado. */

const BASE = import.meta.env.VITE_API_URL ?? "/api/v1";

let accessToken: string | null = localStorage.getItem("access_token");

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("access_token", token);
  else localStorage.removeItem("access_token");
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

export async function http<T>(config: {
  url: string;
  method?: string;
  data?: unknown;
  params?: Record<string, string | undefined>;
  signal?: AbortSignal;
}): Promise<T> {
  const url = new URL(BASE + config.url, window.location.origin);
  for (const [k, v] of Object.entries(config.params ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const res = await fetch(url, {
    method: config.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: config.data ? JSON.stringify(config.data) : undefined,
    signal: config.signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body?.error ?? {};
    if (res.status === 401 || res.status === 403) setAccessToken(null);
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
  const res = await fetch(`${BASE}/chat/sessions/${sessionId}/ask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ question }),
    signal,
  });

  if (!res.ok || !res.body) throw new ApiError(res.status, "stream_failed", "Fallo el chat");

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

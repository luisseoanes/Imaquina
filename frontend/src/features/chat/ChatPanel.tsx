import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Bot, Send, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError, http, streamChat } from "@/lib/http";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

interface ChatSessionOut {
  id: string;
  moment_id: string | null;
}

export default function ChatPanel({
  momentId,
  openingPrompt,
}: {
  momentId: string;
  openingPrompt: string | null;
}) {
  const { t } = useTranslation();
  // Solo lo escrito/recibido EN ESTA visita: el historial previo llega de la
  // query `historial`, no se copia a estado local (evitaría "setState en un
  // efecto" y además duplicaría la fuente de verdad).
  const [nuevos, setNuevos] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // C6: reusa la sesión del momento si ya existe una, en vez de crear una
  // nueva (y perder la conversación) en cada montaje.
  const sesiones = useQuery({
    queryKey: ["chat", "sessions", momentId],
    queryFn: () =>
      http<ChatSessionOut[]>({ url: "/chat/sessions", params: { moment_id: momentId } }),
  });

  const start = useMutation({
    mutationFn: () =>
      http<{ session_id: string }>({
        url: "/chat/sessions",
        method: "POST",
        data: { moment_id: momentId },
      }),
  });

  // El backend manda las sesiones más recientes primero: la primera de la
  // lista es la que se reusa. Si no hay ninguna, `start` crea una y esta
  // queda como la sesión activa.
  const sessionId = sesiones.data?.[0]?.id ?? start.data?.session_id ?? null;

  useEffect(() => {
    if (sessionId || sesiones.isLoading || start.isPending) return;
    start.mutate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesiones.isLoading, sessionId, start.isPending]);

  // Historial previo (C1/C2/C6): si la sesión ya existía, trae lo que se
  // habló. Para una recién creada devuelve vacío, así que no hace daño pedirlo
  // siempre.
  const historial = useQuery({
    queryKey: ["chat", "messages", sessionId],
    queryFn: () => http<Msg[]>({ url: `/chat/sessions/${sessionId}/messages` }),
    enabled: !!sessionId,
  });

  const mensajes = [...(historial.data ?? []), ...nuevos];
  // R8: la conversación puede iniciarla el bot con la pregunta detonante del
  // momento. Es contenido curado en el CMS, no texto generado, así que se
  // DERIVA en el render en vez de guardarse en estado.
  const visibles: Msg[] = openingPrompt
    ? [{ role: "assistant", content: openingPrompt }, ...mensajes]
    : mensajes;

  async function send() {
    const question = input.trim();
    if (!question || !sessionId || streaming) return;

    setInput("");
    setRateLimited(false);
    setNuevos((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setStreaming(true);

    abortRef.current = new AbortController();
    try {
      for await (const token of streamChat(sessionId, question, abortRef.current.signal)) {
        setNuevos((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + token,
          };
          return next;
        });
      }
    } catch (err) {
      // N10: un 429 (límite por hora) no es "algo se rompió" -- el mensaje
      // vacío que se acababa de añadir se retira, no queda una burbuja muda.
      if (err instanceof ApiError && err.status === 429) {
        setRateLimited(true);
        setNuevos((m) => m.slice(0, -1));
      } else {
        throw err;
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-line shadow-sm">
      <header className="flex items-center gap-2 border-b border-line bg-surface-muted px-4 py-3 font-medium">
        <Bot size={18} className="text-brand-ink" aria-hidden />
        {t("chat.title")}
      </header>

      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {visibles.map((m, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}
          >
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
                m.role === "user"
                  ? "bg-brand/15 text-brand-ink"
                  : "bg-surface-muted text-content-subtle"
              }`}
              aria-hidden
            >
              {m.role === "user" ? <User size={14} /> : <Bot size={14} />}
            </span>
            <span
              className={`inline-block max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "rounded-br-sm bg-brand text-brand-content"
                  : "rounded-bl-sm bg-surface-muted"
              }`}
            >
              {m.content || (streaming && t("chat.thinking"))}
            </span>
          </div>
        ))}
      </div>

      {rateLimited && (
        <p className="flex items-center gap-2 border-t border-line bg-note px-4 py-2 text-sm text-note-content">
          <AlertTriangle size={16} className="shrink-0" aria-hidden />
          {t("chat.rateLimited")}
        </p>
      )}

      <div className="flex gap-2 border-t border-line p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={t("chat.placeholder")}
          className="flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm
                     transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
        <button
          onClick={() => void send()}
          disabled={streaming || !sessionId}
          aria-label={t("chat.send")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand
                     text-brand-content transition active:scale-[0.98] disabled:opacity-50"
        >
          <Send size={16} aria-hidden />
        </button>
      </div>
    </section>
  );
}

import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { http, streamChat } from "@/lib/http";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPanel({
  momentId,
  openingPrompt,
}: {
  momentId: string;
  openingPrompt: string | null;
}) {
  const { t } = useTranslation();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // R8: la conversación puede iniciarla el bot con la pregunta detonante del
  // momento. Es contenido curado en el CMS, no texto generado, así que se
  // DERIVA en el render en vez de guardarse en `messages`: metiéndolo por un
  // efecto, cada cambio de `openingPrompt` (llega async con el momento)
  // reseteaba el estado y borraba la conversación en curso.
  const visibles: Msg[] = openingPrompt
    ? [{ role: "assistant", content: openingPrompt }, ...messages]
    : messages;

  const start = useMutation({
    mutationFn: () =>
      http<{ session_id: string }>({
        url: "/chat/sessions",
        method: "POST",
        data: { moment_id: momentId },
      }),
    onSuccess: (res) => setSessionId(res.session_id),
  });

  useEffect(() => {
    if (!sessionId) start.mutate();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send() {
    const question = input.trim();
    if (!question || !sessionId || streaming) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setStreaming(true);

    abortRef.current = new AbortController();
    try {
      for await (const token of streamChat(sessionId, question, abortRef.current.signal)) {
        setMessages((m) => {
          const next = [...m];
          next[next.length - 1] = {
            role: "assistant",
            content: next[next.length - 1].content + token,
          };
          return next;
        });
      }
    } finally {
      setStreaming(false);
    }
  }

  return (
    <section className="mt-8 rounded border">
      <header className="border-b px-4 py-2 font-medium">{t("chat.title")}</header>

      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
        {visibles.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : ""}>
            <span
              className={`inline-block rounded px-3 py-2 text-sm ${
                m.role === "user" ? "bg-black text-white" : "bg-gray-100"
              }`}
            >
              {m.content || (streaming && t("chat.thinking"))}
            </span>
          </div>
        ))}
      </div>

      <div className="flex gap-2 border-t p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void send()}
          placeholder={t("chat.placeholder")}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <button
          onClick={() => void send()}
          disabled={streaming || !sessionId}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {t("chat.send")}
        </button>
      </div>
    </section>
  );
}

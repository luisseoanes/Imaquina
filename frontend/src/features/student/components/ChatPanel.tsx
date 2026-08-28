/** El asistente de robótica dentro de un momento (R5, R8, R9).
 *
 *  - **Reusa la sesión del momento** en vez de crear una nueva en cada montaje
 *    (C2): `GET /chat/sessions?moment_id=` devuelve las del usuario para ese
 *    momento y se toma la más reciente. Sólo si no hay ninguna se crea, y se
 *    crea al mandar la primera pregunta — abrir la pantalla no debe dejar
 *    sesiones vacías por toda la base.
 *  - **El prompt de apertura es contenido curado, no generado** (R8): viene en
 *    el momento y se pinta como primer turno del bot cuando no hay historial.
 *    No se persiste como mensaje: si se guardara, el modelo lo recibiría de
 *    vuelta como si lo hubiera dicho él.
 *  - La respuesta llega por SSE (`streamChat`) y se pinta token a token: el
 *    criterio de aceptación es primer token en menos de 2 s, y esperar a la
 *    respuesta completa lo tira por tierra aunque el backend cumpla.
 */
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "@/shared/api/ApiError";
import { streamChat } from "@/shared/api/streamChat";
import { Icon } from "@/shared/ui/panel-icons";
import type { Lang } from "@/shared/config/roles";
import { startChatSession, useChatMessages, useChatSessions } from "../api";

interface Turno {
  role: "user" | "assistant";
  content: string;
}

export function ChatPanel({
  momentId,
  openingPrompt,
  lang,
}: {
  momentId: string;
  openingPrompt: string | null;
  lang: Lang;
}) {
  const { t } = useTranslation();
  const sesiones = useChatSessions(momentId);
  const sesionExistente = sesiones.data?.[0]?.id ?? null;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const activa = sessionId ?? sesionExistente;

  const historial = useChatMessages(activa ?? "", { enabled: !!activa });

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [pregunta, setPregunta] = useState("");
  const [enVuelo, setEnVuelo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);

  // El historial del servidor es la verdad; los turnos locales son lo que se ha
  // dicho en esta pantalla desde la última recarga.
  const mensajes: Turno[] = [...(historial.data ?? []), ...turnos];

  useEffect(() => {
    finRef.current?.scrollIntoView({ block: "end" });
  }, [mensajes.length, enVuelo]);

  async function enviar() {
    const texto = pregunta.trim();
    if (!texto || enVuelo) return;

    setError(null);
    setPregunta("");
    setTurnos((v) => [...v, { role: "user", content: texto }, { role: "assistant", content: "" }]);
    setEnVuelo(true);

    try {
      let id = activa;
      if (!id) {
        id = (await startChatSession(momentId, lang)).session_id;
        setSessionId(id);
      }

      for await (const token of streamChat(id, texto)) {
        if (token === "[DONE]") break;
        // El último turno es la burbuja del asistente que se acaba de
        // añadir; se reemplaza acumulando el token recibido.
        setTurnos((v) =>
          v.map((turno, i) =>
            i === v.length - 1
              ? { role: turno.role, content: turno.content + token }
              : turno,
          ),
        );
      }
    } catch (e) {
      // 429 es el límite por hora (N7), y merece un mensaje propio: "algo falló"
      // no le dice al estudiante que vuelva más tarde.
      const msg =
        e instanceof ApiError
          ? e.status === 429
            ? t("student.chat.rateLimited")
            : e.message
          : t("common.error");
      setError(msg);
      // Se retira la burbuja vacía del asistente: dejarla parece que respondió
      // en blanco.
      setTurnos((v) => v.slice(0, -1));
    } finally {
      setEnVuelo(false);
    }
  }

  const vacio = mensajes.length === 0;

  return (
    <section
      aria-label={t("student.chat.title")}
      className="flex flex-col rounded-2xl border border-line/60 bg-surface shadow-card"
    >
      <header className="flex items-center gap-2 border-b border-line/60 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
          <Icon name="sparkles" className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold text-content">
            {t("student.chat.title")}
          </p>
          <p className="truncate text-xs text-content-subtle">
            {t("student.chat.subtitle")}
          </p>
        </div>
      </header>

      <div className="max-h-[26rem] min-h-[12rem] flex-1 space-y-3 overflow-y-auto p-4">
        {vacio && openingPrompt ? (
          <Burbuja role="assistant">{openingPrompt}</Burbuja>
        ) : null}
        {vacio && !openingPrompt ? (
          <p className="py-6 text-center text-sm text-content-muted">
            {t("student.chat.empty")}
          </p>
        ) : null}

        {mensajes.map((m, i) => (
          <Burbuja key={i} role={m.role}>
            {m.content || (enVuelo && i === mensajes.length - 1 ? "…" : "")}
          </Burbuja>
        ))}

        {error ? (
          <p role="alert" className="rounded-2xl bg-danger-surface p-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div ref={finRef} />
      </div>

      <form
        className="flex items-center gap-2 border-t border-line/60 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder={t("student.chat.placeholder")}
          aria-label={t("student.chat.placeholder")}
          className="min-w-0 flex-1 rounded-pill border border-line bg-canvas px-4 py-2.5 text-sm text-content transition duration-150 placeholder:text-content-subtle focus:border-brand-ink"
        />
        <button
          type="submit"
          disabled={enVuelo || !pregunta.trim()}
          aria-label={t("student.chat.send")}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand text-brand-content transition duration-200 hover:bg-brand-strong disabled:opacity-40"
        >
          <Icon name="send" className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function Burbuja({ role, children }: { role: "user" | "assistant"; children: ReactNode }) {
  const esUsuario = role === "user";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <p
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          esUsuario
            ? "bg-brand text-brand-content"
            : "bg-surface-muted text-content"
        }`}
      >
        {children}
      </p>
    </div>
  );
}

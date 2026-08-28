/** Render de los bloques interactivos (checklist, vídeo con capítulos,
 *  mini-quiz de comprensión, herramienta embebida, Blockly).
 *
 *  La estructura viene en `block.config` con el texto por idioma
 *  (`{ es: "...", en: "..." }`). El estado del alumno —qué marcó, qué
 *  respondió— llega en `block.interaction` y se guarda con `onSave`; en la
 *  previsualización del Studio `onSave` no se pasa y los controles quedan
 *  en modo lectura.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

type LangText = Record<string, string> | undefined;

function txtEn(map: LangText, lang: string): string {
  if (!map || typeof map !== "object") return "";
  return map[lang] ?? Object.values(map)[0] ?? "";
}

interface Common {
  config: Record<string, unknown>;
  lang: string;
  interaction?: Record<string, unknown> | null;
  onSave?: (state: Record<string, unknown>) => void;
}

// --- Checklist -------------------------------------------------------------

export function ChecklistBlock({ config, lang, interaction, onSave }: Common) {
  const { t } = useTranslation();
  const items = (config.items as { id: string; text: LangText }[]) ?? [];
  const [done, setDone] = useState<Record<string, boolean>>(
    (interaction?.done as Record<string, boolean>) ?? {},
  );
  const readOnly = !onSave;

  const toggle = (id: string) => {
    const next = { ...done, [id]: !done[id] };
    setDone(next);
    onSave?.({ done: next });
  };

  const hechos = items.filter((it) => done[it.id]).length;
  return (
    <div className="rounded-2xl border border-line bg-surface-muted p-4">
      <p className="mb-2 text-xs font-semibold uppercase text-content-subtle">
        {t("student.moment.checklist", { done: hechos, total: items.length })}
      </p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li key={it.id}>
            <label className="flex items-start gap-2 text-sm text-content">
              <input
                type="checkbox"
                checked={!!done[it.id]}
                disabled={readOnly}
                onChange={() => toggle(it.id)}
                className="mt-0.5"
              />
              <span className={done[it.id] ? "line-through opacity-60" : ""}>
                {txtEn(it.text, lang)}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- Vídeo con capítulos --------------------------------------------------

export function VideoChaptersBlock({
  config,
  lang,
  src,
}: Common & { src: string | null }) {
  const { t } = useTranslation();
  const chapters =
    (config.chapters as { id: string; at: number; label: LangText }[]) ?? [];
  const [at, setAt] = useState<number | null>(null);

  if (!src) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-content-muted">
        {t("student.moment.missingMedia", { kind: "video" })}
      </div>
    );
  }
  const base = src.includes("youtube") || /^[\w-]{11}$/.test(src) ? null : src;
  return (
    <div className="space-y-2">
      {base ? (
        <video
          src={at != null ? `${base}#t=${at}` : base}
          controls
          preload="metadata"
          className="w-full rounded-2xl border border-line/60 bg-content"
        />
      ) : (
        <video
          src={src}
          controls
          className="w-full rounded-2xl border border-line/60 bg-content"
        />
      )}
      {chapters.length > 0 ? (
        <ol className="flex flex-wrap gap-2">
          {chapters
            .slice()
            .sort((a, b) => a.at - b.at)
            .map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setAt(c.at)}
                  className="rounded-control bg-surface-muted px-2.5 py-1 text-xs text-content hover:bg-line"
                >
                  {formatoTiempo(c.at)} · {txtEn(c.label, lang)}
                </button>
              </li>
            ))}
        </ol>
      ) : null}
    </div>
  );
}

function formatoTiempo(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

// --- Mini-quiz de comprensión (no cuenta nota) ---------------------------

export function InlineQuizBlock({ config, lang, interaction, onSave }: Common) {
  const { t } = useTranslation();
  const questions =
    (config.questions as {
      id: string;
      prompt: LangText;
      options: { id: string; text: LangText; correct?: boolean }[];
    }[]) ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>(
    (interaction?.answers as Record<string, string>) ?? {},
  );
  const [revelado, setRevelado] = useState(
    Boolean((interaction?.answers as object) ?? false),
  );

  const elegir = (qId: string, oId: string) => {
    const next = { ...answers, [qId]: oId };
    setAnswers(next);
    onSave?.({ answers: next });
  };

  return (
    <div className="rounded-2xl border border-line bg-surface-muted p-4">
      <p className="mb-3 text-xs font-semibold uppercase text-content-subtle">
        {t("student.moment.checkYourUnderstanding")}
      </p>
      <div className="space-y-4">
        {questions.map((q) => {
          const elegido = answers[q.id];
          return (
            <div key={q.id}>
              <p className="mb-2 text-sm font-medium text-content">
                {txtEn(q.prompt, lang)}
              </p>
              <div className="space-y-1.5">
                {q.options.map((o) => {
                  const esElegido = elegido === o.id;
                  const marca =
                    revelado && esElegido
                      ? o.correct
                        ? "border-success text-success"
                        : "border-danger text-danger"
                      : revelado && o.correct
                        ? "border-success/60"
                        : "border-line";
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => elegir(q.id, o.id)}
                      className={`block w-full rounded-control border px-3 py-2 text-left text-sm ${marca} ${
                        esElegido ? "bg-canvas" : "bg-surface"
                      }`}
                    >
                      {txtEn(o.text, lang)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {!revelado && Object.keys(answers).length > 0 ? (
        <button
          type="button"
          onClick={() => setRevelado(true)}
          className="mt-3 rounded-control bg-brand-ink px-3 py-1.5 text-xs font-semibold text-content-inverse"
        >
          {t("student.moment.checkAnswers")}
        </button>
      ) : null}
    </div>
  );
}

// --- Herramienta embebida / Blockly -------------------------------------

const IFRAME_ALLOW: Record<string, string> = {
  falstad: "https://www.falstad.com/circuit/circuitjs.html",
  wokwi: "https://wokwi.com",
  tinkercad: "https://www.tinkercad.com",
  viewstl: "https://www.viewstl.com",
  geogebra: "https://www.geogebra.org",
};

export function EmbedInteractiveBlock({ config }: Common) {
  const { t } = useTranslation();
  const provider = config.provider as string | undefined;
  const src = config.src as string | undefined;
  const permitido =
    src &&
    (!provider ||
      !IFRAME_ALLOW[provider] ||
      src.startsWith(IFRAME_ALLOW[provider]) ||
      src.startsWith("https://"));

  if (!permitido) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-4 text-sm text-content-muted">
        {t("student.moment.missingMedia", { kind: provider ?? "embed" })}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-line/60 bg-content">
      <iframe
        src={src}
        title={provider ?? "embed"}
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        referrerPolicy="strict-origin-when-cross-origin"
        className="h-[28rem] w-full"
      />
    </div>
  );
}

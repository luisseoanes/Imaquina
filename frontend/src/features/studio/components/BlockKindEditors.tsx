/** Editores de la `config` de cada bloque interactivo.
 *
 *  El texto se guarda por idioma (`{ es, en }`) dentro de `config`, así que
 *  añadir un tercer idioma no rompe la forma. Cada editor recibe la `config`
 *  actual y el idioma activo del Studio y devuelve la `config` nueva completa.
 */
import { useTranslation } from "react-i18next";

import { Button, Field, Select, TextInput } from "@/shared/ui/panel";
import { RichTextEditor } from "@/shared/ui/RichTextEditor";

type Cfg = Record<string, unknown>;
type LangText = Record<string, string>;

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 8);

function setLang(map: LangText | undefined, lang: string, value: string): LangText {
  return { ...(map ?? {}), [lang]: value };
}

// --- Checklist -----------------------------------------------------------

interface ChecklistItem {
  id: string;
  text?: LangText;
}

export function ChecklistEditor({
  config,
  lang,
  onChange,
}: {
  config: Cfg;
  lang: string;
  onChange: (c: Cfg) => void;
}) {
  const { t } = useTranslation();
  const items = (config.items as ChecklistItem[]) ?? [];
  const set = (next: ChecklistItem[]) => onChange({ ...config, items: next });

  return (
    <Field label={t("studio.editor.checklistItems")}>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={it.id} className="flex gap-2">
            <TextInput
              value={it.text?.[lang] ?? ""}
              onChange={(e) =>
                set(
                  items.map((x) =>
                    x.id === it.id
                      ? { ...x, text: setLang(x.text, lang, e.target.value) }
                      : x,
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label={t("studio.action.delete")}
              className="text-danger"
              onClick={() => set(items.filter((x) => x.id !== it.id))}
            >
              ✕
            </button>
            <span className="sr-only">{i + 1}</span>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => set([...items, { id: uid(), text: { [lang]: "" } }])}
        >
          {t("studio.editor.addItem")}
        </Button>
      </div>
    </Field>
  );
}

// --- Vídeo con capítulos ------------------------------------------------

interface Chapter {
  id: string;
  at: number;
  label?: LangText;
}

export function ChaptersEditor({
  config,
  lang,
  onChange,
}: {
  config: Cfg;
  lang: string;
  onChange: (c: Cfg) => void;
}) {
  const { t } = useTranslation();
  const chapters = (config.chapters as Chapter[]) ?? [];
  const set = (next: Chapter[]) => onChange({ ...config, chapters: next });

  return (
    <Field label={t("studio.editor.chapters")} hint={t("studio.editor.chaptersHint")}>
      <div className="space-y-2">
        {chapters.map((c) => (
          <div key={c.id} className="flex gap-2">
            <TextInput
              type="number"
              value={String(c.at)}
              className="max-w-24"
              onChange={(e) =>
                set(
                  chapters.map((x) =>
                    x.id === c.id ? { ...x, at: Number(e.target.value) || 0 } : x,
                  ),
                )
              }
            />
            <TextInput
              value={c.label?.[lang] ?? ""}
              onChange={(e) =>
                set(
                  chapters.map((x) =>
                    x.id === c.id
                      ? { ...x, label: setLang(x.label, lang, e.target.value) }
                      : x,
                  ),
                )
              }
            />
            <button
              type="button"
              aria-label={t("studio.action.delete")}
              className="text-danger"
              onClick={() => set(chapters.filter((x) => x.id !== c.id))}
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => set([...chapters, { id: uid(), at: 0, label: { [lang]: "" } }])}
        >
          {t("studio.editor.addChapter")}
        </Button>
      </div>
    </Field>
  );
}

// --- Mini-quiz de comprensión -----------------------------------------

interface QuizOption {
  id: string;
  text?: LangText;
  correct?: boolean;
}
interface QuizQuestion {
  id: string;
  prompt?: LangText;
  options: QuizOption[];
}

export function InlineQuizEditor({
  config,
  lang,
  onChange,
}: {
  config: Cfg;
  lang: string;
  onChange: (c: Cfg) => void;
}) {
  const { t } = useTranslation();
  const questions = (config.questions as QuizQuestion[]) ?? [];
  const set = (next: QuizQuestion[]) => onChange({ ...config, questions: next });
  const patchQ = (id: string, patch: Partial<QuizQuestion>) =>
    set(questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  return (
    <div className="space-y-3">
      {questions.map((q) => (
        <div key={q.id} className="rounded-control border border-line p-3">
          <Field label={t("studio.editor.quizPrompt")}>
            <RichTextEditor
              value={q.prompt?.[lang] ?? ""}
              onChange={(html) =>
                patchQ(q.id, { prompt: setLang(q.prompt, lang, html) })
              }
            />
          </Field>
          <div className="space-y-2">
            {q.options.map((o) => (
              <div key={o.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!o.correct}
                  aria-label={t("studio.editor.quizCorrect")}
                  onChange={(e) =>
                    patchQ(q.id, {
                      options: q.options.map((x) =>
                        x.id === o.id ? { ...x, correct: e.target.checked } : x,
                      ),
                    })
                  }
                />
                <TextInput
                  value={o.text?.[lang] ?? ""}
                  onChange={(e) =>
                    patchQ(q.id, {
                      options: q.options.map((x) =>
                        x.id === o.id
                          ? { ...x, text: setLang(x.text, lang, e.target.value) }
                          : x,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={t("studio.action.delete")}
                  className="text-danger"
                  onClick={() =>
                    patchQ(q.id, {
                      options: q.options.filter((x) => x.id !== o.id),
                    })
                  }
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              variant="ghost"
              onClick={() =>
                patchQ(q.id, {
                  options: [...q.options, { id: uid(), text: { [lang]: "" } }],
                })
              }
            >
              {t("studio.editor.addOption")}
            </Button>
          </div>
          <button
            type="button"
            className="mt-2 text-xs text-danger hover:underline"
            onClick={() => set(questions.filter((x) => x.id !== q.id))}
          >
            {t("studio.editor.removeQuestion")}
          </button>
        </div>
      ))}
      <Button
        variant="ghost"
        onClick={() =>
          set([
            ...questions,
            { id: uid(), prompt: { [lang]: "" }, options: [{ id: uid(), text: { [lang]: "" } }] },
          ])
        }
      >
        {t("studio.editor.addQuestion")}
      </Button>
    </div>
  );
}

// --- Herramienta embebida / Blockly ---------------------------------

const INTERACTIVE_PROVIDERS = [
  "falstad",
  "wokwi",
  "tinkercad",
  "viewstl",
  "geogebra",
] as const;

export function EmbedInteractiveEditor({
  config,
  onChange,
  withProvider = true,
}: {
  config: Cfg;
  onChange: (c: Cfg) => void;
  withProvider?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <>
      {withProvider ? (
        <Field label={t("studio.field.embedProvider")}>
          <Select
            value={(config.provider as string) ?? ""}
            onChange={(e) => onChange({ ...config, provider: e.target.value })}
          >
            <option value="">—</option>
            {INTERACTIVE_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label={t("studio.field.embedSrc")} hint={t("studio.editor.iframeSrcHint")}>
        <TextInput
          value={(config.src as string) ?? ""}
          placeholder="https://…"
          onChange={(e) => onChange({ ...config, src: e.target.value })}
        />
      </Field>
    </>
  );
}

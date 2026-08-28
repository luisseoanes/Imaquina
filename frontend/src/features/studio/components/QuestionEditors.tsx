/** Editores de la `config` de los tipos de pregunta estructurados
 *  (ordering / matching / cloze) y de la rúbrica de las abiertas.
 *
 *  El texto se guarda por idioma dentro de `config` (`{ es, en }`), igual que
 *  los bloques interactivos. Cada editor recibe la config actual y devuelve la
 *  nueva completa; el guardado lo hace quien lo usa.
 */
import { useTranslation } from "react-i18next";

import { Button, Field, TextInput } from "@/shared/ui/panel";
import type { RubricCriterion } from "../types";

type Cfg = Record<string, unknown>;
type LangText = Record<string, string>;
const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? String(Math.random())).slice(0, 8);
const setL = (m: LangText | undefined, l: string, v: string): LangText => ({
  ...(m ?? {}),
  [l]: v,
});

interface Item {
  id: string;
  text?: LangText;
}

function ItemList({
  items,
  lang,
  onChange,
  label,
}: {
  items: Item[];
  lang: string;
  onChange: (next: Item[]) => void;
  label: string;
}) {
  const { t } = useTranslation();
  return (
    <Field label={label}>
      <div className="space-y-1.5">
        {items.map((it) => (
          <div key={it.id} className="flex gap-2">
            <TextInput
              value={it.text?.[lang] ?? ""}
              onChange={(e) =>
                onChange(
                  items.map((x) =>
                    x.id === it.id
                      ? { ...x, text: setL(x.text, lang, e.target.value) }
                      : x,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-danger"
              aria-label={t("studio.action.delete")}
              onClick={() => onChange(items.filter((x) => x.id !== it.id))}
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => onChange([...items, { id: uid(), text: { [lang]: "" } }])}
        >
          {t("studio.editor.addItem")}
        </Button>
      </div>
    </Field>
  );
}

export function QuestionConfigEditor({
  kind,
  config,
  lang,
  onChange,
}: {
  kind: string;
  config: Cfg;
  lang: string;
  onChange: (c: Cfg) => void;
}) {
  const { t } = useTranslation();

  if (kind === "ordering") {
    const items = (config.items as Item[]) ?? [];
    return (
      <div className="mt-2">
        <p className="mb-1 text-xs text-content-subtle">
          {t("studio.assessments.orderingHint")}
        </p>
        <ItemList
          items={items}
          lang={lang}
          onChange={(next) => onChange({ ...config, items: next })}
          label={t("studio.assessments.orderingItems")}
        />
      </div>
    );
  }

  if (kind === "matching") {
    const left = (config.left as Item[]) ?? [];
    const right = (config.right as Item[]) ?? [];
    const pairs = (config.pairs as [string, string][]) ?? [];
    return (
      <div className="mt-2 space-y-2">
        <ItemList
          items={left}
          lang={lang}
          onChange={(next) => onChange({ ...config, left: next })}
          label={t("studio.assessments.matchLeft")}
        />
        <ItemList
          items={right}
          lang={lang}
          onChange={(next) => onChange({ ...config, right: next })}
          label={t("studio.assessments.matchRight")}
        />
        <Field label={t("studio.assessments.matchPairs")}>
          <div className="space-y-1.5">
            {left.map((l) => {
              const pair = pairs.find((p) => p[0] === l.id);
              return (
                <div key={l.id} className="flex items-center gap-2 text-sm">
                  <span className="min-w-24 flex-1 truncate">
                    {l.text?.[lang] ?? l.id}
                  </span>
                  <select
                    value={pair?.[1] ?? ""}
                    onChange={(e) => {
                      const rest = pairs.filter((p) => p[0] !== l.id);
                      onChange({
                        ...config,
                        pairs: e.target.value
                          ? [...rest, [l.id, e.target.value]]
                          : rest,
                      });
                    }}
                    className="flex-1 rounded-control border border-line bg-canvas px-2 py-1"
                  >
                    <option value="">—</option>
                    {right.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.text?.[lang] ?? r.id}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </Field>
      </div>
    );
  }

  // cloze
  const blanks = (config.blanks as { id: string; answers: string[] }[]) ?? [];
  const text = (config.text as LangText | undefined)?.[lang] ?? "";
  return (
    <div className="mt-2 space-y-2">
      <Field label={t("studio.assessments.clozeText")} hint={t("studio.assessments.clozeHint")}>
        <TextInput
          value={text}
          onChange={(e) =>
            onChange({
              ...config,
              text: setL(config.text as LangText | undefined, lang, e.target.value),
            })
          }
        />
      </Field>
      <Field label={t("studio.assessments.clozeBlanks")}>
        <div className="space-y-1.5">
          {blanks.map((b) => (
            <div key={b.id} className="flex gap-2">
              <span className="rounded bg-surface-muted px-2 py-1 text-xs">
                {`{{${b.id}}}`}
              </span>
              <TextInput
                value={(b.answers ?? []).join(" | ")}
                placeholder={t("studio.assessments.clozeAnswers")}
                onChange={(e) =>
                  onChange({
                    ...config,
                    blanks: blanks.map((x) =>
                      x.id === b.id
                        ? {
                            ...x,
                            answers: e.target.value
                              .split("|")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          }
                        : x,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="text-danger"
                onClick={() =>
                  onChange({ ...config, blanks: blanks.filter((x) => x.id !== b.id) })
                }
              >
                ✕
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() =>
              onChange({
                ...config,
                blanks: [...blanks, { id: String(blanks.length), answers: [] }],
              })
            }
          >
            {t("studio.assessments.addBlank")}
          </Button>
        </div>
      </Field>
    </div>
  );
}

export function RubricEditor({
  criteria,
  onSave,
}: {
  criteria: RubricCriterion[];
  onSave: (criteria: RubricCriterion[]) => void;
}) {
  const { t } = useTranslation();
  const set = (next: RubricCriterion[]) => onSave(next);

  return (
    <div className="mt-3 rounded-control border border-line p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-content-subtle">
        {t("studio.assessments.rubric")}
      </p>
      <div className="space-y-2">
        {criteria.map((c, i) => (
          <div key={c.id ?? i} className="flex items-center gap-2">
            <TextInput
              value={c.title}
              placeholder={t("studio.assessments.criterionTitle")}
              onChange={(e) =>
                set(
                  criteria.map((x, j) =>
                    j === i ? { ...x, title: e.target.value } : x,
                  ),
                )
              }
            />
            <TextInput
              type="number"
              className="w-20"
              value={String(c.max_points)}
              onChange={(e) =>
                set(
                  criteria.map((x, j) =>
                    j === i ? { ...x, max_points: Number(e.target.value) || 0 } : x,
                  ),
                )
              }
            />
            <button
              type="button"
              className="text-danger"
              onClick={() => set(criteria.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => set([...criteria, { title: "", max_points: 1, levels: [] }])}
        >
          {t("studio.assessments.addCriterion")}
        </Button>
      </div>
    </div>
  );
}

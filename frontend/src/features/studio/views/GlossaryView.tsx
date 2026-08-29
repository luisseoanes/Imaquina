import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useGlossary, useGlossaryMutations } from "../api";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  QueryState,
  Select,
  TextInput,
} from "@/shared/ui/panel";

export function GlossaryView() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useGlossary();
  const m = useGlossaryMutations();

  const [src, setSrc] = useState("");
  const [tgt, setTgt] = useState("");
  const [note, setNote] = useState("");
  const [pair, setPair] = useState("es-en");

  const add = () => {
    if (!src.trim() || !tgt.trim()) return;
    const [source_lang, target_lang] = pair.split("-");
    m.create.mutate({
      source_lang,
      target_lang,
      term_source: src.trim(),
      term_target: tgt.trim(),
      note: note.trim() || null,
    });
    setSrc("");
    setTgt("");
    setNote("");
  };

  return (
    <div>
      <PageHeader
        title={t("studio.nav.glossary")}
        description={t("studio.glossary.subtitle")}
      />

      <Card className="mb-5">
        <div className="grid gap-2 sm:grid-cols-[auto_1fr_1fr_1fr_auto] sm:items-end">
          <Select value={pair} onChange={(e) => setPair(e.target.value)}>
            <option value="es-en">ES → EN</option>
            <option value="en-es">EN → ES</option>
          </Select>
          <TextInput
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            placeholder={t("studio.glossary.source")}
          />
          <TextInput
            value={tgt}
            onChange={(e) => setTgt(e.target.value)}
            placeholder={t("studio.glossary.target")}
          />
          <TextInput
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("studio.glossary.note")}
          />
          <Button onClick={add} disabled={m.create.isPending}>
            {t("studio.glossary.add")}
          </Button>
        </div>
        {m.create.error instanceof Error ? (
          <p className="mt-2 text-sm text-danger">{m.create.error.message}</p>
        ) : null}
      </Card>

      <QueryState isLoading={isLoading} error={error}>
        {(data ?? []).length === 0 ? (
          <EmptyState message={t("studio.glossary.empty")} />
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <tbody className="divide-y divide-line">
                {(data ?? []).map((term) => (
                  <tr key={term.id}>
                    <td className="px-4 py-2 text-xs uppercase text-content-subtle">
                      {term.source_lang}→{term.target_lang}
                    </td>
                    <td className="px-4 py-2 font-medium text-content">
                      {term.term_source}
                    </td>
                    <td className="px-4 py-2 text-content">{term.term_target}</td>
                    <td className="px-4 py-2 text-content-muted">
                      {term.note ?? ""}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        className="text-danger"
                        onClick={() => m.remove.mutate(term.id)}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </QueryState>
    </div>
  );
}

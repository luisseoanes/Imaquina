import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import ChatPanel from "@/features/chat/ChatPanel";
import AssessmentForm from "@/features/assessment/AssessmentForm";
import { useAuth } from "@/features/auth/useAuth";
import { http } from "@/lib/http";
import { useLang } from "@/lib/useLang";
import { RichTextView } from "@/lib/richText";

export interface Block {
  id: string;
  kind: "text" | "image" | "audio" | "video" | "embed";
  body: string | null;
  caption: string | null;
  alt_text: string | null;
  media_asset_id: string | null;
}

export interface MomentData {
  id: string;
  type: string;
  title: string;
  blocks: Block[];
  chatbot_opening_prompt: string | null;
  /** Sólo llega si el backend decidió que el rol es staff (R4). */
  teacher_note?: string | null;
}

export default function MomentPage() {
  const { projectId = "", momentType } = useParams();
  const { t } = useTranslation();
  const { session, isStaff } = useAuth();
  const [showGuide, setShowGuide] = useState(false);
  const qc = useQueryClient();

  const lang = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["moment", projectId, momentType, lang],
    queryFn: () =>
      http<MomentData>({
        url: `/learn/projects/${projectId}/moments/${momentType}`,
        params: { lang },
      }),
  });

  // N5/N9: solo el estudiante marca progreso -- el docente no "completa"
  // momentos, los revisa.
  const completar = useMutation({
    mutationFn: () =>
      http<void>({
        url: `/learn/projects/${projectId}/moments/${momentType}/complete`,
        method: "POST",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress", projectId] });
    },
  });

  if (isLoading) return <p className="p-6">{t("common.loading")}</p>;
  if (!data) return null;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <Link
        to={`/projects/${projectId}`}
        className="text-sm text-content-subtle hover:underline"
      >
        ← {t("projects.backToProject")}
      </Link>

      <h1 className="mt-2 text-xl font-bold sm:text-2xl">{data.title}</h1>

      {/* R4: el boton del docente. `teacher_note` sólo viene si el backend
          decidio mandarlo — aqui no ocultamos nada, simplemente no llega. */}
      {isStaff && data.teacher_note && (
        <section className="my-4 rounded border border-note-line bg-note p-3">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="text-sm font-medium text-note-content"
          >
            {t("teacher.showGuide")}
          </button>
          {showGuide && (
            <p className="mt-2 whitespace-pre-wrap text-sm">{data.teacher_note}</p>
          )}
        </section>
      )}

      <article className="mt-6">
        {data.blocks.map((b) => (
          <BlockView key={b.id} block={b} />
        ))}
      </article>

      {session?.role === "student" && (
        <button
          onClick={() => completar.mutate()}
          disabled={completar.isPending || completar.isSuccess}
          className="mt-6 rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:bg-surface-muted disabled:text-content-muted disabled:cursor-not-allowed"
        >
          {completar.isSuccess ? t("projects.completed") : t("projects.markComplete")}
        </button>
      )}

      {/* Momento 6, R10: formulario de evaluación en vez de chatbot (R8 lo
          reserva a los momentos 1-5). */}
      {data.type === "assess" && session?.role === "student" ? (
        <AssessmentForm momentId={data.id} />
      ) : (
        data.type !== "assess" && (
          <ChatPanel momentId={data.id} openingPrompt={data.chatbot_opening_prompt} />
        )
      )}
    </main>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "text":
      return <RichTextView html={block.body ?? ""} />;
    case "image":
      return (
        <figure>
          <img src={block.body ?? ""} alt={block.alt_text ?? ""} className="max-w-full" />
          {block.caption && <figcaption>{block.caption}</figcaption>}
        </figure>
      );
    case "audio":
      return <audio controls src={block.body ?? ""} className="w-full" />;
    case "video":
    case "embed":
      return (
        <div className="aspect-video">
          <iframe
            src={block.body ?? ""}
            title={block.caption ?? "video"}
            allowFullScreen
            className="h-full w-full rounded"
          />
        </div>
      );
    default:
      return null;
  }
}

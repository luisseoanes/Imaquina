import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import ChatPanel from "@/features/chat/ChatPanel";
import { useAuth } from "@/features/auth/useAuth";
import { http } from "@/lib/http";

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
  const { projectId, momentType } = useParams();
  const { t } = useTranslation();
  const { isStaff } = useAuth();
  const [showGuide, setShowGuide] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["moment", projectId, momentType],
    queryFn: () =>
      http<MomentData>({ url: `/learn/projects/${projectId}/moments/${momentType}` }),
  });

  if (isLoading) return <p className="p-6">{t("common.loading")}</p>;
  if (!data) return null;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <h1 className="text-xl font-bold sm:text-2xl">{data.title}</h1>

      {/* R4: el boton del docente. `teacher_note` sólo viene si el backend
          decidio mandarlo — aqui no ocultamos nada, simplemente no llega. */}
      {isStaff && data.teacher_note && (
        <section className="my-4 rounded border border-amber-300 bg-amber-50 p-3">
          <button
            onClick={() => setShowGuide((v) => !v)}
            className="text-sm font-medium text-amber-900"
          >
            {t("teacher.showGuide")}
          </button>
          {showGuide && (
            <p className="mt-2 whitespace-pre-wrap text-sm">{data.teacher_note}</p>
          )}
        </section>
      )}

      <article className="prose mt-6 max-w-none">
        {data.blocks.map((b) => (
          <BlockView key={b.id} block={b} />
        ))}
      </article>

      {/* El chatbot acompaña los momentos 1–5, no la evaluación (R8). */}
      {data.type !== "assess" && (
        <ChatPanel momentId={data.id} openingPrompt={data.chatbot_opening_prompt} />
      )}
    </main>
  );
}

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "text":
      return <p className="whitespace-pre-wrap">{block.body}</p>;
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

/** Render de los bloques de contenido de un momento.
 *
 *  El bloque llega del snapshot publicado. Para imagen, audio y vídeo el
 *  backend resuelve `media_asset_id → url` al servir (`learning.resolver_media`);
 *  si el bloque no referencia un asset de la librería, el editor guarda la
 *  dirección a mano en `body`, así que ése es el recurso alternativo.
 *
 *  El texto enriquecido pasa por `RichText`, que reconstruye el HTML contra una
 *  lista blanca: NUNCA `dangerouslySetInnerHTML`. Es contenido que edita el
 *  cliente y lo consumen menores.
 */
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { RichText } from "@/shared/ui/RichText";
import {
  ChecklistBlock,
  EmbedInteractiveBlock,
  InlineQuizBlock,
  VideoChaptersBlock,
} from "@/shared/ui/InteractiveBlocks";
import { Icon } from "@/shared/ui/panel-icons";

export type BlockKind =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "embed"
  | "checklist"
  | "video_chapters"
  | "inline_quiz"
  | "blockly"
  | "embed_interactive";

/** Bloque tal y como lo sirve el camino de lectura (`learning`) y como lo
 *  devuelve la previsualización del Studio. `url`/`mime_type` los resuelve el
 *  backend a partir de `media_asset_id`. */
export interface Block {
  id: string;
  kind: BlockKind;
  order: number;
  media_asset_id?: string | null;
  config?: Record<string, unknown>;
  /** Estado del alumno en un bloque interactivo (sólo el camino de lectura). */
  interaction?: Record<string, unknown> | null;
  body: string | null;
  caption: string | null;
  alt_text: string | null;
  url?: string | null;
  mime_type?: string | null;
  duration_seconds?: number | null;
}

const KINDS_INTERACTIVOS = new Set([
  "checklist",
  "video_chapters",
  "inline_quiz",
  "blockly",
  "embed_interactive",
]);

/** Mismo criterio que `RichText`: http(s) o una ruta del propio origen. Lo que
 *  se descarta es el esquema ejecutable — un `javascript:` guardado en el CMS
 *  no puede convertirse en un clic.
 *
 *  La ruta relativa NO es un caso raro: `settings.media_url` compone la URL con
 *  `S3_PUBLIC_URL`, y con esa variable vacía (el `.env` de desarrollo lo está)
 *  devuelve `/bucket/clave`. Exigir `https://` dejaba toda la media en blanco
 *  en local sin ningún aviso. */
function esUrlServible(url: string | null | undefined): url is string {
  return !!url && /^(https?:\/\/|\/)/i.test(url);
}

/** El vídeo del MVP es YouTube embebido (decisión del cliente, 18/08/2026).
 *  Se normaliza a la forma `/embed/`; cualquier otro dominio no se mete en un
 *  iframe —sería ejecutar HTML de terceros en la sesión del estudiante— y se
 *  ofrece como enlace. */
function idDeYoutube(url: string): string | null {
  const m =
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/i.exec(url);
  if (m?.[1]) return m[1];
  // El editor puede guardar el id pelado en `config.src`.
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}

function Figura({ block, children }: { block: Block; children: ReactNode }) {
  return (
    <figure className="space-y-2">
      {children}
      {block.caption ? (
        <figcaption className="text-xs text-content-muted">{block.caption}</figcaption>
      ) : null}
    </figure>
  );
}

function SinRecurso({ kind }: { kind: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-muted p-5 text-sm text-content-muted">
      <Icon name="image" className="h-5 w-5 flex-shrink-0 text-content-subtle" />
      <span>{t("student.moment.missingMedia", { kind })}</span>
    </div>
  );
}

function BlockView({
  block,
  lang,
  onSaveInteraction,
}: {
  block: Block;
  lang: string;
  onSaveInteraction?: (blockId: string, state: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  // Un embed puede traer su fuente en `config` (proveedor + src, el camino del
  // editor nuevo). Para el resto: el asset de la librería manda y `body` es la
  // dirección escrita a mano.
  const configSrc =
    (block.kind === "embed" || block.kind === "video_chapters") &&
    typeof block.config?.src === "string"
      ? (block.config.src as string)
      : null;
  const src = configSrc
    ? configSrc
    : esUrlServible(block.url)
      ? block.url
      : esUrlServible(block.body)
        ? block.body
        : null;

  if (block.kind === "text") {
    return block.body ? (
      <RichText html={block.body} className="text-[0.95rem] text-content" />
    ) : null;
  }

  if (KINDS_INTERACTIVOS.has(block.kind)) {
    const config = block.config ?? {};
    const onSave = onSaveInteraction
      ? (state: Record<string, unknown>) => onSaveInteraction(block.id, state)
      : undefined;
    const common = { config, lang, interaction: block.interaction, onSave };
    return (
      <Figura block={block}>
        {block.kind === "checklist" ? (
          <ChecklistBlock {...common} />
        ) : block.kind === "inline_quiz" ? (
          <InlineQuizBlock {...common} />
        ) : block.kind === "video_chapters" ? (
          <VideoChaptersBlock {...common} src={src} />
        ) : (
          <EmbedInteractiveBlock {...common} />
        )}
      </Figura>
    );
  }

  if (!src) return <SinRecurso kind={t(`studio.blockKind.${block.kind}`, block.kind)} />;

  if (block.kind === "image") {
    return (
      <Figura block={block}>
        <img
          src={src}
          alt={block.alt_text ?? ""}
          loading="lazy"
          className="w-full rounded-2xl border border-line/60 bg-surface-muted object-cover"
        />
      </Figura>
    );
  }

  if (block.kind === "audio") {
    return (
      <Figura block={block}>
        <audio src={src} controls className="w-full">
          {block.alt_text}
        </audio>
      </Figura>
    );
  }

  if (block.kind === "video") {
    return (
      <Figura block={block}>
        <video
          src={src}
          controls
          preload="metadata"
          className="w-full rounded-2xl border border-line/60 bg-content"
        >
          {block.alt_text}
        </video>
      </Figura>
    );
  }

  // embed
  const yt = idDeYoutube(src);
  if (!yt) {
    return (
      <Figura block={block}>
        <a
          href={src}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-2 rounded-control bg-surface-muted px-4 py-2.5 text-sm font-semibold text-brand-ink hover:bg-line"
        >
          <Icon name="arrow-right" className="h-4 w-4" />
          {block.caption ?? t("student.moment.openResource")}
        </a>
      </Figura>
    );
  }
  return (
    <Figura block={block}>
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-line/60 bg-content">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${yt}`}
          title={block.alt_text ?? block.caption ?? t("student.moment.video")}
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full"
        />
      </div>
    </Figura>
  );
}

export function MomentBlocks({
  blocks,
  lang = "es",
  onSaveInteraction,
}: {
  blocks: Block[];
  lang?: string;
  onSaveInteraction?: (blockId: string, state: Record<string, unknown>) => void;
}) {
  const ordenados = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-5">
      {ordenados.map((b) => (
        <BlockView
          key={b.id}
          block={b}
          lang={lang}
          onSaveInteraction={onSaveInteraction}
        />
      ))}
    </div>
  );
}

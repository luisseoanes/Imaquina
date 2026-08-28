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
import { Icon } from "@/shared/ui/panel-icons";
import type { Block } from "../api";

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
  return m?.[1] ?? null;
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

function BlockView({ block }: { block: Block }) {
  const { t } = useTranslation();
  // El asset de la librería manda; `body` es la dirección escrita a mano.
  const src = esUrlServible(block.url)
    ? block.url
    : esUrlServible(block.body)
      ? block.body
      : null;

  if (block.kind === "text") {
    return block.body ? (
      <RichText html={block.body} className="text-[0.95rem] text-content" />
    ) : null;
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

export function MomentBlocks({ blocks }: { blocks: Block[] }) {
  const ordenados = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div className="space-y-5">
      {ordenados.map((b) => (
        <BlockView key={b.id} block={b} />
      ))}
    </div>
  );
}

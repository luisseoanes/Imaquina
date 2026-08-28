import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { MOMENT_ORDER } from "@/shared/config/roles";
import { routes } from "@/shared/config/routes";
import { Card, PageHeader, QueryState } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { RichText } from "@/shared/ui/RichText";
import { usePublishedProject } from "../api";
import type { TeacherBlock } from "../api";
import { useTeacher } from "../TeacherContext";

export function ContentProjectView() {
  const { t } = useTranslation();
  const { projectId = "" } = useParams();
  const { lang } = useTeacher();
  const { data, isLoading, error } = usePublishedProject(projectId, lang, {
    enabled: !!projectId,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to={routes.teacherContent}
        className="mb-3 inline-block text-sm text-content-muted hover:text-content"
      >
        ← {t("teacher.nav.content")}
      </Link>
      <QueryState isLoading={isLoading} error={error}>
        {data ? (
          <>
            <PageHeader
              title={data.title}
              description={`${t("teacher.courses.grade", { grade: data.grade })}${
                data.kit ? ` · ${data.kit}` : ""
              }`}
            />
            <div className="space-y-3">
              {MOMENT_ORDER.map((type) => {
                const m = data.moments.find((x) => x.type === type);
                if (!m) return null;
                return (
                  <MomentPanel
                    key={m.id}
                    type={type}
                    title={m.title}
                    teacherNote={m.teacher_note}
                    openingPrompt={m.chatbot_opening_prompt}
                    blocks={m.blocks}
                  />
                );
              })}
            </div>
          </>
        ) : null}
      </QueryState>
    </div>
  );
}

function MomentPanel({
  type,
  title,
  teacherNote,
  openingPrompt,
  blocks,
}: {
  type: string;
  title: string | null;
  teacherNote: string | null;
  openingPrompt: string | null;
  blocks: TeacherBlock[];
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div>
          <p className="text-xs uppercase tracking-wide text-content-subtle">
            {t(`studio.moment.${type}`, type)}
          </p>
          <p className="font-display font-bold text-content">
            {title ?? t(`studio.moment.${type}`, type)}
          </p>
        </div>
        <Icon
          name="chevron-right"
          className={`h-4 w-4 text-content-subtle transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line/60 p-4">
          {teacherNote ? (
            <div className="rounded-xl bg-brand-soft p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-ink">
                <Icon name="star" className="h-3.5 w-3.5" />
                {t("teacher.content.teacherGuide")}
              </p>
              <RichText html={teacherNote} className="text-sm text-content" />
            </div>
          ) : null}

          {openingPrompt ? (
            <p className="text-sm text-content-muted">
              <span className="text-content-subtle">
                {t("teacher.content.openingPrompt")}:{" "}
              </span>
              {openingPrompt}
            </p>
          ) : null}

          {blocks.length === 0 ? (
            <p className="text-sm text-content-subtle">{t("teacher.content.noBlocks")}</p>
          ) : (
            blocks
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((b) => <BlockView key={b.id} block={b} />)
          )}
        </div>
      ) : null}
    </Card>
  );
}

function BlockView({ block }: { block: TeacherBlock }) {
  const { t } = useTranslation();
  if (block.kind === "text") {
    return block.body ? (
      <RichText html={block.body} className="text-sm text-content" />
    ) : null;
  }
  return (
    <div className="rounded-xl border border-line/60 p-3 text-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-content-subtle">
        {t(`studio.blockKind.${block.kind}`, block.kind)}
      </p>
      {block.body ? (
        <a
          href={/^https?:/i.test(block.body) ? block.body : undefined}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1 block break-all text-brand-ink underline"
        >
          {block.body}
        </a>
      ) : null}
      {block.caption ? (
        <p className="mt-1 text-content-muted">{block.caption}</p>
      ) : null}
    </div>
  );
}

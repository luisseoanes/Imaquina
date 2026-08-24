import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "@/lib/http";
import {
  useDeleteProject,
  useDuplicateProject,
  usePublishProject,
  useStudioProject,
  useTranslationStatus,
  useUnpublishProject,
  useValidateProject,
  type Lang,
} from "./api";

function BarraDeAcciones({ projectId, status }: { projectId: string; status: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const validar = useValidateProject();
  const publicar = usePublishProject();
  const despublicar = useUnpublishProject();
  const duplicar = useDuplicateProject();
  const borrar = useDeleteProject();
  const [problemas, setProblemas] = useState<string[] | null>(null);

  const onPublish = async () => {
    const { problems } = await validar.mutateAsync(projectId);
    if (problems.length > 0) {
      setProblemas(problems);
      return;
    }
    setProblemas(null);
    publicar.mutate(projectId);
  };

  const onDuplicate = () => {
    const slug = window.prompt(t("studio.duplicateSlug"));
    if (!slug) return;
    duplicar.mutate(
      { id: projectId, slug },
      { onSuccess: (nuevo) => navigate(`../${nuevo.id}`, { relative: "path" }) },
    );
  };

  const onDelete = () => {
    if (!window.confirm(t("studio.deleteConfirm"))) return;
    borrar.mutate(projectId, { onSuccess: () => navigate("..", { relative: "path" }) });
  };

  const onUnpublish = () => {
    if (!window.confirm(t("studio.unpublishConfirm"))) return;
    despublicar.mutate(projectId);
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {status === "published" ? (
          <button
            type="button"
            onClick={onUnpublish}
            disabled={despublicar.isPending}
            className="rounded border px-3 py-1.5 text-sm"
          >
            {t("studio.unpublish")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={validar.isPending || publicar.isPending}
            className="rounded bg-brand px-3 py-1.5 text-sm text-brand-content"
          >
            {publicar.isPending ? t("studio.publishing") : t("studio.publishNow")}
          </button>
        )}
        <button type="button" onClick={onDuplicate} className="rounded border px-3 py-1.5 text-sm">
          {t("studio.duplicate")}
        </button>
        {status !== "published" && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded border border-danger px-3 py-1.5 text-sm text-danger"
          >
            {t("studio.deleteProject")}
          </button>
        )}
      </div>

      {problemas && problemas.length > 0 && (
        <div className="mt-2 rounded border border-danger bg-note p-2 text-sm">
          <p className="font-medium">{t("studio.publishBlocked")}</p>
          <ul className="ml-4 list-disc">
            {problemas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {(duplicar.error instanceof ApiError || borrar.error instanceof ApiError) && (
        <p className="mt-2 text-sm text-danger">
          {(duplicar.error as ApiError | undefined)?.message ??
            (borrar.error as ApiError | undefined)?.message}
        </p>
      )}
    </div>
  );
}

function EstadoDeTraduccion({ projectId }: { projectId: string }) {
  const { data } = useTranslationStatus(projectId);
  if (!data) return null;
  return (
    <div className="mb-4 flex gap-3 text-xs">
      {data.map((estado) => (
        <span
          key={estado.lang}
          className={`rounded px-2 py-0.5 uppercase ${
            estado.complete
              ? "bg-success text-success-content"
              : "bg-surface-muted text-content-muted"
          }`}
          title={estado.complete ? undefined : estado.missing.join("; ")}
        >
          {estado.lang}: {estado.complete ? "✓" : "…"}
        </span>
      ))}
    </div>
  );
}

/** Cabecera del proyecto, sus seis momentos y las acciones de autoría. */
export default function ProjectDetail({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const { projectId = "" } = useParams();
  const { data, isLoading } = useStudioProject(projectId, lang);

  if (isLoading) return <p>{t("common.loading")}</p>;
  if (!data) return null;

  return (
    <>
      <Link to=".." relative="path" className="text-sm text-content-subtle hover:underline">
        ← {t("studio.back")}
      </Link>

      <h2 className="mt-2 text-xl font-bold">{data.title ?? t("studio.untitled")}</h2>
      <p className="text-sm text-content-subtle">
        {data.slug} · {t("studio.grade")} {data.grade}
        {data.kit ? ` · ${data.kit}` : ""}
        {" · "}
        {data.status === "published" ? t("studio.published") : t("studio.draft")}
      </p>

      <EstadoDeTraduccion projectId={projectId} />
      <BarraDeAcciones projectId={projectId} status={data.status} />

      <h3 className="mt-6 mb-2 font-medium">{t("studio.moments")}</h3>
      <ol className="divide-y rounded border">
        {data.moments.map((m) => (
          <li key={m.id}>
            <Link
              to={`../${projectId}/moments/${m.id}`}
              relative="path"
              className="flex items-center gap-3 p-3 hover:bg-surface-muted"
            >
              <span className="w-6 text-sm text-content-subtle">{m.order + 1}</span>
              <span className="flex-1">
                {m.title ?? (
                  <span className="text-content-subtle">
                    {t(`moments.${m.type}`)} — {t("studio.untitled")}
                  </span>
                )}
              </span>
              <span className="text-sm text-content-subtle">
                {m.blocks} {t("studio.blocks")}
              </span>
              {m.langs.length > 0 && (
                <span className="text-xs uppercase text-content-subtle">
                  {m.langs.join(" · ")}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}

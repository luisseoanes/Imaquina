import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import type { Lang } from "./api";
import { useStudioProject } from "./api";

/** Cabecera del proyecto y sus seis momentos.
 *
 *  De momento sólo lectura: el editor de bloques es S13. Existe para que la
 *  ruta anidada del Studio tenga a dónde navegar y para ver que los momentos
 *  se crean con el proyecto (R7).
 */
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
      </p>

      <h3 className="mt-6 mb-2 font-medium">{t("studio.moments")}</h3>
      <ol className="divide-y rounded border">
        {data.moments.map((m) => (
          <li key={m.id} className="flex items-center gap-3 p-3">
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
          </li>
        ))}
      </ol>

      <p className="mt-4 text-sm text-content-subtle">{t("studio.editorPending")}</p>
    </>
  );
}

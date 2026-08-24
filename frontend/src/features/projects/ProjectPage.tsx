import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";
import { http } from "@/lib/http";

interface MomentResumen {
  id: string;
  type: string;
  order: number;
  title: string;
  blocks: unknown[];
}

interface ProjectData {
  id: string;
  title: string;
  summary: string | null;
  grade: string;
  kit: string | null;
  moments: MomentResumen[];
}

/** El proyecto y sus seis momentos: la pantalla desde la que se entra a cada
 *  uno. Faltaba, así que el listado enlazaba a una ruta inexistente y el
 *  comodín devolvía al usuario al principio.
 *
 *  Mobile-first: una columna, filas altas y de ancho completo — se usa desde
 *  el móvil en el aula de robótica, donde no hay un PC por estudiante. */
export default function ProjectPage() {
  const { projectId = "" } = useParams();
  const { t } = useTranslation();
  const { session } = useAuth();
  const esEstudiante = session?.role === "student";

  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => http<ProjectData>({ url: `/learn/projects/${projectId}` }),
  });

  // N5: progreso lineal, decidido. Solo aplica al estudiante -- el backend
  // ya lo exige de verdad (`learning._exigir_momento_desbloqueado`), esto es
  // para no mandarlo a un enlace que el servidor va a rechazar.
  const { data: progreso } = useQuery({
    queryKey: ["progress", projectId],
    queryFn: () => http<Record<string, string>>({ url: `/learn/projects/${projectId}/progress` }),
    enabled: esEstudiante,
  });

  if (isLoading) return <p className="p-4 sm:p-6">{t("common.loading")}</p>;
  if (!data) return null;

  const desbloqueado = (idx: number): boolean => {
    if (!esEstudiante || !progreso) return true;
    if (idx === 0) return true;
    return progreso[data.moments[idx - 1].type] === "completed";
  };

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <Link to="/" className="text-sm text-content-subtle hover:underline">
        ← {t("projects.back")}
      </Link>

      <h1 className="mt-2 text-xl font-bold sm:text-2xl">{data.title}</h1>
      <p className="text-sm text-content-muted">
        {t("projects.grade")} {data.grade}
        {data.kit ? ` · ${data.kit}` : ""}
      </p>
      {data.summary && <p className="mt-3 text-content-muted">{data.summary}</p>}

      <h2 className="mt-6 mb-2 font-medium">{t("projects.moments")}</h2>
      <ol className="divide-y divide-line overflow-hidden rounded border">
        {data.moments.map((m, idx) => {
          const vacio = m.blocks.length === 0;
          const completado = progreso?.[m.type] === "completed";
          const bloqueado = !vacio && !desbloqueado(idx);
          const contenido = (
            <>
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full
                           bg-surface-muted text-sm font-medium"
                aria-hidden
              >
                {completado ? "✓" : m.order + 1}
              </span>
              <span className="flex-1">
                <span className="block font-medium">{m.title}</span>
                {/* El nombre metodológico del momento (R7) sólo si aporta:
                    si el editor tituló "Introducción", repetirlo es ruido. */}
                {(vacio || bloqueado || t(`moments.${m.type}`) !== m.title) && (
                  <span className="block text-sm text-content-subtle">
                    {vacio
                      ? t("projects.momentEmpty")
                      : bloqueado
                        ? t("projects.momentLocked")
                        : t(`moments.${m.type}`)}
                  </span>
                )}
              </span>
            </>
          );

          // `min-h-14`: objetivo táctil cómodo en móvil, no una fila de tabla.
          return (
            <li key={m.id}>
              {vacio || bloqueado ? (
                <div className="flex min-h-14 items-center gap-3 p-3 text-content-subtle">
                  {contenido}
                </div>
              ) : (
                <Link
                  to={`/projects/${data.id}/moments/${m.type}`}
                  className="flex min-h-14 items-center gap-3 p-3 hover:bg-surface-muted"
                >
                  {contenido}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </main>
  );
}

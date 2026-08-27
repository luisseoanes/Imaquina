import { useQuery } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Compass,
  Hammer,
  Lightbulb,
  Lock,
  Rocket,
  Search,
  Share2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/features/auth/useAuth";
import { http } from "@/lib/http";
import { useLang } from "@/lib/useLang";

// Icono orientativo por tipo de momento (R7). No implica una asignación
// oficial a las 4 etapas de marca -- eso sigue abierto (ver docs/backlog.md).
const MOMENT_ICONS: Record<string, typeof Lightbulb> = {
  intro: Lightbulb,
  inquiry: Search,
  design: Compass,
  build: Hammer,
  communicate: Share2,
  assess: Rocket,
};

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

  const lang = useLang();
  const { data, isLoading } = useQuery({
    queryKey: ["project", projectId, lang],
    queryFn: () =>
      http<ProjectData>({ url: `/learn/projects/${projectId}`, params: { lang } }),
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
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-content-subtle hover:text-content"
      >
        <ChevronRight className="rotate-180" size={14} aria-hidden />
        {t("projects.back")}
      </Link>

      <h1 className="mt-2 font-display text-xl font-bold sm:text-2xl">{data.title}</h1>
      <p className="text-sm text-content-muted">
        {t("projects.grade")} {data.grade}
        {data.kit ? ` · ${data.kit}` : ""}
      </p>
      {data.summary && <p className="mt-3 text-content-muted">{data.summary}</p>}

      <h2 className="mt-6 mb-2 font-medium">{t("projects.moments")}</h2>
      <ol className="divide-y divide-line overflow-hidden rounded-2xl border border-line shadow-sm">
        {data.moments.map((m, idx) => {
          const vacio = m.blocks.length === 0;
          const completado = progreso?.[m.type] === "completed";
          const bloqueado = !vacio && !desbloqueado(idx);
          const Icon = MOMENT_ICONS[m.type] ?? Lightbulb;
          const contenido = (
            <>
              <span
                className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-medium ${
                  completado
                    ? "bg-success text-success-content"
                    : bloqueado
                      ? "bg-surface-muted text-content-subtle"
                      : "bg-brand/15 text-brand-ink"
                }`}
                aria-hidden
              >
                {completado ? (
                  <Check size={16} />
                ) : bloqueado ? (
                  <Lock size={14} />
                ) : (
                  <Icon size={16} />
                )}
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
              {!vacio && !bloqueado && (
                <ChevronRight
                  className="shrink-0 text-content-subtle"
                  size={18}
                  aria-hidden
                />
              )}
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
                  className="flex min-h-14 items-center gap-3 p-3 transition hover:bg-surface-muted"
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

/** Derivaciones sobre los datos del estudiante.
 *
 *  El backend no expone un "mis proyectos con progreso": el progreso se pide
 *  por proyecto (`GET /learn/projects/{id}/progress`). Se compone aquí con
 *  `useQueries` en vez de en cada pantalla, para que el cálculo de "cuánto
 *  llevo" y "cuál es mi siguiente momento" tenga UN solo criterio.
 *
 *  **Coste consciente**: son N+1 peticiones. Con los 2 proyectos del MVP y los
 *  pocos que tiene un grado es irrelevante; si un día un grado acumula muchos,
 *  la respuesta es un endpoint agregado en el backend, no paginar esto a
 *  escondidas. Por eso hay un tope explícito y visible (`TOPE_PROGRESO`).
 */
import { useQueries } from "@tanstack/react-query";

import httpClient from "@/shared/api/httpClient";
import { env } from "@/shared/config/env";
import { MOMENT_ORDER } from "@/shared/config/roles";
import type { Lang, MomentType } from "@/shared/config/roles";
import { keys, useProjects } from "./api";
import type { ProgressMap, ProgressState, ProjectCard } from "./api";

/** Cuántos proyectos se acompañan de su progreso en el panel. */
export const TOPE_PROGRESO = 12;

export interface ProjectWithProgress extends ProjectCard {
  progress: ProgressMap;
  /** Momentos completados de los seis. */
  completed: number;
  /** 0–100, redondeado. Es lo que pinta la barra. */
  percent: number;
  /** El primero sin completar: a donde lleva el botón "continuar". `null` si
   *  ya terminó el proyecto entero. */
  next: MomentType | null;
  state: "not_started" | "in_progress" | "completed";
}

export function resumirProgreso(progress: ProgressMap) {
  const completados = MOMENT_ORDER.filter((m) => progress[m] === "completed");
  const next = MOMENT_ORDER.find((m) => progress[m] !== "completed") ?? null;
  const completed = completados.length;
  return {
    completed,
    percent: Math.round((completed / MOMENT_ORDER.length) * 100),
    next,
    state:
      completed === 0
        ? ("not_started" as const)
        : completed === MOMENT_ORDER.length
          ? ("completed" as const)
          : ("in_progress" as const),
  };
}

/** Un momento está desbloqueado si es el primero o si el anterior está
 *  completado. Réplica exacta de `_exigir_momento_desbloqueado` del backend,
 *  que es quien manda: esto sólo decide qué se pinta con candado. */
export function estaDesbloqueado(type: MomentType, progress: ProgressMap): boolean {
  const i = MOMENT_ORDER.indexOf(type);
  const anterior = i > 0 ? MOMENT_ORDER[i - 1] : undefined;
  if (!anterior) return true;
  return progress[anterior] === "completed";
}

export function estadoDelMomento(
  type: MomentType,
  progress: ProgressMap,
): ProgressState | "locked" {
  const estado = progress[type] ?? "not_started";
  if (estado === "completed") return "completed";
  return estaDesbloqueado(type, progress) ? estado : "locked";
}

/** Los proyectos publicados del grado del estudiante, con su progreso. */
export function useProjectsWithProgress(lang: Lang, grade?: string | null) {
  const proyectos = useProjects(lang, grade);
  const lista = (proyectos.data ?? []).slice(0, TOPE_PROGRESO);

  const progresos = useQueries({
    queries: lista.map((p) => ({
      queryKey: keys.progress(p.id),
      queryFn: () =>
        httpClient<ProgressMap>(`${env.apiBaseUrl}/learn/projects/${p.id}/progress`),
    })),
  });

  const data: ProjectWithProgress[] = lista.map((p, i) => {
    const progress = progresos[i]?.data ?? {};
    return { ...p, progress, ...resumirProgreso(progress) };
  });

  return {
    data,
    // El progreso se pinta en cuanto llega; lo que bloquea la pantalla es el
    // listado. Un progreso a medio cargar se ve como 0%, no como error.
    isLoading: proyectos.isLoading,
    isFetchingProgress: progresos.some((q) => q.isLoading),
    error: proyectos.error,
    truncated: (proyectos.data ?? []).length > TOPE_PROGRESO,
  };
}

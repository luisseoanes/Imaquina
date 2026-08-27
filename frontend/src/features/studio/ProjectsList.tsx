import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { z } from "zod";

import { ApiError } from "@/lib/http";
import type { Lang } from "./api";
import { useCreateProject, useStudioProjects } from "./api";

/** El identificador va en la URL: minúsculas, sin acentos ni espacios. */
function aSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

const esquema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).max(120),
  grade: z.string().min(1).max(20),
  kit: z.string().optional(),
});

type Formulario = z.infer<typeof esquema>;

function NuevoProyecto({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const crear = useCreateProject(lang);
  const [slugTocado, setSlugTocado] = useState(false);

  // `mode: "onChange"` para poder usar `formState.isValid` en vez de `watch()`:
  // watch() no se puede memoizar y el linter lo marca.
  const { register, handleSubmit, setValue, reset, formState } = useForm<Formulario>({
    resolver: zodResolver(esquema),
    mode: "onChange",
    defaultValues: { title: "", slug: "", grade: "", kit: "" },
  });

  return (
    <form
      className="mb-8 grid gap-3 rounded border p-4 sm:grid-cols-5"
      onSubmit={handleSubmit((datos) =>
        crear.mutate(
          { ...datos, kit: datos.kit || null },
          { onSuccess: () => reset() },
        ),
      )}
    >
      <label className="sm:col-span-2">
        <span className="text-sm font-medium">{t("studio.projectTitle")}</span>
        <input
          {...register("title")}
          onChange={(e) => {
            setValue("title", e.target.value);
            // El slug sigue al título mientras nadie lo toque a mano.
            if (!slugTocado) setValue("slug", aSlug(e.target.value));
          }}
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
        />
      </label>

      <label className="sm:col-span-2">
        <span className="text-sm font-medium">{t("studio.slug")}</span>
        <input
          {...register("slug")}
          onChange={(e) => {
            setSlugTocado(true);
            setValue("slug", e.target.value);
          }}
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
        />
        <span className="text-xs text-content-subtle">{t("studio.slugHint")}</span>
      </label>

      <label>
        <span className="text-sm font-medium">{t("studio.grade")}</span>
        <input
          {...register("grade")}
          className="mt-1 w-full rounded border px-2 py-1 text-sm"
        />
      </label>

      <div className="sm:col-span-5">
        <button
          type="submit"
          disabled={crear.isPending || !formState.isValid}
          className="rounded bg-brand px-4 py-2 text-sm text-brand-content disabled:bg-surface-muted disabled:text-content-muted disabled:cursor-not-allowed"
        >
          {crear.isPending ? t("studio.creating") : t("studio.create")}
        </button>
        {/* El 409 del slug repetido es el error que de verdad ve el editor. */}
        {crear.error instanceof ApiError && (
          <span className="ml-3 text-sm text-danger">{crear.error.message}</span>
        )}
      </div>
    </form>
  );
}

export default function ProjectsList({ lang }: { lang: Lang }) {
  const { t } = useTranslation();
  const { data, isLoading } = useStudioProjects(lang);

  return (
    <>
      <NuevoProyecto lang={lang} />

      {isLoading && <p>{t("common.loading")}</p>}
      {data?.length === 0 && <p className="text-content-muted">{t("studio.noProjects")}</p>}

      <ul className="divide-y rounded border">
        {data?.map((p) => (
          <li key={p.id} className="flex items-center gap-3 p-3">
            <Link
              to={`projects/${p.id}`}
              className="flex-1 font-medium hover:underline"
            >
              {p.title ?? t("studio.untitled")}
            </Link>
            <span className="text-sm text-content-subtle">
              {t("studio.grade")} {p.grade}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs ${
                p.status === "published"
                  ? "bg-success text-success-content"
                  : "bg-surface-muted text-content-muted"
              }`}
            >
              {p.status === "published" ? t("studio.published") : t("studio.draft")}
            </span>
            <span className="text-xs uppercase text-content-subtle">
              {p.langs.join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

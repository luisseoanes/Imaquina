import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, Route, Routes } from "react-router-dom";

import type { Lang } from "./api";
import MomentEditor from "./MomentEditor";
import ProjectDetail from "./ProjectDetail";
import ProjectsList from "./ProjectsList";

const IDIOMAS: Lang[] = ["es", "en"];

/** Content Studio: el módulo con el que el cliente carga los 34 proyectos
 *  restantes. Va en bundle aparte (ver `manualChunks` en vite.config.ts): los
 *  estudiantes son el 95% del tráfico y no deben descargar el editor. */
export default function StudioPage() {
  const { t } = useTranslation();
  // El idioma de EDICIÓN, que no es el de la interfaz: se puede trabajar la
  // traducción al inglés con la UI en español.
  const [lang, setLang] = useState<Lang>("es");

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <header className="mb-6 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-2xl font-bold">
          <Link to=".">{t("studio.title")}</Link>
        </h1>
        <div className="ml-auto flex items-center gap-2">
          <span id="lang-edicion" className="text-sm text-content-subtle">
            {t("studio.editingLang")}
          </span>
          <nav
            className="flex gap-1 rounded-full border border-line p-1"
            aria-labelledby="lang-edicion"
          >
            {IDIOMAS.map((codigo) => (
              <button
                key={codigo}
                onClick={() => setLang(codigo)}
                aria-pressed={lang === codigo}
                className={`rounded-full px-3 py-1 text-sm uppercase transition ${
                  lang === codigo
                    ? "bg-brand text-brand-content"
                    : "text-content-subtle hover:text-content"
                }`}
              >
                {codigo}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <Routes>
        <Route index element={<ProjectsList lang={lang} />} />
        <Route path="projects/:projectId" element={<ProjectDetail lang={lang} />} />
        <Route
          path="projects/:projectId/moments/:momentId"
          element={<MomentEditor lang={lang} />}
        />
      </Routes>
    </main>
  );
}

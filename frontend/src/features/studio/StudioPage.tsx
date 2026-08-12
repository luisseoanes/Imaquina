import { useTranslation } from "react-i18next";

/** Content Studio: el módulo que el cliente usa para cargar los 34 proyectos
 *  restantes. Va en bundle aparte (ver vite.config.ts manualChunks). */
export default function StudioPage() {
  const { t } = useTranslation();
  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold">{t("studio.title")}</h1>
      <p className="mt-2 text-sm text-gray-600">
        Editor de proyectos, momentos y bloques. Pendiente: F2 del cronograma.
      </p>
    </main>
  );
}

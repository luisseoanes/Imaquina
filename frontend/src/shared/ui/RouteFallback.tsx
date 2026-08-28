import { useTranslation } from "react-i18next";

/** Lo que se ve mientras carga una ruta diferida. */
export function RouteFallback() {
  const { t } = useTranslation();
  return (
    <div role="status" aria-live="polite" className="p-6 text-content-muted">
      {t("common.loading")}
    </div>
  );
}

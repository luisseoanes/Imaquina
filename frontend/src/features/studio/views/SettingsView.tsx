import { useTranslation } from "react-i18next";

import { Card, PageHeader } from "@/shared/ui/panel";
import { useStudio } from "../StudioContext";
import { setLanguage } from "@/shared/i18n";
import { LANGS } from "@/shared/config/roles";
import { useAuth } from "@/shared/hooks/useAuth";

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { lang, setLang } = useStudio();

  return (
    <div className="max-w-xl">
      <PageHeader
        title={t("studio.nav.settings")}
        description={t("studio.settings.subtitle")}
      />

      <Card className="mb-4">
        <h2 className="mb-1 text-base font-semibold text-content">
          {t("studio.settings.account")}
        </h2>
        <p className="text-sm text-content-muted">
          {t("studio.settings.role")}: {session?.role}
        </p>
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 text-base font-semibold text-content">
          {t("studio.settings.uiLang")}
        </h2>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLanguage(l)}
              aria-pressed={i18n.language === l}
              className={`rounded-control px-3 py-2 text-sm font-medium ${
                i18n.language === l
                  ? "bg-brand text-brand-content"
                  : "bg-surface-muted text-content"
              }`}
            >
              {t(`studio.settings.lang.${l}`, l)}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-base font-semibold text-content">
          {t("studio.workingLang")}
        </h2>
        <p className="mb-3 text-sm text-content-muted">
          {t("studio.settings.workingLangHint")}
        </p>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded-control px-3 py-2 text-sm font-medium uppercase ${
                lang === l
                  ? "bg-brand text-brand-content"
                  : "bg-surface-muted text-content"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

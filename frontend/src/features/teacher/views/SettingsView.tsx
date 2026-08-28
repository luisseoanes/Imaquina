import { useTranslation } from "react-i18next";

import { LANGS } from "@/shared/config/roles";
import { setLanguage } from "@/shared/i18n";
import { useAuth } from "@/shared/hooks/useAuth";
import { useMe } from "@/shared/hooks/useMe";
import { Card, PageHeader } from "@/shared/ui/panel";
import { Icon } from "@/shared/ui/panel-icons";
import { useTeacher } from "../TeacherContext";

export function SettingsView() {
  const { t, i18n } = useTranslation();
  const { session } = useAuth();
  const { data: me } = useMe();
  const { lang, setLang } = useTeacher();

  const iniciales = (me?.full_name ?? "Docente")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title={t("teacher.nav.settings")} description={t("teacher.settings.subtitle")} />

      <Card className="mb-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft font-display text-lg font-extrabold text-brand-ink">
            {iniciales}
          </span>
          <div className="min-w-0">
            <p className="truncate font-display font-bold text-content">
              {me?.full_name ?? "—"}
            </p>
            <p className="truncate text-xs text-content-muted">
              {me?.email ?? session?.role}
            </p>
            <span className="mt-1 inline-flex items-center gap-1 rounded-pill bg-info-surface px-2 py-0.5 text-[0.7rem] font-semibold text-info">
              <Icon name="users" className="h-3 w-3" />
              {t("teacher.settings.roleLabel")}
            </span>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 font-display text-base font-bold text-content">
          {t("teacher.settings.language")}
        </h2>
        <p className="mb-3 text-sm text-content-muted">
          {t("teacher.settings.languageHint")}
        </p>
        <div className="flex gap-2">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLanguage(l);
                setLang(l);
              }}
              aria-pressed={i18n.language === l}
              className={`rounded-control px-3 py-2 text-sm font-semibold transition duration-150 ${
                i18n.language === l || lang === l
                  ? "bg-brand text-brand-content"
                  : "bg-surface-muted text-content"
              }`}
            >
              {t(`teacher.settings.lang.${l}`, l)}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

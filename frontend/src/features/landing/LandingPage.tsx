import { Lightbulb, Rocket, Search, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { buttonClasses } from "@/components/ui/Button";

// Clases estaticas (no interpoladas) para que Tailwind las detecte al
// escanear el contenido -- `bg-${token}/15` con `token` dinamico no lo haría.
const STAGES = [
  { key: "curiosear", icon: Lightbulb, badge: "bg-curiosear/15 text-curiosear" },
  { key: "descubrir", icon: Search, badge: "bg-descubrir/15 text-descubrir" },
  { key: "inventar", icon: Wrench, badge: "bg-inventar/15 text-inventar" },
  { key: "innovar", icon: Rocket, badge: "bg-innovar/15 text-innovar" },
] as const;

/** Página pública en "/" para visitantes sin sesión -- `App.tsx` la muestra
 *  solo cuando no hay sesión, un usuario ya logueado sigue viendo
 *  `ProjectsPage` como siempre. */
export default function LandingPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface">
      <div className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-b
                     from-brand/15 to-transparent"
          aria-hidden
        />
        <header className="relative mx-auto flex max-w-5xl items-center px-4 py-6 sm:px-6">
          <span className="font-display text-lg font-semibold">{t("app.name")}</span>
          <Link
            to="/login"
            className={`ml-auto ${buttonClasses("secondary", "sm")}`}
          >
            {t("auth.login")}
          </Link>
        </header>

        <main className="relative mx-auto max-w-3xl px-4 pt-10 pb-20 text-center sm:px-6 sm:pt-16">
          <p className="text-sm font-medium text-brand-ink">{t("landing.kicker")}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">
            {t("landing.title")}
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-content-muted sm:text-lg">
            {t("landing.subtitle")}
          </p>
          <Link to="/login" className={`mt-8 ${buttonClasses("primary", "md")}`}>
            {t("landing.cta")}
          </Link>
        </main>
      </div>

      <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
        <h2 className="mb-6 text-center font-display text-xl font-semibold sm:text-2xl">
          {t("landing.stagesTitle")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STAGES.map(({ key, icon: Icon, badge }) => (
            <div
              key={key}
              className="rounded-2xl border border-line bg-surface p-5 shadow-sm"
            >
              <span
                className={`inline-flex size-10 items-center justify-center rounded-full ${badge}`}
              >
                <Icon size={20} aria-hidden />
              </span>
              <h3 className="mt-3 font-display font-semibold">
                {t(`landing.stages.${key}.title`)}
              </h3>
              <p className="mt-1 text-sm text-content-muted">
                {t(`landing.stages.${key}.text`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-line px-4 py-6 text-center text-xs text-content-subtle">
        {t("landing.footer")}
      </footer>
    </div>
  );
}

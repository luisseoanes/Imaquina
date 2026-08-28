import { Trans, useTranslation } from "react-i18next";

import { PartnerLogos } from "./PartnerLogos";
import { RandomRobot } from "./RandomRobot";
import { SignInForm } from "./SignInForm";
import { useRandomRobot } from "./useRandomRobot";
import { BrandBackdrop } from "@/shared/ui/BrandBackdrop";
import { BrandLogo } from "@/shared/ui/BrandLogo";
import { LanguageSwitcher } from "@/shared/ui/LanguageSwitcher";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/** Pantalla de acceso.
 *
 *  Mobile-first de verdad: el móvil recibe SÓLO el logotipo y la tarjeta de
 *  acceso sobre el ambiente ámbar —sin ilustración: en una pantalla estrecha
 *  compite con el formulario en vez de acompañarlo—, y el panel de bienvenida
 *  a tamaño completo aparece a partir de `lg`. Al
 *  revés (diseñar el escritorio y encoger) el panel izquierdo acaba
 *  apilándose encima del formulario y empuja lo único que el usuario ha venido
 *  a hacer por debajo del pliegue.
 */
export function SignInPage() {
  const { t } = useTranslation();
  useDocumentTitle("auth.pageTitle");
  // Un robot distinto en cada carga. Sólo se pinta en el panel de escritorio:
  // en móvil no hay ilustración.
  const robot = useRandomRobot();

  return (
    <div className="relative min-h-svh overflow-hidden bg-canvas">
      <BrandBackdrop />

      <div className="relative z-10 mx-auto flex min-h-svh max-w-7xl flex-col px-5 py-8 sm:px-8 lg:py-12">
        <div className="flex flex-1 flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
          {/* Bienvenida. En móvil sólo queda el logotipo, arriba del todo:
              el resto es aire que empujaría el formulario hacia abajo. */}
          <section className="lg:flex-1 lg:self-start">
            <BrandLogo className="h-12 w-auto sm:h-14 lg:h-16" />

            <div className="hidden lg:block">
              <h1 className="mt-9 max-w-lg font-display text-5xl font-extrabold leading-[1.08] tracking-tight text-content">
                <Trans
                  i18nKey="auth.headline"
                  components={{ acento: <span className="text-brand-ink" /> }}
                />
              </h1>
              <p className="mt-5 max-w-md text-[1.2rem] font-[480] leading-relaxed text-content-muted">
                {t("auth.subheadline")}
              </p>

              {/* La ilustración va DEBAJO del texto, no flotando en una
                  esquina: así la columna se lee de arriba abajo en un solo
                  recorrido y el robot cierra el bloque en vez de competir. */}
              <RandomRobot
                src={robot}
                priority
                className="-mt-4 -ml-6 w-[26rem] xl:w-[30rem]"
              />
            </div>
          </section>

          {/* Acceso. Primero en el DOM después del logo, que es lo que el
              usuario viene a hacer. */}
          <section className="w-full lg:max-w-md lg:shrink-0">
            <div className="rounded-card border border-line/70 bg-surface p-6 shadow-float sm:p-8">
              <h2 className="font-display text-[1.8rem] font-bold text-content">
                {t("auth.signInTitle")}
              </h2>
              <p className="mt-1 text-[1.05rem] font-[480] text-content-muted">
                {t("auth.signInSubtitle")}
              </p>

              <div className="mt-7">
                <SignInForm />
              </div>
            </div>
          </section>
        </div>

        {/* Colaboradores: cierran la página por debajo de la tarjeta, que es
            donde el prototipo dejaba sitio. */}
        <PartnerLogos className="mt-14 lg:mt-16" />

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <LanguageSwitcher />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[1.05rem] font-[480] text-content-muted">
            <a href="#terminos" className="hover:text-content">{t("auth.terms")}</a>
            <a href="#contacto" className="hover:text-content">{t("auth.contact")}</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}

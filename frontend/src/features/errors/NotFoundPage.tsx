import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { RandomRobot } from "@/features/auth/RandomRobot";
import { useRandomRobot } from "@/features/auth/useRandomRobot";
import { BrandBackdrop } from "@/shared/ui/BrandBackdrop";
import { BrandLogo } from "@/shared/ui/BrandLogo";
import { routes } from "@/shared/config/routes";
import { useDocumentTitle } from "@/shared/hooks/useDocumentTitle";

/** Pantalla para una dirección que no existe.
 *
 *  Una página de error es un sitio para dar dirección, no para lamentarse: dice
 *  qué pasó, por qué pudo pasar y ofrece una salida concreta.
 *
 *  La salida es siempre el inicio de sesión, haya sesión o no: es la única
 *  pantalla construida y la puerta de entrada al producto.
 */
export function NotFoundPage() {
  const { t } = useTranslation();
  useDocumentTitle("notFound.pageTitle");
  const robot = useRandomRobot();

  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-canvas">
      <BrandBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-8 sm:px-8">
        <Link to={routes.login} className="inline-block self-start">
          <BrandLogo className="h-12 w-auto sm:h-14" />
        </Link>

        <div className="flex flex-1 flex-col items-center justify-center gap-10 py-12 lg:flex-row lg:gap-16">
          <div className="max-w-lg text-center lg:text-left">
            {/* El código va como etiqueta y no como titular: lo que necesita
                leer quien llega aquí es qué ha pasado, no un número. */}
            <p className="font-display text-[1.05rem] font-bold uppercase tracking-[0.2em] text-brand-ink">
              {t("notFound.code")}
            </p>

            <h1 className="mt-3 font-display text-4xl font-extrabold leading-tight tracking-tight text-content sm:text-5xl">
              {t("notFound.title")}
            </h1>

            <p className="mt-4 text-[1.2rem] font-[480] leading-relaxed text-content-muted">
              {t("notFound.body")}
            </p>

            <Link
              to={routes.login}
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-control
                         bg-brand px-5 py-3.5 text-[1.05rem] font-semibold text-brand-content
                         shadow-sm transition hover:bg-brand-strong active:scale-[0.99]"
            >
              {t("notFound.toSignIn")}
              <IconoFlecha />
            </Link>
          </div>

          {/* Sin ilustración en móvil, igual que en el acceso: en pantalla
              estrecha empuja el mensaje y la salida fuera de la vista. */}
          <RandomRobot src={robot} priority className="hidden w-80 shrink-0 lg:block xl:w-96" />
        </div>
      </div>
    </div>
  );
}

function IconoFlecha() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

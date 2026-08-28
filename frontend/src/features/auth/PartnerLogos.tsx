import { useTranslation } from "react-i18next";

import enjoyai from "@/assets/logos/enjoyai.webp";
import foodcashClaro from "@/assets/logos/foodcash-claro.svg";
import foodcashOscuro from "@/assets/logos/foodcash-oscuro.svg";
import ubbuClaro from "@/assets/logos/ubbu-claro.svg";
import ubbuOscuro from "@/assets/logos/ubbu-oscuro.png";
import whalesbot from "@/assets/logos/whalesbot.png";

/** Un colaborador. `oscuro` sólo lo llevan los que tienen versión para fondo
 *  oscuro; los de tono medio se ven bien en ambos y no la necesitan. */
interface Colaborador {
  nombre: string;
  url: string;
  claro: string;
  oscuro?: string;
}

const COLABORADORES: Colaborador[] = [
  { nombre: "ubbu", url: "https://ubbu.io/", claro: ubbuClaro, oscuro: ubbuOscuro },
  { nombre: "WhalesBot", url: "https://www.whalesbot.ai/", claro: whalesbot },
  { nombre: "EnjoyAI", url: "https://www.enjoyaiglobal.org/", claro: enjoyai },
  {
    nombre: "Foodcash",
    url: "https://www.foodcash.com.co/",
    claro: foodcashClaro,
    oscuro: foodcashOscuro,
  },
];

/** Logos de los colaboradores.
 *
 *  Los que tienen dos versiones cambian según el fondo: `-claro` va sobre
 *  fondo claro y `-oscuro` sobre fondo oscuro (el nombre dice el fondo, no el
 *  color del logo — `ubbu-oscuro` es casi blanco). Se resuelve con dos `<img>`
 *  y la variante `dark:`, no con JavaScript: así el logo correcto ya está en
 *  el HTML y no hay parpadeo al cargar.
 */
export function PartnerLogos({ className = "" }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="colaboradores" className={className}>
      <h2
        id="colaboradores"
        className="text-center text-[0.9rem] font-semibold uppercase tracking-[0.14em] text-content-subtle"
      >
        {t("auth.partners")}
      </h2>

      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-12">
        {COLABORADORES.map(({ nombre, url, claro, oscuro }) => (
          <li key={nombre}>
            <a
              href={url}
              // Sitios de terceros: se abren aparte para no sacar a nadie de
              // mitad del acceso, y `noopener` evita que la página destino
              // pueda tocar la nuestra por `window.opener`.
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("auth.visitPartner", { name: nombre })}
              className="block rounded-control opacity-70 transition hover:opacity-100 focus-visible:opacity-100"
            >
              <img
                src={claro}
                alt={nombre}
                loading="lazy"
                className={`h-6 w-auto sm:h-7 ${oscuro ? "dark:hidden" : ""}`}
              />
              {oscuro && (
                <img
                  src={oscuro}
                  alt={nombre}
                  loading="lazy"
                  className="hidden h-6 w-auto sm:h-7 dark:block"
                />
              )}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

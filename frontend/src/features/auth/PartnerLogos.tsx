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
  claro: string;
  oscuro?: string;
}

const COLABORADORES: Colaborador[] = [
  { nombre: "ubbu", claro: ubbuClaro, oscuro: ubbuOscuro },
  { nombre: "WhalesBot", claro: whalesbot },
  { nombre: "EnjoyAI", claro: enjoyai },
  { nombre: "Foodcash", claro: foodcashClaro, oscuro: foodcashOscuro },
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
        className="text-center text-xs font-medium uppercase tracking-[0.14em] text-content-subtle"
      >
        {t("auth.partners")}
      </h2>

      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-12">
        {COLABORADORES.map(({ nombre, claro, oscuro }) => (
          <li key={nombre}>
            <img
              src={claro}
              alt={nombre}
              loading="lazy"
              className={`h-6 w-auto opacity-70 transition hover:opacity-100 sm:h-7 ${
                oscuro ? "dark:hidden" : ""
              }`}
            />
            {oscuro && (
              <img
                src={oscuro}
                alt={nombre}
                loading="lazy"
                className="hidden h-6 w-auto opacity-70 transition hover:opacity-100 sm:h-7 dark:block"
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

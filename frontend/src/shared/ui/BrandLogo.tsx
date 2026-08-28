import { useTranslation } from "react-i18next";

import logoClaro from "@/assets/brand/imaquina-horizontal-claro.svg";
import logoOscuro from "@/assets/brand/imaquina-horizontal-oscuro.png";

/** Logotipo de Imaquina.
 *
 *  Único punto del código que sabe qué ficheros son el logo: cambiarlos por
 *  otra versión es tocar los imports de aquí y nada más.
 *
 *  Dos versiones, igual que los logos de colaboradores: el sufijo dice **sobre
 *  qué fondo va cada una**, no de qué color es el logo — `-oscuro` es la clara
 *  (luminosidad media 179), hecha para fondo oscuro. Se conmutan con dos `<img>`
 *  y la variante `dark:`, sin JavaScript, para que el correcto ya venga en el
 *  HTML y no haya parpadeo al cargar.
 *
 *  El texto alternativo es el nombre de la marca porque el logotipo ES el
 *  nombre; describirlo ("logo de…") sería redundante para un lector de
 *  pantalla, que ya anuncia que es una imagen. Va sólo en el primero: el otro
 *  es la misma marca y anunciarla dos veces sobraría.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <>
      <img src={logoClaro} alt={t("app.name")} className={`dark:hidden ${className}`} />
      <img src={logoOscuro} alt="" aria-hidden className={`hidden dark:block ${className}`} />
    </>
  );
}

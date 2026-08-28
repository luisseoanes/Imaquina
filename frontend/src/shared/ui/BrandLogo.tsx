import { useTranslation } from "react-i18next";

import logotipo from "@/assets/brand/imaquina-horizontal.svg";

/** Logotipo de Imaquina.
 *
 *  Único punto del código que sabe qué fichero es el logo: cambiarlo por otra
 *  versión es tocar el import de aquí y nada más.
 *
 *  El texto alternativo es el nombre de la marca porque el logotipo ES el
 *  nombre; describirlo ("logo de…") sería redundante para un lector de
 *  pantalla, que ya anuncia que es una imagen.
 *
 *  **PROVISIONAL — en modo oscuro se pinta en blanco monocromo.** El logotipo
 *  lleva el texto en tinta casi negra y sobre fondo oscuro desaparece, así que
 *  `brightness(0) invert(1)` lo vuelve una silueta blanca legible. El precio es
 *  perder el dorado del isotipo. Cuando exista una versión oficial para fondo
 *  oscuro se importa como las de `logos/` (patrón `-claro` / `-oscuro`) y este
 *  filtro se borra.
 */
export function BrandLogo({ className = "" }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <img
      src={logotipo}
      alt={t("app.name")}
      className={`dark:brightness-0 dark:invert ${className}`}
    />
  );
}

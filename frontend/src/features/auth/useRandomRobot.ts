import { useState } from "react";

import robot1 from "@/assets/illustrations/robot-1.svg";
import robot2 from "@/assets/illustrations/robot-2.svg";
import robot3 from "@/assets/illustrations/robot-3.svg";
import robot4 from "@/assets/illustrations/robot-4.svg";
import robot5 from "@/assets/illustrations/robot-5.svg";

export const ROBOTS = [robot1, robot2, robot3, robot4, robot5];

/** Uno de los robots, elegido al azar en cada carga de la página.
 *
 *  Se elige en el inicializador de `useState` y no en el cuerpo del
 *  componente: así se decide UNA vez por montaje y no cambia en cada
 *  renderizado. Con React en modo estricto el componente se monta dos veces en
 *  desarrollo, y sin esto el robot parpadearía cambiando de imagen.
 *
 *  Vive en un hook para que la misma elección sirva a las dos posiciones —el
 *  panel de escritorio y el fondo del móvil— y no salgan dos robots distintos
 *  en la misma pantalla.
 */
export function useRandomRobot(): string {
  const [src] = useState(() => ROBOTS[Math.floor(Math.random() * ROBOTS.length)]!);
  return src;
}

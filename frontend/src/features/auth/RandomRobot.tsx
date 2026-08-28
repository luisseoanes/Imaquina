/** La ilustración del robot.
 *
 *  Es decorativa: `alt=""` y `aria-hidden` para que un lector de pantalla no
 *  anuncie una imagen que no aporta información y no la interponga antes del
 *  formulario, que es a lo que se viene.
 */
export function RandomRobot({
  src,
  className = "",
  priority = false,
}: {
  src: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden
      draggable={false}
      // La imagen grande de la pantalla: cargarla tarde deja un hueco visible.
      {...(priority ? { fetchPriority: "high" as const } : { loading: "lazy" as const })}
      data-testid="robot-ilustracion"
      className={`select-none ${className}`}
    />
  );
}

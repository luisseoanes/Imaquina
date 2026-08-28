/** Los volúmenes ámbar del fondo de las pantallas públicas.
 *
 *  Puro decorado: oculto a lectores de pantalla y sin capturar el puntero.
 *
 *  Va en `z-0` y no en `-z-10`: con z negativo quedaría **detrás** del fondo
 *  opaco del contenedor y no se vería nada. El contenido se pone encima con
 *  `z-10`.
 */
export function BrandBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute -left-28 -top-36 size-[32rem] rounded-full bg-brand/45 blur-[90px]" />
      <div className="absolute -left-44 top-[28%] size-[24rem] rounded-full bg-brand/30 blur-[80px]" />
      <div className="absolute -right-36 -top-24 size-[28rem] rounded-full bg-brand/22 blur-[85px]" />
      <div className="absolute -bottom-44 left-[30%] size-[34rem] rounded-full bg-brand/25 blur-[95px]" />
    </div>
  );
}

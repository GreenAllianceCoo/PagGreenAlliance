import { cx } from "./cx";
import { IconoInfo } from "./Iconos";

type AvisoCreditoBloqueadoProps = {
  /** Texto de `perfilAsociado.credito.mensaje` (p. ej. «Podrás pedir tu crédito cuando tu proceso esté operando»). */
  mensaje: string;
  /** Muestra además el botón «Nueva solicitud» apagado (sin acción), como los botones deshabilitados de 3k. */
  conBoton?: boolean;
  /** `id` del aviso: el mosaico «Nueva solicitud» apagado lo enlaza con `aria-describedby` (pieza 3p). */
  id?: string;
  className?: string;
};

/**
 * Estado «no puedes pedir crédito todavía» (pedido D-16, sin maqueta propia: sigue el
 * lenguaje de 3k — ícono en círculo verde tenue, título en Bricolage, botón gris
 * `#EEF2F0` con texto `#7C8B96` (3p)). Se usa en /cuenta y /cuenta/solicitar cuando
 * `credito.puedeSolicitar` es false: nunca hay un botón activo de solicitar.
 * Diseño oficial: pieza 3p.
 */
export function AvisoCreditoBloqueado({ mensaje, conBoton = false, id, className }: AvisoCreditoBloqueadoProps) {
  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {conBoton ? (
        <span
          aria-disabled="true"
          className="flex h-13.5 cursor-not-allowed items-center justify-center rounded-full bg-ga-linea-suave px-6 text-16 font-extrabold text-ga-deshabilitado-texto"
        >
          Nueva solicitud
        </span>
      ) : null}
      <div id={id} role="status" className="flex items-start gap-3 rounded-16 bg-ga-fondo-suave p-4 motion-safe:animate-ga-aparecer">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ga-verde-tint text-ga-verde"
        >
          <IconoInfo tamano={22} grosor={1.8} />
        </span>
        <p className="m-0 font-display text-17 font-extrabold leading-130 text-ga-navy">{mensaje}</p>
      </div>
    </div>
  );
}

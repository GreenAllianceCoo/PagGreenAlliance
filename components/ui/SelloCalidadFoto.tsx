import { cx } from "./cx";
import { IconoCheck } from "./Iconos";

/** Sello «✓ Nítida y con buena luz» sobre la vista previa (pieza 3j): entra con opacity + scale .9→1 (150 ms). */
export function SelloCalidadFoto({ className }: { className?: string }) {
  return (
    <span
      className={cx(
        "absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-12 font-extrabold text-ga-verde-oscuro",
        "motion-safe:animate-ga-sello-chico",
        className,
      )}
    >
      <IconoCheck tamano={12} grosor={3} />
      Nítida y con buena luz
    </span>
  );
}

/** Aviso ámbar (nunca bloquea): «La foto se ve borrosa u oscura, tómala de nuevo». */
export function AvisoFotoDudosa({
  mensaje,
  alRepetir,
  textoRepetir = "Tomar la foto de nuevo",
}: {
  mensaje: string;
  alRepetir: () => void;
  textoRepetir?: string;
}) {
  return (
    <div
      role="status"
      className="flex flex-col gap-1.5 rounded-12 border-1.5 border-[#F3DDB0] bg-ga-ambar-fondo-suave p-3 motion-safe:animate-ga-error-chico"
    >
      <span className="text-13 font-bold text-ga-ambar-texto">{mensaje}.</span>
      <span className="text-12 leading-140 text-ga-ambar-texto-2">
        Es un aviso, no un bloqueo: puedes continuar con la foto tal como está.
      </span>
      <button
        type="button"
        onClick={alRepetir}
        className="self-start text-13 font-extrabold text-ga-verde underline hover:text-ga-verde-oscuro"
      >
        {textoRepetir}
      </button>
    </div>
  );
}

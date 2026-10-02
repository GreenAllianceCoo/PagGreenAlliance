/** «$ 2.500.000» → 2500000 (solo para el medidor visual; no es un nuevo cálculo de tope). */
function numeroDesdeTexto(texto: string) {
  const limpio = texto.replace(/[^\d]/g, "");
  return limpio ? Number(limpio) : 0;
}

/**
 * Tarjeta verde «Tope disponible para tu grado» (pieza 2b), con medidor opcional.
 * Compartida por /cuenta y la cuenta de demostración.
 */
export function TarjetaTope({
  tope,
  montoUsado,
  etiqueta = "Tope disponible para tu grado",
}: {
  /** Ya formateado («$ 2.500.000») o el texto de «sin cupo». */
  tope: string;
  /** Monto de la última solicitud, ya formateado; solo para el medidor visual. */
  montoUsado?: string;
  etiqueta?: string;
}) {
  const topeNumero = numeroDesdeTexto(tope);
  const usadoNumero = montoUsado ? numeroDesdeTexto(montoUsado) : 0;
  const fraccion = topeNumero > 0 ? Math.min(usadoNumero / topeNumero, 1) : 0;

  return (
    <section className="relative flex flex-col gap-1.5 overflow-hidden rounded-28 bg-ga-verde p-5 text-white lg:gap-3 lg:p-6">
      <span aria-hidden="true" className="absolute -right-10 -bottom-16 h-44 w-44 rounded-full bg-ga-verde-oscuro" />
      <span className="relative text-14 text-ga-verde-claro lg:text-15">{etiqueta}</span>
      <span className="relative font-display text-26 font-extrabold leading-none tracking-cifra text-white lg:text-[46px]">
        {tope}
      </span>
      {/* Medidor: solo cuando ya hay una solicitud que compare contra el tope. */}
      {montoUsado ? (
        <>
          <div className="relative h-2.5 overflow-hidden rounded-full bg-white/18 lg:h-2.5">
            <div
              className="h-full origin-left rounded-full bg-ga-ambar-fondo-fuerte transition-transform duration-500 ease-spring"
              style={{ width: "100%", transform: `scaleX(${fraccion})` }}
            />
          </div>
          <span className="relative text-13 text-ga-verde-claro lg:text-14">Tu solicitud usa {montoUsado}</span>
        </>
      ) : null}
    </section>
  );
}

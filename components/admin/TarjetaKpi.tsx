type Props = {
  etiqueta: string;
  /**
   * `undefined` solo como defensa (ver `lib/admin/kpis.ts`: los 4 KPI del
   * panel de créditos ya vienen siempre calculados con consultas de
   * conteo/suma exactas, no deberían llegar `undefined` en uso normal).
   */
  valor: string | number | undefined;
  /** Color del número: por defecto el texto claro; «ambar»/«verde» para resaltar (pieza 2d). */
  tono?: "normal" | "ambar" | "verde";
  /** Línea pequeña bajo la cifra (p. ej. monto desembolsado). */
  nota?: string;
};

const TONOS = {
  normal: "text-admin-texto",
  ambar: "text-admin-ambar",
  verde: "text-admin-verde-2",
} as const;

/**
 * Tarjeta de KPI del panel de administración (pieza 2d: «Créditos pendientes»,
 * «Afiliaciones pendientes», «Aprobados este mes», «Monto aprobado este
 * mes»). Si `valor` llegara `undefined` (no debería, ver el comentario del
 * tipo `Props`) se muestra un guion en vez de un número inventado.
 */
export function TarjetaKpi({ etiqueta, valor, tono = "normal", nota }: Props) {
  return (
    <div className="flex flex-col gap-1.5 rounded-20 bg-admin-superficie px-5 py-4.5">
      <span className="text-14 text-admin-texto-3">{etiqueta}</span>
      <span
        className={`font-display font-extrabold leading-none tracking-cifra ${
          typeof valor === "string" && valor.includes("$") ? "text-38" : "text-48"
        } ${TONOS[tono]}`}
      >
        {valor ?? "—"}
      </span>
      {nota ? <span className="text-13 text-admin-texto-3">{nota}</span> : null}
    </div>
  );
}

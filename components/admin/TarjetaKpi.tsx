type Props = {
  etiqueta: string;
  /** `undefined` = todavía no hay una consulta que la calcule (ver el TODO(backend) de quien la use). */
  valor: string | number | undefined;
  /** Color del número: por defecto el texto claro; «ambar»/«verde» para resaltar (pieza 2d). */
  tono?: "normal" | "ambar" | "verde";
};

const TONOS = {
  normal: "text-admin-texto",
  ambar: "text-admin-ambar",
  verde: "text-admin-verde-2",
} as const;

/**
 * Tarjeta de KPI del panel de administración (pieza 2d: «Créditos pendientes»,
 * «Afiliaciones pendientes», «Aprobados este mes», «Monto aprobado este
 * mes»). Cuando `valor` es `undefined` se muestra un guion: no se inventa un
 * número que necesitaría una consulta nueva (ver TODO(backend) en la página
 * que la usa y docs/auditorias/2026-09-25-backend-rediseno-c-plus.md).
 */
export function TarjetaKpi({ etiqueta, valor, tono = "normal" }: Props) {
  return (
    <div className="flex flex-col gap-1.5 rounded-20 bg-admin-superficie px-5 py-4.5">
      <span className="text-14 text-admin-texto-3">{etiqueta}</span>
      <span
        className={`font-display font-extrabold leading-none tracking-cifra ${
          typeof valor === "string" && valor.includes("$") ? "text-38" : "text-48"
        } ${TONOS[tono]}`}
        title={valor === undefined ? "Pendiente de conectar con una consulta nueva (TODO(backend))" : undefined}
      >
        {valor ?? "—"}
      </span>
    </div>
  );
}

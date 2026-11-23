import type { ReactNode } from "react";

type Tono = "normal" | "ambar" | "verde" | "azul" | "violeta" | "rosa";

type Props = {
  etiqueta: string;
  /**
   * `undefined` solo como defensa (ver `lib/admin/kpis.ts`: los 4 KPI del
   * panel de créditos ya vienen siempre calculados con consultas de
   * conteo/suma exactas, no deberían llegar `undefined` en uso normal).
   */
  valor: string | number | undefined;
  /** Color de la tarjeta: cifra, ícono y filete superior. */
  tono?: Tono;
  /** Línea pequeña bajo la cifra (p. ej. monto desembolsado). */
  nota?: string;
  /** Ícono (de components/ui/Iconos) que va en el cuadro de color. */
  icono?: ReactNode;
};

const TONOS: Record<Tono, { cifra: string; caja: string; filete: string }> = {
  normal: { cifra: "text-admin-texto", caja: "bg-admin-gris-fondo text-admin-texto-2", filete: "bg-admin-texto-3" },
  ambar: { cifra: "text-admin-ambar", caja: "bg-admin-ambar-fondo text-admin-ambar", filete: "bg-admin-ambar" },
  verde: { cifra: "text-admin-verde-2", caja: "bg-admin-verde-fondo text-admin-verde-2", filete: "bg-admin-verde" },
  azul: { cifra: "text-admin-texto", caja: "bg-admin-azul-fondo text-admin-azul", filete: "bg-admin-azul" },
  violeta: { cifra: "text-admin-texto", caja: "bg-admin-violeta-fondo text-admin-violeta", filete: "bg-admin-violeta" },
  rosa: { cifra: "text-admin-texto", caja: "bg-admin-rosa-fondo text-admin-rosa", filete: "bg-admin-rosa" },
};

/**
 * Tarjeta de KPI del panel de administración (pieza 2d). Fase 2: cada cifra
 * lleva su tono (filete superior + ícono en un cuadro de color) para que el
 * resumen no se vea plano. Si `valor` llegara `undefined` se muestra un guion.
 */
export function TarjetaKpi({ etiqueta, valor, tono = "normal", nota, icono }: Props) {
  const t = TONOS[tono];
  return (
    <div className="relative flex flex-col gap-1.5 overflow-hidden rounded-20 bg-admin-superficie px-5 py-4.5 shadow-[inset_0_0_0_1px_var(--ga-admin-borde-sutil)]">
      <span aria-hidden="true" className={`absolute inset-x-5 top-0 h-[3px] rounded-b-full opacity-80 ${t.filete}`} />
      <div className="flex items-start justify-between gap-2">
        <span className="text-14 text-admin-texto-3">{etiqueta}</span>
        {icono ? (
          <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-10 ${t.caja}`}>
            {icono}
          </span>
        ) : null}
      </div>
      <span
        className={`font-display font-semibold leading-none tracking-cifra ${
          typeof valor === "string" && valor.includes("$") ? "text-38" : "text-48"
        } ${t.cifra}`}
      >
        {valor ?? "—"}
      </span>
      {nota ? <span className="text-13 text-admin-texto-3">{nota}</span> : null}
    </div>
  );
}

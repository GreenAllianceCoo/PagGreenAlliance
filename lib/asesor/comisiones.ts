/**
 * Comisiones del asesor («embajador», spec-requerimientos-ricardo §0 y §5.4;
 * migración 20260929100500). Funciones puras: el periodo de corte (16 → 15,
 * hora de Colombia) igual que public.periodo_comision(), y la vista de
 * `comisiones_periodo_asesor()` para /asesor (pieza 3l).
 */

import { formatearPesos } from "@/lib/cuenta";
import { formatearFechaCorta, formatearFechaLarga, sumarMeses, type FechaISO } from "@/lib/fechas";

/** Cifras de la presentación (spec §0). La base usa las mismas en comisiones_periodo_asesor(). */
export const VALOR_INGRESO_NUEVO = 500_000;
export const VALOR_EMBARGO_OPERATIVO = 100_000;
export const BONO_50_EMBARGOS = 1_000_000;
export const META_BONO = 50;
export const META_VIAJE = 100;
export const DIA_CORTE = 15;

/** Lo que se muestra antes de tocar «Acumulado ganado a la fecha». */
export const MASCARA_ACUMULADO = "•••••";

/** Valores del enum public.concepto_comision. */
export const CONCEPTOS_COMISION = [
  "ingreso_nuevo",
  "embargo_operativo",
  "bono_50_embargos",
  "viaje_100_embargos",
  "ajuste",
] as const;
export type ConceptoComision = (typeof CONCEPTOS_COMISION)[number];

export const ETIQUETA_CONCEPTO: Record<ConceptoComision, string> = {
  ingreso_nuevo: "Ingreso nuevo",
  embargo_operativo: "Embargo operativo",
  bono_50_embargos: "Bono por 50 embargos",
  viaje_100_embargos: "Viaje por 100 embargos",
  ajuste: "Ajuste",
};

/** Periodo que contiene la fecha: del día 16 al día 15 del mes siguiente (igual que la base). */
export function periodoComision(fecha: FechaISO): { inicio: FechaISO; fin: FechaISO } {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const dieciseisDeEsteMes = `${String(anio).padStart(4, "0")}-${String(mes).padStart(2, "0")}-16`;
  const inicio = dia >= 16 ? dieciseisDeEsteMes : sumarMeses(dieciseisDeEsteMes, -1);
  const fin = sumarMeses(inicio, 1).replace(/-16$/, "-15");
  return { inicio, fin };
}

/**
 * Cortes (días 15) para el selector «Periodo» del formulario de pago en
 * /admin: el del periodo en curso y los `cantidad − 1` anteriores.
 */
export function opcionesPeriodoCorte(hoy: FechaISO, cantidad = 6): { valor: FechaISO; etiqueta: string }[] {
  const { fin } = periodoComision(hoy);
  return Array.from({ length: cantidad }, (_, i) => {
    const corte = sumarMeses(fin, -i);
    const { inicio } = periodoComision(corte);
    return { valor: corte, etiqueta: `${formatearFechaCorta(inicio)} – ${formatearFechaLarga(corte)}` };
  });
}

/** true si la fecha es un día 15 (check pagos_comision_corte_chk). */
export function esDiaDeCorte(fecha: FechaISO): boolean {
  return /^\d{4}-\d{2}-15$/.test(fecha);
}

/** Fila de public.comisiones_periodo_asesor(). */
export type FilaComisionesPeriodo = {
  periodo_inicio: FechaISO;
  periodo_fin: FechaISO;
  ingresos_nuevos: number;
  valor_ingresos_nuevos: number | string;
  clientes_operativos: number;
  valor_clientes_operativos: number | string;
  total_operando_hoy: number;
};

export type AvanceMeta = { actual: number; meta: number; porcentaje: number; alcanzado: boolean; faltan: number };

function avance(actual: number, meta: number): AvanceMeta {
  return {
    actual,
    meta,
    porcentaje: Math.min(100, Math.round((actual / meta) * 100)),
    alcanzado: actual >= meta,
    faltan: Math.max(0, meta - actual),
  };
}

export type VistaComisiones = {
  periodoInicio: FechaISO;
  periodoFin: FechaISO;
  /** «16 sept – 15 de octubre de 2026». */
  periodoTexto: string;
  /** «Corte: 15 de octubre de 2026». */
  corteTexto: string;
  ingresosNuevos: { cantidad: number; valor: string; valorUnitario: string };
  clientesOperativos: { cantidad: number; valor: string; valorUnitario: string };
  /** Suma de las dos líneas del periodo (lo que se causa en este corte, no lo pagado). */
  totalPeriodo: string;
  operandoHoy: number;
  bono50: AvanceMeta;
  viaje100: AvanceMeta;
};

/** Vista de /asesor. Sin fila (quien llama no puede_atender) → null. */
export function vistaComisiones(fila: FilaComisionesPeriodo | null | undefined): VistaComisiones | null {
  if (!fila) return null;
  const valorIngresos = Number(fila.valor_ingresos_nuevos);
  const valorOperativos = Number(fila.valor_clientes_operativos);
  const operandoHoy = Number(fila.total_operando_hoy);
  return {
    periodoInicio: fila.periodo_inicio,
    periodoFin: fila.periodo_fin,
    periodoTexto: `${formatearFechaCorta(fila.periodo_inicio)} – ${formatearFechaLarga(fila.periodo_fin)}`,
    corteTexto: `Corte: ${formatearFechaLarga(fila.periodo_fin)}`,
    ingresosNuevos: {
      cantidad: Number(fila.ingresos_nuevos),
      valor: formatearPesos(valorIngresos),
      valorUnitario: formatearPesos(VALOR_INGRESO_NUEVO),
    },
    clientesOperativos: {
      cantidad: Number(fila.clientes_operativos),
      valor: formatearPesos(valorOperativos),
      valorUnitario: formatearPesos(VALOR_EMBARGO_OPERATIVO),
    },
    totalPeriodo: formatearPesos(valorIngresos + valorOperativos),
    operandoHoy,
    bono50: avance(operandoHoy, META_BONO),
    viaje100: avance(operandoHoy, META_VIAJE),
  };
}

/**
 * Monto escrito en el formulario de pago («1.000.000», «$ 500.000»,
 * «-50000» para un ajuste) → entero en pesos, o null si no es un número.
 */
/** RS-10: tope por pago (valor absoluto, también en ajustes). Igual que pagos_comision_monto_tope_chk. */
export const MONTO_MAXIMO_PAGO = 10_000_000;

export function leerMontoPesos(texto: string): number | null {
  const limpio = texto.trim().replace(/[$\s.]/g, "");
  if (!/^-?[0-9]{1,12}$/.test(limpio)) return null;
  return Number(limpio);
}

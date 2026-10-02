import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ETIQUETA_CONCEPTO, type ConceptoComision } from "@/lib/asesor/comisiones";
import { formatearFecha, formatearPesos } from "@/lib/cuenta";
import { formatearFechaLarga } from "@/lib/fechas";
import { registrar } from "@/lib/servidor/registro";

/**
 * Loaders de /admin/asesores para la pieza 3m (spec-requerimientos-ricardo §6):
 * interruptor «Atiende asociados» y registro de pagos de comisión.
 */

export type PersonaEquipo = {
  id: string;
  nombre: string;
  cedula: string;
  rol: "asesor" | "admin" | "secretario";
  /** Solo significa algo para admins (un asesor siempre atiende). */
  atiendeAsociados: boolean;
  /** true = aparece en el desplegable de /afiliacion y puede tener clientes. */
  atiende: boolean;
  activo: boolean;
};

/**
 * Asesores y admins, con su interruptor. El interruptor solo se muestra en
 * los admins (en un asesor no tiene efecto: public.puede_atender()).
 */
export async function listarEquipo(supabase: SupabaseClient): Promise<{ personas: PersonaEquipo[]; error: boolean }> {
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, cedula, rol, atiende_asociados, activo")
    .in("rol", ["asesor", "admin", "secretario"])
    .order("nombre_completo");
  if (error) {
    registrar("error", { evento: "admin_equipo_fallo", codigo: error.code, mensaje: error.message });
    return { personas: [], error: true };
  }
  return {
    error: false,
    personas: (data ?? []).map((p) => {
      const rol = p.rol as "asesor" | "admin" | "secretario";
      const activo = p.activo !== false;
      const atiendeAsociados = p.atiende_asociados === true;
      return {
        id: p.id as string,
        nombre: p.nombre_completo as string,
        cedula: p.cedula as string,
        rol,
        atiendeAsociados,
        atiende: activo && (rol === "asesor" || atiendeAsociados),
        activo,
      };
    }),
  };
}

export type PagoComisionAdmin = {
  id: string;
  asesorId: string;
  asesorNombre: string;
  asociadoNombre: string | null;
  periodoCorte: string;
  /** «15 de octubre de 2026». */
  periodoTexto: string;
  concepto: ConceptoComision;
  conceptoTexto: string;
  monto: number;
  montoTexto: string;
  nota: string | null;
  registradoPor: string | null;
  registrado: string | undefined;
  /** Anulado por el admin (no suma en el acumulado del asesor). */
  anulado: boolean;
  motivoAnulacion: string | null;
  anuladoPor: string | null;
  anuladoEl: string | undefined;
};

/** Pagos de comisión (más recientes primero), de todos o de un asesor. */
export async function listarPagosComision(
  supabase: SupabaseClient,
  opciones: { asesorId?: string; limite?: number } = {},
): Promise<{ pagos: PagoComisionAdmin[]; totalPorAsesor: Record<string, string>; error: boolean }> {
  let consulta = supabase
    .from("pagos_comision")
    .select(
      "id, asesor_id, asociado_id, periodo_corte, concepto, monto, nota, registrado_por, created_at, anulado, anulado_por, anulado_at, motivo_anulacion",
    )
    .order("created_at", { ascending: false })
    .limit(opciones.limite ?? 200);
  if (opciones.asesorId) consulta = consulta.eq("asesor_id", opciones.asesorId);
  const { data, error } = await consulta;
  if (error) {
    registrar("error", { evento: "admin_pagos_comision_fallo", codigo: error.code, mensaje: error.message });
    return { pagos: [], totalPorAsesor: {}, error: true };
  }

  const ids = [
    ...new Set(
      (data ?? [])
        .flatMap((p) => [
          p.asesor_id as string,
          p.asociado_id as string | null,
          p.registrado_por as string | null,
          p.anulado_por as string | null,
        ])
        .filter(Boolean),
    ),
  ] as string[];
  const { data: perfiles } = ids.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", ids)
    : { data: [] };
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, p.nombre_completo as string]));

  const sumas = new Map<string, number>();
  const pagos = (data ?? []).map((p) => {
    const monto = Number(p.monto);
    const anulado = p.anulado === true;
    // Igual que revelar_acumulado_comision(): solo suman los pagos vigentes.
    if (!anulado) sumas.set(p.asesor_id as string, (sumas.get(p.asesor_id as string) ?? 0) + monto);
    const concepto = p.concepto as ConceptoComision;
    return {
      id: p.id as string,
      asesorId: p.asesor_id as string,
      asesorNombre: nombre.get(p.asesor_id as string) ?? "Asesor",
      asociadoNombre: p.asociado_id ? (nombre.get(p.asociado_id as string) ?? null) : null,
      periodoCorte: p.periodo_corte as string,
      periodoTexto: formatearFechaLarga(p.periodo_corte as string),
      concepto,
      conceptoTexto: ETIQUETA_CONCEPTO[concepto] ?? String(p.concepto),
      monto,
      montoTexto: monto < 0 ? `− ${formatearPesos(-monto)}` : formatearPesos(monto),
      nota: (p.nota as string | null) ?? null,
      registradoPor: p.registrado_por ? (nombre.get(p.registrado_por as string) ?? null) : null,
      registrado: formatearFecha(p.created_at as string),
      anulado,
      motivoAnulacion: (p.motivo_anulacion as string | null) ?? null,
      anuladoPor: p.anulado_por ? (nombre.get(p.anulado_por as string) ?? null) : null,
      anuladoEl: formatearFecha(p.anulado_at as string | null),
    };
  });

  return {
    error: false,
    pagos,
    // Suma de los pagos VIGENTES listados (con el límite): el admin la ve; el asesor, no (solo con revelarAcumulado).
    totalPorAsesor: Object.fromEntries([...sumas].map(([id, total]) => [id, formatearPesos(total)])),
  };
}

/** Clientes (asociados) de un asesor, para el selector opcional «Cliente» del pago. */
export async function listarClientesDeAsesor(
  supabase: SupabaseClient,
  asesorId: string,
): Promise<{ id: string; nombre: string }[]> {
  const { data } = await supabase
    .from("perfiles")
    .select("id, nombre_completo")
    .eq("asesor_id", asesorId)
    .order("nombre_completo");
  return (data ?? []).map((p) => ({ id: p.id as string, nombre: p.nombre_completo as string }));
}

export type AccionBitacoraPago = "creacion" | "edicion" | "anulacion";

export const ETIQUETA_ACCION_BITACORA: Record<AccionBitacoraPago, string> = {
  creacion: "Registro",
  edicion: "Corrección",
  anulacion: "Anulación",
};

export type EntradaBitacoraPago = {
  id: number;
  pagoId: string;
  accion: AccionBitacoraPago;
  accionTexto: string;
  motivo: string | null;
  actorNombre: string | null;
  cuando: string | undefined;
  creadoEl: string;
  /** Solo lo que cambió (monto, concepto, nota, anulado), antes → después, ya en texto. */
  cambios: { campo: string; antes: string | null; despues: string | null }[];
};

const CAMPOS_BITACORA: Record<string, string> = { monto: "Monto", concepto: "Concepto", nota: "Nota", anulado: "Anulado" };

function textoValor(campo: string, valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (campo === "monto") return formatearPesos(Number(valor));
  if (campo === "concepto") return ETIQUETA_CONCEPTO[valor as ConceptoComision] ?? String(valor);
  if (campo === "anulado") return valor === true ? "Sí" : "No";
  return String(valor);
}

/** Diferencias entre dos fotos (jsonb) de la fila, solo en los campos que el admin puede cambiar. */
export function cambiosBitacora(antes: Record<string, unknown> | null, despues: Record<string, unknown>) {
  return Object.keys(CAMPOS_BITACORA)
    .filter((campo) => (antes ? JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo]) : campo !== "anulado"))
    .map((campo) => ({
      campo: CAMPOS_BITACORA[campo],
      antes: antes ? textoValor(campo, antes[campo]) : null,
      despues: textoValor(campo, despues[campo]),
    }));
}

/** Bitácora de pagos de comisión (solo admin la lee), más reciente primero; de un pago o de todos. */
export async function listarBitacoraPagos(
  supabase: SupabaseClient,
  opciones: { pagoId?: string; limite?: number } = {},
): Promise<{ entradas: EntradaBitacoraPago[]; error: boolean }> {
  let consulta = supabase
    .from("bitacora_pagos_comision")
    .select("id, pago_id, accion, antes, despues, motivo, actor_id, created_at")
    .order("created_at", { ascending: false })
    .limit(opciones.limite ?? 200);
  if (opciones.pagoId) consulta = consulta.eq("pago_id", opciones.pagoId);
  const { data, error } = await consulta;
  if (error) {
    registrar("error", { evento: "admin_bitacora_pagos_fallo", codigo: error.code, mensaje: error.message });
    return { entradas: [], error: true };
  }
  const ids = [...new Set((data ?? []).map((f) => f.actor_id as string | null).filter(Boolean))] as string[];
  const { data: perfiles } = ids.length
    ? await supabase.from("perfiles").select("id, nombre_completo").in("id", ids)
    : { data: [] };
  const nombre = new Map((perfiles ?? []).map((p) => [p.id as string, p.nombre_completo as string]));
  return {
    error: false,
    entradas: (data ?? []).map((f) => {
      const accion = f.accion as AccionBitacoraPago;
      return {
        id: Number(f.id),
        pagoId: f.pago_id as string,
        accion,
        accionTexto: ETIQUETA_ACCION_BITACORA[accion] ?? String(f.accion),
        motivo: (f.motivo as string | null) ?? null,
        actorNombre: f.actor_id ? (nombre.get(f.actor_id as string) ?? null) : null,
        cuando: formatearFecha(f.created_at as string),
        creadoEl: f.created_at as string,
        cambios: cambiosBitacora(
          (f.antes as Record<string, unknown> | null) ?? null,
          (f.despues as Record<string, unknown>) ?? {},
        ),
      };
    }),
  };
}

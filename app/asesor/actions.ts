"use server";

import { redirect } from "next/navigation";
import { vistaClienteBuscado, type ClienteBuscado, type FilaClienteAsesor } from "@/lib/asesor/busqueda";
import { metaDeClic } from "@/lib/asesor/premios";
import { exigirAsesor } from "@/lib/asesor/servidor";
import { formatearPesos } from "@/lib/cuenta";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import { esquemaBuscarCliente, leerBuscarCliente } from "@/lib/validaciones/asesor";

/**
 * «Salir» del asesor: mismo mecanismo que app/cuenta/actions.ts (no se
 * reutiliza ese archivo porque es zona de otro agente; misma lógica).
 */
export async function cerrarSesionAsesor() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    registrar("error", { evento: "asesor_cerrar_sesion_fallo", estado: error.status, codigo: error.code });
  }
  redirect("/ingresar");
}

/** RS-13: tope suave por asesor para no inflar el contador ni martillar la búsqueda. */
const MAX_ACCIONES_ASESOR_POR_HORA = 30;
const VENTANA_ACCIONES_ASESOR_SEGUNDOS = 60 * 60;

export type EstadoAcumulado = {
  /** «$ 1.600.000» (solo después de tocar el botón). */
  total?: string;
  error?: string;
};

/**
 * «Acumulado ganado a la fecha» (spec-requerimientos-ricardo §5.4.3, pieza
 * 3l): la cifra está oculta («•••••») hasta que el asesor toca el botón.
 * Cada llamada suma 1 al contador de revelaciones (tabla sin lectura desde
 * la app) y devuelve la suma de sus pagos de comisión. Única vía para ver
 * esa cifra: el asesor no puede leer `pagos_comision`.
 */
export async function revelarAcumulado(): Promise<EstadoAcumulado> {
  const { supabase, userId } = await exigirAsesor();
  // RS-13: el contador solo suma cuando la acción pasa el límite.
  if (!(await dentroDelLimite("asesor-revelar", userId, MAX_ACCIONES_ASESOR_POR_HORA, VENTANA_ACCIONES_ASESOR_SEGUNDOS))) {
    return { error: "Consultaste tu acumulado muchas veces. Intenta de nuevo más tarde." };
  }
  const { data, error } = await supabase.rpc("revelar_acumulado_comision");
  if (error) {
    registrar("error", { evento: "revelar_acumulado_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos mostrar tu acumulado. Intenta de nuevo." };
  }
  return { total: formatearPesos(Number(data ?? 0)) };
}

export type EstadoBuscarCliente = {
  /** null = búsqueda hecha, sin resultado entre SUS clientes. */
  cliente?: ClienteBuscado | null;
  errores?: { cedula?: string };
  error?: string;
  /** Lo que escribió (para no borrarlo). */
  cedula?: string;
};

/**
 * «Buscar por cédula» (§5.5): solo sus propios clientes (F2-03, lo exige
 * buscar_cliente_asesor() en la base). La respuesta trae la cédula
 * ENMASCARADA, el estado del proceso y la capacidad de endeudamiento.
 */
export async function buscarCliente(
  _previo: EstadoBuscarCliente,
  formData: FormData,
): Promise<EstadoBuscarCliente> {
  const entrada = leerBuscarCliente(formData);
  const resultado = esquemaBuscarCliente.safeParse(entrada);
  if (!resultado.success) {
    return { errores: erroresPorCampo<"cedula">(resultado.error), cedula: entrada.cedula };
  }

  const { supabase, userId } = await exigirAsesor();
  if (!(await dentroDelLimite("asesor-buscar", userId, MAX_ACCIONES_ASESOR_POR_HORA, VENTANA_ACCIONES_ASESOR_SEGUNDOS))) {
    return { error: "Hiciste muchas búsquedas seguidas. Intenta de nuevo más tarde.", cedula: entrada.cedula };
  }
  const { data, error } = await supabase
    .rpc("buscar_cliente_asesor", { p_cedula: resultado.data.cedula })
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "buscar_cliente_asesor_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos buscar. Intenta de nuevo.", cedula: entrada.cedula };
  }
  return {
    cliente: data ? vistaClienteBuscado(data as FilaClienteAsesor) : null,
    cedula: entrada.cedula,
  };
}

/**
 * Registra que el asesor abrió o tocó «Premios» (para que la cooperativa sepa si lo ven).
 * La base aplica el tope de 1 registro por minuto por asesor (registrar_clic_premios).
 * No devuelve nada y nunca falla hacia la UI: es una métrica, no bloquea nada.
 */
export async function registrarClicPremios(meta?: number): Promise<void> {
  const { supabase } = await exigirAsesor();
  const { error } = await supabase.rpc("registrar_clic_premios", { p_meta: metaDeClic(meta) });
  if (error) {
    registrar("error", { evento: "registrar_clic_premios_fallo", codigo: error.code, mensaje: error.message });
  }
}

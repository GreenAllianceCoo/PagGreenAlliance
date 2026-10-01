import type { Metadata } from "next";
import { PanelAsesor } from "@/components/asesor/PanelAsesor";
import { registrar } from "@/lib/servidor/registro";
import { cargarComisionesAsesor, exigirAsesor } from "@/lib/asesor/servidor";
import { cargarMetricasAsesor } from "@/lib/asesor/metricas";
import { sanitizarFilaResumen, type FilaResumenAsesor } from "@/lib/asesor/resumen";
import { buscarCliente, cerrarSesionAsesor, revelarAcumulado } from "./actions";

export const metadata: Metadata = {
  title: "Mis clientes · Cooperativa Green Alliance",
};

/**
 * Pantalla del asesor: «Mis clientes» (spec-fase-2.md §1). Entran el rol
 * asesor y los admins con `atiende_asociados` (spec-requerimientos-ricardo
 * §2.9, Ricardo Varón): lo comprueba `exigirAsesor()` en el servidor.
 * Pieza 3l: pestañas «Mis clientes» (con búsqueda por cédula) y «Comisiones»
 * (`cargarComisionesAsesor`, `revelarAcumulado`, `buscarCliente`).
 */
export default async function AsesorPage() {
  const { supabase, nombre } = await exigirAsesor();
  const perfil = { nombre_completo: nombre };

  // resumen_clientes_asesor() ya se autofiltra por auth.uid() (RLS/SECURITY
  // DEFINER) y nunca selecciona celular, correo, nequi ni fotos.
  const { data, error } = await supabase.rpc("resumen_clientes_asesor");
  if (error) {
    registrar("error", { evento: "resumen_clientes_asesor_fallo", codigo: error.code, mensaje: error.message });
  }
  // Spec §5.5 / RS-12: la base (migración 20260930100400) ya devuelve la
  // cédula ENMASCARADA; aquí no se vuelve a enmascarar. La búsqueda exacta por
  // cédula es la acción `buscarCliente`, en el servidor.
  const filas: FilaResumenAsesor[] = (data ?? []).map((fila: Record<string, unknown>) => {
    const limpia = sanitizarFilaResumen(fila);
    return { ...limpia, cedula: limpia.cedula ?? "" };
  });

  // Comisiones del periodo (corte el 15): null si no se pudieron cargar (queda en el registro).
  const [comisiones, metricas] = await Promise.all([cargarComisionesAsesor(supabase), cargarMetricasAsesor(supabase)]);

  return (
    <PanelAsesor
      nombre={perfil.nombre_completo ?? "Asesor"}
      filas={filas}
      comisiones={comisiones}
      metricas={metricas}
      accionSalir={cerrarSesionAsesor}
      revelar={revelarAcumulado}
      buscar={buscarCliente}
    />
  );
}

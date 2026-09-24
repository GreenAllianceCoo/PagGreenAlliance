import "server-only";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/** Fila de `public.obtener_asesores_publico()` (spec-fase-2 §1): solo id y nombre. */
export type Asesor = { id: string; nombre: string };

/**
 * Lista de asesores para el desplegable «¿Quién te refirió?» del formulario
 * público de afiliación. La función solo la puede llamar `service_role`
 * (no hay sesión en `/afiliacion`), así que se lee desde el servidor.
 */
export async function asesoresParaAfiliacion(): Promise<Asesor[]> {
  const { data, error } = await crearClienteAdmin().rpc("obtener_asesores_publico");
  if (error) {
    registrar("error", {
      evento: "asesores_afiliacion_fallo",
      codigo: error.code,
      mensaje: error.message,
    });
    return [];
  }
  return (data ?? []) as Asesor[];
}

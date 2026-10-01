"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { enviarGanadorSorteo } from "@/lib/correo/sorteo";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import { nombreMes } from "@/lib/sorteo/fecha";
import { registrar } from "@/lib/servidor/registro";
import { esquemaRealizarSorteo } from "@/lib/validaciones/admin";

export type EstadoRealizarSorteo = {
  error?: string;
  mensaje?: string;
  /** Solo grado y nombre: nunca cédula ni número de boleta (§12.10). */
  ganador?: { grado: string; nombre: string; mesTexto: string };
};

/** Textos de admin_realizar_sorteo() listos para mostrar (los demás errores se ocultan). */
const MENSAJES_SORTEO = [
  "Falta el mes del sorteo",
  "No se puede sortear un mes que no ha empezado",
  "El sorteo se hace cuando cierre la inscripción (después del día 5)",
  "El sorteo de ese mes ya se realizó",
  "No hay participantes confirmados para el sorteo de ese mes",
];

/**
 * «Realizar sorteo» de /admin (spec §12.10). Solo el admin; el azar y la regla
 * «una vez por mes» viven en la RPC `admin_realizar_sorteo`. Después le
 * escribe al ganador (correo personal). Campo del formulario: `mes`
 * («AAAA-MM» o «AAAA-MM-01»).
 */
export async function realizarSorteo(
  _previo: EstadoRealizarSorteo,
  formData: FormData,
): Promise<EstadoRealizarSorteo> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaRealizarSorteo.safeParse({ mes: formData.get("mes") });
  if (!resultado.success) return { error: resultado.error.issues[0]?.message ?? "Elige el mes del sorteo." };

  const { data, error } = await supabase.rpc("admin_realizar_sorteo", { p_mes: resultado.data.mes }).maybeSingle();
  const fila = data as { mes: string; asociado_id: string; nombre_completo: string; grado: string } | null;
  if (error || !fila) {
    const conocido = MENSAJES_SORTEO.find((m) => error?.message?.includes(m));
    if (!conocido) registrar("error", { evento: "sorteo_realizar_fallo", codigo: error?.code, mensaje: error?.message });
    return { error: conocido ? `${conocido}.` : "No pudimos realizar el sorteo. Intenta de nuevo." };
  }

  const mesTexto = nombreMes(Number(String(fila.mes).slice(5, 7)));

  // Correo al ganador (no bloquea la respuesta si algo falla).
  const { data: perfil } = await supabase.from("perfiles").select("cedula").eq("id", fila.asociado_id).single();
  if (perfil?.cedula) {
    const correo = destinatariosAviso(await correoDeCedula(perfil.cedula));
    if (correo.length > 0) await enviarGanadorSorteo({ correo, nombre: fila.nombre_completo, mes: mesTexto });
  }

  revalidatePath("/admin/sorteo");
  revalidatePath("/cuenta");
  return { mensaje: "Sorteo realizado.", ganador: { grado: fila.grado, nombre: fila.nombre_completo, mesTexto } };
}

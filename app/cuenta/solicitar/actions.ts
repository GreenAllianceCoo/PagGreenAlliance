"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MONTO_MINIMO } from "@/lib/credito";

export type EstadoSolicitud = {
  error?: string;
  /** Campo al que corresponde el error (para enlazarlo y mover el foco). Sin campo = error general. */
  campo?: "porcentaje" | "monto";
};

/**
 * «Enviar solicitud» de /cuenta/solicitar. Valida en el servidor, con la
 * sesión del usuario (RLS), e inserta en solicitudes_credito. La base vuelve a
 * validar tope, mínimo y pendiente (trigger chk_monto_solicitud e índice único).
 */
export async function crearSolicitud(
  _prevState: EstadoSolicitud,
  formData: FormData
): Promise<EstadoSolicitud> {
  const porcentaje = formData.get("porcentaje");
  if (porcentaje !== "50" && porcentaje !== "100") {
    return { error: "Elige el porcentaje de devolución.", campo: "porcentaje" };
  }

  const monto = Number(formData.get("monto"));
  if (!Number.isInteger(monto) || monto <= 0) {
    return { error: "Elige un monto válido.", campo: "monto" };
  }
  if (monto < MONTO_MINIMO) {
    return { error: "El monto mínimo de un crédito es $100.000.", campo: "monto" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("grado")
    .eq("id", user.id)
    .single();

  if (!perfil?.grado) {
    return { error: "Tu perfil no tiene un grado asignado. Habla con la cooperativa." };
  }

  const { data: solicitudes } = await supabase
    .from("solicitudes_credito")
    .select("estado")
    .eq("asociado_id", user.id)
    .order("fecha_solicitud", { ascending: false })
    .limit(1);

  if (solicitudes?.[0]?.estado === "pendiente") {
    return { error: "Ya tienes una solicitud pendiente de revisión." };
  }

  const { data: paquete } = await supabase
    .from("grados_credito")
    .select("capacidad_maxima")
    .eq("grado", perfil.grado)
    .eq("porcentaje", porcentaje)
    .single();

  if (!paquete) {
    return { error: "No hay un tope de crédito configurado para tu grado." };
  }

  if (monto > paquete.capacidad_maxima) {
    return { error: "El monto supera el tope permitido para tu grado.", campo: "monto" };
  }

  // Tasa, interés, cuota, total y plazo los calcula la base (trigger chk_monto_solicitud).
  const { error } = await supabase.from("solicitudes_credito").insert({
    asociado_id: user.id,
    porcentaje_devolucion: porcentaje,
    monto_solicitado: monto,
  });

  if (error) {
    return { error: "No pudimos enviar la solicitud. Intenta de nuevo." };
  }

  // Vuelve al inicio del asociado, donde la tarjeta «Tu solicitud» muestra la nueva.
  redirect("/cuenta");
}

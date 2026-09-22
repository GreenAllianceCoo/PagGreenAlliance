"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoSolicitud = { error?: string };

export async function crearSolicitud(
  _prevState: EstadoSolicitud,
  formData: FormData
): Promise<EstadoSolicitud> {
  const porcentaje = formData.get("porcentaje");
  if (porcentaje !== "50" && porcentaje !== "100") {
    return { error: "Selecciona un porcentaje de devolucion valido." };
  }

  const monto = Number(formData.get("monto"));
  if (!Number.isFinite(monto) || monto <= 0) {
    return { error: "Ingresa un monto valido." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("grado")
    .eq("id", user.id)
    .single();

  if (!perfil?.grado) {
    return { error: "Tu perfil no tiene un grado asignado. Contacta al administrador." };
  }

  const { data: solicitudes } = await supabase
    .from("solicitudes_credito")
    .select("estado")
    .eq("asociado_id", user.id)
    .order("fecha_solicitud", { ascending: false })
    .limit(1);

  if (solicitudes?.[0]?.estado === "pendiente") {
    return { error: "Ya tienes una solicitud pendiente de revision." };
  }

  const { data: paquete } = await supabase
    .from("grados_credito")
    .select("capacidad_maxima, cuota_mensual, plazo_meses")
    .eq("grado", perfil.grado)
    .eq("porcentaje", porcentaje)
    .single();

  if (!paquete) {
    return { error: "No hay un tope de credito configurado para tu grado." };
  }

  if (monto > paquete.capacidad_maxima) {
    return { error: "El monto supera el tope permitido para tu grado." };
  }

  const proporcion = monto / paquete.capacidad_maxima;
  const cuotaMensual = Math.round((proporcion * paquete.cuota_mensual) / 1000) * 1000;

  const { error } = await supabase.from("solicitudes_credito").insert({
    asociado_id: user.id,
    porcentaje_devolucion: porcentaje,
    monto_solicitado: monto,
    cuota_mensual: cuotaMensual,
    plazo_meses: paquete.plazo_meses,
  });

  if (error) {
    return { error: "No se pudo enviar la solicitud. Intenta de nuevo." };
  }

  redirect("/dashboard");
}

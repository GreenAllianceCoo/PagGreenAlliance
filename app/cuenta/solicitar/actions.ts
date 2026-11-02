"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MONTO_MINIMO, PASO_MONTO, cupoParaPorcentaje, esPorcentajeCredito } from "@/lib/credito";
import { reglaCreditoDe } from "@/lib/asociado/servidor";

export type EstadoSolicitud = {
  error?: string;
  /** Campo al que corresponde el error (para enlazarlo y mover el foco). Sin campo = error general. */
  campo?: "porcentaje" | "monto";
};

/**
 * «Enviar solicitud» de /cuenta/solicitar. Valida en el servidor, con la
 * sesión del usuario (RLS), e inserta en solicitudes_credito. La base vuelve a
 * validar tope, mínimo y pendiente (trigger chk_monto_solicitud e índice único).
 * Regla de Sebas (spec-requerimientos-ricardo §8): solo si el asociado está
 * activo y su proceso ejecutivo está en «operando»; el tope sale del GRUPO de
 * crédito del grado (§1). Se niega aquí, antes de llegar a la base.
 */
export async function crearSolicitud(
  _prevState: EstadoSolicitud,
  formData: FormData
): Promise<EstadoSolicitud> {
  // 50, 60, 70, 80, 90 o 100 (texto exacto del radio; «65», «50 » o «50%» no valen).
  const porcentajeTexto = formData.get("porcentaje");
  if (typeof porcentajeTexto !== "string" || !esPorcentajeCredito(porcentajeTexto)) {
    return { error: "Elige el porcentaje de tu cupo.", campo: "porcentaje" };
  }
  const porcentaje = Number(porcentajeTexto);

  const monto = Number(formData.get("monto"));
  if (!Number.isInteger(monto) || monto <= 0) {
    return { error: "Elige un monto válido.", campo: "monto" };
  }
  if (monto < MONTO_MINIMO) {
    return { error: "El monto mínimo de un crédito es $100.000.", campo: "monto" };
  }
  // F-06: el servidor aceptaba cualquier monto entero (p. ej. $123.457) con el
  // formulario manipulado, aunque el deslizador solo permite pasos de $50.000.
  if (monto % PASO_MONTO !== 0) {
    return { error: "El monto debe ser un múltiplo de $50.000.", campo: "monto" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/ingresar");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("grado, activo")
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

  const { regla, cupo } = await reglaCreditoDe(supabase, {
    activo: (perfil.activo as boolean | null | undefined) ?? null,
    grado: perfil.grado,
    tienePendiente: false,
  });
  if (!regla.puedeSolicitar) {
    return { error: regla.mensaje };
  }

  // Tope del porcentaje elegido: el de su fila (50/100) o interpolado entre las dos
  // y redondeado al peso, la misma cuenta del trigger chk_monto_solicitud.
  const tope = cupo.estado === "con_cupo" ? cupoParaPorcentaje(cupo.paquetes, porcentaje) : undefined;
  if (tope === undefined) {
    return { error: "No hay un tope de crédito configurado para tu grado." };
  }

  if (monto > tope) {
    return { error: "El monto supera el tope permitido para tu grado.", campo: "monto" };
  }

  // Tasa, interés, cuota, total, plazo y porcentaje_devolucion los calcula la
  // base (trigger chk_monto_solicitud); el asociado solo manda porcentaje_credito y monto.
  const { error } = await supabase.from("solicitudes_credito").insert({
    asociado_id: user.id,
    porcentaje_credito: porcentaje,
    monto_solicitado: monto,
  });

  if (error) {
    return { error: "No pudimos enviar la solicitud. Intenta de nuevo." };
  }

  // Vuelve al inicio del asociado, donde la tarjeta «Tu solicitud» muestra la nueva.
  redirect("/cuenta");
}

"use server";

import { registrar } from "@/lib/servidor/registro";
import { redirect } from "next/navigation";
import { guardarFlashAfiliacion } from "@/lib/afiliacion/flash";
import { dentroDelLimite, ipDelCliente } from "@/lib/servidor/limite";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  esquemaAfiliacion,
  leerFormularioAfiliacion,
  type CampoAfiliacion,
  type EntradaAfiliacion,
} from "@/lib/validaciones/afiliacion";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";

export type EstadoAfiliacion = {
  errores?: Partial<Record<CampoAfiliacion, string>>;
  /** Error que no es de un campo (límite por IP, falla de la base). */
  errorGeneral?: string;
  /** Lo que escribió el usuario, para no borrarlo si hay error. */
  valores?: EntradaAfiliacion;
};

const MENSAJE_PENDIENTE =
  "Ya tenemos una solicitud pendiente con esta cédula. El equipo te contactará pronto.";

/**
 * «Enviar solicitud» (spec §2 «Al enviar» + mapa §5), en este orden:
 * trampa → validación → límite por IP y por cédula → sin otra pendiente →
 * insert (service role) → 2 correos (sin bloquear) → /afiliacion/enviada.
 */
export async function enviarAfiliacion(
  _previo: EstadoAfiliacion,
  formData: FormData,
): Promise<EstadoAfiliacion> {
  const entrada = leerFormularioAfiliacion(formData);

  // Campo trampa lleno = bot: responder «éxito» sin guardar ni enviar correos.
  if (textoDe(formData, "sitio_web").trim() !== "") {
    registrar("warn", { evento: "afiliacion_trampa_activada" });
    await guardarFlashAfiliacion(entrada.email);
    redirect("/afiliacion/enviada");
  }

  // 1. Validación (mismo esquema que el navegador).
  const resultado = esquemaAfiliacion.safeParse(entrada);
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoAfiliacion>(resultado.error), valores: entrada };
  }
  const datos = resultado.data;

  // Límite de envíos: 5 por hora por IP y 3 por día por cédula.
  const ip = await ipDelCliente();
  if (!(await dentroDelLimite("afiliacion-ip", ip, 5, 60 * 60))) {
    return {
      errorGeneral: "Recibimos varias solicitudes desde esta conexión. Intenta de nuevo en una hora.",
      valores: entrada,
    };
  }
  if (!(await dentroDelLimite("afiliacion-cedula", datos.cedula, 3, 24 * 60 * 60))) {
    return {
      errores: { cedula: "Ya recibimos varias solicitudes con esta cédula hoy. Intenta de nuevo mañana." },
      valores: entrada,
    };
  }

  const admin = crearClienteAdmin();

  // Sin otra solicitud pendiente con la misma cédula (la base también lo impide).
  const { data: pendientes, error: errorConsulta } = await admin
    .from("solicitudes_afiliacion")
    .select("id")
    .eq("cedula", datos.cedula)
    .eq("estado", "pendiente")
    .limit(1);
  if (errorConsulta) {
    registrar("error", { evento: "afiliacion_consulta_fallo", codigo: errorConsulta.code, mensaje: errorConsulta.message });
  } else if (pendientes && pendientes.length > 0) {
    return { errores: { cedula: MENSAJE_PENDIENTE }, valores: entrada };
  }

  // 2. Insert con service role (RLS no deja insertar a nadie más).
  const { data: fila, error } = await admin
    .from("solicitudes_afiliacion")
    .insert({
      nombre: datos.nombre,
      cedula: datos.cedula,
      grado: datos.grado_id,
      unidad: datos.unidad,
      celular: datos.celular,
      email: datos.email,
      mensaje: datos.mensaje,
      acepto_datos_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !fila) {
    if (error?.code === "23505") {
      return { errores: { cedula: MENSAJE_PENDIENTE }, valores: entrada };
    }
    registrar("error", { evento: "afiliacion_insert_fallo", codigo: error?.code, mensaje: error?.message });
    return {
      errorGeneral: "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.",
      valores: entrada,
    };
  }

  // 3. «Solicitud enviada».
  await guardarFlashAfiliacion(datos.email);
  redirect("/afiliacion/enviada");
}

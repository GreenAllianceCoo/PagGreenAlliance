"use server";

import { after } from "next/server";
import { avisarAdminsDeRecuperacion } from "@/lib/correo/recuperacion";
import { dentroDelLimite, ipDelCliente } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaRecuperacion,
  MENSAJE_RECUPERACION_RECIBIDA,
  type CampoRecuperacion,
} from "@/lib/validaciones/recuperacion";

export type EstadoRecuperacion = {
  errores?: Partial<Record<CampoRecuperacion, string>>;
  /** Error que no es de un campo (límite por IP). */
  errorGeneral?: string;
  /** Lo que escribió el usuario, para no borrarlo si hay error. */
  valores?: Partial<Record<CampoRecuperacion, string>>;
  /** Respuesta única: siempre el mismo texto exista o no la cédula. */
  mensaje?: string;
};

/** Tiempo mínimo de respuesta: iguala el camino «cédula existe» y «no existe». */
const TIEMPO_MINIMO_MS = 1500;

async function esperarHasta(inicio: number) {
  const falta = TIEMPO_MINIMO_MS - (Date.now() - inicio);
  if (falta > 0) await new Promise((resolver) => setTimeout(resolver, falta));
}

/**
 * «Enviar solicitud» de /ingresar/recuperar (público, sin sesión).
 * No cambia nada por sí solo: deja una solicitud para que el admin verifique
 * la identidad por otro medio. Respuesta SIEMPRE igual (S-06): exista o no la
 * cédula, haya o no otra solicitud pendiente, se haya o no pasado del límite
 * por cédula, el usuario ve MENSAJE_RECUPERACION_RECIBIDA y tarda lo mismo.
 * Solo el límite por IP (que no depende de la cédula) muestra un aviso distinto.
 */
export async function solicitarRecuperacion(
  _previo: EstadoRecuperacion,
  formData: FormData,
): Promise<EstadoRecuperacion> {
  const inicio = Date.now();
  const valores = {
    cedula: textoDe(formData, "cedula"),
    correo: textoDe(formData, "correo"),
    celular: textoDe(formData, "celular"),
    motivo: textoDe(formData, "motivo"),
  };

  // Campo trampa lleno = bot: «éxito» sin guardar nada.
  if (textoDe(formData, "sitio_web").trim() !== "") {
    registrar("warn", { evento: "recuperacion_trampa_activada" });
    await esperarHasta(inicio);
    return { mensaje: MENSAJE_RECUPERACION_RECIBIDA };
  }

  const resultado = esquemaRecuperacion.safeParse(valores);
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoRecuperacion>(resultado.error), valores };
  }
  const datos = resultado.data;

  // Límites: 5 por hora por IP; 2 por día por cédula (cuenta exista o no).
  const ip = await ipDelCliente();
  if (!(await dentroDelLimite("recuperacion-ip", ip, 5, 60 * 60))) {
    return {
      errorGeneral: "Recibimos varias solicitudes desde esta conexión. Intenta de nuevo en una hora.",
      valores,
    };
  }
  const dentroPorCedula = await dentroDelLimite("recuperacion-cedula", datos.cedula, 2, 24 * 60 * 60);

  if (dentroPorCedula) {
    try {
      const admin = crearClienteAdmin();
      const { data: id, error } = await admin.rpc("crear_solicitud_recuperacion", {
        p_cedula: datos.cedula,
        p_correo_nuevo: datos.correo,
        p_celular: datos.celular,
        p_motivo: datos.motivo,
      });
      if (error) {
        registrar("error", { evento: "recuperacion_crear_fallo", codigo: error.code, mensaje: error.message });
      } else if (typeof id === "string") {
        // Aviso a los admins fuera del camino de respuesta: no cambia el tiempo.
        after(async () => {
          const { data: perfil } = await admin
            .from("perfiles")
            .select("nombre_completo")
            .eq("cedula", datos.cedula)
            .maybeSingle();
          await avisarAdminsDeRecuperacion(perfil?.nombre_completo ?? "Un asociado");
        });
      }
    } catch (e) {
      registrar("error", {
        evento: "recuperacion_crear_excepcion",
        mensaje: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    registrar("warn", { evento: "recuperacion_limite_cedula" });
  }

  await esperarHasta(inicio);
  return { mensaje: MENSAJE_RECUPERACION_RECIBIDA };
}

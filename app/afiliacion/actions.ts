"use server";

import { registrar } from "@/lib/servidor/registro";
import { redirect } from "next/navigation";
import { guardarFlashAfiliacion } from "@/lib/afiliacion/flash";
import { borrarFotosAfiliacion, subirFotosAfiliacion } from "@/lib/afiliacion/fotos";
import { dentroDelLimite, ipDelCliente } from "@/lib/servidor/limite";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  esquemaAfiliacion,
  leerFormularioAfiliacion,
  valoresDeTextoAfiliacion,
  type CampoAfiliacion,
  type ValoresAfiliacion,
} from "@/lib/validaciones/afiliacion";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";

export type EstadoAfiliacion = {
  errores?: Partial<Record<CampoAfiliacion, string>>;
  /** Error que no es de un campo (límite por IP, falla de la base). */
  errorGeneral?: string;
  /** Lo que escribió el usuario, para no borrarlo si hay error (sin las 3 fotos: ver ValoresAfiliacion). */
  valores?: ValoresAfiliacion;
};

/**
 * «Enviar solicitud» (docs/spec-fase-2.md §2 + mapa de botones §5), en este orden:
 * trampa → validación → límite por IP y por cédula → subir las 3 fotos →
 * insert (service role) → /afiliacion/enviada.
 * Sin correos al enviar la afiliación (los únicos correos a asociados son los de
 * docs/resend-plantillas.md: ingreso aceptado, código de ingreso y crédito).
 *
 * S-06 (revisión de seguridad 2026-09-24): antes, una cédula con solicitud
 * pendiente recibía un mensaje distinto y una respuesta más rápida (se
 * detectaba ANTES de subir fotos) que un envío normal; eso deja adivinar,
 * por el mensaje y por el tiempo de respuesta, si una cédula ya está en
 * trámite. Ahora no hay una comprobación previa aparte: se sigue el MISMO
 * camino que un envío exitoso (sube las 3 fotos e intenta el insert) y el
 * índice único parcial de la base (`solicitudes_afiliacion`, `estado =
 * 'pendiente'`) es quien de verdad decide. Si choca, se responde EXACTAMENTE
 * como un envío exitoso (mismo flash, mismo redirect) y no se guarda una
 * fila duplicada.
 */
export async function enviarAfiliacion(
  _previo: EstadoAfiliacion,
  formData: FormData,
): Promise<EstadoAfiliacion> {
  const entrada = leerFormularioAfiliacion(formData);
  const valores = valoresDeTextoAfiliacion(entrada);

  // Campo trampa lleno = bot: responder «éxito» sin guardar ni subir nada.
  if (textoDe(formData, "sitio_web").trim() !== "") {
    registrar("warn", { evento: "afiliacion_trampa_activada" });
    await guardarFlashAfiliacion(entrada.email);
    redirect("/afiliacion/enviada");
  }

  // 1. Validación (mismo esquema que el navegador).
  const resultado = esquemaAfiliacion.safeParse(entrada);
  if (!resultado.success) {
    return { errores: erroresPorCampo<CampoAfiliacion>(resultado.error), valores };
  }
  const datos = resultado.data;

  // Límite de envíos: 5 por hora por IP y 3 por día por cédula.
  const ip = await ipDelCliente();
  if (!(await dentroDelLimite("afiliacion-ip", ip, 5, 60 * 60))) {
    return {
      errorGeneral: "Recibimos varias solicitudes desde esta conexión. Intenta de nuevo en una hora.",
      valores,
    };
  }
  if (!(await dentroDelLimite("afiliacion-cedula", datos.cedula, 3, 24 * 60 * 60))) {
    return {
      errores: { cedula: "Ya recibimos varias solicitudes con esta cédula hoy. Intenta de nuevo mañana." },
      valores,
    };
  }

  const admin = crearClienteAdmin();

  // 2. Subir las 3 fotos al bucket privado (service role). Si algo falla, no se
  // guarda la solicitud y las fotos que ya se hubieran subido se borran (ver
  // lib/afiliacion/fotos.ts).
  let fotos;
  try {
    fotos = await subirFotosAfiliacion(admin, datos.cedula, {
      cedulaFrente: datos.foto_cedula_frente,
      cedulaReverso: datos.foto_cedula_reverso,
      selfie: datos.foto_selfie,
    });
  } catch (e) {
    registrar("error", {
      evento: "afiliacion_fotos_fallo",
      mensaje: e instanceof Error ? e.message : String(e),
    });
    return {
      errorGeneral: "No pudimos subir tus fotos. Revisa tu conexión e intenta de nuevo.",
      valores,
    };
  }

  // 3. Insert con service role (RLS no deja insertar a nadie más).
  const { data: fila, error } = await admin
    .from("solicitudes_afiliacion")
    .insert({
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      cedula: datos.cedula,
      grado: datos.grado_id,
      institucion: datos.institucion,
      nequi: datos.nequi,
      celular: datos.celular,
      email: datos.email,
      asesor_id: datos.asesor_id,
      ...fotos.columnas,
      mensaje: datos.mensaje,
      acepto_datos_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !fila) {
    // El insert no quedó: no dejar las fotos huérfanas en el bucket.
    await borrarFotosAfiliacion(admin, fotos.rutas);
    if (error?.code === "23505") {
      // S-06: ya existe una solicitud pendiente con esta cédula (índice único
      // parcial de la base). Se responde EXACTAMENTE igual que un envío
      // exitoso: mismo flash, mismo redirect, sin decir por qué. Solo el
      // evento queda en el registro del servidor, sin cédula ni nombre ni
      // correo (el equipo lo puede seguir viendo con QA_DEV_LOG si hace falta).
      registrar("warn", { evento: "afiliacion_duplicada" });
      await guardarFlashAfiliacion(datos.email);
      redirect("/afiliacion/enviada");
    }
    registrar("error", { evento: "afiliacion_insert_fallo", codigo: error?.code, mensaje: error?.message });
    return {
      errorGeneral: "No pudimos enviar tu solicitud. Intenta de nuevo en unos minutos.",
      valores,
    };
  }

  // 4. «Solicitud enviada».
  await guardarFlashAfiliacion(datos.email);
  redirect("/afiliacion/enviada");
}

"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { asesoresParaAfiliacion } from "@/lib/afiliacion/asesores";
import { guardarFlashAfiliacion } from "@/lib/afiliacion/flash";
import {
  borrarFotosSiHuerfanas,
  crearSubidasAfiliacion,
  rutaEsDelPrefijo,
  solicitudIdDeTicket,
  verificarFotosSubidas,
  type SubidasAfiliacion,
} from "@/lib/afiliacion/fotos";
import { cargarCatalogoGrados } from "@/lib/grados";
import { VERSION_POLITICA_DATOS } from "@/lib/politica-datos";
import { dentroDelLimite, ipDelCliente } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  CAMPOS_FOTO,
  crearEsquemaAfiliacion,
  esquemaPrepararSubida,
  leerFormularioAfiliacion,
  valoresDeTextoAfiliacion,
  type CampoAfiliacion,
  type CampoFoto,
  type EntradaAfiliacion,
  type ValoresAfiliacion,
} from "@/lib/validaciones/afiliacion";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";

export type EstadoAfiliacion = {
  errores?: Partial<Record<CampoAfiliacion, string>>;
  /** Error que no es de un campo (límite por IP, falla de la base). */
  errorGeneral?: string;
  /** Lo que escribió el usuario, para no borrarlo si hay error (sin fotos: se vuelven a subir). */
  valores?: ValoresAfiliacion;
};

export type ResultadoPrepararSubida =
  | ({ ok: true } & SubidasAfiliacion)
  | { ok: false; error: string };

const MENSAJE_FOTOS_FALLO = "No pudimos recibir tus fotos. Revisa tu conexión e intenta de nuevo.";

/**
 * Paso previo al envío: emite una URL firmada de subida por foto bajo un
 * prefijo nuevo `solicitudes/<id>/` (lib/afiliacion/fotos.ts). No recibe
 * archivos: solo el tipo de cada foto (jpeg/png/webp) para la extensión.
 * Límite: 10 por hora por IP (cada llamada permite subir hasta 15 MB).
 */
export async function prepararSubidaFotos(tipos: unknown): Promise<ResultadoPrepararSubida> {
  const resultado = esquemaPrepararSubida.safeParse(tipos);
  if (!resultado.success) return { ok: false, error: "La foto debe ser JPG, PNG o WEBP." };

  const ip = await ipDelCliente();
  if (!(await dentroDelLimite("afiliacion-subida-ip", ip, 10, 60 * 60))) {
    return { ok: false, error: "Recibimos varias solicitudes desde esta conexión. Intenta de nuevo en una hora." };
  }

  try {
    const subidas = await crearSubidasAfiliacion(crearClienteAdmin(), resultado.data);
    return { ok: true, ...subidas };
  } catch (e) {
    registrar("error", { evento: "afiliacion_preparar_subida_fallo", mensaje: e instanceof Error ? e.message : String(e) });
    return { ok: false, error: MENSAJE_FOTOS_FALLO };
  }
}

/** Rutas que mandó el navegador y que SÍ son del prefijo del ticket (las únicas que se pueden borrar). */
function rutasDelTicket(entrada: EntradaAfiliacion): { solicitudId: string; rutas: string[] } | null {
  const solicitudId = solicitudIdDeTicket(entrada.fotos_ticket);
  if (!solicitudId) return null;
  const rutas = (Object.keys(CAMPOS_FOTO) as CampoFoto[])
    .filter((campo) => rutaEsDelPrefijo(entrada[campo], solicitudId, campo))
    .map((campo) => entrada[campo]);
  return { solicitudId, rutas };
}

const MENSAJE_FOTO_VERIFICACION: Record<string, string> = {
  ticket: "Pasó mucho tiempo desde que subiste tus fotos. Envía de nuevo la solicitud.",
  ruta: "Vuelve a subir esta foto.",
  falta: "No recibimos esta foto. Vuelve a subirla.",
  peso: "La foto pesa demasiado (máximo 5 MB).",
  tipo: "La foto debe ser JPG, PNG o WEBP.",
};

/**
 * «Enviar solicitud» (spec-requerimientos-ricardo §2 + mapa de botones §5):
 * trampa → validación (con el catálogo de grados y la lista de asesores que
 * lee el servidor) → límite por IP y por cédula → verificar las 3 fotos ya
 * subidas → insert (service role, id = prefijo de las fotos) →
 * /afiliacion/enviada.
 * Sin correos al enviar la afiliación.
 *
 * S-06: una cédula con solicitud pendiente responde EXACTAMENTE igual que un
 * envío exitoso (mismo flash, mismo redirect); decide el índice único
 * parcial de la base (23505).
 */
export async function enviarAfiliacion(
  _previo: EstadoAfiliacion,
  formData: FormData,
): Promise<EstadoAfiliacion> {
  const entrada = leerFormularioAfiliacion(formData);
  const valores = valoresDeTextoAfiliacion(entrada);
  const admin = crearClienteAdmin();

  /** Si el envío no sigue, se borran las fotos subidas con ese ticket (si no hay solicitud con ese id). */
  async function descartarFotos() {
    const delTicket = rutasDelTicket(entrada);
    if (delTicket && delTicket.rutas.length > 0) {
      await borrarFotosSiHuerfanas(admin, delTicket.solicitudId, delTicket.rutas);
    }
  }

  // Campo trampa lleno = bot: responder «éxito» sin guardar nada.
  if (textoDe(formData, "sitio_web").trim() !== "") {
    registrar("warn", { evento: "afiliacion_trampa_activada" });
    await descartarFotos();
    await guardarFlashAfiliacion(entrada.email);
    redirect("/afiliacion/enviada");
  }

  // 1. Validación (mismo esquema que el navegador, con el contexto del servidor).
  const [grados, asesores] = await Promise.all([cargarCatalogoGrados(), asesoresParaAfiliacion()]);
  const resultado = crearEsquemaAfiliacion({ grados, asesores }).safeParse(entrada);
  if (!resultado.success) {
    await descartarFotos();
    return { errores: erroresPorCampo<CampoAfiliacion>(resultado.error), valores };
  }
  const datos = resultado.data;

  // 2. Límite de envíos: 5 por hora por IP y 3 por día por cédula.
  const ip = await ipDelCliente();
  if (!(await dentroDelLimite("afiliacion-ip", ip, 5, 60 * 60))) {
    await descartarFotos();
    return {
      errorGeneral: "Recibimos varias solicitudes desde esta conexión. Intenta de nuevo en una hora.",
      valores,
    };
  }
  if (!(await dentroDelLimite("afiliacion-cedula", datos.cedula, 3, 24 * 60 * 60))) {
    await descartarFotos();
    return {
      errores: { cedula: "Ya recibimos varias solicitudes con esta cédula hoy. Intenta de nuevo mañana." },
      valores,
    };
  }

  // 3. Las 3 fotos ya subidas: del prefijo del ticket, existen, ≤ 5 MB, bytes reales de imagen.
  const fotos = await verificarFotosSubidas(admin, datos.fotos_ticket, {
    foto_cedula_frente: datos.foto_cedula_frente,
    foto_cedula_reverso: datos.foto_cedula_reverso,
    foto_selfie: datos.foto_selfie,
  });
  if (!fotos.ok) {
    registrar("warn", { evento: "afiliacion_fotos_no_verificadas", motivo: fotos.motivo, campo: fotos.campo });
    await descartarFotos();
    const mensaje = MENSAJE_FOTO_VERIFICACION[fotos.motivo] ?? MENSAJE_FOTOS_FALLO;
    return fotos.campo ? { errores: { [fotos.campo]: mensaje }, valores } : { errorGeneral: mensaje, valores };
  }

  // 4. Insert con service role (RLS no deja insertar a nadie más).
  const { data: fila, error } = await admin
    .from("solicitudes_afiliacion")
    .insert({
      id: fotos.solicitudId,
      nombres: datos.nombres,
      apellidos: datos.apellidos,
      cedula: datos.cedula,
      grado: datos.grado_id,
      institucion: datos.institucion,
      nequi: datos.nequi,
      celular: datos.celular,
      email: datos.email,
      correo_institucional: datos.correo_institucional,
      nomina_entidad: datos.nomina.entidad,
      nomina_tipo: datos.nomina.tipo,
      nomina_numero: datos.nomina.numero,
      asesor_id: datos.asesor_id,
      ...fotos.columnas,
      mensaje: datos.mensaje,
      acepto_datos_at: new Date().toISOString(),
      // Versión de la política que aceptó (queda sellada en la base; no se puede cambiar después).
      version_politica_datos: VERSION_POLITICA_DATOS,
    })
    .select("id")
    .single();

  if (error || !fila) {
    // No dejar fotos huérfanas (si ya existe una solicitud con ese id, NO se borran).
    // RS-04: la limpieza corre DESPUÉS de responder (after), para que el camino
    // «cédula ya pendiente» (23505) no tarde más que el de éxito (oráculo de tiempo).
    after(() => borrarFotosSiHuerfanas(admin, fotos.solicitudId, fotos.rutas));
    if (error?.code === "23505") {
      // S-06: cédula con solicitud pendiente (o envío repetido con el mismo
      // ticket): se responde igual que un envío exitoso, sin decir por qué.
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

  // 5. «Solicitud enviada» (el flash guarda el correo personal ENMASCARADO).
  await guardarFlashAfiliacion(datos.email);
  redirect("/afiliacion/enviada");
}

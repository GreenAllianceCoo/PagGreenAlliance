"use server";

import { revalidatePath } from "next/cache";
import { exigirAdmin } from "@/lib/admin/servidor";
import { BUCKET_LOGOS } from "@/lib/conveniosServidor";
import { reordenarConvenios } from "@/lib/conveniosOrden";
import { registrar } from "@/lib/servidor/registro";
import { erroresPorCampo, textoDe } from "@/lib/validaciones/comunes";
import {
  bytesCoincidenConTipo,
  entradaGuardarConvenio,
  esquemaGuardarConvenio,
  esquemaIdConvenio,
  esquemaMoverConvenio,
  esquemaVisibilidadConvenio,
  leerFormularioConvenio,
  validarLogo,
  type CampoConvenio,
} from "@/lib/validaciones/convenios";

/** Rutas que muestran convenios: la landing (cache de 1 h), /cuenta y el panel. */
function refrescar() {
  revalidatePath("/admin/convenios");
  revalidatePath("/");
  revalidatePath("/cuenta");
}

export type EstadoGuardarConvenio = {
  errores?: Partial<Record<CampoConvenio, string>>;
  errorGeneral?: string;
  mensaje?: string;
  /** Sube con cada guardado correcto: el formulario lo usa para cerrarse. */
  guardado?: number;
  valores?: ReturnType<typeof leerFormularioConvenio>;
};

export type EstadoAccionConvenio = { error?: string; mensaje?: string };

/** Ruta que usa el logo dentro del bucket: <id>/<marca de tiempo>.<ext> (cada subida es un archivo nuevo, sin caché vieja). */
function rutaLogo(id: string, extension: string) {
  return `${id}/${Date.now()}.${extension}`;
}

/**
 * «Guardar convenio» (crear o editar). Valida con zod en el servidor, sube el
 * logo (tipo, tamaño y firma del archivo) al bucket `convenios-logos` con la
 * sesión del admin (RLS: solo admin escribe) y guarda la fila. Si la fila
 * falla después de subir el logo, borra el archivo recién subido.
 */
export async function guardarConvenio(
  _previo: EstadoGuardarConvenio,
  formData: FormData,
): Promise<EstadoGuardarConvenio> {
  const { supabase, userId } = await exigirAdmin();

  const entrada = leerFormularioConvenio(formData);
  const resultado = esquemaGuardarConvenio.safeParse(entradaGuardarConvenio(entrada));
  const errores: Partial<Record<CampoConvenio, string>> = resultado.success ? {} : erroresPorCampo<CampoConvenio>(resultado.error);

  // Logo (opcional): validado en el servidor, no se confía en `accept` del navegador.
  const archivo = formData.get("logo");
  const hayLogo = archivo instanceof File && archivo.size > 0;
  let logoNuevo: { bytes: Uint8Array; extension: string; tipo: string } | null = null;
  if (hayLogo) {
    const valido = validarLogo(archivo);
    if (!valido.ok) {
      errores.logo = valido.mensaje;
    } else {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      if (!bytesCoincidenConTipo(bytes, valido.tipo)) {
        errores.logo = "El archivo no coincide con el tipo de imagen indicado.";
      } else {
        logoNuevo = { bytes, extension: valido.extension, tipo: valido.tipo };
      }
    }
  }

  if (!resultado.success || errores.logo) return { errores, valores: entrada };
  const datos = resultado.data;
  const quitarLogo = formData.get("quitarLogo") === "on";

  const id = datos.id ?? crypto.randomUUID();

  // Logo anterior (para borrarlo si se reemplaza o se quita).
  let logoAnterior: string | null = null;
  if (datos.id) {
    const { data: actual, error: errorLectura } = await supabase
      .from("convenios")
      .select("logo_path")
      .eq("id", id)
      .maybeSingle();
    if (errorLectura || !actual) {
      return { errorGeneral: "No encontramos ese convenio. Recarga la página.", valores: entrada };
    }
    logoAnterior = (actual.logo_path as string | null) ?? null;
  }

  let logoPath: string | null = quitarLogo ? null : logoAnterior;
  let subido: string | null = null;
  if (logoNuevo) {
    const ruta = rutaLogo(id, logoNuevo.extension);
    const { error } = await supabase.storage
      .from(BUCKET_LOGOS)
      .upload(ruta, logoNuevo.bytes, { contentType: logoNuevo.tipo, upsert: false });
    if (error) {
      registrar("error", { evento: "convenio_logo_subida_fallo", mensaje: error.message });
      return { errores: { logo: "No pudimos subir el logo. Intenta de nuevo." }, valores: entrada };
    }
    subido = ruta;
    logoPath = ruta;
  }

  const fila = {
    nombre_empresa: datos.nombreEmpresa,
    nit: datos.nit,
    especialidad: datos.especialidad,
    emoji: datos.emoji,
    descripcion: datos.descripcion,
    servicios: datos.servicios,
    sedes: datos.sedes,
    telefono_contacto: datos.telefonoContacto,
    orden: datos.orden,
    visible: datos.visible,
    logo_path: logoPath,
    video_url: datos.videoUrl,
    pdf_url: datos.pdfUrl,
    pdf_tamano: datos.pdfUrl ? datos.pdfTamano : null,
  };

  const { error } = datos.id
    ? await supabase.from("convenios").update(fila).eq("id", id)
    : await supabase.from("convenios").insert({ id, ...fila });

  if (error) {
    if (subido) await supabase.storage.from(BUCKET_LOGOS).remove([subido]);
    registrar("error", { evento: "convenio_guardar_fallo", codigo: error.code, mensaje: error.message });
    // 23514 = check de la base (límites de longitud, formato de URL, teléfono…).
    return {
      errorGeneral:
        error.code === "23514"
          ? "Algún dato no cumple las reglas de la base. Revisa los campos e intenta de nuevo."
          : "No pudimos guardar el convenio. Intenta de nuevo.",
      valores: entrada,
    };
  }

  // Borra el logo anterior si se reemplazó o se quitó (si falla, solo queda un archivo huérfano).
  if (logoAnterior && logoAnterior !== logoPath) {
    const { error: errorBorrado } = await supabase.storage.from(BUCKET_LOGOS).remove([logoAnterior]);
    if (errorBorrado) registrar("warn", { evento: "convenio_logo_anterior_no_borrado", mensaje: errorBorrado.message });
  }

  registrar("info", { evento: datos.id ? "convenio_editado" : "convenio_creado", convenioId: id, admin: userId });
  refrescar();
  return { mensaje: datos.id ? "Convenio actualizado." : "Convenio creado.", guardado: Date.now() };
}

/** «Ocultar» / «Mostrar»: cambia `visible` (la landing y /cuenta solo leen los visibles). */
export async function alternarVisibilidadConvenio(
  _previo: EstadoAccionConvenio,
  formData: FormData,
): Promise<EstadoAccionConvenio> {
  const { supabase, userId } = await exigirAdmin();
  const resultado = esquemaVisibilidadConvenio.safeParse({ id: textoDe(formData, "id"), visible: textoDe(formData, "visible") });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { id, visible } = resultado.data;

  const { data, error } = await supabase.from("convenios").update({ visible }).eq("id", id).select("nombre_empresa").maybeSingle();
  if (error) {
    registrar("error", { evento: "convenio_visibilidad_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos guardar el cambio. Intenta de nuevo." };
  }
  if (!data) return { error: "No encontramos ese convenio." };

  registrar("info", { evento: visible ? "convenio_mostrado" : "convenio_ocultado", convenioId: id, admin: userId });
  refrescar();
  return { mensaje: visible ? `«${data.nombre_empresa}» ahora se muestra.` : `«${data.nombre_empresa}» quedó oculto.` };
}

/** «Subir» / «Bajar»: intercambia la posición con el vecino y renumera de 10 en 10. */
export async function moverConvenio(_previo: EstadoAccionConvenio, formData: FormData): Promise<EstadoAccionConvenio> {
  const { supabase, userId } = await exigirAdmin();
  const resultado = esquemaMoverConvenio.safeParse({ id: textoDe(formData, "id"), direccion: textoDe(formData, "direccion") });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { id, direccion } = resultado.data;

  const { data, error } = await supabase
    .from("convenios")
    .select("id, orden")
    .order("orden", { ascending: true })
    .order("nombre_empresa", { ascending: true });
  if (error || !data) {
    registrar("error", { evento: "convenio_mover_lectura_fallo", codigo: error?.code, mensaje: error?.message });
    return { error: "No pudimos cambiar el orden. Intenta de nuevo." };
  }

  const cambios = reordenarConvenios(data as { id: string; orden: number }[], id, direccion);
  if (cambios.length === 0) return {};

  const resultados = await Promise.all(cambios.map((c) => supabase.from("convenios").update({ orden: c.orden }).eq("id", c.id)));
  const fallo = resultados.find((r) => r.error);
  if (fallo?.error) {
    registrar("error", { evento: "convenio_mover_fallo", codigo: fallo.error.code, mensaje: fallo.error.message });
    refrescar();
    return { error: "No pudimos cambiar el orden. Recarga la página y revisa." };
  }

  registrar("info", { evento: "convenio_reordenado", convenioId: id, direccion, admin: userId });
  refrescar();
  return { mensaje: direccion === "subir" ? "Subió una posición." : "Bajó una posición." };
}

/** «Eliminar» (con confirmación en pantalla): borra la fila y su logo. */
export async function eliminarConvenio(_previo: EstadoAccionConvenio, formData: FormData): Promise<EstadoAccionConvenio> {
  const { supabase, userId } = await exigirAdmin();
  const resultado = esquemaIdConvenio.safeParse({ id: textoDe(formData, "id") });
  if (!resultado.success) return { error: "Datos inválidos." };
  const { id } = resultado.data;

  const { data, error } = await supabase.from("convenios").delete().eq("id", id).select("nombre_empresa, logo_path").maybeSingle();
  if (error) {
    registrar("error", { evento: "convenio_eliminar_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos eliminar el convenio. Si tiene datos asociados, ocúltalo en su lugar." };
  }
  if (!data) return { error: "No encontramos ese convenio." };

  if (data.logo_path) {
    const { error: errorBorrado } = await supabase.storage.from(BUCKET_LOGOS).remove([data.logo_path as string]);
    if (errorBorrado) registrar("warn", { evento: "convenio_logo_no_borrado", mensaje: errorBorrado.message });
  }

  registrar("info", { evento: "convenio_eliminado", convenioId: id, admin: userId });
  refrescar();
  return { mensaje: `«${data.nombre_empresa}» eliminado.` };
}

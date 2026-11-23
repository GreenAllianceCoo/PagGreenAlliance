"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { esImagenPorFirma, esPdfPorFirma, imagenAWebp, nombreArchivo } from "@/lib/convenio/archivos";
import {
  BUCKET_PUBLICACIONES,
  errorDeArchivos,
  esquemaPublicacion,
  IMAGEN_SUBIDA_MAX_BYTES,
  IMAGEN_TIPOS,
  leerFormularioPublicacion,
  PDF_MAX_BYTES,
  rutaEsDeLaPublicacion,
  type CampoPublicacion,
} from "@/lib/convenio/publicaciones";
import { exigirConvenio, obtenerPublicacionPropia } from "@/lib/convenio/servidor";
import { erroresPorCampo } from "@/lib/validaciones/comunes";
import { dentroDelLimite } from "@/lib/servidor/limite";
import { registrar } from "@/lib/servidor/registro";
import { createClient } from "@/lib/supabase/server";
import { BUCKET_LOGOS, esLogoEstatico } from "@/lib/conveniosServidor";
import {
  bytesCoincidenConTipo,
  esquemaDatosConvenioPropio,
  leerFormularioConvenioPropio,
  validarLogo,
  type CampoConvenioPropio,
} from "@/lib/validaciones/convenios";

/** «Salir» del panel del convenio: cierra la sesión y vuelve al ingreso con NIT. */
export async function cerrarSesionConvenio() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) registrar("error", { evento: "cerrar_sesion_fallo", estado: error.status, codigo: error.code });
  redirect("/ingresar/convenio");
}

const esquemaId = z.uuid();
const MENSAJE_OCULTA = "Green Alliance ocultó esta publicación. No se puede cambiar ni retirar.";
const MENSAJE_LIMITE_SUBIDAS = "Subiste muchos archivos seguidos. Espera unos minutos e intenta de nuevo.";

/** Las rutas de /convenio y del feed de los asociados que muestran publicaciones. */
function refrescar(id?: string) {
  revalidatePath("/convenio");
  if (id) revalidatePath(`/convenio/${id}`);
  revalidatePath("/cuenta/beneficios");
}

/**
 * Antes de subir un archivo: la publicación no puede estar oculta (si ya
 * existe) y hay un tope de subidas por convenio para no llenar el bucket.
 */
async function puedeSubir(supabase: Awaited<ReturnType<typeof exigirConvenio>>["supabase"], convenioId: string, publicacionId: string) {
  const actual = await obtenerPublicacionPropia(supabase, publicacionId);
  if (actual?.ocultaEn) return MENSAJE_OCULTA;
  if (!(await dentroDelLimite("convenio-subida", convenioId, 80, 60 * 60))) return MENSAJE_LIMITE_SUBIDAS;
  return null;
}

export type ResultadoSubida = { ruta?: string; error?: string };

/**
 * Sube UNA imagen de una publicación. Llega ya reducida en el navegador (el
 * límite de las Server Actions es 3 MB y el de Vercel 4,5 MB); aquí se valida
 * la firma y se reconvierte a WebP con sharp (máx. 1600 px, sin metadatos).
 */
export async function subirImagenPublicacion(formData: FormData): Promise<ResultadoSubida> {
  const { supabase, convenio } = await exigirConvenio();
  const id = esquemaId.safeParse(formData.get("publicacionId"));
  const archivo = formData.get("archivo");
  if (!id.success || !(archivo instanceof File)) return { error: "Datos inválidos." };
  if (!IMAGEN_TIPOS.includes(archivo.type as (typeof IMAGEN_TIPOS)[number])) return { error: "Usa imágenes JPG, PNG o WebP." };
  if (archivo.size <= 0 || archivo.size > IMAGEN_SUBIDA_MAX_BYTES) return { error: "La imagen pesa demasiado. Prueba con otra." };

  const bloqueo = await puedeSubir(supabase, convenio.id, id.data);
  if (bloqueo) return { error: bloqueo };

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  if (!esImagenPorFirma(bytes)) return { error: "El archivo no es una imagen válida." };

  let webp: Buffer;
  try {
    webp = await imagenAWebp(bytes);
  } catch (e) {
    registrar("warn", { evento: "publicacion_imagen_invalida", mensaje: e instanceof Error ? e.message : String(e) });
    return { error: "No pudimos leer esa imagen. Prueba con otra." };
  }

  const ruta = `${convenio.id}/${id.data}/${nombreArchivo("webp")}`;
  const { error } = await supabase.storage
    .from(BUCKET_PUBLICACIONES)
    .upload(ruta, webp, { contentType: "image/webp", upsert: false });
  if (error) {
    registrar("error", { evento: "publicacion_imagen_subida_fallo", mensaje: error.message });
    return { error: "No pudimos subir la imagen. Intenta de nuevo." };
  }
  return { ruta };
}

export type ResultadoSubidaPdf = { ruta?: string; token?: string; error?: string };

/**
 * El PDF (hasta 15 MB) no cabe en una Server Action: el servidor crea una URL
 * firmada de subida para una ruta que él mismo elige y el navegador sube el
 * archivo directo al bucket. guardarPublicacion revisa después la firma %PDF.
 */
export async function pedirSubidaPdf(formData: FormData): Promise<ResultadoSubidaPdf> {
  const { supabase, convenio } = await exigirConvenio();
  const id = esquemaId.safeParse(formData.get("publicacionId"));
  if (!id.success) return { error: "Datos inválidos." };

  const bloqueo = await puedeSubir(supabase, convenio.id, id.data);
  if (bloqueo) return { error: bloqueo };

  const ruta = `${convenio.id}/${id.data}/${nombreArchivo("pdf")}`;
  const { data, error } = await supabase.storage.from(BUCKET_PUBLICACIONES).createSignedUploadUrl(ruta);
  if (error || !data) {
    registrar("error", { evento: "publicacion_pdf_url_fallo", mensaje: error?.message });
    return { error: "No pudimos preparar la subida del PDF. Intenta de nuevo." };
  }
  return { ruta: data.path, token: data.token };
}

/** Descarga el PDF recién subido y revisa tamaño y firma. */
async function pdfValido(supabase: Awaited<ReturnType<typeof exigirConvenio>>["supabase"], ruta: string) {
  const { data, error } = await supabase.storage.from(BUCKET_PUBLICACIONES).download(ruta);
  if (error || !data) return false;
  if (data.size > PDF_MAX_BYTES) return false;
  const inicio = new Uint8Array(await data.slice(0, 8).arrayBuffer());
  return esPdfPorFirma(inicio);
}

async function borrarArchivos(supabase: Awaited<ReturnType<typeof exigirConvenio>>["supabase"], rutas: string[]) {
  if (rutas.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET_PUBLICACIONES).remove(rutas);
  if (error) registrar("warn", { evento: "publicacion_archivos_no_borrados", cantidad: rutas.length, mensaje: error.message });
}

/**
 * Quita un archivo que se subió pero aún no está guardado en la publicación
 * (el convenio lo cambió antes de publicar). Los guardados se borran al
 * guardar los cambios, no aquí.
 */
export async function descartarArchivo(formData: FormData): Promise<void> {
  const { supabase, convenio } = await exigirConvenio();
  const id = esquemaId.safeParse(formData.get("publicacionId"));
  const ruta = formData.get("ruta");
  if (!id.success || typeof ruta !== "string" || !rutaEsDeLaPublicacion(ruta, convenio.id, id.data)) return;
  const actual = await obtenerPublicacionPropia(supabase, id.data);
  if (actual && (actual.ocultaEn || actual.imagenes.includes(ruta) || actual.pdfPath === ruta)) return;
  await borrarArchivos(supabase, [ruta]);
}

export type EstadoPublicacionForm = {
  errores?: Partial<Record<CampoPublicacion, string>>;
  errorGeneral?: string;
  valores?: ReturnType<typeof leerFormularioPublicacion>;
};

/**
 * «Publicar» / «Guardar cambios». Se publica al guardar, sin aprobación. La
 * base vuelve a exigir todo (RLS: solo lo propio y no oculto; check de
 * archivos y fechas; trigger con los topes 10/5).
 */
export async function guardarPublicacion(_previo: EstadoPublicacionForm, formData: FormData): Promise<EstadoPublicacionForm> {
  const { supabase, convenio } = await exigirConvenio();
  const valores = leerFormularioPublicacion(formData);
  const id = esquemaId.safeParse(formData.get("id"));
  const editando = formData.get("modo") === "editar";
  if (!id.success) return { errorGeneral: "Datos inválidos. Recarga la página.", valores };

  const imagenes = formData.getAll("imagenes").filter((v): v is string => typeof v === "string" && v !== "");
  const pdfCampo = formData.get("pdf");
  const pdf = typeof pdfCampo === "string" && pdfCampo !== "" ? pdfCampo : null;
  const rutas = pdf ? [...imagenes, pdf] : imagenes;

  const resultado = esquemaPublicacion().safeParse(valores);
  const errores: Partial<Record<CampoPublicacion, string>> = resultado.success ? {} : erroresPorCampo<CampoPublicacion>(resultado.error);
  if (rutas.some((r) => !rutaEsDeLaPublicacion(r, convenio.id, id.data))) {
    return { errorGeneral: "Los archivos no corresponden a esta publicación. Recarga la página.", valores };
  }
  if (resultado.success) {
    const errorArchivos = errorDeArchivos(resultado.data.tipo, imagenes.length, Boolean(pdf));
    if (errorArchivos) errores.archivos = errorArchivos;
  }

  const actual = editando ? await obtenerPublicacionPropia(supabase, id.data) : null;
  if (editando && !actual) return { errorGeneral: "No encontramos esa publicación.", valores };
  if (actual?.ocultaEn) return { errorGeneral: MENSAJE_OCULTA, valores };
  if (actual && resultado.success && actual.tipo !== resultado.data.tipo) {
    return { errorGeneral: "No se puede cambiar el tipo de una publicación.", valores };
  }

  const anteriores = new Set(actual ? [...actual.imagenes, ...(actual.pdfPath ? [actual.pdfPath] : [])] : []);
  const nuevas = rutas.filter((r) => !anteriores.has(r));

  if (!resultado.success || Object.keys(errores).length > 0) return { errores, valores };
  const datos = resultado.data;

  if (pdf && !anteriores.has(pdf) && !(await pdfValido(supabase, pdf))) {
    await borrarArchivos(supabase, [pdf]);
    return { errores: { archivos: "El archivo no es un PDF válido o pesa más de 15 MB." }, valores };
  }

  const fila = {
    titulo: datos.titulo,
    descripcion: datos.descripcion,
    beneficio: datos.tipo === "promocion" ? datos.beneficio : null,
    imagenes,
    pdf_path: pdf,
    inicia_el: datos.iniciaEl,
    termina_el: datos.terminaEl,
  };
  const { error } = actual
    ? await supabase.from("convenio_publicaciones").update(fila).eq("id", id.data)
    : await supabase.from("convenio_publicaciones").insert({ id: id.data, convenio_id: convenio.id, tipo: datos.tipo, ...fila });

  if (error) {
    await borrarArchivos(supabase, nuevas);
    registrar(error.code === "P0001" ? "warn" : "error", { evento: "publicacion_guardar_fallo", codigo: error.code, mensaje: error.message });
    // P0001: tope de publicaciones (mensaje escrito para el convenio en el trigger).
    if (error.code === "P0001" && error.message.startsWith("Ya tienes")) return { errorGeneral: error.message, valores };
    return { errorGeneral: "No pudimos guardar la publicación. Revisa los datos e intenta de nuevo.", valores };
  }

  // Archivos que se quitaron al editar.
  if (actual) await borrarArchivos(supabase, [...anteriores].filter((r) => !rutas.includes(r)));

  registrar("info", { evento: actual ? "publicacion_editada" : "publicacion_creada", convenioId: convenio.id, publicacionId: id.data });
  refrescar(id.data);
  redirect(`/convenio?listo=${actual ? "editada" : "publicada"}`);
}

export type EstadoRetirar = { error?: string };

/** «Retirar»: borra la publicación y sus archivos (solo si no está oculta). */
export async function retirarPublicacion(_previo: EstadoRetirar, formData: FormData): Promise<EstadoRetirar> {
  const { supabase, convenio } = await exigirConvenio();
  const id = esquemaId.safeParse(formData.get("id"));
  if (!id.success) return { error: "Datos inválidos." };

  const actual = await obtenerPublicacionPropia(supabase, id.data);
  if (!actual) return { error: "No encontramos esa publicación." };
  if (actual.ocultaEn) return { error: MENSAJE_OCULTA };

  const { data, error } = await supabase.from("convenio_publicaciones").delete().eq("id", id.data).select("id");
  if (error || !data || data.length === 0) {
    registrar("error", { evento: "publicacion_retirar_fallo", codigo: error?.code, mensaje: error?.message });
    return { error: "No pudimos retirar la publicación. Intenta de nuevo." };
  }
  await borrarArchivos(supabase, [...actual.imagenes, ...(actual.pdfPath ? [actual.pdfPath] : [])]);

  registrar("info", { evento: "publicacion_retirada", convenioId: convenio.id, publicacionId: id.data });
  refrescar(id.data);
  redirect("/convenio?listo=retirada");
}

export type EstadoDatosEmpresa = {
  errores?: Partial<Record<CampoConvenioPropio, string>>;
  errorGeneral?: string;
  valores?: ReturnType<typeof leerFormularioConvenioPropio>;
};

/**
 * «Guardar cambios» de /convenio/empresa. Valida con los mismos límites del
 * admin, sube el logo a la carpeta <convenio_id>/ del bucket público (RLS:
 * solo su carpeta) y guarda con actualizar_datos_convenio(), que solo toca
 * los campos de la ficha. Nombre y NIT siguen siendo del admin.
 */
export async function guardarDatosEmpresa(_previo: EstadoDatosEmpresa, formData: FormData): Promise<EstadoDatosEmpresa> {
  const { supabase, convenio } = await exigirConvenio();
  const entrada = leerFormularioConvenioPropio(formData);
  const resultado = esquemaDatosConvenioPropio.safeParse(entrada);
  const errores: Partial<Record<CampoConvenioPropio, string>> = resultado.success
    ? {}
    : erroresPorCampo<CampoConvenioPropio>(resultado.error);

  const quitarLogo = formData.get("quitarLogo") === "on";
  const archivo = formData.get("logo");
  let logoNuevo: { bytes: Uint8Array; extension: string; tipo: string } | null = null;
  if (archivo instanceof File && archivo.size > 0) {
    const valido = validarLogo(archivo);
    if (!valido.ok) errores.logo = valido.mensaje;
    else {
      const bytes = new Uint8Array(await archivo.arrayBuffer());
      if (!bytesCoincidenConTipo(bytes, valido.tipo)) errores.logo = "El archivo no coincide con el tipo de imagen indicado.";
      else logoNuevo = { bytes, extension: valido.extension, tipo: valido.tipo };
    }
  }
  if (!resultado.success || errores.logo) return { errores, valores: entrada };

  if (logoNuevo && !(await dentroDelLimite("convenio-logo", convenio.id, 20, 60 * 60))) {
    return { errores: { logo: MENSAJE_LIMITE_SUBIDAS }, valores: entrada };
  }

  let logoPath: string | null = null;
  if (logoNuevo) {
    logoPath = `${convenio.id}/${Date.now()}.${logoNuevo.extension}`;
    const { error } = await supabase.storage
      .from(BUCKET_LOGOS)
      .upload(logoPath, logoNuevo.bytes, { contentType: logoNuevo.tipo, upsert: false });
    if (error) {
      registrar("error", { evento: "convenio_propio_logo_subida_fallo", mensaje: error.message });
      return { errores: { logo: "No pudimos subir el logo. Intenta de nuevo." }, valores: entrada };
    }
  }

  const datos = resultado.data;
  const { data: logoAnterior, error } = await supabase.rpc("actualizar_datos_convenio", {
    p_especialidad: datos.especialidad,
    p_descripcion: datos.descripcion,
    p_telefono: datos.telefonoContacto,
    p_servicios: datos.servicios,
    p_sedes: datos.sedes,
    p_cambiar_logo: Boolean(logoNuevo) || quitarLogo,
    p_logo_path: logoPath,
  });
  if (error) {
    registrar("error", { evento: "convenio_propio_guardar_fallo", codigo: error.code, mensaje: error.message });
    if (logoPath) await supabase.storage.from(BUCKET_LOGOS).remove([logoPath]);
    return { errorGeneral: "No pudimos guardar los cambios. Intenta de nuevo.", valores: entrada };
  }

  // Borra el logo reemplazado si estaba en su carpeta (si falla, solo queda un archivo huérfano).
  if (typeof logoAnterior === "string" && logoAnterior.startsWith(`${convenio.id}/`) && !esLogoEstatico(logoAnterior)) {
    const { error: errorBorrado } = await supabase.storage.from(BUCKET_LOGOS).remove([logoAnterior]);
    if (errorBorrado) registrar("warn", { evento: "convenio_propio_logo_anterior_no_borrado", mensaje: errorBorrado.message });
  }

  registrar("info", { evento: "convenio_propio_editado", convenioId: convenio.id });
  revalidatePath("/convenio", "layout");
  revalidatePath("/");
  revalidatePath("/cuenta");
  redirect("/convenio?listo=empresa");
}

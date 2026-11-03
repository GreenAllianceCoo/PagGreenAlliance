"use server";

import { revalidatePath } from "next/cache";
import { registrar } from "@/lib/servidor/registro";
import { exigirAdmin } from "@/lib/admin/servidor";
import { correoDeCedula } from "@/lib/ingreso/servidor";
import {
  enviarCondicionesCredito,
  enviarCreditoAsignado,
  enviarDesembolsoCredito,
} from "@/lib/correo/credito";
import { aplicarResolucionCredito } from "@/lib/admin/resolucionCredito";
import { formatearFechaLarga } from "@/lib/fechas";
import { destinatariosAviso } from "@/lib/correo/destinatarios";
import { avisarCorreoInstitucional } from "@/lib/correo/institucional";
import { textoDe } from "@/lib/validaciones/comunes";
import {
  esquemaBuscarCedula,
  esquemaCrearCreditoAdmin,
  esquemaEditarCondicionesCredito,
  esquemaMarcarDesembolso,
  esquemaResolverCredito,
  leerFormularioCondiciones,
  leerFormularioCrearCredito,
  type CampoCrearCreditoAdmin,
  type CampoEditarCondiciones,
} from "@/lib/validaciones/admin";
import { cupoCreditoDelGrado } from "@/lib/grados";
import { esEstadoProceso, ETIQUETA_ESTADO_PROCESO } from "@/lib/procesoEjecutivo";
import { crearSubidaComprobante, firmarComprobante, registrarComprobanteSubido, rutaDeComprobante } from "@/lib/admin/comprobantes";
import { esquemaPrepararComprobante, esquemaRegistrarComprobante, esquemaVerComprobante } from "@/lib/validaciones/comprobante";

export type EstadoAccionCredito = { error?: string; mensaje?: string };

/**
 * «Aprobar» / «Rechazar» de /admin/creditos. La lógica (no resolver la propia,
 * solo pendientes, carrera S-11 y correo del resultado) vive en
 * lib/admin/resolucionCredito.ts, compartida con la vista de tabla.
 */
export async function resolverCredito(
  _previo: EstadoAccionCredito,
  formData: FormData,
): Promise<EstadoAccionCredito> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaResolverCredito.safeParse({
    id: formData.get("id"),
    decision: formData.get("decision"),
    motivo: formData.get("motivo") ?? undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const respuesta = await aplicarResolucionCredito(supabase, userId, resultado.data);
  if (respuesta.error) return { error: respuesta.error };

  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta"); // el asociado ve el estado nuevo en su pantalla
  return { mensaje: respuesta.mensaje };
}

/** Textos de admin_marcar_desembolsado() listos para mostrar (los demás errores se ocultan). */
const MENSAJES_DESEMBOLSO = [
  "Solo un crédito aprobado se puede marcar como desembolsado",
  "Este crédito ya fue marcado como desembolsado",
  "La fecha de desembolso no puede ser futura",
  "La fecha de desembolso no puede ser anterior a la aprobación",
  "No puede marcar el desembolso de su propio crédito; debe hacerlo otro administrador",
  "La solicitud no existe",
];

/**
 * «Marcar desembolsado» de /admin/creditos (spec §12.2). Solo el admin, por la
 * RPC `admin_marcar_desembolsado` (la base valida estado, fecha y que no sea
 * el propio crédito, y deja el historial). Sin fecha = hoy en Colombia. Después
 * avisa: correo con el monto al personal y aviso sin datos al institucional.
 * Campos del formulario: `id` y `fecha` (opcional, AAAA-MM-DD).
 */
export async function marcarDesembolsado(
  _previo: EstadoAccionCredito,
  formData: FormData,
): Promise<EstadoAccionCredito> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaMarcarDesembolso.safeParse({
    id: formData.get("id"),
    fecha: formData.get("fecha") ?? undefined,
  });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Datos inválidos." };
  }
  const datos = resultado.data;
  // Comprobante opcional (se recomienda): el navegador ya lo subió a Storage con una
  // URL firmada y solo manda la ruta; se verifica más abajo, DESPUÉS de marcar el desembolso.
  const rutaComprobante = textoDe(formData, "comprobanteRuta");

  const { data, error } = await supabase
    .rpc("admin_marcar_desembolsado", { p_solicitud_id: datos.id, p_fecha: datos.fecha ?? null })
    .maybeSingle();
  if (error || !data) {
    const conocido = MENSAJES_DESEMBOLSO.find((m) => error?.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "credito_desembolso_fallo", codigo: error?.code, mensaje: error?.message, solicitud_id: datos.id });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos marcar el desembolso. Intenta de nuevo." };
  }
  const fecha = String((data as { fecha_desembolso: string }).fecha_desembolso).slice(0, 10);

  // Comprobante: si falla, el desembolso YA quedó marcado; se avisa para que lo suba de nuevo.
  let conComprobante = false;
  let avisoComprobante = "";
  if (rutaComprobante) {
    const guardado = esquemaRegistrarComprobante.safeParse({ solicitudId: datos.id, ruta: rutaComprobante });
    const r = guardado.success ? await registrarComprobanteSubido(supabase, datos.id, guardado.data.ruta) : null;
    if (r?.ok) conComprobante = true;
    else avisoComprobante = " El comprobante no se guardó; súbelo de nuevo desde este crédito.";
  }

  // Aviso al asociado (no bloquea la respuesta si algo falla).
  const { data: solicitud } = await supabase
    .from("solicitudes_credito")
    .select("asociado_id, monto_solicitado, plazo_meses")
    .eq("id", datos.id)
    .single();
  if (solicitud) {
    const { data: perfil } = await supabase
      .from("perfiles")
      .select("nombre_completo, cedula, correo_institucional")
      .eq("id", solicitud.asociado_id)
      .single();
    if (perfil) {
      const correoPersonal = await correoDeCedula(perfil.cedula);
      const correo = destinatariosAviso(correoPersonal);
      await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
      if (correo.length > 0) {
        await enviarDesembolsoCredito({
          id: datos.id,
          nombre: perfil.nombre_completo,
          correo,
          monto: Number(solicitud.monto_solicitado),
          fecha,
          fechaTexto: formatearFechaLarga(fecha),
          conComprobante,
          plazoMeses: Number(solicitud.plazo_meses),
        });
      }
    }
  }

  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  return { mensaje: conComprobante ? "Desembolso registrado con su comprobante." : `Desembolso registrado.${avisoComprobante}` };
}

export type EstadoEditarCondiciones = EstadoAccionCredito & {
  errores?: Partial<Record<CampoEditarCondiciones, string>>;
};

/** Textos de admin_editar_condiciones_credito() listos para mostrar (los demás errores se ocultan). */
const MENSAJES_CONDICIONES = [
  "No puedes editar tu propio crédito; debe hacerlo otro administrador",
  "Un crédito rechazado no se puede editar",
  "Un crédito desembolsado no se puede editar",
  "Ese convenio no está disponible",
  "No hay tasas configuradas para este grado",
  "No hay cambios para guardar",
  "La solicitud no existe",
];

/**
 * «Editar condiciones» de /admin/creditos: lo que recibe, lo que devuelve, plazo,
 * porcentaje y tipo. Solo admin, por la RPC (la base exige que no esté desembolsado
 * y deja el historial con el motivo). El asociado recibe un aviso solo si cambió
 * algo que él ve: lo que devuelve no se le muestra (revela la tasa).
 */
export async function editarCondicionesCredito(
  _previo: EstadoEditarCondiciones,
  formData: FormData,
): Promise<EstadoEditarCondiciones> {
  const { supabase } = await exigirAdmin();

  const resultado = esquemaEditarCondicionesCredito.safeParse(leerFormularioCondiciones(formData));
  if (!resultado.success) {
    const errores: Partial<Record<CampoEditarCondiciones, string>> = {};
    for (const problema of resultado.error.issues) {
      const campo = problema.path[0] as CampoEditarCondiciones | undefined;
      if (campo && !errores[campo]) errores[campo] = problema.message;
    }
    return { errores };
  }
  const datos = resultado.data;

  const { data: campos, error } = await supabase.rpc("admin_editar_condiciones_credito", {
    p_solicitud_id: datos.id,
    p_monto: datos.monto,
    p_total_a_pagar: datos.totalAPagar,
    p_plazo_meses: datos.plazoMeses,
    p_porcentaje: datos.porcentaje,
    p_tipo: datos.tipoCredito,
    p_convenio_id: datos.convenioId,
    p_motivo: datos.motivo,
  });
  if (error) {
    const conocido = MENSAJES_CONDICIONES.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "credito_condiciones_fallo", codigo: error.code, mensaje: error.message, solicitud_id: datos.id });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos guardar los cambios. Intenta de nuevo." };
  }

  const cambiados = (campos ?? []) as string[];
  if (cambiados.some((c) => c !== "total")) {
    const { data: solicitud } = await supabase
      .from("solicitudes_credito")
      .select("asociado_id, convenios:convenio_id(nombre_empresa)")
      .eq("id", datos.id)
      .single();
    const { data: perfil } = solicitud
      ? await supabase
          .from("perfiles")
          .select("nombre_completo, cedula, correo_institucional")
          .eq("id", solicitud.asociado_id)
          .single()
      : { data: null };
    if (solicitud && perfil) {
      const correoPersonal = await correoDeCedula(perfil.cedula);
      const correo = destinatariosAviso(correoPersonal);
      await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
      if (correo.length > 0) {
        const convenio = solicitud.convenios as unknown as { nombre_empresa: string } | null;
        await enviarCondicionesCredito({
          id: datos.id,
          nombre: perfil.nombre_completo,
          correo,
          monto: datos.monto,
          plazoMeses: datos.plazoMeses,
          porcentaje: datos.porcentaje,
          tipo: datos.tipoCredito === "convenio" ? `Convenio ${convenio?.nombre_empresa ?? ""}`.trim() : "Cooperativa",
        });
      }
    }
  }

  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/perfil");
  return { mensaje: "Condiciones actualizadas." };
}

// ---------------------------------------------------------------------------
// «Nuevo crédito»: el admin crea un crédito ya aprobado sin solicitud del asociado
// ---------------------------------------------------------------------------

/** Lo que el admin ve del asociado antes de crearle el crédito. */
export type AsociadoParaCredito = {
  id: string;
  nombre: string;
  cedula: string;
  /** Nombre del grado (o el código si no está en el catálogo); null = sin grado. */
  grado: string | null;
  /** Grupo de `grados_credito` (clave de los topes del panel); null = sin cupo. */
  grupo: string | null;
  /** Cupo del grado al 50 % y al 100 %; null = no se pudo leer o no tiene. */
  cupo50: number | null;
  cupo100: number | null;
  /** Plazo de la tabla del grado (100 %), para proponerlo en el formulario. */
  plazoSugerido: number | null;
  /** Etiqueta del paso del proceso ejecutivo; null = sin proceso. */
  proceso: string | null;
  /** Razones por las que la base no dejaría crearlo (vacío = se puede). */
  bloqueos: string[];
};

export type EstadoBuscarAsociado = { error?: string; asociado?: AsociadoParaCredito };

/**
 * Paso 1 de «Nuevo crédito»: busca al asociado por cédula con la sesión del admin
 * (RLS). Devuelve nombre, grado, proceso y cupo, y avisa de antemano lo que la
 * base rechazaría (la base lo vuelve a exigir en admin_crear_credito).
 */
export async function buscarAsociadoPorCedula(
  _previo: EstadoBuscarAsociado,
  formData: FormData,
): Promise<EstadoBuscarAsociado> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaBuscarCedula.safeParse({ cedula: textoDe(formData, "cedula") });
  if (!resultado.success) {
    return { error: resultado.error.issues[0]?.message ?? "Revisa la cédula." };
  }
  const { cedula } = resultado.data;

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("id, nombre_completo, cedula, grado, rol, activo, eliminado_at")
    .eq("cedula", cedula)
    .maybeSingle();
  if (error) {
    registrar("error", { evento: "admin_buscar_cedula_fallo", codigo: error.code, mensaje: error.message });
    return { error: "No pudimos buscar la cédula. Intenta de nuevo." };
  }
  if (!perfil || perfil.rol !== "asociado" || perfil.eliminado_at) {
    return { error: "No encontramos un asociado con esa cédula." };
  }

  const id = perfil.id as string;
  const [cupo, { data: proceso }, { data: pendientes }] = await Promise.all([
    cupoCreditoDelGrado(supabase, perfil.grado as string | null),
    supabase.from("procesos_ejecutivos").select("estado").eq("asociado_id", id).maybeSingle(),
    supabase.from("solicitudes_credito").select("id").eq("asociado_id", id).eq("estado", "pendiente").limit(1),
  ]);

  const estadoProceso = esEstadoProceso(proceso?.estado) ? proceso.estado : null;
  const paquetes = cupo.estado === "con_cupo" ? cupo.paquetes : [];
  const cupo50 = paquetes.find((p) => p.porcentaje === "50")?.capacidad_maxima ?? null;
  const paquete100 = paquetes.find((p) => p.porcentaje === "100");

  // Mismo orden de reglaSolicitarCredito (lib/credito.ts), con textos para el admin.
  const bloqueos: string[] = [];
  if (id === userId) bloqueos.push("Es tu propia cuenta: otro administrador debe crearte el crédito.");
  if (perfil.activo === false) bloqueos.push("El asociado está inactivo.");
  if (cupo.estado === "sin_grado") bloqueos.push("El asociado no tiene grado asignado.");
  if (cupo.estado === "sin_cupo") bloqueos.push("Su grado no tiene cupo de crédito configurado.");
  if (estadoProceso !== "operando") bloqueos.push("Su proceso ejecutivo no está en «Operando».");
  if ((pendientes ?? []).length > 0) bloqueos.push("Tiene una solicitud pendiente: resuélvela primero.");

  return {
    asociado: {
      id,
      nombre: perfil.nombre_completo as string,
      cedula: perfil.cedula as string,
      grado: cupo.estado === "sin_grado" ? null : cupo.nombre,
      grupo: cupo.estado === "con_cupo" ? cupo.grupo : null,
      cupo50,
      cupo100: paquete100?.capacidad_maxima ?? null,
      plazoSugerido: paquete100?.plazo_meses ?? null,
      proceso: estadoProceso ? ETIQUETA_ESTADO_PROCESO[estadoProceso] : null,
      bloqueos,
    },
  };
}

export type EstadoCrearCredito = EstadoAccionCredito & {
  errores?: Partial<Record<CampoCrearCreditoAdmin, string>>;
};

/**
 * Textos de admin_crear_credito() listos para mostrar (los demás errores se ocultan).
 * Una sola lista para alinearla con la migración: se compara con `includes`.
 */
const MENSAJES_CREAR_CREDITO = [
  "No puedes crearte un crédito a ti mismo; debe hacerlo otro administrador",
  "No encontramos al asociado",
  "El asociado está inactivo; no se le puede crear un crédito",
  "El asociado no tiene un grado con cupo de crédito configurado",
  "El proceso ejecutivo del asociado no está en «operando»",
  "El asociado ya tiene una solicitud de crédito pendiente; resuélvela primero",
  "Ese convenio no está disponible",
  "No hay un tope configurado para el grado",
];

/**
 * «Nuevo crédito» de /admin/creditos (solo admin): crea el crédito ya APROBADO, listo
 * para «Marcar desembolsado». Escribe solo por la RPC admin_crear_credito, que exige
 * admin, no a sí mismo, asociado activo con grado y cupo, proceso «operando» y sin
 * solicitud pendiente; puede superar el cupo (el motivo queda en el historial).
 * El aviso al asociado nunca lleva el motivo ni lo que devuelve (revela la tasa).
 */
export async function crearCreditoAdmin(_previo: EstadoCrearCredito, formData: FormData): Promise<EstadoCrearCredito> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaCrearCreditoAdmin.safeParse(leerFormularioCrearCredito(formData));
  if (!resultado.success) {
    const errores: Partial<Record<CampoCrearCreditoAdmin, string>> = {};
    for (const problema of resultado.error.issues) {
      const campo = problema.path[0] as CampoCrearCreditoAdmin | undefined;
      if (campo && !errores[campo]) errores[campo] = problema.message;
    }
    // El asociado no es un campo visible del formulario: va como error general.
    if (errores.asociadoId) return { error: errores.asociadoId };
    return { errores };
  }
  const datos = resultado.data;
  if (datos.asociadoId === userId) {
    return { error: "No puedes crearte un crédito a ti mismo; debe hacerlo otro administrador." };
  }

  const { data: solicitudId, error } = await supabase.rpc("admin_crear_credito", {
    p_asociado_id: datos.asociadoId,
    p_monto: datos.monto,
    p_total_a_pagar: datos.totalAPagar,
    p_plazo_meses: datos.plazoMeses,
    p_porcentaje: datos.porcentaje,
    p_tipo: datos.tipoCredito,
    p_convenio_id: datos.convenioId,
    p_motivo: datos.motivo,
  });
  if (error) {
    const conocido = MENSAJES_CREAR_CREDITO.find((m) => error.message?.includes(m));
    if (!conocido) {
      registrar("error", { evento: "credito_admin_crear_fallo", codigo: error.code, mensaje: error.message, asociado_id: datos.asociadoId });
    }
    return { error: conocido ? `${conocido}.` : "No pudimos crear el crédito. Intenta de nuevo." };
  }
  registrar("info", { evento: "credito_admin_creado", actor_id: userId, asociado_id: datos.asociadoId, solicitud_id: solicitudId });

  // Aviso al asociado (no bloquea la respuesta si algo falla).
  const [{ data: perfil }, { data: convenio }] = await Promise.all([
    supabase.from("perfiles").select("nombre_completo, cedula, correo_institucional").eq("id", datos.asociadoId).single(),
    datos.convenioId
      ? supabase.from("convenios").select("nombre_empresa").eq("id", datos.convenioId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (perfil) {
    const correoPersonal = await correoDeCedula(perfil.cedula);
    const correo = destinatariosAviso(correoPersonal);
    await avisarCorreoInstitucional(correoPersonal, perfil.correo_institucional);
    if (correo.length > 0) {
      const empresa = (convenio as { nombre_empresa?: string } | null)?.nombre_empresa ?? "";
      await enviarCreditoAsignado({
        id: String(solicitudId ?? ""),
        nombre: perfil.nombre_completo,
        correo,
        monto: datos.monto,
        plazoMeses: datos.plazoMeses,
        porcentaje: datos.porcentaje,
        tipo: datos.tipoCredito === "convenio" ? `Convenio ${empresa}`.trim() : "Cooperativa",
      });
    }
  }

  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  revalidatePath("/cuenta/perfil");
  return { mensaje: "Crédito creado y aprobado. Ya puedes marcarlo como desembolsado." };
}

// ---------------------------------------------------------------------------
// Comprobante de desembolso (subir / reemplazar / ver)
// ---------------------------------------------------------------------------

export type RespuestaPrepararComprobante =
  | { ok: true; ruta: string; token: string; bucket: string }
  | { ok: false; error: string };

/**
 * Paso 1 de la subida: URL firmada para que el navegador suba el archivo directo
 * a Storage. Solo admin; valida tipo y tamaño (el bucket los vuelve a exigir).
 */
export async function prepararSubidaComprobante(entrada: {
  solicitudId: string;
  tipo: string;
  tamano: number;
}): Promise<RespuestaPrepararComprobante> {
  await exigirAdmin();
  const r = esquemaPrepararComprobante.safeParse(entrada);
  if (!r.success) return { ok: false, error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const subida = await crearSubidaComprobante(r.data.solicitudId, r.data.tipo);
  if (!subida) return { ok: false, error: "No pudimos preparar la subida. Intenta de nuevo." };
  return { ok: true, ...subida };
}

/**
 * Paso 2 (crédito ya desembolsado): liga el archivo subido a la solicitud. Sirve para
 * subir el comprobante por primera vez o reemplazarlo; la base deja el historial.
 */
export async function guardarComprobanteDesembolso(entrada: {
  solicitudId: string;
  ruta: string;
}): Promise<EstadoAccionCredito> {
  const { supabase } = await exigirAdmin();
  const r = esquemaRegistrarComprobante.safeParse(entrada);
  if (!r.success) return { error: r.error.issues[0]?.message ?? "Datos inválidos." };
  const resultado = await registrarComprobanteSubido(supabase, r.data.solicitudId, r.data.ruta);
  if (!resultado.ok) return { error: resultado.error };
  revalidatePath("/admin/creditos");
  revalidatePath("/cuenta");
  return { mensaje: "Comprobante guardado." };
}

/** «Ver comprobante» del admin: URL firmada de 3 minutos. */
export async function urlComprobanteAdmin(entrada: { solicitudId: string }): Promise<{ url?: string; error?: string }> {
  await exigirAdmin();
  const r = esquemaVerComprobante.safeParse(entrada);
  if (!r.success) return { error: "No encontramos la solicitud." };
  const ruta = await rutaDeComprobante(r.data.solicitudId);
  if (!ruta) return { error: "Este crédito no tiene comprobante." };
  const url = await firmarComprobante(ruta);
  return url ? { url } : { error: "No pudimos abrir el comprobante. Intenta de nuevo." };
}

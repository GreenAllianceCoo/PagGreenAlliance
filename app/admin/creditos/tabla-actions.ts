"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { exigirAdmin } from "@/lib/admin/servidor";
import { aplicarResolucionCredito } from "@/lib/admin/resolucionCredito";
import { esEntidadDeLista, OPCION_OTRA_ENTIDAD } from "@/lib/afiliacion/entidades";
import { registrar } from "@/lib/servidor/registro";
import { esquemaGuardarCambiosTablaCreditos, type EntradaCambiosTablaCreditos } from "@/lib/validaciones/admin";
import { editarDatosAsociado } from "@/app/admin/asociados/actions";
import { cambiarCedulaAsociado } from "@/app/admin/asociados/cedula-actions";

/**
 * Resultado de un grupo de celdas de la tabla. `clave`:
 * - `datos:<asociadoId>`  → nombre y/o celular de la persona,
 * - `cedula:<asociadoId>` → su cédula,
 * - `estado:<solicitudId>` → aprobar o rechazar esa solicitud.
 */
export type ResultadoCambioTabla = { clave: string; ok: boolean; error?: string };

export type RespuestaTablaCreditos = {
  /** Error general (nada se aplicó). */
  error?: string;
  /** Error del motivo (nada se aplicó). */
  errorMotivo?: string;
  resultados?: ResultadoCambioTabla[];
  /** Resumen para el toast: «5 guardados, 1 con error». */
  mensaje?: string;
};

const MENSAJE_GENERICO = "No pudimos guardar este cambio. Intenta de nuevo.";

/** Primer mensaje de una respuesta de las acciones existentes ({ error } o { errores: { campo } }). */
function primerError(respuesta: { error?: string; errores?: Partial<Record<string, string | undefined>> }): string | undefined {
  if (respuesta.error) return respuesta.error;
  const mensajes = Object.values(respuesta.errores ?? {}).filter(Boolean) as string[];
  return mensajes[0];
}

/**
 * Nombre y/o celular por la acción de «Editar datos» del asociado (RPC
 * admin_editar_datos_asociado, que pide TODOS los campos): el correo institucional
 * y la cuenta de nómina se reenvían sin cambio, leídos del perfil, en la misma forma
 * en que el formulario de la ficha los precarga. Esa acción repite sus reglas (no a
 * sí mismo, no a un cliente suyo, frecuencia) y no manda correos.
 */
async function aplicarDatosPersona(
  supabase: SupabaseClient,
  cambio: { asociadoId: string; nombre?: string; telefono?: string | null },
): Promise<ResultadoCambioTabla> {
  const clave = `datos:${cambio.asociadoId}`;
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre_completo, telefono, correo_institucional, nomina_entidad, nomina_tipo, nomina_numero")
    .eq("id", cambio.asociadoId)
    .maybeSingle();
  if (!perfil) return { clave, ok: false, error: "No encontramos al asociado." };

  const entidad = (perfil.nomina_entidad as string | null) ?? "";
  const deLista = !entidad || esEntidadDeLista(entidad);
  const tipo = (perfil.nomina_tipo as string | null) ?? "";
  const telefono = cambio.telefono !== undefined ? (cambio.telefono ?? "") : ((perfil.telefono as string | null) ?? "");

  const fd = new FormData();
  fd.set("asociadoId", cambio.asociadoId);
  fd.set("nombre", cambio.nombre ?? (perfil.nombre_completo as string));
  fd.set("telefono", telefono);
  fd.set("correoInstitucional", (perfil.correo_institucional as string | null) ?? "");
  fd.set("nomina_entidad", deLista ? entidad : OPCION_OTRA_ENTIDAD);
  fd.set("nomina_entidad_otra", deLista ? "" : entidad);
  fd.set("nomina_tipo", tipo === "deposito_electronico" ? "" : tipo);
  fd.set("nomina_numero", (perfil.nomina_numero as string | null) ?? "");

  const respuesta = await editarDatosAsociado({}, fd);
  if (respuesta.mensaje) return { clave, ok: true };
  const errores = respuesta.errores ?? {};
  // Un error en un campo que la tabla no edita es de los datos ya guardados: se corrigen en la ficha.
  if (!respuesta.error && !errores.nombre && !errores.telefono && Object.keys(errores).length > 0) {
    return {
      clave,
      ok: false,
      error: "Su correo institucional o su cuenta de nómina guardados no pasan la validación: corrígelos desde la ficha del asociado.",
    };
  }
  return { clave, ok: false, error: primerError(respuesta) ?? MENSAJE_GENERICO };
}

/** Cédula por la acción de «Corregir cédula» (RPC admin_cambiar_cedula), con el motivo del envío. */
async function aplicarCedulaPersona(asociadoId: string, cedula: string, motivo: string): Promise<ResultadoCambioTabla> {
  const clave = `cedula:${asociadoId}`;
  const fd = new FormData();
  fd.set("asociadoId", asociadoId);
  fd.set("cedula", cedula);
  fd.set("motivo", motivo);
  const respuesta = await cambiarCedulaAsociado({}, fd);
  if (respuesta.mensaje) return { clave, ok: true };
  return { clave, ok: false, error: primerError(respuesta) ?? MENSAJE_GENERICO };
}

/** Un cambio que lanza una excepción inesperada no detiene los demás (las redirecciones de Next sí se propagan). */
async function sinDetenerLasDemas(clave: string, aplicar: () => Promise<ResultadoCambioTabla>): Promise<ResultadoCambioTabla> {
  try {
    return await aplicar();
  } catch (e) {
    unstable_rethrow(e);
    registrar("error", { evento: "tabla_creditos_cambio_fallo", clave, mensaje: e instanceof Error ? e.message : String(e) });
    return { clave, ok: false, error: MENSAJE_GENERICO };
  }
}

/**
 * «Guardar cambios» de la vista de tabla de /admin/creditos (solo admin). Recibe
 * los cambios de varias filas y UN motivo (5 a 300 caracteres) para todos, y aplica
 * cada uno por el camino que ya existe (la base vuelve a exigir sus reglas):
 * - nombre y celular → «Editar datos» del asociado (una vez por persona),
 * - cédula → «Corregir cédula», con el motivo,
 * - aprobar / rechazar → la misma lógica de «Aprobar» / «Rechazar» de la ficha; el
 *   motivo es el del rechazo (lo ve el asociado).
 * No es atómico: aplica uno por uno y devuelve el resultado de cada uno.
 */
export async function guardarCambiosTablaCreditos(entrada: EntradaCambiosTablaCreditos): Promise<RespuestaTablaCreditos> {
  const { supabase, userId } = await exigirAdmin();

  const resultado = esquemaGuardarCambiosTablaCreditos.safeParse(entrada);
  if (!resultado.success) {
    const deMotivo = resultado.error.issues.find((i) => i.path[0] === "motivo");
    if (deMotivo) return { errorMotivo: deMotivo.message };
    const primero = resultado.error.issues[0];
    // Los mensajes de los esquemas de cada campo ya son legibles («El celular debe tener 10 dígitos…»).
    return { error: primero?.message ?? "Revisa los cambios." };
  }
  const { motivo, personas, estados } = resultado.data;

  const resultados: ResultadoCambioTabla[] = [];
  // Primero los datos de la persona: así el correo del resultado del crédito sale con el nombre ya corregido.
  for (const persona of personas) {
    if (persona.nombre !== undefined || persona.telefono !== undefined) {
      resultados.push(
        await sinDetenerLasDemas(`datos:${persona.asociadoId}`, () =>
          aplicarDatosPersona(supabase, { asociadoId: persona.asociadoId, nombre: persona.nombre, telefono: persona.telefono }),
        ),
      );
    }
    if (persona.cedula !== undefined) {
      const cedula = persona.cedula;
      resultados.push(await sinDetenerLasDemas(`cedula:${persona.asociadoId}`, () => aplicarCedulaPersona(persona.asociadoId, cedula, motivo)));
    }
  }
  for (const cambio of estados) {
    resultados.push(
      await sinDetenerLasDemas(`estado:${cambio.solicitudId}`, async () => {
        const decision =
          cambio.decision === "aprobado"
            ? ({ id: cambio.solicitudId, decision: "aprobado" } as const)
            : ({ id: cambio.solicitudId, decision: "rechazado", motivo } as const);
        const r = await aplicarResolucionCredito(supabase, userId, decision);
        return r.mensaje
          ? { clave: `estado:${cambio.solicitudId}`, ok: true }
          : { clave: `estado:${cambio.solicitudId}`, ok: false, error: r.error ?? MENSAJE_GENERICO };
      }),
    );
  }

  const guardados = resultados.filter((r) => r.ok).length;
  const conError = resultados.length - guardados;
  registrar("info", { evento: "tabla_creditos_guardada", actor_id: userId, guardados, con_error: conError });

  if (guardados > 0) {
    revalidatePath("/admin/creditos");
    revalidatePath("/admin/asociados");
    for (const id of new Set(personas.map((p) => p.asociadoId))) revalidatePath(`/admin/asociados/${id}`);
    revalidatePath("/cuenta");
    revalidatePath("/cuenta/perfil");
  }

  const partes = [`${guardados} ${guardados === 1 ? "guardado" : "guardados"}`];
  if (conError > 0) partes.push(`${conError} con error`);
  return { resultados, mensaje: partes.join(", ") + "." };
}

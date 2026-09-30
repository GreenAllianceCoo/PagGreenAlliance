/**
 * Lo que pasa de una afiliación aprobada al perfil del asociado
 * (spec-requerimientos-ricardo §2.12): cédula, grado, institución, correo
 * institucional, cuenta de nómina y asesor. El correo PERSONAL no se copia:
 * es el correo del usuario en Auth (una sola fuente).
 * Función pura (la usa aprobarAfiliacion y se prueba sola).
 */
export type SolicitudParaPerfil = {
  cedula: string;
  grado: string | null;
  institucion?: string | null;
  correo_institucional?: string | null;
  nomina_entidad?: string | null;
  nomina_tipo?: string | null;
  nomina_numero?: string | null;
  asesor_id?: string | null;
};

export type DatosPerfilDeAfiliacion = {
  cedula: string;
  grado: string | null;
  institucion?: string;
  correo_institucional?: string;
  nomina_entidad?: string;
  nomina_tipo?: string;
  nomina_numero?: string;
  asesor_id?: string;
};

export function datosPerfilDeAfiliacion(solicitud: SolicitudParaPerfil): DatosPerfilDeAfiliacion {
  const datos: DatosPerfilDeAfiliacion = { cedula: solicitud.cedula, grado: solicitud.grado };
  if (solicitud.institucion) datos.institucion = solicitud.institucion;
  if (solicitud.correo_institucional) datos.correo_institucional = solicitud.correo_institucional;
  // La base exige la cuenta de nómina completa o vacía (perfiles_nomina_chk):
  // las afiliaciones anteriores al formulario v3 no la tienen.
  if (solicitud.nomina_entidad && solicitud.nomina_tipo && solicitud.nomina_numero) {
    datos.nomina_entidad = solicitud.nomina_entidad;
    datos.nomina_tipo = solicitud.nomina_tipo;
    datos.nomina_numero = solicitud.nomina_numero;
  }
  if (solicitud.asesor_id) datos.asesor_id = solicitud.asesor_id;
  return datos;
}

const NOMBRE_TIPO: Record<string, string> = {
  ahorros: "Ahorros",
  corriente: "Corriente",
  deposito_electronico: "Depósito electrónico",
};

/** «Bancolombia · Ahorros · 1234567890» para la ficha del admin (null si no hay cuenta). */
export function textoCuentaNomina(
  entidad: string | null | undefined,
  tipo: string | null | undefined,
  numero: string | null | undefined,
): string | null {
  if (!entidad || !tipo || !numero) return null;
  return `${entidad} · ${NOMBRE_TIPO[tipo] ?? tipo} · ${numero}`;
}

/**
 * Filtro de PostgREST para «quienes atienden asociados» (misma regla que
 * public.puede_atender(): rol asesor, o admin con atiende_asociados; activos).
 * Uso: supabase.from("perfiles").select(...).or(FILTRO_ATIENDEN).eq("activo", true)
 */
export const FILTRO_ATIENDEN = "rol.eq.asesor,and(rol.eq.admin,atiende_asociados.eq.true)";

/** Nombre del grado cuando viene embebido por PostgREST (`grados(nombre)`: objeto o arreglo). */
export function nombreGradoEmbebido(embebido: unknown): string | null {
  const fila = Array.isArray(embebido) ? embebido[0] : embebido;
  if (fila && typeof fila === "object" && "nombre" in fila) {
    const nombre = (fila as { nombre?: unknown }).nombre;
    return typeof nombre === "string" ? nombre : null;
  }
  return null;
}

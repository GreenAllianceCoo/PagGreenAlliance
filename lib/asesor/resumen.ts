// Funciones puras sobre el resultado de `resumen_clientes_asesor()`
// (supabase/migrations/20260924000300_funciones_asesor.sql). Sin Supabase
// aquí para poder probarlas con datos de ejemplo.

/** Una fila de `select * from public.resumen_clientes_asesor()`. */
export type FilaResumenAsesor = {
  origen: "asociado" | "solicitud_afiliacion";
  perfil_id: string | null;
  solicitud_id: string | null;
  nombre: string;
  cedula: string;
  grado: string;
  estado_afiliacion: "pendiente" | "contactado" | "aprobada" | "rechazada" | null;
  estado_credito: "pendiente" | "aprobado" | "rechazado" | null;
};

/** Las únicas columnas que el asesor puede ver. Nunca celular, email, nequi ni fotos. */
const CAMPOS_PERMITIDOS = [
  "origen",
  "perfil_id",
  "solicitud_id",
  "nombre",
  "cedula",
  "grado",
  "estado_afiliacion",
  "estado_credito",
] as const;

/**
 * Copia SOLO los campos permitidos de una fila cruda (defensa en profundidad:
 * aunque la función SQL ya no selecciona datos sensibles, la UI nunca debe
 * reenviar al navegador un campo que no reconozca explícitamente).
 */
export function sanitizarFilaResumen(fila: Record<string, unknown>): FilaResumenAsesor {
  const limpia = {} as Record<string, unknown>;
  for (const campo of CAMPOS_PERMITIDOS) limpia[campo] = fila[campo] ?? null;
  return limpia as FilaResumenAsesor;
}

/** Identificador estable de una fila para `key` en listas (perfil o solicitud, nunca ambos). */
export function idFilaResumen(fila: FilaResumenAsesor): string {
  return fila.perfil_id ?? fila.solicitud_id ?? fila.cedula;
}

export type EstadoCliente = { clave: string; etiqueta: string };

const ETIQUETAS_AFILIACION: Record<string, string> = {
  pendiente: "Afiliación pendiente",
  contactado: "Afiliación contactada",
  aprobada: "Afiliación aprobada",
  rechazada: "Afiliación rechazada",
};

const ETIQUETAS_CREDITO: Record<string, string> = {
  pendiente: "Crédito en revisión",
  aprobado: "Crédito aprobado",
  rechazado: "Crédito rechazado",
};

/**
 * Estado a mostrar en la tabla: si todavía es una solicitud de afiliación, el
 * estado de esa solicitud; si ya es asociado, el de su última solicitud de
 * crédito (o «Asociado sin solicitud» si nunca ha pedido uno).
 */
export function estadoCliente(fila: FilaResumenAsesor): EstadoCliente {
  if (fila.origen === "solicitud_afiliacion") {
    const codigo = fila.estado_afiliacion ?? "pendiente";
    return { clave: `afiliacion_${codigo}`, etiqueta: ETIQUETAS_AFILIACION[codigo] ?? "Afiliación" };
  }
  if (fila.estado_credito) {
    return { clave: `credito_${fila.estado_credito}`, etiqueta: ETIQUETAS_CREDITO[fila.estado_credito] ?? "Crédito" };
  }
  return { clave: "asociado", etiqueta: "Asociado sin solicitud" };
}

/** Quita tildes para que la búsqueda no distinga «Perez» de «Pérez». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Filtra «mis clientes» por nombre/cédula y por el estado elegido en el desplegable. */
export function filtrarClientes(
  filas: FilaResumenAsesor[],
  opciones: { busqueda?: string; estado?: string },
): FilaResumenAsesor[] {
  const busqueda = normalizar((opciones.busqueda ?? "").trim());
  const estado = opciones.estado ?? "todos";
  return filas.filter((fila) => {
    const coincideTexto =
      !busqueda || normalizar(fila.nombre).includes(busqueda) || fila.cedula.includes(busqueda);
    const coincideEstado = estado === "todos" || estadoCliente(fila).clave === estado;
    return coincideTexto && coincideEstado;
  });
}

/** Opciones del filtro «Estado»: «Todos» + solo los estados que de verdad aparecen en la lista. */
export function opcionesEstadoCliente(filas: FilaResumenAsesor[]): EstadoCliente[] {
  const vistos = new Map<string, string>();
  for (const fila of filas) {
    const { clave, etiqueta } = estadoCliente(fila);
    if (!vistos.has(clave)) vistos.set(clave, etiqueta);
  }
  return [{ clave: "todos", etiqueta: "Todos los estados" }, ...[...vistos.entries()].map(([clave, etiqueta]) => ({ clave, etiqueta }))];
}

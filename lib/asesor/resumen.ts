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

/** Quita tildes para que la búsqueda no distinga «Perez» de «Pérez». Exportada: la usan también las tarjetas de resumen. */
export function normalizar(texto: string): string {
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

// ---------------------------------------------------------------------------
// Rediseño C+ (pieza 2c): tarjetas de resumen «Pendiente/Contactado/Aprobada/
// Rechazada» que también filtran, + chips del mismo estado. El lienzo solo
// modela clientes en trámite de afiliación (su `CLIENTES` de ejemplo siempre
// trae un estado `af`); la función real también devuelve asociados YA
// afiliados (con o sin crédito). `categoriaAfiliacion` adapta ese modelo más
// rico a las 4 categorías del diseño: un asociado ya es, por definición,
// una afiliación «Aprobada» (así tenga o no una solicitud de crédito).
// TODO(diseno: D-06): confirmar con ga-disenador-lienzo si esta es la regla
// correcta o si un asociado con crédito rechazado debería verse distinto.
// ---------------------------------------------------------------------------

/** Las 4 categorías de la pieza 2c, en el mismo orden del lienzo. */
export type CategoriaAfiliacion = "pendiente" | "contactado" | "aprobada" | "rechazada";

export const CATEGORIAS_AFILIACION: CategoriaAfiliacion[] = ["pendiente", "contactado", "aprobada", "rechazada"];

const ETIQUETA_CATEGORIA: Record<CategoriaAfiliacion, string> = {
  pendiente: "Pendiente",
  contactado: "Contactado",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export function etiquetaCategoriaAfiliacion(categoria: CategoriaAfiliacion): string {
  return ETIQUETA_CATEGORIA[categoria];
}

/** Ver TODO(diseno: D-06) arriba: agrupa el estado real de una fila en una de las 4 categorías del diseño. */
export function categoriaAfiliacion(fila: FilaResumenAsesor): CategoriaAfiliacion {
  if (fila.origen === "solicitud_afiliacion") {
    const estado = fila.estado_afiliacion ?? "pendiente";
    if (estado === "contactado" || estado === "aprobada" || estado === "rechazada") return estado;
    return "pendiente";
  }
  // origen === "asociado": su afiliación ya se aprobó (por eso es asociado).
  return "aprobada";
}

/** Cuenta cuántas filas caen en cada categoría, para el número grande de cada tarjeta/chip. */
export function contarPorCategoriaAfiliacion(filas: FilaResumenAsesor[]): Record<CategoriaAfiliacion, number> {
  const conteo: Record<CategoriaAfiliacion, number> = { pendiente: 0, contactado: 0, aprobada: 0, rechazada: 0 };
  for (const fila of filas) conteo[categoriaAfiliacion(fila)] += 1;
  return conteo;
}

/** Filtra por categoría (tarjetas/chips) y por nombre (buscador «Buscar por nombre» de 2c). */
export function filtrarPorCategoriaYNombre(
  filas: FilaResumenAsesor[],
  opciones: { categoria?: CategoriaAfiliacion | "todos"; busqueda?: string },
): FilaResumenAsesor[] {
  const categoria = opciones.categoria ?? "todos";
  const busqueda = normalizar((opciones.busqueda ?? "").trim());
  return filas.filter((fila) => {
    const coincideCategoria = categoria === "todos" || categoriaAfiliacion(fila) === categoria;
    const coincideTexto = !busqueda || normalizar(fila.nombre).includes(busqueda);
    return coincideCategoria && coincideTexto;
  });
}

const ETIQUETA_ULTIMO_CREDITO: Record<NonNullable<FilaResumenAsesor["estado_credito"]>, string> = {
  pendiente: "En revisión",
  aprobado: "Aprobado",
  rechazado: "No aprobado",
};

/** Columna/chip «Último crédito» de la tabla (2c): «Sin crédito» si nunca ha pedido uno. */
export function etiquetaUltimoCredito(fila: FilaResumenAsesor): string {
  if (!fila.estado_credito) return "Sin crédito";
  return ETIQUETA_ULTIMO_CREDITO[fila.estado_credito];
}

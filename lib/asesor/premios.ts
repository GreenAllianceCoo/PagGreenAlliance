// Premios de asesores por cantidad de asociados (presentación de negocio, pág. 25;
// migración 20261002100000). Funciones puras: sin Supabase, para poder probarlas.
// El PRIMER asesor en llegar a 50 gana el bono al mérito; el primero en llegar a 100,
// el viaje a San Andrés. Única vez. A un asesor nunca se le dice QUIÉN ganó si fue otro.

import { fechaBogotaDeInstante, formatearFechaLarga } from "@/lib/fechas";

export const METAS_PREMIO = [50, 100] as const;
export type MetaPremio = (typeof METAS_PREMIO)[number];

/** Estados que devuelve public.mis_premios_asesor(). */
export type EstadoPremio = "disponible" | "ya_ganado" | "ganado_por_mi";

export const ETIQUETA_ESTADO_PREMIO: Record<EstadoPremio, string> = {
  disponible: "Disponible",
  ya_ganado: "Ya fue ganado",
  ganado_por_mi: "¡Lo ganaste!",
};

export const TEXTO_PREMIO: Record<MetaPremio, { titulo: string; descripcion: string }> = {
  50: {
    titulo: "Bono comercial al mérito",
    descripcion: "$1.000.000 al alcanzar 50 asociados (embargos operativos). Se entrega una sola vez, al primer asesor que llegue.",
  },
  100: {
    titulo: "Bono comercial al compromiso",
    descripcion:
      "Viaje a San Andrés Isla, 3 días y 2 noches todo pago con un acompañante, al alcanzar 100 asociados. Se entrega una sola vez, al primer asesor que llegue.",
  },
};

/** Fila de public.mis_premios_asesor(). */
export type FilaMisPremios = {
  clientes_acumulados: number | string;
  meta: number | string;
  estado: string;
  ganado_at: string | null;
};

export type VistaPremio = {
  meta: MetaPremio;
  titulo: string;
  descripcion: string;
  actual: number;
  /** 0–100, para la barra. */
  porcentaje: number;
  faltan: number;
  estado: EstadoPremio;
  etiqueta: string;
  /** «Lo ganaste el 3 de octubre de 2026» (solo si lo ganó él). */
  ganadoTexto: string | null;
};

export type VistaPremios = { clientesAcumulados: number; premios: VistaPremio[] };

function estadoSeguro(valor: string): EstadoPremio {
  return valor === "ganado_por_mi" || valor === "ya_ganado" ? valor : "disponible";
}

function esMeta(n: number): n is MetaPremio {
  return (METAS_PREMIO as readonly number[]).includes(n);
}

/** Sin filas (quien llama no puede atender o falló la RPC) → null. */
export function vistaPremios(filas: FilaMisPremios[] | null | undefined): VistaPremios | null {
  if (!filas || filas.length === 0) return null;
  const premios: VistaPremio[] = [];
  for (const fila of filas) {
    const meta = Number(fila.meta);
    if (!esMeta(meta)) continue;
    const actual = Math.max(0, Number(fila.clientes_acumulados) || 0);
    const estado = estadoSeguro(fila.estado);
    premios.push({
      meta,
      ...TEXTO_PREMIO[meta],
      actual,
      porcentaje: Math.min(100, Math.round((actual / meta) * 100)),
      faltan: Math.max(0, meta - actual),
      estado,
      etiqueta: ETIQUETA_ESTADO_PREMIO[estado],
      ganadoTexto:
        estado === "ganado_por_mi" && fila.ganado_at
          ? `Lo ganaste el ${formatearFechaLarga(fechaBogotaDeInstante(fila.ganado_at))}`
          : null,
    });
  }
  if (premios.length === 0) return null;
  premios.sort((a, b) => a.meta - b.meta);
  return { clientesAcumulados: premios[0].actual, premios };
}

/** Meta que se manda al registrar un clic: solo 50, 100 o ninguna. */
export function metaDeClic(valor: unknown): MetaPremio | null {
  const n = typeof valor === "string" ? Number(valor) : valor;
  return typeof n === "number" && esMeta(n) ? n : null;
}

// ---- Admin ----

/** Fila de public.admin_premios_asesores(). */
export type FilaAdminPremios = {
  asesor_id: string;
  clientes_acumulados: number | string;
  clics: number | string;
  ultimo_clic: string | null;
  gano_50_at: string | null;
  gano_100_at: string | null;
  aperturas?: number | string;
  toques_50?: number | string;
  toques_100?: number | string;
};

export type PremiosDeAsesor = {
  asociados: number;
  clics: number;
  ultimoClic: string | null;
  gano50: string | null;
  gano100: string | null;
  /** Veces que abrió la sección (sin meta). */
  aperturas: number;
  /** Toques sobre el premio de 50 y de 100. */
  toques50: number;
  toques100: number;
};

/** Indexa por asesor; las filas inválidas se descartan. */
export function indexarPremiosAdmin(filas: FilaAdminPremios[] | null | undefined): Map<string, PremiosDeAsesor> {
  const mapa = new Map<string, PremiosDeAsesor>();
  for (const f of filas ?? []) {
    if (!f || typeof f.asesor_id !== "string") continue;
    mapa.set(f.asesor_id, {
      asociados: Math.max(0, Number(f.clientes_acumulados) || 0),
      clics: Math.max(0, Number(f.clics) || 0),
      ultimoClic: f.ultimo_clic ?? null,
      gano50: f.gano_50_at ?? null,
      gano100: f.gano_100_at ?? null,
      aperturas: Math.max(0, Number(f.aperturas) || 0),
      toques50: Math.max(0, Number(f.toques_50) || 0),
      toques100: Math.max(0, Number(f.toques_100) || 0),
    });
  }
  return mapa;
}

/** Quién ganó cada meta (nombre) según las filas y el nombre de cada asesor; null = nadie todavía. */
export function ganadoresPorMeta(
  nombres: Map<string, string> | Record<string, string>,
  premios: Map<string, PremiosDeAsesor>,
): { 50: string | null; 100: string | null } {
  const nombreDe = (id: string) => (nombres instanceof Map ? nombres.get(id) : nombres[id]) ?? "Asesor";
  let g50: string | null = null;
  let g100: string | null = null;
  for (const [id, p] of premios) {
    if (p.gano50) g50 = nombreDe(id);
    if (p.gano100) g100 = nombreDe(id);
  }
  return { 50: g50, 100: g100 };
}

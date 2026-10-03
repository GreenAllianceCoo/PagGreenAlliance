/**
 * Texto en lenguaje claro de cada fila de public.admin_historial_equipo()
 * (función pura, sin acceso a la base): «Aprobó la afiliación de Juan Pérez».
 */

export type TipoEventoEquipo = "afiliacion" | "proceso" | "asesor" | "rol" | "estado" | "credito";

/** Fila tal como la devuelve la RPC. */
export type FilaHistorialEquipo = {
  cuando: string;
  actor_id: string;
  actor_nombre: string;
  actor_rol: string;
  tipo: string;
  objetivo: string;
  detalle: string | null;
  extra: string | null;
  motivo: string | null;
  total: number | string;
};

export type EventoEquipo = {
  /** «2 oct 2026 10:15» (hora de Colombia). */
  cuando: string;
  cuandoISO: string;
  actorId: string;
  actorNombre: string;
  /** «Secretario», «Administrador» o «Asesor». */
  actorRol: string;
  /** «Aprobó la afiliación de Juan Pérez». */
  descripcion: string;
  motivo: string | null;
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** «2 oct 2026 10:15» en hora de Colombia (sin depender de la configuración regional del servidor). */
export function formatearCuandoEquipo(instante: string): string {
  const d = new Date(instante);
  if (Number.isNaN(d.getTime())) return "";
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Bogota",
      day: "numeric",
      month: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return `${Number(partes.day)} ${MESES[Number(partes.month) - 1]} ${partes.year} ${partes.hour}:${partes.minute}`;
}

/** «2026-10-02» → «2 oct 2026». */
function fechaCorta(aaaammdd: string | null): string | null {
  const m = aaaammdd?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}` : null;
}

const NOMBRE_ROL: Record<string, string> = {
  admin: "Administrador",
  secretario: "Secretario",
  asesor: "Asesor",
  asociado: "Asociado",
};
const nombreRol = (rol: string | null) => (rol ? (NOMBRE_ROL[rol] ?? rol) : "");
const nombreRolMinuscula = (rol: string | null) => nombreRol(rol).toLowerCase();

const ETIQUETA_PROCESO: Record<string, string> = {
  reparto: "Reparto",
  radicado: "Radicado",
  admitido: "Admitido",
  mandamiento_de_pago: "Mandamiento de pago",
  notificado: "Notificado",
  medidas_cautelares: "Medidas cautelares",
  operando: "Operando",
  terminado: "Terminado",
};

function etiquetaProceso(estado: string | null) {
  if (!estado) return "";
  return ETIQUETA_PROCESO[estado] ?? estado.charAt(0).toUpperCase() + estado.slice(1).replace(/_/g, " ");
}

/** Frase de la acción, en pasado y en tercera persona omitida: «Aprobó el crédito de Ana». */
export function describirEventoEquipo(f: Pick<FilaHistorialEquipo, "tipo" | "objetivo" | "detalle" | "extra">): string {
  const quien = f.objetivo;
  switch (f.tipo) {
    case "afiliacion":
      switch (f.detalle) {
        case "aprobada":
          return `Aprobó la afiliación de ${quien}`;
        case "rechazada":
          return `Rechazó la afiliación de ${quien}`;
        case "contactado":
          return `Marcó como contactada la afiliación de ${quien}`;
        case "pendiente":
          return `Devolvió a pendiente la afiliación de ${quien}`;
        default:
          return `Cambió el estado de la afiliación de ${quien}`;
      }
    case "proceso": {
      const fecha = fechaCorta(f.extra);
      return `Cambió el proceso ejecutivo de ${quien} a «${etiquetaProceso(f.detalle)}»${fecha ? ` (inicio del embargo: ${fecha})` : ""}`;
    }
    case "asesor":
      if (f.detalle && f.extra) return `Cambió el asesor de ${quien}: de ${f.extra} a ${f.detalle}`;
      if (f.detalle) return `Asignó a ${f.detalle} como asesor de ${quien}`;
      if (f.extra) return `Quitó a ${f.extra} como asesor de ${quien}`;
      return `Cambió el asesor de ${quien}`;
    case "rol":
      if (f.extra === "asociado") return `Creó a ${quien} como ${nombreRolMinuscula(f.detalle)}`;
      return `Cambió el rol de ${quien} de ${nombreRolMinuscula(f.extra)} a ${nombreRolMinuscula(f.detalle)}`;
    case "estado": {
      const activo = f.detalle === "true";
      const delEquipo = f.extra === "secretario" || f.extra === "asesor" || f.extra === "admin";
      if (delEquipo) return `${activo ? "Reactivó" : "Desactivó"} a ${quien} (${nombreRolMinuscula(f.extra)})`;
      return `${activo ? "Reactivó" : "Dio de baja"} a ${quien}`;
    }
    case "credito":
      switch (f.detalle) {
        case "aprobado":
          return `Aprobó el crédito de ${quien}`;
        case "rechazado":
          return `Rechazó el crédito de ${quien}`;
        case "desembolsado":
          return `Marcó como desembolsado el crédito de ${quien}`;
        case "credito_habilitado":
          return `Habilitó un nuevo crédito a ${quien}`;
        case "comprobante_desembolso":
          return `Subió el comprobante de desembolso de ${quien}`;
        default:
          return `Actualizó el crédito de ${quien}`;
      }
    default:
      return `Hizo un cambio sobre ${quien}`;
  }
}

export function vistaEventoEquipo(f: FilaHistorialEquipo): EventoEquipo {
  return {
    cuando: formatearCuandoEquipo(f.cuando),
    cuandoISO: f.cuando,
    actorId: f.actor_id,
    actorNombre: f.actor_nombre,
    actorRol: nombreRol(f.actor_rol),
    descripcion: describirEventoEquipo(f),
    motivo: f.motivo,
  };
}

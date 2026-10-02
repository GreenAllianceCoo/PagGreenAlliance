import { z } from "zod";
import { CONCEPTOS_COMISION, esDiaDeCorte, leerMontoPesos, MONTO_MAXIMO_PAGO } from "@/lib/asesor/comisiones";

const MENSAJE_MONTO_TOPE = `El monto no puede pasar de $ ${MONTO_MAXIMO_PAGO.toLocaleString("es-CO")}.`;
import { diasEntre, esFechaISO, hoyBogota } from "@/lib/fechas";
import { ESTADOS_PROCESO } from "@/lib/procesoEjecutivo";
import { esquemaCedula, esquemaCorreo, textoDe } from "./comunes";

/**
 * Esquemas del panel /admin. Mismo patrón que el resto del proyecto: un solo
 * esquema por acción, usado en la Server Action (no hay formularios de admin
 * en un cliente separado que necesite repetir la validación, pero se deja
 * aquí para que cualquier componente cliente lo reutilice si hace falta).
 */

// ---------------------------------------------------------------------------
// Afiliaciones
// ---------------------------------------------------------------------------

/** Estados a los que el admin puede mover una solicitud (sin «pendiente»: es el inicial). */
export const ESTADOS_AFILIACION_ADMIN = ["contactado", "rechazada"] as const;

export const esquemaCambiarEstadoAfiliacion = z.object({
  id: z.uuid({ error: "Falta el id de la solicitud." }),
  estado: z.enum(ESTADOS_AFILIACION_ADMIN, { error: "Elige un estado válido." }),
});

export const esquemaAprobarAfiliacion = z.object({
  id: z.uuid({ error: "Falta el id de la solicitud." }),
});

/**
 * «Asignar asesor» (P-96): la afiliación (por su id) y el asesor elegido
 * (perfil con rol asesor). El resto de las reglas (afiliación aprobada,
 * perfil sin asesor, asesor válido) se comprueban en el servidor, no aquí:
 * este esquema solo valida la forma de los dos ids.
 */
export const esquemaAsignarAsesor = z.object({
  id: z.uuid({ error: "Falta el id de la solicitud." }),
  asesorId: z.uuid({ error: "Elige un asesor." }),
});

// ---------------------------------------------------------------------------
// Solicitudes de crédito
// ---------------------------------------------------------------------------

const esquemaMotivoRechazo = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(3, { error: "Escribe el motivo del rechazo (mínimo 3 caracteres)." })
      .max(500, { error: "El motivo puede tener máximo 500 caracteres." }),
  );

/** «Aprobar» / «Rechazar» de /admin/creditos (P-06: el motivo es obligatorio al rechazar). */
export const esquemaResolverCredito = z.discriminatedUnion("decision", [
  z.object({ id: z.uuid(), decision: z.literal("aprobado") }),
  z.object({ id: z.uuid(), decision: z.literal("rechazado"), motivo: esquemaMotivoRechazo }),
]);

/**
 * «Marcar desembolsado» (§12.2): el crédito (id) y la fecha opcional (vacía =
 * hoy en hora de Colombia, la pone la base). No puede ser futura; que no sea
 * anterior a la aprobación y que el crédito esté aprobado lo comprueba la base.
 */
export const esquemaMarcarDesembolso = z.object({
  id: z.uuid({ error: "Falta el id de la solicitud." }),
  fecha: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined))
    .pipe(
      z
        .string()
        .refine(esFechaISO, { error: "Escribe una fecha válida." })
        .refine((v) => v <= hoyBogota(), { error: "La fecha de desembolso no puede ser futura." })
        .optional(),
    ),
});

// ---------------------------------------------------------------------------
// Baja / reactivación de asociados (§12.6)
// ---------------------------------------------------------------------------

export const CAMPOS_ESTADO_ASOCIADO = ["asociadoId", "motivo"] as const;
export type CampoEstadoAsociado = (typeof CAMPOS_ESTADO_ASOCIADO)[number];

/** «Dar de baja» / «Reactivar»: el motivo es obligatorio (5 a 300 caracteres, igual que la base). */
export const esquemaCambiarEstadoAsociado = z.object({
  asociadoId: z.uuid({ error: "Falta el asociado." }),
  activo: z.enum(["true", "false"], { error: "Elige una acción válida." }).transform((v) => v === "true"),
  motivo: z
    .string({ error: "Escribe el motivo." })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(5, { error: "El motivo debe tener entre 5 y 300 caracteres." })
        .max(300, { error: "El motivo debe tener entre 5 y 300 caracteres." }),
    ),
});

// ---------------------------------------------------------------------------
// Habilitar crédito tras un rechazo (§13.2)
// ---------------------------------------------------------------------------

export const CAMPOS_HABILITAR_CREDITO = ["asociadoId", "motivo"] as const;
export type CampoHabilitarCredito = (typeof CAMPOS_HABILITAR_CREDITO)[number];

/** «Habilitar crédito»: motivo obligatorio (5 a 300 caracteres, igual que la base). */
export const esquemaHabilitarCredito = z.object({
  asociadoId: z.uuid({ error: "Falta el asociado." }),
  motivo: esquemaCambiarEstadoAsociado.shape.motivo,
});

// ---------------------------------------------------------------------------
// Sorteo mensual (§12.10)
// ---------------------------------------------------------------------------

/** Mes del sorteo: «AAAA-MM» (input type=month) o «AAAA-MM-01»; sale siempre «AAAA-MM-01». */
export const esquemaRealizarSorteo = z.object({
  mes: z
    .string({ error: "Elige el mes del sorteo." })
    .trim()
    .regex(/^\d{4}-(0[1-9]|1[0-2])(-01)?$/, { error: "Elige el mes del sorteo." })
    .transform((v) => v.slice(0, 7) + "-01"),
});

// ---------------------------------------------------------------------------
// Asesores
// ---------------------------------------------------------------------------

const esquemaNombrePropio = (mensajeVacio: string) =>
  z
    .string({ error: mensajeVacio })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, { error: mensajeVacio })
        .min(2, { error: "Debe tener al menos 2 caracteres." })
        .max(60, { error: "Puede tener máximo 60 caracteres." })
        .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/, { error: "Solo letras y espacios." }),
    );

/** Roles que el admin puede crear desde /admin/asesores (el equipo: asesores y secretarios). */
export const ROLES_EQUIPO = ["asesor", "secretario"] as const;

/** «Registrar asesor» / «Registrar secretario» de /admin/asesores. */
export const esquemaCrearAsesor = z.object({
  cedula: esquemaCedula,
  nombres: esquemaNombrePropio("Escribe los nombres."),
  apellidos: esquemaNombrePropio("Escribe los apellidos."),
  correo: esquemaCorreo,
  rol: z.enum(ROLES_EQUIPO, { error: "Elige un rol válido." }).default("asesor"),
});
export type CampoCrearAsesor = keyof z.input<typeof esquemaCrearAsesor>;

export function leerFormularioAsesor(formData: FormData) {
  return {
    cedula: textoDe(formData, "cedula"),
    nombres: textoDe(formData, "nombres"),
    apellidos: textoDe(formData, "apellidos"),
    correo: textoDe(formData, "correo"),
    rol: textoDe(formData, "rol") || "asesor",
  };
}

// ---------------------------------------------------------------------------
// Requerimientos de Ricardo (spec-requerimientos-ricardo §6, pieza 3m)
// ---------------------------------------------------------------------------

/** Fecha opcional «AAAA-MM-DD» de un <input type="date">: vacío → null. */
const esquemaFechaOpcional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.union([z.null(), z.string().refine(esFechaISO, { error: "Escribe una fecha válida." })]));

/** Selector de estado del proceso + fecha de inicio del embargo (detalle del asociado). */
export const esquemaActualizarProceso = z
  .object({
    asociadoId: z.uuid({ error: "Falta el asociado." }),
    estado: z.enum(ESTADOS_PROCESO, { error: "Elige un paso del proceso." }),
    fechaInicioEmbargo: esquemaFechaOpcional,
  })
  .superRefine((datos, ctx) => {
    if (!datos.fechaInicioEmbargo) return;
    if (datos.estado !== "operando" && datos.estado !== "terminado") {
      ctx.addIssue({
        code: "custom",
        path: ["fechaInicioEmbargo"],
        message: "La fecha de inicio del embargo solo se registra desde el paso «Operando».",
      });
      return;
    }
    if (datos.fechaInicioEmbargo < "2020-01-01") {
      ctx.addIssue({ code: "custom", path: ["fechaInicioEmbargo"], message: "Revisa la fecha: es muy antigua." });
    }
    // La base rechaza más de un mes en el futuro (normalizar_proceso_ejecutivo).
    if (diasEntre(hoyBogota(), datos.fechaInicioEmbargo) > 31) {
      ctx.addIssue({
        code: "custom",
        path: ["fechaInicioEmbargo"],
        message: "La fecha de inicio del embargo no puede estar a más de un mes en el futuro.",
      });
    }
  });
export type CampoActualizarProceso = "asociadoId" | "estado" | "fechaInicioEmbargo";

/** «Marcar atendida» de la bandeja de alertas. */
export const esquemaMarcarAlerta = z.object({
  alertaId: z.uuid({ error: "Falta la alerta." }),
});

/** «Registrar pago de comisión» (pagos_comision; sin update ni delete: se corrige con «Ajuste»). */
export const esquemaPagoComision = z
  .object({
    asesorId: z.uuid({ error: "Elige el asesor." }),
    periodoCorte: z
      .string()
      .trim()
      .refine((v) => esFechaISO(v) && esDiaDeCorte(v), { error: "Elige el periodo (corte del día 15)." }),
    concepto: z.enum(CONCEPTOS_COMISION, { error: "Elige el concepto." }),
    monto: z
      .string()
      .transform((v, ctx) => {
        const valor = leerMontoPesos(v);
        if (valor === null) {
          ctx.addIssue({ code: "custom", message: "Escribe el monto en pesos, sin decimales." });
          return z.NEVER;
        }
        if (Math.abs(valor) > MONTO_MAXIMO_PAGO) {
          ctx.addIssue({ code: "custom", message: MENSAJE_MONTO_TOPE });
          return z.NEVER;
        }
        return valor;
      }),
    asociadoId: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.union([z.null(), z.uuid({ error: "Elige un cliente válido." })])),
    nota: z
      .string()
      .transform((v) => v.trim().replace(/\s+/g, " "))
      .pipe(z.string().max(300, { error: "La nota puede tener máximo 300 caracteres." }))
      .transform((v) => (v === "" ? null : v)),
  })
  .superRefine((datos, ctx) => {
    // Mismas reglas que pagos_comision_monto_chk.
    if (datos.concepto === "ajuste" && datos.monto === 0) {
      ctx.addIssue({ code: "custom", path: ["monto"], message: "Un ajuste no puede ser de $0." });
    } else if (datos.concepto === "viaje_100_embargos" && datos.monto < 0) {
      ctx.addIssue({ code: "custom", path: ["monto"], message: "El monto no puede ser negativo." });
    } else if (datos.concepto !== "ajuste" && datos.concepto !== "viaje_100_embargos" && datos.monto <= 0) {
      ctx.addIssue({ code: "custom", path: ["monto"], message: "El monto debe ser mayor que cero (para descontar usa «Ajuste»)." });
    }
  });
export type CampoPagoComision = "asesorId" | "periodoCorte" | "concepto" | "monto" | "asociadoId" | "nota";

export function leerFormularioPagoComision(formData: FormData) {
  return {
    asesorId: textoDe(formData, "asesorId"),
    periodoCorte: textoDe(formData, "periodoCorte"),
    concepto: textoDe(formData, "concepto"),
    monto: textoDe(formData, "monto"),
    asociadoId: textoDe(formData, "asociadoId"),
    nota: textoDe(formData, "nota"),
  };
}

/** Interruptor «Atiende asociados» de /admin/asesores. */
export const esquemaAtiendeAsociados = z.object({
  perfilId: z.uuid({ error: "Falta la persona." }),
  atiende: z.enum(["true", "false"], { error: "Valor inválido." }).transform((v) => v === "true"),
});

/** Motivo obligatorio de una corrección o anulación de pago (5 a 300, igual que la base). */
const esquemaMotivoPago = z
  .string()
  .transform((v) => v.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(5, { error: "Escribe el motivo (mínimo 5 caracteres)." })
      .max(300, { error: "El motivo puede tener máximo 300 caracteres." }),
  );

/**
 * «Corregir pago» (admin_editar_pago_comision): monto, concepto y/o nota;
 * vacío = no cambiar. La nota se borra con la casilla `borrarNota`.
 */
export const esquemaEditarPagoComision = z
  .object({
    pagoId: z.uuid({ error: "Falta el pago." }),
    motivo: esquemaMotivoPago,
    monto: z.string().transform((v, ctx) => {
      if (v.trim() === "") return null;
      const valor = leerMontoPesos(v);
      if (valor === null) {
        ctx.addIssue({ code: "custom", message: "Escribe el monto en pesos, sin decimales." });
        return z.NEVER;
      }
      if (Math.abs(valor) > MONTO_MAXIMO_PAGO) {
        ctx.addIssue({ code: "custom", message: MENSAJE_MONTO_TOPE });
        return z.NEVER;
      }
      return valor;
    }),
    concepto: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.union([z.null(), z.enum(CONCEPTOS_COMISION, { error: "Elige el concepto." })])),
    nota: z
      .string()
      .transform((v) => v.trim().replace(/\s+/g, " "))
      .pipe(z.string().max(300, { error: "La nota puede tener máximo 300 caracteres." })),
    borrarNota: z.boolean(),
  })
  .transform(({ nota, borrarNota, ...resto }) => ({
    ...resto,
    // null = no cambiar; "" = borrar la nota (así lo entiende la RPC).
    nota: borrarNota ? "" : nota === "" ? null : nota,
  }))
  .superRefine((datos, ctx) => {
    if (datos.monto === null && datos.concepto === null && datos.nota === null) {
      ctx.addIssue({ code: "custom", path: ["monto"], message: "No hay cambios para guardar." });
    }
  });
export type CampoEditarPagoComision = "pagoId" | "motivo" | "monto" | "concepto" | "nota";

export function leerFormularioEditarPago(formData: FormData) {
  return {
    pagoId: textoDe(formData, "pagoId"),
    motivo: textoDe(formData, "motivo"),
    monto: textoDe(formData, "monto"),
    concepto: textoDe(formData, "concepto"),
    nota: textoDe(formData, "nota"),
    borrarNota: formData.get("borrarNota") === "on",
  };
}

/** «Anular pago» (admin_anular_pago_comision): motivo obligatorio. */
export const esquemaAnularPagoComision = z.object({
  pagoId: z.uuid({ error: "Falta el pago." }),
  motivo: esquemaMotivoPago,
});

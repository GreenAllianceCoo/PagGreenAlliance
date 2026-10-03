/**
 * Server Actions nuevas de los requerimientos de Ricardo, con Supabase
 * simulado (nunca una base real):
 *  - /cuenta: pedirRetiroAnticipado, pedirRenovacion (RPC + aviso a admins);
 *  - /asesor: revelarAcumulado, buscarCliente (cédula enmascarada);
 *  - /admin: actualizarProcesoEjecutivo, marcarAlertaAtendida,
 *    registrarPagoComision, editarPagoComision, anularPagoComision,
 *    alternarAtiendeAsociados.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  avisarAdmins: vi.fn(async () => {}),
  cliente: null as unknown,
  dentroDelLimite: vi.fn(async () => true),
  adminId: "admin-1",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: m.dentroDelLimite }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => m.cliente) }));
vi.mock("@/lib/supabase/admin", () => ({ crearClienteAdmin: vi.fn() }));
vi.mock("@/lib/correo/alertas", () => ({ avisarAdminsDeAlerta: m.avisarAdmins }));
vi.mock("@/lib/admin/servidor", () => ({
  exigirAdmin: vi.fn(async () => ({ supabase: m.cliente, userId: m.adminId, nombre: "Admin" })),
  exigirAdminOSecretario: vi.fn(async () => ({ supabase: m.cliente, userId: m.adminId, nombre: "Admin", rol: "admin" })),
}));
vi.mock("@/lib/asesor/servidor", () => ({
  exigirAsesor: vi.fn(async () => ({ supabase: m.cliente, userId: "asesor-1", nombre: "Asesor", rol: "asesor" })),
}));

import { pedirRenovacion, pedirRetiroAnticipado } from "@/app/cuenta/actions-proceso";
import { buscarCliente, revelarAcumulado } from "@/app/asesor/actions";
import { actualizarProcesoEjecutivo } from "@/app/admin/asociados/actions";
import { marcarAlertaAtendida } from "@/app/admin/alertas/actions";
import {
  alternarAtiendeAsociados,
  anularPagoComision,
  editarPagoComision,
  registrarPagoComision,
} from "@/app/admin/asesores/actions";

const UUID = "11111111-2222-4333-8444-555555555555";
const UUID2 = "22222222-2222-4333-8444-555555555555";

type Respuesta = { data?: unknown; error?: { message?: string; code?: string } | null };

/** Cliente falso: `rpc` responde lo que se configure; `from` guarda inserts/updates. */
function clienteFalso(opciones: {
  usuario?: { id: string } | null;
  rpc?: (nombre: string, args: unknown) => Respuesta;
  insertError?: { message?: string; code?: string } | null;
  updateResultado?: Respuesta;
  perfil?: Record<string, unknown>;
} = {}) {
  const inserts: { tabla: string; fila: unknown }[] = [];
  const updates: { tabla: string; cambios: unknown; filtros: [string, unknown][] }[] = [];
  const rpc = vi.fn((nombre: string, args?: unknown) => {
    const r = opciones.rpc?.(nombre, args) ?? { data: null, error: null };
    const promesa = Promise.resolve({ data: r.data ?? null, error: r.error ?? null });
    return Object.assign(promesa, { maybeSingle: () => promesa });
  });
  const from = vi.fn((tabla: string) => {
    const filtros: [string, unknown][] = [];
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn((c: string, v: unknown) => {
      filtros.push([c, v]);
      return consulta;
    });
    consulta.single = vi.fn(async () => ({ data: opciones.perfil ?? { nombre_completo: "Laura Gómez" }, error: null }));
    consulta.maybeSingle = vi.fn(async () => opciones.updateResultado ?? { data: null, error: null });
    consulta.insert = vi.fn(async (fila: unknown) => {
      inserts.push({ tabla, fila });
      return { data: null, error: opciones.insertError ?? null };
    });
    consulta.update = vi.fn((cambios: unknown) => {
      updates.push({ tabla, cambios, filtros });
      return consulta;
    });
    return consulta;
  });
  const cliente = {
    auth: { getUser: vi.fn(async () => ({ data: { user: opciones.usuario === undefined ? { id: "u1" } : opciones.usuario } })) },
    rpc,
    from,
  };
  m.cliente = cliente;
  return { cliente, rpc, inserts, updates };
}

function fd(campos: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.append(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.adminId = "admin-1";
  m.dentroDelLimite.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
describe("/cuenta · retiro anticipado y renovación (§3.8–§3.9)", () => {
  it("retiro: crea la alerta por RPC, avisa a los admins y responde el texto de la spec", async () => {
    const { rpc } = clienteFalso({ rpc: () => ({ data: UUID }) });
    const r = await pedirRetiroAnticipado();
    expect(rpc).toHaveBeenCalledWith("crear_alerta_asociado", { p_tipo: "retiro_anticipado" });
    expect(m.avisarAdmins).toHaveBeenCalledWith({ tipo: "retiro_anticipado", nombreAsociado: "Laura Gómez" });
    expect(r).toEqual({ ok: true, mensaje: "Listo, el administrador te contactará" });
    // Nunca una suma en la respuesta.
    expect(JSON.stringify(r)).not.toMatch(/\d{4,}/);
  });

  it("renovación: mismo mecanismo con p_tipo renovacion", async () => {
    const { rpc } = clienteFalso({ rpc: () => ({ data: UUID }) });
    await pedirRenovacion();
    expect(rpc).toHaveBeenCalledWith("crear_alerta_asociado", { p_tipo: "renovacion" });
  });

  it.each([
    "Ya avisaste al administrador; te contactará pronto",
    "La renovación se habilita cuando pasen 24 meses desde el inicio de tu embargo",
    "Esta opción se habilita cuando tu proceso esté operando",
  ])("muestra el mensaje de la base «%s» y NO avisa a los admins", async (mensaje) => {
    clienteFalso({ rpc: () => ({ error: { message: mensaje } }) });
    const r = await pedirRenovacion();
    expect(r.error).toBe(`${mensaje}.`);
    expect(m.avisarAdmins).not.toHaveBeenCalled();
  });

  it("un error desconocido de la base no se muestra tal cual", async () => {
    clienteFalso({ rpc: () => ({ error: { message: 'relation "x" does not exist', code: "42P01" } }) });
    const r = await pedirRetiroAnticipado();
    expect(r.error).toBe("No pudimos avisar al administrador. Intenta de nuevo.");
  });

  it("sin sesión no llama a la base", async () => {
    const { rpc } = clienteFalso({ usuario: null });
    const r = await pedirRetiroAnticipado();
    expect(r.error).toMatch(/sesión/);
    expect(rpc).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe("/asesor · acumulado y búsqueda (§5.4–§5.5)", () => {
  it("revelarAcumulado: una sola RPC (que suma el contador) y la cifra formateada", async () => {
    const { rpc } = clienteFalso({ rpc: () => ({ data: 1600000 }) });
    expect(await revelarAcumulado()).toEqual({ total: "$ 1.600.000" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("revelar_acumulado_comision");
  });

  it("revelarAcumulado: error genérico si la RPC falla", async () => {
    clienteFalso({ rpc: () => ({ error: { message: "Solo los asesores pueden ver su acumulado de comisiones" } }) });
    expect((await revelarAcumulado()).error).toMatch(/No pudimos/);
  });

  it("RS-13: revelarAcumulado con el límite agotado NO llama a la RPC (el contador no sube)", async () => {
    const { rpc } = clienteFalso({ rpc: () => ({ data: 1 }) });
    m.dentroDelLimite.mockResolvedValue(false);
    const r = await revelarAcumulado();
    expect(r.error).toMatch(/muchas veces/);
    expect(r.total).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
    expect(m.dentroDelLimite).toHaveBeenCalledWith("asesor-revelar", "asesor-1", 30, 3600);
  });

  it("RS-13: buscarCliente con el límite agotado no llama a la RPC", async () => {
    const { rpc } = clienteFalso();
    m.dentroDelLimite.mockResolvedValue(false);
    const r = await buscarCliente({}, fd({ cedula: "1012345321" }));
    expect(r.error).toMatch(/muchas búsquedas/);
    expect(rpc).not.toHaveBeenCalled();
    expect(m.dentroDelLimite).toHaveBeenCalledWith("asesor-buscar", "asesor-1", 30, 3600);
  });

  it("buscarCliente: valida la cédula antes de ir a la base", async () => {
    const { rpc } = clienteFalso();
    const r = await buscarCliente({}, fd({ cedula: "12" }));
    expect(r.errores?.cedula).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("buscarCliente: normaliza, busca y devuelve la cédula ENMASCARADA", async () => {
    const { rpc } = clienteFalso({
      rpc: () => ({
        data: {
          perfil_id: UUID,
          nombre: "Laura Gómez",
          cedula: "1012345321",
          grado: "PT",
          grado_nombre: "Patrullero",
          institucion: "policia",
          estado_proceso: "operando",
          fecha_inicio_embargo: "2026-06-15",
          grupo_credito: "PT",
          cupo_50: 1300000,
          cupo_100: 2700000,
        },
      }),
    });
    const r = await buscarCliente({}, fd({ cedula: "1.012.345.321" }));
    expect(rpc).toHaveBeenCalledWith("buscar_cliente_asesor", { p_cedula: "1012345321" });
    expect(r.cliente?.cedulaEnmascarada).toBe("1.0••.•••.321");
    expect(JSON.stringify(r.cliente)).not.toContain("1012345321");
    expect(r.cliente?.capacidad).toEqual({ configurada: true, cupo50: "$ 1.300.000", cupo100: "$ 2.700.000" });
  });

  it("buscarCliente: sin resultado (no es su cliente) → cliente null", async () => {
    clienteFalso({ rpc: () => ({ data: null }) });
    const r = await buscarCliente({}, fd({ cedula: "1012345321" }));
    expect(r.cliente).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("/admin · proceso ejecutivo (§6)", () => {
  it("guarda por RPC con fecha vacía = null (conservar / hoy al pasar a Operando)", async () => {
    const { rpc } = clienteFalso();
    const r = await actualizarProcesoEjecutivo({}, fd({ asociadoId: UUID, estado: "operando", fechaInicioEmbargo: "" }));
    expect(r.mensaje).toBe("Proceso actualizado.");
    expect(rpc).toHaveBeenCalledWith("admin_actualizar_proceso_ejecutivo", {
      p_asociado_id: UUID,
      p_estado: "operando",
      p_fecha_inicio_embargo: null,
    });
  });

  it("rechaza fecha antes de «Operando» sin llamar a la base", async () => {
    const { rpc } = clienteFalso();
    const r = await actualizarProcesoEjecutivo({}, fd({ asociadoId: UUID, estado: "sentencia", fechaInicioEmbargo: "2026-06-15" }));
    expect(r.errores?.fechaInicioEmbargo).toMatch(/desde el paso «Operando»/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rechaza un estado que no existe y una fecha inválida", async () => {
    clienteFalso();
    expect((await actualizarProcesoEjecutivo({}, fd({ asociadoId: UUID, estado: "embargado", fechaInicioEmbargo: "" }))).errores?.estado).toBeTruthy();
    expect(
      (await actualizarProcesoEjecutivo({}, fd({ asociadoId: UUID, estado: "operando", fechaInicioEmbargo: "2026-02-30" }))).errores
        ?.fechaInicioEmbargo,
    ).toBeTruthy();
  });

  it.each([
    "Otro administrador debe actualizar el proceso de tus clientes",
    "Otro administrador debe actualizar tu propio proceso",
  ])("RS-01: muestra el mensaje de la base «%s»", async (mensaje) => {
    clienteFalso({ rpc: () => ({ error: { message: mensaje } }) });
    const r = await actualizarProcesoEjecutivo({}, fd({ asociadoId: UUID, estado: "operando", fechaInicioEmbargo: "" }));
    expect(r.error).toBe(`${mensaje}.`);
  });

  it("traduce el error conocido de la base", async () => {
    clienteFalso({ rpc: () => ({ error: { message: "No existe ese asociado" } }) });
    const r = await actualizarProcesoEjecutivo({}, fd({ asociadoId: UUID, estado: "reparto", fechaInicioEmbargo: "" }));
    expect(r.error).toBe("No existe ese asociado.");
  });
});

describe("/admin · alertas (§6)", () => {
  it("marca atendida por RPC", async () => {
    const { rpc } = clienteFalso();
    expect((await marcarAlertaAtendida({}, fd({ alertaId: UUID }))).mensaje).toBe("Alerta atendida.");
    expect(rpc).toHaveBeenCalledWith("admin_marcar_alerta_atendida", { p_alerta_id: UUID });
  });
  it("si otro admin ya la atendió, lo dice", async () => {
    clienteFalso({ rpc: () => ({ error: { message: "La alerta no existe o ya estaba atendida" } }) });
    expect((await marcarAlertaAtendida({}, fd({ alertaId: UUID }))).error).toBe("Esta alerta ya estaba atendida.");
  });
  it("id inválido: no llama a la base", async () => {
    const { rpc } = clienteFalso();
    expect((await marcarAlertaAtendida({}, fd({ alertaId: "x" }))).error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("/admin · pagos de comisión (§5.4, R-09 y correcciones §8)", () => {
  const pago = { asesorId: UUID, periodoCorte: "2026-10-15", concepto: "ingreso_nuevo", monto: "$ 500.000", asociadoId: "", nota: "" };

  it("registra el pago (sin registrado_por: lo sella la base)", async () => {
    const { inserts } = clienteFalso();
    const r = await registrarPagoComision({}, fd(pago));
    expect(r.mensaje).toBe("Pago registrado.");
    expect(inserts[0]).toEqual({
      tabla: "pagos_comision",
      fila: { asesor_id: UUID, asociado_id: null, periodo_corte: "2026-10-15", concepto: "ingreso_nuevo", monto: 500000, nota: null },
    });
  });

  it.each([
    [{ periodoCorte: "2026-10-16" }, "periodoCorte"],
    [{ monto: "-500000" }, "monto"],
    [{ monto: "12,5" }, "monto"],
    [{ concepto: "ajuste", monto: "0" }, "monto"],
    [{ concepto: "propina" }, "concepto"],
    [{ asesorId: "x" }, "asesorId"],
  ])("rechaza %j en el campo %s", async (cambio, campo) => {
    const { inserts } = clienteFalso();
    const r = await registrarPagoComision({}, fd({ ...pago, ...cambio }));
    expect(r.errores?.[campo as keyof typeof r.errores]).toBeTruthy();
    expect(inserts).toHaveLength(0);
  });

  it("RS-10: el monto máximo es 10.000.000 (en valor absoluto) al registrar", async () => {
    const { inserts } = clienteFalso();
    expect((await registrarPagoComision({}, fd({ ...pago, monto: "10.000.001" }))).errores?.monto).toMatch(/10.000.000/);
    expect((await registrarPagoComision({}, fd({ ...pago, concepto: "ajuste", monto: "-10.000.001" }))).errores?.monto).toBeTruthy();
    expect(inserts).toHaveLength(0);
    expect((await registrarPagoComision({}, fd({ ...pago, monto: "10.000.000" }))).mensaje).toBe("Pago registrado.");
  });

  it("RS-10: el monto máximo también aplica al corregir", async () => {
    const { rpc } = clienteFalso();
    const r = await editarPagoComision({}, fd({ pagoId: UUID, motivo: "Error de digitación", monto: "100.000.000", concepto: "", nota: "" }));
    expect(r.errores?.monto).toMatch(/10.000.000/);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("RS-01 (regla cambiada 2026-10-01): un admin sí se registra pagos a sí mismo", async () => {
    m.adminId = UUID;
    const { inserts } = clienteFalso();
    const r = await registrarPagoComision({}, fd(pago));
    expect(r.errores).toBeUndefined();
    expect(r.mensaje).toBe("Pago registrado.");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].fila).toMatchObject({ asesor_id: UUID });
  });

  it("RS-01: muestra el mensaje de la base si igual llega (registrar, corregir y anular)", async () => {
    clienteFalso({ insertError: { message: "Otro administrador debe registrar tus comisiones" } });
    expect((await registrarPagoComision({}, fd(pago))).errores?.asesorId).toBe("Otro administrador debe registrar tus comisiones.");
    clienteFalso({ rpc: () => ({ error: { message: "Otro administrador debe registrar tus comisiones" } }) });
    expect((await anularPagoComision({}, fd({ pagoId: UUID, motivo: "Pago duplicado" }))).error).toBe(
      "Otro administrador debe registrar tus comisiones.",
    );
    expect(
      (await editarPagoComision({}, fd({ pagoId: UUID, motivo: "Error de digitación", monto: "1000", concepto: "", nota: "" }))).error,
    ).toBe("Otro administrador debe registrar tus comisiones.");
  });

  it("un ajuste puede ser negativo", async () => {
    const { inserts } = clienteFalso();
    await registrarPagoComision({}, fd({ ...pago, concepto: "ajuste", monto: "-50.000" }));
    expect(inserts[0].fila).toMatchObject({ concepto: "ajuste", monto: -50000 });
  });

  it("el trigger rechaza un asesor inactivo", async () => {
    clienteFalso({ insertError: { message: "El pago debe ser para un asesor activo" } });
    const r = await registrarPagoComision({}, fd(pago));
    expect(r.errores?.asesorId).toMatch(/asesor activo/);
  });

  it("corregir: motivo obligatorio y al menos un cambio", async () => {
    const { rpc } = clienteFalso();
    expect((await editarPagoComision({}, fd({ pagoId: UUID, motivo: "no", monto: "1", concepto: "", nota: "" }))).errores?.motivo).toBeTruthy();
    expect(
      (await editarPagoComision({}, fd({ pagoId: UUID, motivo: "Error de digitación", monto: "", concepto: "", nota: "" }))).errores?.monto,
    ).toBe("No hay cambios para guardar.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("corregir: manda solo lo que cambia (null = no cambiar; borrarNota → '')", async () => {
    const { rpc } = clienteFalso();
    const r = await editarPagoComision(
      {},
      fd({ pagoId: UUID, motivo: "  Error de   digitación ", monto: "450.000", concepto: "", nota: "", borrarNota: "on" }),
    );
    expect(r.mensaje).toBe("Pago corregido.");
    expect(rpc).toHaveBeenCalledWith("admin_editar_pago_comision", {
      p_pago_id: UUID,
      p_motivo: "Error de digitación",
      p_monto: 450000,
      p_concepto: null,
      p_nota: "",
    });
  });

  it("corregir: el monto que no cuadra con el concepto (23514) se explica", async () => {
    clienteFalso({ rpc: () => ({ error: { code: "23514", message: "violates check constraint" } }) });
    const r = await editarPagoComision({}, fd({ pagoId: UUID, motivo: "Error de digitación", monto: "-1", concepto: "", nota: "" }));
    expect(r.error).toMatch(/no es válido para ese concepto/);
  });

  it("anular: motivo 5–300 y RPC", async () => {
    const { rpc } = clienteFalso();
    expect((await anularPagoComision({}, fd({ pagoId: UUID, motivo: "x" }))).errores?.motivo).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
    expect((await anularPagoComision({}, fd({ pagoId: UUID, motivo: "Pago duplicado" }))).mensaje).toBe("Pago anulado.");
    expect(rpc).toHaveBeenCalledWith("admin_anular_pago_comision", { p_pago_id: UUID, p_motivo: "Pago duplicado" });
  });

  it("anular: un pago ya anulado", async () => {
    clienteFalso({ rpc: () => ({ error: { message: "Un pago anulado ya no se puede modificar" } }) });
    expect((await anularPagoComision({}, fd({ pagoId: UUID, motivo: "Pago duplicado" }))).error).toBe(
      "Un pago anulado ya no se puede modificar.",
    );
  });
});

describe("/admin · «Atiende asociados» (§2.9, §6)", () => {
  it("enciende el interruptor solo en un admin", async () => {
    const { updates } = clienteFalso({ updateResultado: { data: { id: UUID2, nombre_completo: "Ricardo Varón" }, error: null } });
    const r = await alternarAtiendeAsociados({}, fd({ perfilId: UUID2, atiende: "true" }));
    expect(r.mensaje).toBe("Ricardo Varón ahora atiende asociados.");
    expect(updates[0].cambios).toEqual({ atiende_asociados: true });
    expect(updates[0].filtros).toEqual([
      ["id", UUID2],
      ["rol", "admin"],
    ]);
  });
  it("si la persona no es admin, no cambia nada", async () => {
    clienteFalso({ updateResultado: { data: null, error: null } });
    const r = await alternarAtiendeAsociados({}, fd({ perfilId: UUID2, atiende: "false" }));
    expect(r.error).toBe("Este interruptor solo aplica a administradores.");
  });
  it("valor inválido", async () => {
    const { updates } = clienteFalso();
    expect((await alternarAtiendeAsociados({}, fd({ perfilId: UUID2, atiende: "si" }))).error).toBeTruthy();
    expect(updates).toHaveLength(0);
  });
});

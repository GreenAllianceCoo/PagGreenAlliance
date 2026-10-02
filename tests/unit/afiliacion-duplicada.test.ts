/**
 * `enviarAfiliacion` y `prepararSubidaFotos` (app/afiliacion/actions.ts),
 * afiliación v3 con fotos por URL firmada (spec-requerimientos-ricardo §2).
 *  - S-06: una cédula con solicitud pendiente (23505) responde EXACTAMENTE
 *    igual que un envío exitoso (mismo flash, mismo redirect).
 *  - Las fotos ya subidas se borran si el envío no sigue, pero NUNCA si ya
 *    existe una solicitud con ese id (un reenvío del mismo ticket no puede
 *    borrar las fotos de una solicitud real).
 *  - El insert usa id = prefijo de las fotos, correo personal en `email`,
 *    correo institucional y la cuenta de nómina ya resuelta.
 * Todo lo que habla con Supabase, cookies y el registro se simula.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const SOLICITUD = "11111111-2222-4333-8444-555555555555";
const RUTAS = {
  foto_cedula_frente: `solicitudes/${SOLICITUD}/frente.jpg`,
  foto_cedula_reverso: `solicitudes/${SOLICITUD}/reverso.jpg`,
  foto_selfie: `solicitudes/${SOLICITUD}/selfie.jpg`,
};

const m = vi.hoisted(() => ({
  redirect: vi.fn((ruta: string) => {
    throw new Error(`REDIRECT:${ruta}`);
  }),
  registrar: vi.fn(),
  guardarFlash: vi.fn().mockResolvedValue(undefined),
  verificar: vi.fn(),
  borrarHuerfanas: vi.fn().mockResolvedValue(undefined),
  despues: vi.fn(),
  crearSubidas: vi.fn(),
  dentroDelLimite: vi.fn().mockResolvedValue(true),
  ip: vi.fn().mockResolvedValue("1.2.3.4"),
  insertSingle: vi.fn(),
  insertados: [] as Record<string, unknown>[],
}));

vi.mock("next/navigation", () => ({ redirect: m.redirect }));
// RS-04: after() solo existe dentro de una petición; aquí se registra la llamada y se ejecuta al instante.
vi.mock("next/server", () => ({
  after: (tarea: () => unknown) => {
    m.despues();
    void tarea();
  },
}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: m.registrar }));
vi.mock("@/lib/afiliacion/flash", () => ({ guardarFlashAfiliacion: m.guardarFlash }));
vi.mock("@/lib/afiliacion/fotos", () => ({
  verificarFotosSubidas: m.verificar,
  borrarFotosSiHuerfanas: m.borrarHuerfanas,
  crearSubidasAfiliacion: m.crearSubidas,
  // Ticket válido = "ticket-ok" (el real se prueba en afiliacion-subida-fotos.test.ts).
  solicitudIdDeTicket: (t: string) => (t === "ticket-ok" ? SOLICITUD : null),
  rutaEsDelPrefijo: (ruta: string, id: string, campo: string) =>
    ruta === `solicitudes/${id}/${{ foto_cedula_frente: "frente", foto_cedula_reverso: "reverso", foto_selfie: "selfie" }[campo]}.jpg`,
}));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: m.dentroDelLimite, ipDelCliente: m.ip }));
vi.mock("@/lib/grados", () => ({
  cargarCatalogoGrados: async () => [
    { codigo: "PT", nombre: "Patrullero", policia: true, ejercito: false, grupoCredito: "PT", orden: 1, seleccionable: true },
  ],
}));
vi.mock("@/lib/afiliacion/asesores", () => ({ asesoresParaAfiliacion: async () => [] }));
vi.mock("@/lib/supabase/admin", () => ({
  crearClienteAdmin: () => ({
    from: () => ({
      insert: (fila: Record<string, unknown>) => {
        m.insertados.push(fila);
        return { select: () => ({ single: m.insertSingle }) };
      },
    }),
  }),
}));

import { enviarAfiliacion, prepararSubidaFotos } from "@/app/afiliacion/actions";

const CEDULA = "1234567890";
const PERSONAL = "laura.gomez@gmail.com";

function formulario(cambios: Record<string, string> = {}) {
  const campos: Record<string, string> = {
    nombres: "Laura",
    apellidos: "Gómez",
    cedula: CEDULA,
    institucion: "policia",
    grado_id: "PT",
    nequi: "3001234567",
    nomina_entidad: "Nequi",
    nomina_entidad_otra: "",
    nomina_tipo: "",
    nomina_numero: "3001234567",
    celular: "3001234567",
    correo_institucional: "laura.gomez@policia.gov.co",
    email: PERSONAL,
    asesor_id: "",
    mensaje: "",
    acepto_datos: "on",
    sitio_web: "",
    fotos_ticket: "ticket-ok",
    ...RUTAS,
    ...cambios,
  };
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.append(k, v);
  return fd;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.insertados.length = 0;
  m.dentroDelLimite.mockResolvedValue(true);
  m.verificar.mockResolvedValue({
    ok: true,
    solicitudId: SOLICITUD,
    columnas: {
      foto_cedula_frente: `afiliacion-documentos/${RUTAS.foto_cedula_frente}`,
      foto_cedula_reverso: `afiliacion-documentos/${RUTAS.foto_cedula_reverso}`,
      foto_selfie: `afiliacion-documentos/${RUTAS.foto_selfie}`,
    },
    rutas: Object.values(RUTAS),
  });
});

describe("enviarAfiliacion · envío exitoso", () => {
  it("inserta con id = prefijo, correos, nómina resuelta y redirige con el flash del correo PERSONAL", async () => {
    m.insertSingle.mockResolvedValue({ data: { id: SOLICITUD }, error: null });

    await expect(enviarAfiliacion({}, formulario())).rejects.toThrow("REDIRECT:/afiliacion/enviada");

    expect(m.insertados).toHaveLength(1);
    expect(m.insertados[0]).toMatchObject({
      id: SOLICITUD,
      cedula: CEDULA,
      grado: "PT",
      email: PERSONAL,
      correo_institucional: "laura.gomez@policia.gov.co",
      nomina_entidad: "Nequi",
      nomina_tipo: "deposito_electronico",
      nomina_numero: "3001234567",
      foto_cedula_frente: `afiliacion-documentos/${RUTAS.foto_cedula_frente}`,
    });
    expect(m.guardarFlash).toHaveBeenCalledWith(PERSONAL);
    expect(m.borrarHuerfanas).not.toHaveBeenCalled();
    expect(m.registrar.mock.calls.some(([, d]) => d?.evento === "afiliacion_duplicada")).toBe(false);
  });
});

describe("enviarAfiliacion · cédula con solicitud pendiente (S-06)", () => {
  beforeEach(() => {
    m.insertSingle.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });
  });

  it("responde IGUAL que un envío exitoso: mismo flash y mismo redirect", async () => {
    await expect(enviarAfiliacion({}, formulario())).rejects.toThrow("REDIRECT:/afiliacion/enviada");
    expect(m.guardarFlash).toHaveBeenCalledWith(PERSONAL);
  });

  it("borra las fotos subidas SOLO si no hay una solicitud con ese id (borrarFotosSiHuerfanas)", async () => {
    await expect(enviarAfiliacion({}, formulario())).rejects.toThrow("REDIRECT:");
    expect(m.borrarHuerfanas).toHaveBeenCalledWith(expect.anything(), SOLICITUD, Object.values(RUTAS));
  });

  it("RS-04: la limpieza de fotos se difiere con after() (mismo tiempo que el camino de éxito)", async () => {
    await expect(enviarAfiliacion({}, formulario())).rejects.toThrow("REDIRECT:");
    expect(m.despues).toHaveBeenCalledTimes(1);
  });

  it("registra afiliacion_duplicada SIN cédula, nombre ni correo", async () => {
    await expect(enviarAfiliacion({}, formulario())).rejects.toThrow("REDIRECT:");
    const llamada = m.registrar.mock.calls.find(([, d]) => d?.evento === "afiliacion_duplicada");
    expect(llamada).toBeTruthy();
    const texto = JSON.stringify(llamada);
    for (const dato of [CEDULA, PERSONAL, "Laura"]) expect(texto).not.toContain(dato);
  });
});

describe("enviarAfiliacion · cuando el envío no sigue", () => {
  it("campo trampa: responde «éxito», no inserta y descarta las fotos del ticket", async () => {
    await expect(enviarAfiliacion({}, formulario({ sitio_web: "http://spam" }))).rejects.toThrow(
      "REDIRECT:/afiliacion/enviada",
    );
    expect(m.insertados).toHaveLength(0);
    expect(m.borrarHuerfanas).toHaveBeenCalledWith(expect.anything(), SOLICITUD, Object.values(RUTAS));
  });

  it("errores de validación: devuelve errores por campo, conserva lo escrito y descarta las fotos", async () => {
    const r = await enviarAfiliacion({}, formulario({ email: "laura.gomez@policia.gov.co" }));
    expect(r.errores?.email).toBe("Tu correo personal debe ser distinto del institucional.");
    expect(r.valores?.cedula).toBe(CEDULA);
    expect(r.valores).not.toHaveProperty("fotos_ticket");
    expect(m.insertados).toHaveLength(0);
    expect(m.borrarHuerfanas).toHaveBeenCalled();
  });

  it("límite por IP: error general, sin insert", async () => {
    m.dentroDelLimite.mockResolvedValueOnce(false);
    const r = await enviarAfiliacion({}, formulario());
    expect(r.errorGeneral).toMatch(/varias solicitudes/);
    expect(m.insertados).toHaveLength(0);
  });

  it("fotos no verificadas: error en el campo de la foto, sin insert", async () => {
    m.verificar.mockResolvedValueOnce({ ok: false, solicitudId: SOLICITUD, campo: "foto_selfie", motivo: "falta" });
    const r = await enviarAfiliacion({}, formulario());
    expect(r.errores?.foto_selfie).toMatch(/No recibimos esta foto/);
    expect(m.insertados).toHaveLength(0);
    expect(m.borrarHuerfanas).toHaveBeenCalled();
  });

  it("ticket vencido o falso: error general y NO borra nada (no se sabe de quién son las rutas)", async () => {
    m.verificar.mockResolvedValueOnce({ ok: false, solicitudId: null, campo: null, motivo: "ticket" });
    const r = await enviarAfiliacion({}, formulario({ fotos_ticket: "ticket-falso" }));
    expect(r.errorGeneral).toMatch(/Envía de nuevo/);
    expect(m.borrarHuerfanas).not.toHaveBeenCalled();
  });

  it("nunca borra rutas que no sean del prefijo del ticket", async () => {
    await enviarAfiliacion({}, formulario({ email: "", foto_selfie: "solicitudes/otra-solicitud/selfie.jpg" }));
    const rutasBorradas = m.borrarHuerfanas.mock.calls[0]?.[2] as string[];
    expect(rutasBorradas).not.toContain("solicitudes/otra-solicitud/selfie.jpg");
    expect(rutasBorradas).toHaveLength(2);
  });
});

describe("prepararSubidaFotos", () => {
  const TIPOS = { foto_cedula_frente: "image/jpeg", foto_cedula_reverso: "image/png", foto_selfie: "image/webp" };

  it("rechaza tipos no permitidos sin tocar Storage", async () => {
    const r = await prepararSubidaFotos({ ...TIPOS, foto_selfie: "image/gif" });
    expect(r).toEqual({ ok: false, error: "La foto debe ser JPG, PNG o WEBP." });
    expect(m.crearSubidas).not.toHaveBeenCalled();
  });

  it("respeta el límite por IP", async () => {
    m.dentroDelLimite.mockResolvedValueOnce(false);
    const r = await prepararSubidaFotos(TIPOS);
    expect(r.ok).toBe(false);
    expect(m.crearSubidas).not.toHaveBeenCalled();
  });

  it("devuelve ticket, bucket y una ruta+token por foto", async () => {
    m.crearSubidas.mockResolvedValue({
      ticket: "t",
      bucket: "afiliacion-documentos",
      fotos: { foto_cedula_frente: { ruta: "r1", token: "k1" }, foto_cedula_reverso: { ruta: "r2", token: "k2" }, foto_selfie: { ruta: "r3", token: "k3" } },
    });
    const r = await prepararSubidaFotos(TIPOS);
    expect(r.ok).toBe(true);
    expect(m.crearSubidas).toHaveBeenCalledWith(expect.anything(), TIPOS);
  });

  it("si Storage falla, mensaje genérico", async () => {
    m.crearSubidas.mockRejectedValue(new Error("storage caído"));
    const r = await prepararSubidaFotos(TIPOS);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/No pudimos recibir tus fotos/) });
  });
});

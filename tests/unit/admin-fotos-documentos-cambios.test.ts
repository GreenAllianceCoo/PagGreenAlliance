/**
 * Pedido de Sebas (8-nov): fotos de afiliación (fotos-actions.ts), PDF del proceso
 * (documentos-actions.ts), sección «Cambios» (texto y filtros) y logos estáticos de
 * convenios. Supabase y Storage simulados (nunca habla con una base real).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { RedireccionSimulada } = vi.hoisted(() => {
  class RedireccionSimulada extends Error {
    constructor(public ruta: string) {
      super(`REDIRECT ${ruta}`);
    }
  }
  return { RedireccionSimulada };
});

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ruta: string) => {
    throw new RedireccionSimulada(ruta);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  crearClienteAdmin: vi.fn(),
  crearClienteAnonimoSinSesion: vi.fn(() => ({
    storage: { from: () => ({ getPublicUrl: (ruta: string) => ({ data: { publicUrl: `https://bucket.test/${ruta}` } }) }) },
  })),
}));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn(async () => true) }));
vi.mock("@/lib/admin/fotosAfiliacionAsociado", () => ({
  afiliacionVigenteDe: vi.fn(),
  borrarFotoAfiliacion: vi.fn(async () => {}),
  crearSubidaCambioFoto: vi.fn(),
  verificarFotoSubida: vi.fn(),
}));
vi.mock("@/lib/admin/documentosProceso", () => ({
  borrarDocumentosProceso: vi.fn(async () => {}),
  crearSubidaDocumentoProceso: vi.fn(),
  urlDescargaDocumento: vi.fn(),
  verificarDocumentoSubido: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dentroDelLimite } from "@/lib/servidor/limite";
import {
  afiliacionVigenteDe,
  borrarFotoAfiliacion,
  crearSubidaCambioFoto,
  verificarFotoSubida,
} from "@/lib/admin/fotosAfiliacionAsociado";
import {
  borrarDocumentosProceso,
  crearSubidaDocumentoProceso,
  urlDescargaDocumento,
  verificarDocumentoSubido,
} from "@/lib/admin/documentosProceso";
import { guardarCambioFotoAfiliacion, prepararCambioFotoAfiliacion } from "@/app/admin/asociados/fotos-actions";
import {
  guardarDocumentoProceso,
  prepararSubidaDocumentoProceso,
  quitarDocumentoProceso,
  urlDescargaDocumentoProceso,
} from "@/app/admin/asociados/documentos-actions";
import { errorDeArchivoFotoAfiliacion, rutaCambioFoto, rutaEsCambioFoto } from "@/lib/fotosAfiliacionAdmin";
import {
  errorDeArchivoDocumentoProceso,
  esPdfPorBytes,
  formatearTamanoArchivo,
  nombreArchivoDocumento,
  rutaDocumentoProceso,
  rutaEsDocumentoDe,
} from "@/lib/documentosProceso";
import { vistaCambio, type FilaCambioAsociado } from "@/lib/admin/cambiosAsociadosTexto";
import { esquemaFiltrosCambios } from "@/lib/validaciones/cambiosAsociados";
import { esLogoEstatico, urlLogo } from "@/lib/conveniosServidor";
import { seccionesDelRol } from "@/components/admin/secciones";

const ID_ADMIN = "00000000-0000-4000-a000-000000000010";
const ID_ASOCIADO = "00000000-0000-4000-a000-000000000011";
const ID_SOLICITUD = "00000000-0000-4000-a000-000000000012";
const ID_DOC = "00000000-0000-4000-a000-000000000013";
const UUID = "11111111-2222-4333-8444-555555555555";
const MOTIVO = "La foto salió borrosa";

type Escenario = {
  rol?: "admin" | "secretario";
  asociado?: Record<string, unknown> | null;
  errorRpc?: { code?: string; message: string } | null;
  datoRpc?: unknown;
};

function crearSupabaseFalso(escenario: Escenario = {}) {
  const {
    rol = "admin",
    asociado = { rol: "asociado", asesor_id: null, eliminado_at: null },
    errorRpc = null,
    datoRpc = null,
  } = escenario;
  const rpc = vi.fn(async () => (errorRpc ? { data: null, error: errorRpc } : { data: datoRpc, error: null }));
  const from = vi.fn(() => {
    const filtros: Record<string, unknown> = {};
    const resultado = () =>
      filtros.id === ID_ADMIN ? { data: { rol, nombre_completo: "Admin", activo: true }, error: null } : { data: asociado, error: null };
    const consulta: Record<string, unknown> = {};
    consulta.select = vi.fn(() => consulta);
    consulta.eq = vi.fn((columna: string, valor: unknown) => {
      filtros[columna] = valor;
      return consulta;
    });
    consulta.single = vi.fn(async () => resultado());
    consulta.maybeSingle = vi.fn(async () => resultado());
    return consulta;
  });
  const cliente = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: ID_ADMIN } }, error: null })) }, from, rpc };
  vi.mocked(createClient).mockResolvedValue(cliente as never);
  return { rpc };
}

async function redireccionDe(accion: () => Promise<unknown>) {
  try {
    await accion();
    return null;
  } catch (e) {
    if (e instanceof RedireccionSimulada) return e.ruta;
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(dentroDelLimite).mockResolvedValue(true);
  vi.mocked(afiliacionVigenteDe).mockResolvedValue(ID_SOLICITUD);
  vi.mocked(crearSubidaCambioFoto).mockResolvedValue({ ruta: "r", token: "t", bucket: "afiliacion-documentos" });
  vi.mocked(verificarFotoSubida).mockResolvedValue(null);
  vi.mocked(crearSubidaDocumentoProceso).mockResolvedValue({ ruta: "d", token: "t", bucket: "procesos-documentos" });
  vi.mocked(verificarDocumentoSubido).mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Reglas puras
// ---------------------------------------------------------------------------

describe("rutas y archivos de fotos de afiliación", () => {
  it("la foto nueva va al prefijo de la solicitud, con el campo y un uuid", () => {
    const ruta = rutaCambioFoto(ID_SOLICITUD, "foto_selfie", UUID, "image/png");
    expect(ruta).toBe(`solicitudes/${ID_SOLICITUD}/selfie-${UUID}.png`);
    expect(rutaEsCambioFoto(ruta, ID_SOLICITUD, "foto_selfie")).toBe(true);
    expect(rutaEsCambioFoto(ruta, ID_SOLICITUD, "foto_cedula_frente")).toBe(false);
    expect(rutaEsCambioFoto(ruta, ID_DOC, "foto_selfie")).toBe(false);
    expect(rutaEsCambioFoto(`solicitudes/${ID_SOLICITUD}/selfie.png`, ID_SOLICITUD, "foto_selfie")).toBe(false);
  });

  it("valida tipo y tamaño en el navegador", () => {
    expect(errorDeArchivoFotoAfiliacion({ type: "image/jpeg", size: 1000 })).toBeNull();
    expect(errorDeArchivoFotoAfiliacion({ type: "image/gif", size: 1000 })).toMatch(/JPG, PNG o WEBP/);
    expect(errorDeArchivoFotoAfiliacion({ type: "image/png", size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(errorDeArchivoFotoAfiliacion({ type: "image/png", size: 0 })).toMatch(/vacío/);
  });
});

describe("documentos del proceso", () => {
  it("solo PDF de hasta 10 MB (si el navegador no da el tipo, mira la extensión)", () => {
    expect(errorDeArchivoDocumentoProceso({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(errorDeArchivoDocumentoProceso({ type: "", size: 1000, name: "demanda.PDF" })).toBeNull();
    expect(errorDeArchivoDocumentoProceso({ type: "image/png", size: 1000 })).toMatch(/PDF/);
    expect(errorDeArchivoDocumentoProceso({ type: "application/pdf", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });

  it("la ruta es «<asociado>/<uuid>.pdf»", () => {
    const ruta = rutaDocumentoProceso(ID_ASOCIADO, UUID);
    expect(rutaEsDocumentoDe(ruta, ID_ASOCIADO)).toBe(true);
    expect(rutaEsDocumentoDe(ruta, ID_ADMIN)).toBe(false);
    expect(rutaEsDocumentoDe(`${ID_ASOCIADO}/${UUID}.jpg`, ID_ASOCIADO)).toBe(false);
  });

  it("reconoce un PDF por sus bytes", async () => {
    expect(await esPdfPorBytes(new Blob(["%PDF-1.7 ..."]))).toBe(true);
    expect(await esPdfPorBytes(new Blob(["<html>"]))).toBe(false);
  });

  it("tamaño y nombre de descarga legibles", () => {
    expect(formatearTamanoArchivo(1_468_006)).toBe("1,4 MB");
    expect(formatearTamanoArchivo(820 * 1024)).toBe("820 KB");
    expect(nombreArchivoDocumento("Auto que libra mandamiento (Juzgado 3º)")).toBe("auto-que-libra-mandamiento-juzgado-3.pdf");
    expect(nombreArchivoDocumento("¡¡!!")).toBe("documento.pdf");
  });
});

// ---------------------------------------------------------------------------
// «Cambios»: texto y filtros
// ---------------------------------------------------------------------------

const fila = (parcial: Partial<FilaCambioAsociado>): FilaCambioAsociado => ({
  id: "datos-1",
  cuando: "2026-11-08T15:15:00Z",
  asociado_id: ID_ASOCIADO,
  asociado_nombre: "Ana Ruiz",
  actor_nombre: "Laura Gómez",
  actor_rol: "admin",
  tipo: "datos",
  detalle: null,
  motivo: null,
  total: 1,
  ...parcial,
});

describe("vistaCambio", () => {
  it("datos con antes y después, en orden fijo y con «—» para lo vacío", () => {
    const v = vistaCambio(
      fila({ detalle: { campos: ["nombre", "celular"], antes: { celular: null, nombre: "Ana" }, despues: { nombre: "Ana Ruiz", celular: "3001112233" } } }),
    );
    expect(v.titulo).toBe("Cambió los datos personales");
    expect(v.lineas).toEqual([
      { etiqueta: "Nombre", antes: "Ana", despues: "Ana Ruiz" },
      { etiqueta: "Celular", antes: "—", despues: "3001112233" },
    ]);
    expect(v.autor).toBe("Laura Gómez (administrador)");
    expect(v.cuando).toBe("8 nov 2026 10:15");
  });

  it("registros viejos sin valores dicen qué campo cambió", () => {
    const v = vistaCambio(fila({ detalle: { campos: ["celular", "nomina"], antes: null, despues: null } }));
    expect(v.titulo).toBe("Cambió celular, cuenta de nómina (registro sin valores)");
    expect(v.lineas).toEqual([]);
  });

  it("cédula con motivo", () => {
    const v = vistaCambio(
      fila({ tipo: "cedula", detalle: { campos: ["cedula"], antes: { cedula: "123456" }, despues: { cedula: "1234567" } }, motivo: "Error de digitación" }),
    );
    expect(v.titulo).toBe("Corrigió la cédula");
    expect(v.lineas).toEqual([{ etiqueta: "Cédula", antes: "123456", despues: "1234567" }]);
    expect(v.motivo).toBe("Error de digitación");
  });

  it("foto de afiliación: rutas de antes y después para firmar", () => {
    const v = vistaCambio(
      fila({ tipo: "foto_afiliacion", detalle: { campo: "foto_selfie", ruta_anterior: "afiliacion-documentos/a.jpg", ruta_nueva: "afiliacion-documentos/b.jpg" } }),
    );
    expect(v.titulo).toBe("Cambió la foto: selfie");
    expect(v.foto).toEqual({ etiqueta: "Selfie", rutaAnterior: "afiliacion-documentos/a.jpg", rutaNueva: "afiliacion-documentos/b.jpg" });
  });

  it("proceso, documentos, asesor, baja y carné", () => {
    expect(vistaCambio(fila({ tipo: "proceso", detalle: { anterior: "reparto", nuevo: "entrega_titulos", fecha_inicio_embargo: "2026-11-01" } })).lineas).toEqual([
      { etiqueta: "Estado", antes: "Reparto", despues: "Entrega de títulos" },
      { etiqueta: "Inicio del embargo", antes: "—", despues: "1 nov 2026" },
    ]);
    expect(vistaCambio(fila({ tipo: "documento_subido", detalle: { nombre: "Demanda" } })).titulo).toBe("Subió el documento «Demanda» al proceso");
    expect(vistaCambio(fila({ tipo: "documento_quitado", detalle: { nombre: "Demanda" } })).titulo).toBe("Quitó el documento «Demanda» del proceso");
    expect(vistaCambio(fila({ tipo: "asesor", detalle: { anterior: null, nuevo: "Pedro" } })).lineas).toEqual([
      { etiqueta: "Asesor", antes: "—", despues: "Pedro" },
    ]);
    expect(vistaCambio(fila({ tipo: "estado", detalle: { activo: false } })).titulo).toBe("Dio de baja al asociado");
    const carne = vistaCambio(fila({ tipo: "foto_carne", actor_nombre: "Ana Ruiz", actor_rol: "asociado", detalle: { accion: "quitada" } }));
    expect([carne.titulo, carne.autor]).toEqual(["Volvió a la selfie de afiliación en su carné", "El asociado"]);
  });
});

describe("filtros de /admin/cambios", () => {
  it("ignora lo inválido, recorta la búsqueda y ordena las fechas", () => {
    expect(esquemaFiltrosCambios.parse({ asociado: "x", q: "  ana   ruiz ", desde: "2026-11-30", hasta: "2026-11-01", pagina: "0" })).toEqual({
      asociado: undefined,
      q: "ana ruiz",
      desde: "2026-11-01",
      hasta: "2026-11-30",
      pagina: 1,
    });
    expect(esquemaFiltrosCambios.parse({ asociado: ID_ASOCIADO, q: "   ", pagina: "3" })).toMatchObject({ asociado: ID_ASOCIADO, q: undefined, pagina: 3 });
  });
});

// ---------------------------------------------------------------------------
// Acciones: fotos
// ---------------------------------------------------------------------------

const PREPARAR_FOTO = { asociadoId: ID_ASOCIADO, campo: "foto_selfie", tipo: "image/jpeg", tamano: 2000 };
const RUTA_FOTO = `solicitudes/${ID_SOLICITUD}/selfie-${UUID}.jpg`;

describe("prepararCambioFotoAfiliacion", () => {
  it("el secretario no entra", async () => {
    crearSupabaseFalso({ rol: "secretario" });
    expect(await redireccionDe(() => prepararCambioFotoAfiliacion(PREPARAR_FOTO))).toBe("/admin");
  });

  it("no a sí mismo ni a sus propios clientes", async () => {
    crearSupabaseFalso();
    expect(await prepararCambioFotoAfiliacion({ ...PREPARAR_FOTO, asociadoId: ID_ADMIN })).toMatchObject({ ok: false, error: expect.stringMatching(/propias fotos/) });
    crearSupabaseFalso({ asociado: { rol: "asociado", asesor_id: ID_ADMIN, eliminado_at: null } });
    expect(await prepararCambioFotoAfiliacion(PREPARAR_FOTO)).toMatchObject({ ok: false, error: expect.stringMatching(/tus clientes/) });
    expect(crearSubidaCambioFoto).not.toHaveBeenCalled();
  });

  it("rechaza tipos no permitidos y asociados sin afiliación aprobada", async () => {
    crearSupabaseFalso();
    expect(await prepararCambioFotoAfiliacion({ ...PREPARAR_FOTO, tipo: "image/gif" })).toMatchObject({ ok: false });
    vi.mocked(afiliacionVigenteDe).mockResolvedValue(null);
    expect(await prepararCambioFotoAfiliacion(PREPARAR_FOTO)).toMatchObject({ ok: false, error: expect.stringMatching(/afiliación aprobada/) });
  });

  it("respeta el límite de frecuencia", async () => {
    crearSupabaseFalso();
    vi.mocked(dentroDelLimite).mockResolvedValue(false);
    expect(await prepararCambioFotoAfiliacion(PREPARAR_FOTO)).toMatchObject({ ok: false, error: expect.stringMatching(/muchos cambios/) });
  });

  it("devuelve la URL firmada del prefijo de la afiliación vigente", async () => {
    crearSupabaseFalso();
    expect(await prepararCambioFotoAfiliacion(PREPARAR_FOTO)).toEqual({ ok: true, ruta: "r", token: "t", bucket: "afiliacion-documentos" });
    expect(crearSubidaCambioFoto).toHaveBeenCalledWith(ID_SOLICITUD, "foto_selfie", "image/jpeg");
  });
});

describe("guardarCambioFotoAfiliacion", () => {
  const GUARDAR = { asociadoId: ID_ASOCIADO, campo: "foto_selfie", ruta: RUTA_FOTO, motivo: MOTIVO };

  it("exige motivo", async () => {
    const { rpc } = crearSupabaseFalso();
    expect(await guardarCambioFotoAfiliacion({ ...GUARDAR, motivo: "no" })).toEqual({ error: expect.stringMatching(/motivo/) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("si el archivo no sirve, no llama a la base", async () => {
    const { rpc } = crearSupabaseFalso();
    vi.mocked(verificarFotoSubida).mockResolvedValue("La foto debe ser una imagen JPG, PNG o WEBP de máximo 5 MB.");
    expect(await guardarCambioFotoAfiliacion(GUARDAR)).toEqual({ error: expect.stringMatching(/JPG, PNG o WEBP/) });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("muestra el error conocido de la base y borra el archivo", async () => {
    crearSupabaseFalso({ errorRpc: { message: "Esa ya es la foto actual" } });
    expect(await guardarCambioFotoAfiliacion(GUARDAR)).toEqual({ error: "Esa ya es la foto actual." });
    expect(borrarFotoAfiliacion).toHaveBeenCalledWith(RUTA_FOTO);
  });

  it("oculta los errores desconocidos", async () => {
    crearSupabaseFalso({ errorRpc: { code: "XX000", message: "detalle interno" } });
    expect(await guardarCambioFotoAfiliacion(GUARDAR)).toEqual({ error: "No pudimos guardar la foto. Intenta de nuevo." });
  });

  it("registra con la sesión del admin y refresca la ficha y «Cambios»", async () => {
    const { rpc } = crearSupabaseFalso();
    expect(await guardarCambioFotoAfiliacion(GUARDAR)).toEqual({ mensaje: expect.stringMatching(/Foto actualizada/) });
    expect(rpc).toHaveBeenCalledWith("admin_cambiar_foto_afiliacion", {
      p_asociado_id: ID_ASOCIADO,
      p_campo: "foto_selfie",
      p_ruta: RUTA_FOTO,
      p_motivo: MOTIVO,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/admin/asociados/${ID_ASOCIADO}`);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/cambios");
    expect(borrarFotoAfiliacion).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Acciones: documentos del proceso
// ---------------------------------------------------------------------------

describe("documentos del proceso (acciones)", () => {
  const RUTA_DOC = `${ID_ASOCIADO}/${UUID}.pdf`;

  it("el secretario no sube ni descarga", async () => {
    crearSupabaseFalso({ rol: "secretario" });
    expect(await redireccionDe(() => prepararSubidaDocumentoProceso({ asociadoId: ID_ASOCIADO, tamano: 1000 }))).toBe("/admin");
    expect(await redireccionDe(() => urlDescargaDocumentoProceso({ documentoId: ID_DOC }))).toBe("/admin");
  });

  it("no a su propio proceso, ni a eliminados, ni más de 10 MB", async () => {
    crearSupabaseFalso();
    expect(await prepararSubidaDocumentoProceso({ asociadoId: ID_ADMIN, tamano: 1000 })).toMatchObject({ ok: false, error: expect.stringMatching(/propio proceso/) });
    expect(await prepararSubidaDocumentoProceso({ asociadoId: ID_ASOCIADO, tamano: 11 * 1024 * 1024 })).toMatchObject({ ok: false, error: expect.stringMatching(/10 MB/) });
    crearSupabaseFalso({ asociado: { rol: "asociado", eliminado_at: "2026-11-01" } });
    expect(await prepararSubidaDocumentoProceso({ asociadoId: ID_ASOCIADO, tamano: 1000 })).toMatchObject({ ok: false, error: expect.stringMatching(/No encontramos/) });
  });

  it("guarda el documento con su nombre y refresca", async () => {
    const { rpc } = crearSupabaseFalso({ datoRpc: ID_DOC });
    expect(await guardarDocumentoProceso({ asociadoId: ID_ASOCIADO, ruta: RUTA_DOC, nombre: "  Demanda   ejecutiva " })).toEqual({ mensaje: "Documento guardado." });
    expect(rpc).toHaveBeenCalledWith("admin_registrar_documento_proceso", { p_asociado_id: ID_ASOCIADO, p_ruta: RUTA_DOC, p_nombre: "Demanda ejecutiva" });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/cambios");
  });

  it("si la base lo rechaza, borra el archivo subido", async () => {
    crearSupabaseFalso({ errorRpc: { message: "El documento debe pesar máximo 10 MB" } });
    expect(await guardarDocumentoProceso({ asociadoId: ID_ASOCIADO, ruta: RUTA_DOC, nombre: "Demanda" })).toEqual({ error: "El documento debe pesar máximo 10 MB." });
    expect(borrarDocumentosProceso).toHaveBeenCalledWith([RUTA_DOC]);
  });

  it("quitar exige motivo y borra el archivo que devuelve la base", async () => {
    crearSupabaseFalso({ datoRpc: RUTA_DOC });
    expect(await quitarDocumentoProceso({ asociadoId: ID_ASOCIADO, documentoId: ID_DOC, motivo: "x" })).toEqual({ error: expect.stringMatching(/motivo/) });
    expect(await quitarDocumentoProceso({ asociadoId: ID_ASOCIADO, documentoId: ID_DOC, motivo: "Se subió por error" })).toEqual({ mensaje: "Documento quitado." });
    expect(borrarDocumentosProceso).toHaveBeenCalledWith([RUTA_DOC]);
  });

  it("descarga: id inválido o documento quitado", async () => {
    crearSupabaseFalso();
    expect(await urlDescargaDocumentoProceso({ documentoId: "../otro" })).toEqual({ error: "No encontramos el documento." });
    vi.mocked(urlDescargaDocumento).mockResolvedValue(null);
    expect(await urlDescargaDocumentoProceso({ documentoId: ID_DOC })).toEqual({ error: expect.stringMatching(/No pudimos descargar/) });
    vi.mocked(urlDescargaDocumento).mockResolvedValue("https://firmada.test/doc");
    expect(await urlDescargaDocumentoProceso({ documentoId: ID_DOC })).toEqual({ url: "https://firmada.test/doc" });
  });
});

// ---------------------------------------------------------------------------
// Logos estáticos y menú
// ---------------------------------------------------------------------------

describe("logos de convenios", () => {
  it("un logo del sitio («/convenios/logos/…») se usa tal cual; uno del bucket, con su URL pública", () => {
    expect(esLogoEstatico("/convenios/logos/sb7-motos.webp")).toBe(true);
    expect(urlLogo("/convenios/logos/sb7-motos.webp")).toBe("/convenios/logos/sb7-motos.webp");
    expect(esLogoEstatico(`${ID_DOC}/logo.png`)).toBe(false);
    expect(urlLogo(`${ID_DOC}/logo.png`)).toBe(`https://bucket.test/${ID_DOC}/logo.png`);
    expect(urlLogo(null)).toBeNull();
  });
});

describe("menú del admin", () => {
  it("«Cambios» es solo del admin", () => {
    expect(seccionesDelRol("admin").map((s) => s.clave)).toContain("cambios");
    expect(seccionesDelRol("secretario").map((s) => s.clave)).not.toContain("cambios");
  });
});

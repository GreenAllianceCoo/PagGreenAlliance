/**
 * Convenios administrables (5.9 / P-68): esquemas zod, validación del logo,
 * orden, y Server Actions de /admin/convenios con Supabase simulado (nunca
 * toca una base real).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/admin/servidor", () => ({ exigirAdmin: vi.fn() }));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/conveniosServidor", () => ({ BUCKET_LOGOS: "convenios-logos" }));

import { exigirAdmin } from "@/lib/admin/servidor";
import { registrar } from "@/lib/servidor/registro";
import { revalidatePath } from "next/cache";
import { reordenarConvenios } from "@/lib/conveniosOrden";
import {
  alternarVisibilidadConvenio,
  eliminarConvenio,
  guardarConvenio,
  moverConvenio,
} from "@/app/admin/convenios/actions";
import {
  bytesCoincidenConTipo,
  entradaGuardarConvenio,
  esquemaGuardarConvenio,
  esquemaMoverConvenio,
  esquemaVisibilidadConvenio,
  leerFormularioConvenio,
  validarLogo,
} from "@/lib/validaciones/convenios";

const UUID = "11111111-1111-4111-8111-111111111111";
const UUID2 = "22222222-2222-4222-8222-222222222222";

function formulario(extra: Record<string, string | File> = {}) {
  const f = new FormData();
  const base: Record<string, string | File> = {
    nombreEmpresa: "  AMB   Móvil S.A.S. ",
    especialidad: "Tecnología",
    nit: "902.038.118-7",
    emoji: "📱",
    descripcion: "Texto",
    servicios: "Celulares\n\n  Accesorios  \nCelulares",
    sedes: "",
    telefonoContacto: "+57 321 461 2714",
    orden: "10",
    videoUrl: "/convenios/amb-movil.mp4",
    pdfUrl: "",
    pdfTamano: "",
    visible: "on",
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) f.set(k, v);
  return f;
}

const validar = (extra: Record<string, string | File> = {}) =>
  esquemaGuardarConvenio.safeParse(entradaGuardarConvenio(leerFormularioConvenio(formulario(extra))));

describe("esquemaGuardarConvenio", () => {
  it("normaliza un convenio válido (espacios, listas sin vacías ni repetidas, WhatsApp sin +57)", () => {
    const r = validar();
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data).toMatchObject({
      id: null,
      nombreEmpresa: "AMB Móvil S.A.S.",
      telefonoContacto: "3214612714",
      servicios: ["Celulares", "Accesorios"],
      sedes: [],
      orden: 10,
      visible: true,
      pdfUrl: null,
      pdfTamano: null,
      videoUrl: "/convenios/amb-movil.mp4",
    });
  });

  it("acepta crear sin NIT, sin WhatsApp, sin emoji y oculto", () => {
    const r = validar({ nit: "", telefonoContacto: "", emoji: "", visible: "", videoUrl: "" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ nit: null, telefonoContacto: null, emoji: null, visible: false, videoUrl: null });
  });

  it("exige nombre y especialidad, y limita su largo", () => {
    expect(validar({ nombreEmpresa: "   " }).success).toBe(false);
    expect(validar({ nombreEmpresa: "a".repeat(121) }).success).toBe(false);
    expect(validar({ especialidad: "" }).success).toBe(false);
    expect(validar({ especialidad: "a".repeat(81) }).success).toBe(false);
  });

  it("valida NIT, WhatsApp y emoji", () => {
    expect(validar({ nit: "abc" }).success).toBe(false);
    expect(validar({ nit: "902.038.118-7" }).success).toBe(true);
    expect(validar({ telefonoContacto: "12345" }).success).toBe(false);
    expect(validar({ telefonoContacto: "2214612714" }).success).toBe(false);
    expect(validar({ emoji: "x".repeat(17) }).success).toBe(false);
  });

  it("valida el orden (entero de 0 a 10000)", () => {
    expect(validar({ orden: "0" }).success).toBe(true);
    expect(validar({ orden: "10000" }).success).toBe(true);
    expect(validar({ orden: "10001" }).success).toBe(false);
    expect(validar({ orden: "-1" }).success).toBe(false);
    expect(validar({ orden: "1.5" }).success).toBe(false);
    expect(validar({ orden: "abc" }).success).toBe(false);
  });

  it("limita descripción, servicios y sedes", () => {
    expect(validar({ descripcion: "a".repeat(1001) }).success).toBe(false);
    expect(validar({ servicios: Array.from({ length: 21 }, (_, i) => `s${i}`).join("\n") }).success).toBe(false);
    expect(validar({ servicios: "a".repeat(121) }).success).toBe(false);
    expect(validar({ sedes: Array.from({ length: 11 }, (_, i) => `d${i}`).join("\n") }).success).toBe(false);
  });

  it("solo acepta video/PDF de /convenios/… o https, sin «..»", () => {
    expect(validar({ videoUrl: "https://ejemplo.com/v.mp4" }).success).toBe(true);
    expect(validar({ videoUrl: "http://ejemplo.com/v.mp4" }).success).toBe(false);
    expect(validar({ videoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(validar({ videoUrl: "/convenios/../secreto.mp4" }).success).toBe(false);
    expect(validar({ videoUrl: "/otra/ruta.mp4" }).success).toBe(false);
  });

  it("si hay PDF exige el tamaño que se muestra", () => {
    const sin = validar({ videoUrl: "", pdfUrl: "/convenios/x.pdf", pdfTamano: "" });
    expect(sin.success).toBe(false);
    const con = validar({ videoUrl: "", pdfUrl: "/convenios/x.pdf", pdfTamano: "3 MB" });
    expect(con.success).toBe(true);
  });

  it("el id debe ser uuid (o vacío para crear)", () => {
    expect(validar({ id: "no-es-uuid" }).success).toBe(false);
    expect(validar({ id: UUID }).success).toBe(true);
  });
});

describe("otros esquemas", () => {
  it("visibilidad y mover", () => {
    expect(esquemaVisibilidadConvenio.safeParse({ id: UUID, visible: "false" })).toMatchObject({ success: true, data: { visible: false } });
    expect(esquemaVisibilidadConvenio.safeParse({ id: UUID, visible: "quizas" }).success).toBe(false);
    expect(esquemaMoverConvenio.safeParse({ id: UUID, direccion: "subir" }).success).toBe(true);
    expect(esquemaMoverConvenio.safeParse({ id: UUID, direccion: "diagonal" }).success).toBe(false);
    expect(esquemaMoverConvenio.safeParse({ id: "x", direccion: "bajar" }).success).toBe(false);
  });
});

describe("validarLogo", () => {
  it("acepta png, jpeg y webp de hasta 1 MB", () => {
    for (const [tipo, ext] of [["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]] as const) {
      expect(validarLogo({ type: tipo, size: 1000 })).toMatchObject({ ok: true, extension: ext });
    }
    expect(validarLogo({ type: "image/png", size: 1024 * 1024 }).ok).toBe(true);
  });
  it("rechaza otros tipos, vacío y más de 1 MB", () => {
    expect(validarLogo({ type: "application/pdf", size: 10 }).ok).toBe(false);
    expect(validarLogo({ type: "image/gif", size: 10 }).ok).toBe(false);
    expect(validarLogo({ type: "image/svg+xml", size: 10 }).ok).toBe(false);
    expect(validarLogo({ type: "image/png", size: 0 }).ok).toBe(false);
    expect(validarLogo({ type: "image/png", size: 1024 * 1024 + 1 })).toMatchObject({ ok: false, mensaje: expect.stringContaining("1 MB") });
  });
  it("comprueba la firma real del archivo", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
    expect(bytesCoincidenConTipo(png, "image/png")).toBe(true);
    expect(bytesCoincidenConTipo(png, "image/jpeg")).toBe(false);
  });
});

describe("reordenarConvenios", () => {
  const lista = [
    { id: "a", orden: 10 },
    { id: "b", orden: 20 },
    { id: "c", orden: 30 },
  ];
  it("sube y baja intercambiando con el vecino", () => {
    expect(reordenarConvenios(lista, "b", "subir")).toEqual([{ id: "b", orden: 10 }, { id: "a", orden: 20 }]);
    expect(reordenarConvenios(lista, "b", "bajar")).toEqual([{ id: "c", orden: 20 }, { id: "b", orden: 30 }]);
  });
  it("no hace nada en los extremos ni con un id desconocido", () => {
    expect(reordenarConvenios(lista, "a", "subir")).toEqual([]);
    expect(reordenarConvenios(lista, "c", "bajar")).toEqual([]);
    expect(reordenarConvenios(lista, "z", "subir")).toEqual([]);
  });
  it("resuelve órdenes repetidos renumerando", () => {
    const iguales = [{ id: "a", orden: 100 }, { id: "b", orden: 100 }];
    expect(reordenarConvenios(iguales, "b", "subir")).toEqual([{ id: "b", orden: 10 }, { id: "a", orden: 20 }]);
  });
});

// ---------------------------------------------------------------------------
// Server Actions con Supabase simulado
// ---------------------------------------------------------------------------

type Resp = { data?: unknown; error?: { code?: string; message?: string } | null };

/** Constructor encadenable: cualquier método devuelve el mismo objeto y `await` entrega `resp`. */
function cadena(resp: Resp) {
  const c: Record<string, unknown> = {};
  for (const m of ["select", "update", "insert", "delete", "eq", "order"]) c[m] = vi.fn(() => c);
  c.maybeSingle = vi.fn(async () => ({ data: resp.data ?? null, error: resp.error ?? null }));
  c.then = (res: (v: unknown) => unknown) => res({ data: resp.data ?? null, error: resp.error ?? null });
  return c as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

function supabaseFalso(opciones: { tablas?: Resp[]; subida?: Resp }) {
  const cadenas = (opciones.tablas ?? []).map(cadena);
  let i = 0;
  const upload = vi.fn(async () => ({ error: opciones.subida?.error ?? null }));
  const remove = vi.fn(async () => ({ error: null }));
  const from = vi.fn(() => cadenas[Math.min(i++, cadenas.length - 1)]);
  return { supabase: { from, storage: { from: vi.fn(() => ({ upload, remove })) } }, from, upload, remove, cadenas };
}

function comoAdmin(fake: ReturnType<typeof supabaseFalso>) {
  vi.mocked(exigirAdmin).mockResolvedValue({ supabase: fake.supabase, userId: "admin-1", nombre: "Admin" } as never);
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

beforeEach(() => vi.clearAllMocks());

describe("guardarConvenio", () => {
  it("exige admin antes de todo (si no lo es, exigirAdmin redirige y lanza)", async () => {
    vi.mocked(exigirAdmin).mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(guardarConvenio({}, formulario())).rejects.toThrow("NEXT_REDIRECT");
  });

  it("con datos inválidos devuelve errores por campo y no toca la base", async () => {
    const fake = supabaseFalso({ tablas: [{}] });
    comoAdmin(fake);
    const r = await guardarConvenio({}, formulario({ nombreEmpresa: "", orden: "x" }));
    expect(r.errores).toMatchObject({ nombreEmpresa: expect.any(String), orden: expect.any(String) });
    expect(r.valores?.especialidad).toBe("Tecnología");
    expect(fake.from).not.toHaveBeenCalled();
    expect(fake.upload).not.toHaveBeenCalled();
  });

  it("crea el convenio con datos normalizados, refresca landing y /cuenta y registra", async () => {
    const fake = supabaseFalso({ tablas: [{}] });
    comoAdmin(fake);
    const r = await guardarConvenio({}, formulario());
    expect(r.mensaje).toBe("Convenio creado.");
    expect(r.guardado).toBeTypeOf("number");
    const fila = fake.cadenas[0].insert.mock.calls[0][0];
    expect(fila).toMatchObject({ nombre_empresa: "AMB Móvil S.A.S.", telefono_contacto: "3214612714", servicios: ["Celulares", "Accesorios"], orden: 10, visible: true, logo_path: null });
    expect(fila.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(revalidatePath).toHaveBeenCalledWith("/");
    expect(revalidatePath).toHaveBeenCalledWith("/cuenta");
    expect(registrar).toHaveBeenCalledWith("info", expect.objectContaining({ evento: "convenio_creado", admin: "admin-1" }));
  });

  it("rechaza un logo de tipo o tamaño inválido sin subir nada", async () => {
    const fake = supabaseFalso({ tablas: [{}] });
    comoAdmin(fake);
    const pdf = new File([new Uint8Array([1, 2, 3])], "x.pdf", { type: "application/pdf" });
    expect((await guardarConvenio({}, formulario({ logo: pdf }))).errores?.logo).toMatch(/PNG, JPG/);
    const grande = new File([new Uint8Array(1024 * 1024 + 1)], "x.png", { type: "image/png" });
    expect((await guardarConvenio({}, formulario({ logo: grande }))).errores?.logo).toMatch(/1 MB/);
    const falso = new File([new Uint8Array([1, 2, 3, 4])], "x.png", { type: "image/png" });
    expect((await guardarConvenio({}, formulario({ logo: falso }))).errores?.logo).toMatch(/no coincide/);
    expect(fake.upload).not.toHaveBeenCalled();
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("sube el logo, guarda su ruta y, si la fila falla, borra lo subido", async () => {
    const ok = supabaseFalso({ tablas: [{}] });
    comoAdmin(ok);
    const logo = new File([PNG], "l.png", { type: "image/png" });
    const r = await guardarConvenio({}, formulario({ logo }));
    expect(r.mensaje).toBe("Convenio creado.");
    const ruta = (ok.upload.mock.calls[0] as unknown as [string])[0];
    expect(ruta).toMatch(/^[0-9a-f-]{36}\/\d+\.png$/);
    expect(ok.cadenas[0].insert.mock.calls[0][0].logo_path).toBe(ruta);

    const mal = supabaseFalso({ tablas: [{ error: { code: "23514", message: "check" } }] });
    comoAdmin(mal);
    const r2 = await guardarConvenio({}, formulario({ logo }));
    expect(r2.errorGeneral).toMatch(/reglas de la base/);
    expect(mal.remove).toHaveBeenCalledWith([(mal.upload.mock.calls[0] as unknown as [string])[0]]);
  });

  it("al editar reemplaza el logo y borra el anterior", async () => {
    const fake = supabaseFalso({ tablas: [{ data: { logo_path: "viejo/1.png" } }, {}] });
    comoAdmin(fake);
    const logo = new File([PNG], "l.png", { type: "image/png" });
    const r = await guardarConvenio({}, formulario({ id: UUID, logo }));
    expect(r.mensaje).toBe("Convenio actualizado.");
    expect(fake.cadenas[1].update).toHaveBeenCalled();
    expect(fake.remove).toHaveBeenCalledWith(["viejo/1.png"]);
  });

  it("al editar con «quitar logo» deja logo_path en null y borra el archivo", async () => {
    const fake = supabaseFalso({ tablas: [{ data: { logo_path: "viejo/1.png" } }, {}] });
    comoAdmin(fake);
    await guardarConvenio({}, formulario({ id: UUID, quitarLogo: "on" }));
    expect(fake.cadenas[1].update.mock.calls[0][0].logo_path).toBeNull();
    expect(fake.remove).toHaveBeenCalledWith(["viejo/1.png"]);
  });
});

describe("alternarVisibilidadConvenio", () => {
  it("oculta y muestra con mensaje y refresca la landing", async () => {
    const fake = supabaseFalso({ tablas: [{ data: { nombre_empresa: "AMB" } }] });
    comoAdmin(fake);
    const f = new FormData();
    f.set("id", UUID);
    f.set("visible", "false");
    const r = await alternarVisibilidadConvenio({}, f);
    expect(r.mensaje).toContain("oculto");
    expect(fake.cadenas[0].update).toHaveBeenCalledWith({ visible: false });
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });
  it("datos inválidos o error de la base", async () => {
    comoAdmin(supabaseFalso({ tablas: [{ error: { message: "x" } }] }));
    const malo = new FormData();
    malo.set("id", "no");
    expect((await alternarVisibilidadConvenio({}, malo)).error).toBe("Datos inválidos.");
    const f = new FormData();
    f.set("id", UUID);
    f.set("visible", "true");
    expect((await alternarVisibilidadConvenio({}, f)).error).toMatch(/No pudimos/);
  });
});

describe("moverConvenio", () => {
  it("intercambia posiciones con el vecino", async () => {
    const lectura = { data: [{ id: UUID, orden: 10 }, { id: UUID2, orden: 20 }] };
    const fake = supabaseFalso({ tablas: [lectura, {}, {}] });
    comoAdmin(fake);
    const f = new FormData();
    f.set("id", UUID2);
    f.set("direccion", "subir");
    const r = await moverConvenio({}, f);
    expect(r.mensaje).toBe("Subió una posición.");
    expect(fake.cadenas[1].update).toHaveBeenCalledWith({ orden: 10 });
    expect(fake.cadenas[2].update).toHaveBeenCalledWith({ orden: 20 });
  });
  it("en el extremo no cambia nada", async () => {
    const fake = supabaseFalso({ tablas: [{ data: [{ id: UUID, orden: 10 }] }] });
    comoAdmin(fake);
    const f = new FormData();
    f.set("id", UUID);
    f.set("direccion", "subir");
    expect(await moverConvenio({}, f)).toEqual({});
    expect(fake.from).toHaveBeenCalledTimes(1);
  });
});

describe("eliminarConvenio", () => {
  it("borra la fila y su logo", async () => {
    const fake = supabaseFalso({ tablas: [{ data: { nombre_empresa: "AMB", logo_path: "a/1.png" } }] });
    comoAdmin(fake);
    const f = new FormData();
    f.set("id", UUID);
    const r = await eliminarConvenio({}, f);
    expect(r.mensaje).toContain("eliminado");
    expect(fake.remove).toHaveBeenCalledWith(["a/1.png"]);
    expect(registrar).toHaveBeenCalledWith("info", expect.objectContaining({ evento: "convenio_eliminado" }));
  });
  it("si no existe o el id es inválido, error y sin tocar el bucket", async () => {
    const fake = supabaseFalso({ tablas: [{ data: null }] });
    comoAdmin(fake);
    const f = new FormData();
    f.set("id", UUID);
    expect((await eliminarConvenio({}, f)).error).toMatch(/No encontramos/);
    const malo = new FormData();
    malo.set("id", "x");
    expect((await eliminarConvenio({}, malo)).error).toBe("Datos inválidos.");
    expect(fake.remove).not.toHaveBeenCalled();
  });
});

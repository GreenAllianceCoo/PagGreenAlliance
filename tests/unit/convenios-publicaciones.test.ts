/**
 * Convenios B3 (docs/spec-convenios.md §B3): reglas de las publicaciones
 * (estados, topes, validación) y Server Actions del panel /convenio con
 * Supabase simulado. Nunca toca una base real.
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
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));
vi.mock("@/lib/servidor/limite", () => ({ dentroDelLimite: vi.fn(async () => true) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/convenio/servidor", () => ({ exigirConvenio: vi.fn(), obtenerPublicacionPropia: vi.fn() }));

import { exigirConvenio, obtenerPublicacionPropia } from "@/lib/convenio/servidor";
import { dentroDelLimite } from "@/lib/servidor/limite";
import {
  activasPorTipo,
  errorDeArchivos,
  errorDeImagen,
  errorDePdf,
  estadoPublicacion,
  esquemaPublicacion,
  hoyBogota,
  rutaEsDeLaPublicacion,
  type Publicacion,
} from "@/lib/convenio/publicaciones";
import { esImagenPorFirma, esPdfPorFirma, imagenAWebp } from "@/lib/convenio/archivos";
import { guardarPublicacion, retirarPublicacion, subirImagenPublicacion } from "@/app/convenio/actions";

const HOY = "2026-11-21";
const CONVENIO = "41000000-0000-4000-a000-000000000001";
const PUB = "50000000-0000-4000-a000-000000000001";
const ruta = (archivo: string, pub = PUB) => `${CONVENIO}/${pub}/${archivo}`;

function pub(extra: Partial<Publicacion> = {}): Publicacion {
  return {
    id: PUB,
    tipo: "promocion",
    titulo: "Promo",
    descripcion: "x",
    beneficio: null,
    imagenes: [ruta("a.webp")],
    pdfPath: null,
    iniciaEl: "2026-11-01",
    terminaEl: "2026-11-30",
    ocultaEn: null,
    ocultaMotivo: null,
    creadaEn: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

describe("estados y topes", () => {
  it("oculta gana; luego programada, vencida o publicada por fecha", () => {
    expect(estadoPublicacion(pub({ ocultaEn: "x" }), HOY)).toBe("oculta");
    expect(estadoPublicacion(pub({ iniciaEl: "2026-11-22" }), HOY)).toBe("programada");
    expect(estadoPublicacion(pub({ terminaEl: "2026-11-20" }), HOY)).toBe("vencida");
    expect(estadoPublicacion(pub({ terminaEl: HOY }), HOY)).toBe("publicada");
    expect(estadoPublicacion(pub({ iniciaEl: null, terminaEl: null }), HOY)).toBe("publicada");
  });

  it("el tope cuenta publicadas y programadas, no vencidas ni ocultas", () => {
    const lista = [
      pub(),
      pub({ iniciaEl: "2026-12-01", terminaEl: "2026-12-10" }),
      pub({ terminaEl: "2026-11-20" }),
      pub({ ocultaEn: "x" }),
      pub({ tipo: "catalogo", terminaEl: null }),
    ];
    expect(activasPorTipo(lista, HOY)).toEqual({ promocion: 2, catalogo: 1 });
  });

  it("hoyBogota usa la hora de Bogotá (UTC-5)", () => {
    expect(hoyBogota(new Date("2026-11-22T03:00:00Z"))).toBe("2026-11-21");
    expect(hoyBogota(new Date("2026-11-22T06:00:00Z"))).toBe("2026-11-22");
  });
});

describe("validación", () => {
  const base = { tipo: "promocion", titulo: "  Revisión   gratis ", descripcion: "Incluye todo", beneficio: "20% off", iniciaEl: HOY, terminaEl: "2026-12-21" };
  const validar = (extra: Record<string, string> = {}) => esquemaPublicacion(HOY).safeParse({ ...base, ...extra });

  it("acepta y normaliza una promoción", () => {
    const r = validar();
    expect(r.success && r.data).toMatchObject({ titulo: "Revisión gratis", beneficio: "20% off", iniciaEl: HOY });
  });

  it("la promoción exige descripción y las dos fechas", () => {
    const r = validar({ descripcion: "", iniciaEl: "", terminaEl: "" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path[0]).sort()).toEqual(["descripcion", "iniciaEl", "terminaEl"]);
  });

  it("rechaza fechas al revés, ya pasadas o de más de un año", () => {
    expect(validar({ terminaEl: "2026-11-20", iniciaEl: "2026-11-01" }).success).toBe(false);
    expect(validar({ iniciaEl: "2026-12-10", terminaEl: "2026-12-01" }).success).toBe(false);
    expect(validar({ terminaEl: "2027-12-22" }).success).toBe(false);
  });

  it("el catálogo no lleva beneficio y su vigencia es opcional", () => {
    expect(validar({ tipo: "catalogo", beneficio: "", iniciaEl: "", terminaEl: "", descripcion: "" }).success).toBe(true);
    expect(validar({ tipo: "catalogo" }).success).toBe(false);
  });

  it("archivos por tipo", () => {
    expect(errorDeArchivos("promocion", 1, false)).toBeNull();
    expect(errorDeArchivos("promocion", 0, false)).toBeTruthy();
    expect(errorDeArchivos("promocion", 0, true)).toBeTruthy();
    expect(errorDeArchivos("catalogo", 0, true)).toBeNull();
    expect(errorDeArchivos("catalogo", 3, false)).toBeNull();
    expect(errorDeArchivos("catalogo", 11, false)).toBeTruthy();
    expect(errorDeArchivos("catalogo", 2, true)).toBeTruthy();
  });

  it("tipos y pesos de archivo", () => {
    expect(errorDeImagen({ type: "image/png", size: 5 * 1024 * 1024 })).toBeNull();
    expect(errorDeImagen({ type: "image/png", size: 5 * 1024 * 1024 + 1 })).toMatch(/5 MB/);
    expect(errorDeImagen({ type: "image/gif", size: 10 })).toMatch(/JPG/);
    expect(errorDePdf({ type: "application/pdf", size: 15 * 1024 * 1024 })).toBeNull();
    expect(errorDePdf({ type: "application/pdf", size: 15 * 1024 * 1024 + 1 })).toMatch(/15 MB/);
  });

  it("solo acepta rutas de la propia publicación", () => {
    expect(rutaEsDeLaPublicacion(ruta("a.webp"), CONVENIO, PUB)).toBe(true);
    expect(rutaEsDeLaPublicacion(`otro/${PUB}/a.webp`, CONVENIO, PUB)).toBe(false);
    expect(rutaEsDeLaPublicacion(ruta("../x"), CONVENIO, PUB)).toBe(false);
  });
});

describe("archivos (servidor)", () => {
  it("reconoce firmas de imagen y PDF", () => {
    expect(esImagenPorFirma(new Uint8Array([0xff, 0xd8, 0xff, 0]))).toBe(true);
    expect(esImagenPorFirma(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(false);
    expect(esPdfPorFirma(new TextEncoder().encode("%PDF-1.7"))).toBe(true);
    expect(esPdfPorFirma(new TextEncoder().encode("<html>"))).toBe(false);
  });

  it("sharp reduce a 1600 px como máximo y entrega WebP", async () => {
    const sharp = (await import("sharp")).default;
    const grande = await sharp({ create: { width: 3200, height: 1600, channels: 3, background: "#2a6" } }).png().toBuffer();
    const salida = await imagenAWebp(new Uint8Array(grande));
    const meta = await sharp(salida).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------

type Resp = { data?: unknown; error?: { code?: string; message?: string } | null };

function supabaseFalso(opciones: { escritura?: Resp; descarga?: Blob | null } = {}) {
  const cadena: Record<string, ReturnType<typeof vi.fn>> & { then?: unknown } = {};
  for (const m of ["insert", "update", "delete", "eq", "select"]) cadena[m] = vi.fn(() => cadena);
  cadena.then = (res: (v: unknown) => unknown) => res({ data: opciones.escritura?.data ?? null, error: opciones.escritura?.error ?? null });
  const upload = vi.fn(async () => ({ error: null }));
  const remove = vi.fn(async () => ({ error: null }));
  const download = vi.fn(async () => ({ data: opciones.descarga ?? null, error: opciones.descarga ? null : { message: "no" } }));
  const supabase = { from: vi.fn(() => cadena), storage: { from: vi.fn(() => ({ upload, remove, download })) } };
  vi.mocked(exigirConvenio).mockResolvedValue({ supabase, userId: "u1", convenio: { id: CONVENIO, nombre: "AMB", logoUrl: null } } as never);
  return { cadena, upload, remove, download };
}

function formulario(extra: Record<string, string | string[]> = {}) {
  const f = new FormData();
  const base: Record<string, string | string[]> = {
    id: PUB,
    modo: "nueva",
    tipo: "promocion",
    titulo: "Revisión gratis",
    descripcion: "Incluye todo",
    beneficio: "20% off",
    iniciaEl: hoyBogota(),
    terminaEl: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
    imagenes: [ruta("a.webp")],
    ...extra,
  };
  for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}

async function rutaDe(promesa: Promise<unknown>) {
  try {
    return { resultado: await promesa, ruta: null as string | null };
  } catch (e) {
    if (e instanceof RedireccionSimulada) return { resultado: null, ruta: e.ruta };
    throw e;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(obtenerPublicacionPropia).mockResolvedValue(null);
  vi.mocked(dentroDelLimite).mockResolvedValue(true);
});

describe("guardarPublicacion", () => {
  it("crea la promoción con la ruta de su imagen y vuelve al panel", async () => {
    const f = supabaseFalso();
    const { ruta: destino } = await rutaDe(guardarPublicacion({}, formulario()));
    expect(f.cadena.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: PUB, convenio_id: CONVENIO, tipo: "promocion", imagenes: [ruta("a.webp")], beneficio: "20% off" }),
    );
    expect(destino).toBe("/convenio?listo=publicada");
  });

  it("rechaza rutas que no son de esta publicación sin tocar la base", async () => {
    const f = supabaseFalso();
    const r = await guardarPublicacion({}, formulario({ imagenes: [`${CONVENIO}/otra/a.webp`] }));
    expect(r.errorGeneral).toMatch(/no corresponden/);
    expect(f.cadena.insert).not.toHaveBeenCalled();
  });

  it("errores por campo y de archivos", async () => {
    supabaseFalso();
    const r = await guardarPublicacion({}, formulario({ titulo: "x", imagenes: [] }));
    expect(r.errores?.titulo).toBeTruthy();
    const r2 = await guardarPublicacion({}, formulario({ imagenes: [] }));
    expect(r2.errores?.archivos).toMatch(/imagen/);
  });

  it("el tope del trigger llega como mensaje y se borran los archivos nuevos", async () => {
    const mensaje = "Ya tienes 10 promociones activas o programadas, el máximo. Retira una o espera a que venza.";
    const f = supabaseFalso({ escritura: { error: { code: "P0001", message: mensaje } } });
    const r = await guardarPublicacion({}, formulario());
    expect(r.errorGeneral).toBe(mensaje);
    expect(f.remove).toHaveBeenCalledWith([ruta("a.webp")]);
  });

  it("un PDF sin la firma %PDF se rechaza y se borra", async () => {
    const f = supabaseFalso({ descarga: new Blob(["<html>"]) });
    const r = await guardarPublicacion({}, formulario({ tipo: "catalogo", beneficio: "", iniciaEl: "", terminaEl: "", imagenes: [], pdf: ruta("c.pdf") }));
    expect(r.errores?.archivos).toMatch(/PDF válido/);
    expect(f.remove).toHaveBeenCalledWith([ruta("c.pdf")]);
    expect(f.cadena.insert).not.toHaveBeenCalled();
  });

  it("un catálogo en PDF válido se guarda", async () => {
    const f = supabaseFalso({ descarga: new Blob(["%PDF-1.7 ..."]) });
    const { ruta: destino } = await rutaDe(
      guardarPublicacion({}, formulario({ tipo: "catalogo", beneficio: "", iniciaEl: "", terminaEl: "", imagenes: [], pdf: ruta("c.pdf") })),
    );
    expect(f.cadena.insert).toHaveBeenCalledWith(expect.objectContaining({ tipo: "catalogo", pdf_path: ruta("c.pdf"), imagenes: [], beneficio: null }));
    expect(destino).toBe("/convenio?listo=publicada");
  });

  it("al editar, borra los archivos que se quitaron", async () => {
    vi.mocked(obtenerPublicacionPropia).mockResolvedValue(pub({ imagenes: [ruta("viejo.webp")] }));
    const f = supabaseFalso();
    const { ruta: destino } = await rutaDe(guardarPublicacion({}, formulario({ modo: "editar", imagenes: [ruta("nuevo.webp")] })));
    expect(f.cadena.update).toHaveBeenCalled();
    expect(f.remove).toHaveBeenCalledWith([ruta("viejo.webp")]);
    expect(destino).toBe("/convenio?listo=editada");
  });

  it("no edita una oculta por Green Alliance", async () => {
    vi.mocked(obtenerPublicacionPropia).mockResolvedValue(pub({ ocultaEn: "2026-11-20T00:00:00Z" }));
    const f = supabaseFalso();
    const r = await guardarPublicacion({}, formulario({ modo: "editar" }));
    expect(r.errorGeneral).toMatch(/ocultó/);
    expect(f.cadena.update).not.toHaveBeenCalled();
  });
});

describe("subirImagenPublicacion", () => {
  async function png() {
    const sharp = (await import("sharp")).default;
    const b = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#fff" } }).png().toBuffer();
    return new File([new Uint8Array(b)], "x.png", { type: "image/png" });
  }

  it("convierte a WebP y sube a la carpeta del convenio", async () => {
    const f = supabaseFalso();
    const fd = new FormData();
    fd.set("publicacionId", PUB);
    fd.set("archivo", await png());
    const r = await subirImagenPublicacion(fd);
    expect(r.ruta).toMatch(new RegExp(`^${CONVENIO}/${PUB}/[a-z0-9]+-[0-9a-f]{12}\\.webp$`));
    expect(f.upload).toHaveBeenCalledWith(r.ruta, expect.any(Buffer), { contentType: "image/webp", upsert: false });
  });

  it("rechaza un archivo que no es imagen aunque diga image/png", async () => {
    const f = supabaseFalso();
    const fd = new FormData();
    fd.set("publicacionId", PUB);
    fd.set("archivo", new File(["<svg/>"], "x.png", { type: "image/png" }));
    expect((await subirImagenPublicacion(fd)).error).toMatch(/no es una imagen/);
    expect(f.upload).not.toHaveBeenCalled();
  });

  it("no sube a una publicación oculta ni pasado el tope de subidas", async () => {
    const f = supabaseFalso();
    const fd = new FormData();
    fd.set("publicacionId", PUB);
    fd.set("archivo", await png());
    vi.mocked(obtenerPublicacionPropia).mockResolvedValue(pub({ ocultaEn: "x" }));
    expect((await subirImagenPublicacion(fd)).error).toMatch(/ocultó/);
    vi.mocked(obtenerPublicacionPropia).mockResolvedValue(null);
    vi.mocked(dentroDelLimite).mockResolvedValue(false);
    expect((await subirImagenPublicacion(fd)).error).toMatch(/muchos archivos/);
    expect(f.upload).not.toHaveBeenCalled();
  });
});

describe("retirarPublicacion", () => {
  it("borra la fila y sus archivos", async () => {
    vi.mocked(obtenerPublicacionPropia).mockResolvedValue(pub());
    const f = supabaseFalso({ escritura: { data: [{ id: PUB }] } });
    const fd = new FormData();
    fd.set("id", PUB);
    const { ruta: destino } = await rutaDe(retirarPublicacion({}, fd));
    expect(f.cadena.delete).toHaveBeenCalled();
    expect(f.remove).toHaveBeenCalledWith([ruta("a.webp")]);
    expect(destino).toBe("/convenio?listo=retirada");
  });

  it("no retira una oculta", async () => {
    vi.mocked(obtenerPublicacionPropia).mockResolvedValue(pub({ ocultaEn: "x" }));
    const f = supabaseFalso();
    const fd = new FormData();
    fd.set("id", PUB);
    expect((await retirarPublicacion({}, fd)).error).toMatch(/ocultó/);
    expect(f.cadena.delete).not.toHaveBeenCalled();
  });
});

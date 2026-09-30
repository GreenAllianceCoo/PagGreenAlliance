/**
 * lib/afiliacion/fotos.ts · subida con URLs firmadas (spec-requerimientos-
 * ricardo §2.10): ticket HMAC (prefijo + vencimiento), rutas del prefijo,
 * emisión de URLs y verificación de lo subido (existe, ≤ 5 MB, bytes reales
 * de imagen). Storage se simula.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/servidor/registro", () => ({ registrar: vi.fn() }));

import {
  borrarFotosSiHuerfanas,
  crearSubidasAfiliacion,
  crearTicketFotos,
  leerTicketFotos,
  rutaEsDelPrefijo,
  rutaFoto,
  VIDA_TICKET_SEGUNDOS,
  verificarFotosSubidas,
} from "@/lib/afiliacion/fotos";

const SECRETO = "s".repeat(40);
const ID = "11111111-2222-4333-8444-555555555555";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

beforeEach(() => {
  vi.stubEnv("LIMITE_HMAC_SECRET", SECRETO);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ticket de fotos", () => {
  it("un ticket recién creado devuelve su id", () => {
    expect(leerTicketFotos(crearTicketFotos(ID, SECRETO), SECRETO)).toBe(ID);
  });
  it("vence a las 2 horas", () => {
    const ahora = Date.now();
    const ticket = crearTicketFotos(ID, SECRETO, ahora);
    expect(leerTicketFotos(ticket, SECRETO, ahora + (VIDA_TICKET_SEGUNDOS - 5) * 1000)).toBe(ID);
    expect(leerTicketFotos(ticket, SECRETO, ahora + (VIDA_TICKET_SEGUNDOS + 5) * 1000)).toBeNull();
  });
  it("rechaza firma alterada, otro secreto, otro id o basura", () => {
    const ticket = crearTicketFotos(ID, SECRETO);
    const [id, vence, firma] = ticket.split(".");
    expect(leerTicketFotos(`${id}.${vence}.${firma.slice(0, -1)}x`, SECRETO)).toBeNull();
    expect(leerTicketFotos(ticket, "o".repeat(40))).toBeNull();
    expect(leerTicketFotos(`22222222-2222-4333-8444-555555555555.${vence}.${firma}`, SECRETO)).toBeNull();
    expect(leerTicketFotos(`${id}.${Number(vence) + 9999}.${firma}`, SECRETO)).toBeNull();
    expect(leerTicketFotos("", SECRETO)).toBeNull();
    expect(leerTicketFotos("a.b.c", SECRETO)).toBeNull();
  });
});

describe("rutas del prefijo", () => {
  it("arma solicitudes/<id>/<tipo>.<ext> según el tipo", () => {
    expect(rutaFoto(ID, "foto_cedula_frente", "image/jpeg")).toBe(`solicitudes/${ID}/frente.jpg`);
    expect(rutaFoto(ID, "foto_selfie", "image/webp")).toBe(`solicitudes/${ID}/selfie.webp`);
  });
  it("solo acepta la ruta de ESA foto en ESE prefijo", () => {
    expect(rutaEsDelPrefijo(`solicitudes/${ID}/frente.png`, ID, "foto_cedula_frente")).toBe(true);
    expect(rutaEsDelPrefijo(`solicitudes/${ID}/reverso.png`, ID, "foto_cedula_frente")).toBe(false);
    expect(rutaEsDelPrefijo(`solicitudes/otro/frente.png`, ID, "foto_cedula_frente")).toBe(false);
    expect(rutaEsDelPrefijo(`x/solicitudes/${ID}/frente.png`, ID, "foto_cedula_frente")).toBe(false);
    expect(rutaEsDelPrefijo(`solicitudes/${ID}/frente.png/../../x`, ID, "foto_cedula_frente")).toBe(false);
  });
});

/** Storage falso: guarda qué se firmó y devuelve los archivos que se le pasen. */
function storageFalso(archivos: Record<string, Uint8Array | null> = {}) {
  const firmadas: string[] = [];
  const borradas: string[][] = [];
  const bucket = {
    createSignedUploadUrl: vi.fn(async (ruta: string) => {
      firmadas.push(ruta);
      return { data: { signedUrl: `https://x/${ruta}`, token: `tok-${ruta}`, path: ruta }, error: null };
    }),
    download: vi.fn(async (ruta: string) => {
      const bytes = archivos[ruta];
      return bytes ? { data: new Blob([bytes as BlobPart]), error: null } : { data: null, error: { message: "not found" } };
    }),
    remove: vi.fn(async (rutas: string[]) => {
      borradas.push(rutas);
      return { data: [], error: null };
    }),
  };
  let existeSolicitud = false;
  const admin = {
    storage: { from: vi.fn(() => bucket) },
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: existeSolicitud ? { id: ID } : null, error: null }) }) }),
    })),
  };
  return {
    admin: admin as never,
    bucket,
    firmadas,
    borradas,
    conSolicitud: () => {
      existeSolicitud = true;
    },
  };
}

describe("crearSubidasAfiliacion", () => {
  it("firma una URL por foto bajo un prefijo nuevo y devuelve un ticket de ese prefijo", async () => {
    const s = storageFalso();
    const r = await crearSubidasAfiliacion(s.admin, {
      foto_cedula_frente: "image/jpeg",
      foto_cedula_reverso: "image/png",
      foto_selfie: "image/jpeg",
    });
    expect(s.firmadas).toHaveLength(3);
    const id = leerTicketFotos(r.ticket, SECRETO);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.fotos.foto_cedula_reverso.ruta).toBe(`solicitudes/${id}/reverso.png`);
    expect(r.fotos.foto_selfie.token).toBe(`tok-solicitudes/${id}/selfie.jpg`);
    expect(r.bucket).toBe("afiliacion-documentos");
  });

  it("sin LIMITE_HMAC_SECRET no emite nada", async () => {
    vi.stubEnv("LIMITE_HMAC_SECRET", "");
    const s = storageFalso();
    await expect(
      crearSubidasAfiliacion(s.admin, { foto_cedula_frente: "image/jpeg", foto_cedula_reverso: "image/jpeg", foto_selfie: "image/jpeg" }),
    ).rejects.toThrow();
    expect(s.firmadas).toHaveLength(0);
  });
});

describe("verificarFotosSubidas", () => {
  const rutas = {
    foto_cedula_frente: `solicitudes/${ID}/frente.jpg`,
    foto_cedula_reverso: `solicitudes/${ID}/reverso.png`,
    foto_selfie: `solicitudes/${ID}/selfie.jpg`,
  };
  const subidas = { [rutas.foto_cedula_frente]: JPEG, [rutas.foto_cedula_reverso]: PNG, [rutas.foto_selfie]: JPEG };

  it("acepta las 3 fotos del prefijo y devuelve las columnas con el bucket", async () => {
    const s = storageFalso(subidas);
    const r = await verificarFotosSubidas(s.admin, crearTicketFotos(ID, SECRETO), rutas);
    expect(r).toMatchObject({
      ok: true,
      solicitudId: ID,
      columnas: { foto_cedula_frente: `afiliacion-documentos/${rutas.foto_cedula_frente}` },
    });
  });

  it("ticket inválido: no mira Storage", async () => {
    const s = storageFalso(subidas);
    const r = await verificarFotosSubidas(s.admin, "falso", rutas);
    expect(r).toMatchObject({ ok: false, motivo: "ticket", solicitudId: null });
    expect(s.bucket.download).not.toHaveBeenCalled();
  });

  it("ruta de otro prefijo", async () => {
    const s = storageFalso(subidas);
    const r = await verificarFotosSubidas(s.admin, crearTicketFotos(ID, SECRETO), {
      ...rutas,
      foto_selfie: "solicitudes/22222222-2222-4333-8444-555555555555/selfie.jpg",
    });
    expect(r).toMatchObject({ ok: false, motivo: "ruta", campo: "foto_selfie" });
  });

  it("foto que no se subió", async () => {
    const s = storageFalso({ ...subidas, [rutas.foto_selfie]: null });
    const r = await verificarFotosSubidas(s.admin, crearTicketFotos(ID, SECRETO), rutas);
    expect(r).toMatchObject({ ok: false, motivo: "falta", campo: "foto_selfie" });
  });

  it("bytes que no son de imagen o que no coinciden con la extensión (S-04)", async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0, 0, 0, 0, 0]);
    const s1 = storageFalso({ ...subidas, [rutas.foto_cedula_frente]: pdf });
    expect(await verificarFotosSubidas(s1.admin, crearTicketFotos(ID, SECRETO), rutas)).toMatchObject({
      ok: false,
      motivo: "tipo",
      campo: "foto_cedula_frente",
    });
    const s2 = storageFalso({ ...subidas, [rutas.foto_cedula_frente]: PNG }); // .jpg con bytes PNG
    expect(await verificarFotosSubidas(s2.admin, crearTicketFotos(ID, SECRETO), rutas)).toMatchObject({
      ok: false,
      motivo: "tipo",
    });
  });

  it("más de 5 MB", async () => {
    const grande = new Uint8Array(5 * 1024 * 1024 + 1);
    grande.set(JPEG);
    const s = storageFalso({ ...subidas, [rutas.foto_selfie]: grande });
    expect(await verificarFotosSubidas(s.admin, crearTicketFotos(ID, SECRETO), rutas)).toMatchObject({
      ok: false,
      motivo: "peso",
    });
  });
});

describe("borrarFotosSiHuerfanas", () => {
  it("borra si no existe una solicitud con ese id", async () => {
    const s = storageFalso();
    await borrarFotosSiHuerfanas(s.admin, ID, ["a", "b"]);
    expect(s.borradas).toEqual([["a", "b"]]);
  });
  it("NO borra si ya existe la solicitud (reenvío del mismo ticket)", async () => {
    const s = storageFalso();
    s.conSolicitud();
    await borrarFotosSiHuerfanas(s.admin, ID, ["a", "b"]);
    expect(s.borradas).toEqual([]);
  });
});

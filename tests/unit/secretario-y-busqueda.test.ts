import { describe, expect, it } from "vitest";
import { SECCIONES_SECRETARIO, seccionesDelRol } from "@/components/admin/secciones";
import { vistaBusquedaGeneral } from "@/lib/asesor/busqueda";
import {
  esquemaBuscarGeneral,
  MENSAJE_BUSQUEDA_CORTA,
  normalizarTextoBusqueda,
} from "@/lib/validaciones/asesor";
import { esquemaCrearAsesor, leerFormularioAsesor } from "@/lib/validaciones/admin";

describe("normalizarTextoBusqueda", () => {
  it("quita espacios sobrantes en los nombres", () => {
    expect(normalizarTextoBusqueda("  Juan   Pérez ")).toBe("Juan Pérez");
  });
  it("deja solo dígitos si es una cédula con puntos o espacios", () => {
    expect(normalizarTextoBusqueda("1.234.567")).toBe("1234567");
    expect(normalizarTextoBusqueda(" 1234 567 ")).toBe("1234567");
  });
});

describe("esquemaBuscarGeneral", () => {
  it("acepta un nombre de 4 o más letras", () => {
    expect(esquemaBuscarGeneral.safeParse({ texto: "Pere" }).success).toBe(true);
    expect(esquemaBuscarGeneral.safeParse({ texto: "María José" }).success).toBe(true);
  });
  it("acepta 4 a 10 dígitos de cédula (con puntos)", () => {
    const r = esquemaBuscarGeneral.safeParse({ texto: "1.234" });
    expect(r.success && r.data.texto).toBe("1234");
    expect(esquemaBuscarGeneral.safeParse({ texto: "1234567890" }).success).toBe(true);
  });
  it("rechaza menos de 4 caracteres, con el mensaje en español", () => {
    for (const texto of ["", "   ", "Pe", "123", "1.2.3"]) {
      const r = esquemaBuscarGeneral.safeParse({ texto });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe(MENSAJE_BUSQUEDA_CORTA);
    }
  });
  it("rechaza más de 10 números y más de 60 caracteres", () => {
    expect(esquemaBuscarGeneral.safeParse({ texto: "12345678901" }).success).toBe(false);
    expect(esquemaBuscarGeneral.safeParse({ texto: "a".repeat(61) }).success).toBe(false);
  });
  it("rechaza si no viene el campo", () => {
    expect(esquemaBuscarGeneral.safeParse({}).success).toBe(false);
  });
});

describe("vistaBusquedaGeneral", () => {
  it("deja solo nombre, cédula enmascarada y asesor (ignora cualquier otro dato)", () => {
    const filas = [
      { nombre: "Pedro Buscable", cedula_enmascarada: "2.9••.•••.002", asesor_texto: "Asesor Uno", celular: "3001112233", estado: "operando" },
    ];
    expect(vistaBusquedaGeneral(filas)).toEqual([
      { nombre: "Pedro Buscable", cedulaEnmascarada: "2.9••.•••.002", asesor: "Asesor Uno" },
    ]);
  });
  it("tolera datos vacíos o inválidos", () => {
    expect(vistaBusquedaGeneral(null)).toEqual([]);
    expect(vistaBusquedaGeneral([null, 3, {}])).toEqual([]);
  });
});

describe("rol al crear equipo (esquemaCrearAsesor)", () => {
  const base = { cedula: "1.234.567.890", nombres: "Ana", apellidos: "Gómez", correo: " ANA@Correo.com " };
  it("por defecto es asesor", () => {
    const r = esquemaCrearAsesor.safeParse(base);
    expect(r.success && r.data.rol).toBe("asesor");
  });
  it("acepta secretario y normaliza cédula y correo", () => {
    const r = esquemaCrearAsesor.safeParse({ ...base, rol: "secretario" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.rol).toBe("secretario");
      expect(r.data.cedula).toBe("1234567890");
      expect(r.data.correo).toBe("ana@correo.com");
    }
  });
  it("no deja crear un admin desde este formulario", () => {
    expect(esquemaCrearAsesor.safeParse({ ...base, rol: "admin" }).success).toBe(false);
    expect(esquemaCrearAsesor.safeParse({ ...base, rol: "asociado" }).success).toBe(false);
  });
  it("leerFormularioAsesor toma el rol del formulario y usa asesor si falta", () => {
    const f = new FormData();
    expect(leerFormularioAsesor(f).rol).toBe("asesor");
    f.set("rol", "secretario");
    expect(leerFormularioAsesor(f).rol).toBe("secretario");
  });
});

describe("menú por rol", () => {
  it("el secretario solo ve Resumen y Afiliaciones", () => {
    expect(seccionesDelRol("secretario").map((s) => s.clave)).toEqual(["resumen", "afiliaciones"]);
    expect([...SECCIONES_SECRETARIO]).toEqual(["resumen", "afiliaciones"]);
  });
  it("el admin ve todas", () => {
    const claves = seccionesDelRol("admin").map((s) => s.clave);
    for (const c of ["resumen", "afiliaciones", "creditos", "asociados", "asesores", "alertas", "convenios", "sorteo"]) {
      expect(claves).toContain(c);
    }
  });
});

/**
 * Funciones puras de los requerimientos de Ricardo (spec 2026-09-29):
 * fechas con la regla de Postgres, proceso ejecutivo (conteo de 36 meses,
 * retiro/renovación), conteo del crédito, regla «solo operando», periodo de
 * comisiones (16 → 15), vista de comisiones y de búsqueda del asesor,
 * verificador de foto, convenios y destinatarios de correo.
 */
import { describe, expect, it } from "vitest";
import { datosPerfilDeAfiliacion, nombreGradoEmbebido, textoCuentaNomina } from "@/lib/admin/afiliacion";
import { dimensionesObjetivo } from "@/lib/afiliacion/comprimirFoto";
import {
  brilloMedio,
  dimensionesAnalisis,
  evaluarCalidadFoto,
  LADO_MENOR_MINIMO_PX,
  UMBRAL_BRILLO_MINIMO,
  UMBRAL_NITIDEZ,
  varianzaLaplaciano,
  type ImagenRGBA,
} from "@/lib/afiliacion/calidadFoto";
import { vistaClienteBuscado } from "@/lib/asesor/busqueda";
import {
  esDiaDeCorte,
  leerMontoPesos,
  opcionesPeriodoCorte,
  periodoComision,
  vistaComisiones,
} from "@/lib/asesor/comisiones";
import { puedeAtender } from "@/lib/asesor/puedeAtender";
import { CONVENIOS, enlaceWhatsappConvenio, formatearCelular, mensajeWhatsappConvenio } from "@/lib/convenios";
import { destinatarioAvisoInstitucional, destinatariosAviso } from "@/lib/correo/destinatarios";
import { MENSAJE_CREDITO_SOLO_OPERANDO, reglaSolicitarCredito } from "@/lib/credito";
import { conteoCredito, textoTope, vistaSolicitud, type FilaSolicitud } from "@/lib/cuenta";
import {
  diasEntre,
  esFechaISO,
  formatearMesAnio,
  hoyBogota,
  mesesYDiasEntre,
  sumarMeses,
  textoMesesYDias,
} from "@/lib/fechas";
import { MENSAJE_SIN_CUPO } from "@/lib/gradosCatalogo";
import {
  caminoEstabilidad,
  TEXTO_ANTES_DE_OPERANDO,
  vistaProcesoEjecutivo,
  type FilaMiProceso,
} from "@/lib/procesoEjecutivo";

// ---------------------------------------------------------------------------
describe("fechas (regla de Postgres, hora de Colombia)", () => {
  it("sumarMeses ajusta al último día del mes como `date + interval`", () => {
    expect(sumarMeses("2026-01-31", 1)).toBe("2026-02-28");
    expect(sumarMeses("2024-01-31", 1)).toBe("2024-02-29");
    expect(sumarMeses("2026-06-15", 36)).toBe("2029-06-15");
    expect(sumarMeses("2026-03-31", -1)).toBe("2026-02-28");
    expect(sumarMeses("2026-01-16", -1)).toBe("2025-12-16");
  });
  it("mesesYDiasEntre y su texto", () => {
    expect(mesesYDiasEntre("2026-09-30", "2029-06-15")).toEqual({ meses: 32, dias: 16 });
    expect(mesesYDiasEntre("2026-09-30", "2026-09-30")).toEqual({ meses: 0, dias: 0 });
    expect(mesesYDiasEntre("2026-10-01", "2026-09-30")).toEqual({ meses: 0, dias: 0 });
    expect(textoMesesYDias({ meses: 1, dias: 1 })).toBe("1 mes y 1 día");
    expect(textoMesesYDias({ meses: 3, dias: 0 })).toBe("3 meses");
    expect(textoMesesYDias({ meses: 0, dias: 0 })).toBe("0 días");
  });
  it("hoyBogota usa la zona de Colombia (UTC−5)", () => {
    expect(hoyBogota(new Date("2026-10-01T03:00:00Z"))).toBe("2026-09-30");
    expect(hoyBogota(new Date("2026-10-01T06:00:00Z"))).toBe("2026-10-01");
  });
  it("esFechaISO, diasEntre y formatearMesAnio", () => {
    expect(esFechaISO("2026-02-29")).toBe(false);
    expect(esFechaISO("2028-02-29")).toBe(true);
    expect(esFechaISO("2026-9-1")).toBe(false);
    expect(diasEntre("2026-09-30", "2026-10-31")).toBe(31);
    expect(formatearMesAnio("2026-06-15")).toMatch(/^jun\.? 2026$/);
  });
});

// ---------------------------------------------------------------------------
function fila(cambios: Partial<FilaMiProceso>): FilaMiProceso {
  return {
    estado: "operando",
    fecha_inicio_embargo: "2026-06-15",
    fecha_fin_embargo: "2029-06-15",
    fecha_habilita_renovacion: "2028-06-15",
    conteo_activo: true,
    puede_pedir_retiro: true,
    puede_pedir_renovacion: false,
    retiro_pendiente: false,
    renovacion_pendiente: false,
    ...cambios,
  };
}

describe("proceso ejecutivo · vista de /cuenta", () => {
  it("sin proceso: 8 pasos pendientes y el texto de «antes de Operando»", () => {
    const v = vistaProcesoEjecutivo(null, "2026-09-30");
    expect(v.tieneProceso).toBe(false);
    expect(v.pasos).toHaveLength(8);
    expect(v.pasos.every((p) => p.estado === "pendiente")).toBe(true);
    expect(v.textoConteo).toBe(TEXTO_ANTES_DE_OPERANDO);
    expect(v.retiro.visible).toBe(false);
  });

  it("antes de Operando: pasos hechos/actual, sin conteo ni botones", () => {
    const v = vistaProcesoEjecutivo(
      fila({ estado: "sentencia", fecha_inicio_embargo: null, fecha_fin_embargo: null, fecha_habilita_renovacion: null, conteo_activo: false, puede_pedir_retiro: false }),
      "2026-09-30",
    );
    expect(v.pasos.map((p) => p.estado)).toEqual(["hecho", "hecho", "hecho", "actual", "pendiente", "pendiente", "pendiente", "pendiente"]);
    expect(v.estadoTexto).toBe("Sentencia");
    expect(v.conteo).toBeNull();
    expect(v.textoConteo).toBe(TEXTO_ANTES_DE_OPERANDO);
    expect(v.retiro.visible).toBe(false);
    expect(v.renovacion.visible).toBe(false);
  });

  it("Operando: conteo con meses y días; retiro visible; renovación visible pero desactivada con cuánto falta", () => {
    const v = vistaProcesoEjecutivo(fila({}), "2026-09-30");
    expect(v.conteo).toMatchObject({ mesesRestantes: 32, diasRestantes: 16, activo: true });
    expect(v.textoConteo).toBe("Faltan 32 meses y 16 días");
    expect(v.retiro).toEqual({ visible: true, habilitado: true, pendiente: false });
    expect(v.renovacion).toMatchObject({ visible: true, habilitado: false, faltaTexto: "Se activa en 20 meses y 16 días" });
  });

  it("retiro con alerta pendiente: visible, no habilitado", () => {
    const v = vistaProcesoEjecutivo(fila({ retiro_pendiente: true, puede_pedir_retiro: false }), "2026-09-30");
    expect(v.retiro).toEqual({ visible: true, habilitado: false, pendiente: true });
  });

  it("a los 24 meses la renovación se habilita (lo decide la base)", () => {
    const v = vistaProcesoEjecutivo(fila({ puede_pedir_renovacion: true }), "2028-06-15");
    expect(v.renovacion).toMatchObject({ visible: true, habilitado: true, faltaTexto: null });
  });

  it("Terminado: todos los pasos hechos, conteo terminado, sin botones", () => {
    const v = vistaProcesoEjecutivo(fila({ estado: "terminado", conteo_activo: false, puede_pedir_retiro: false }), "2029-07-01");
    expect(v.pasos.every((p) => p.estado === "hecho")).toBe(true);
    expect(v.textoConteo).toBe("Tu conteo de 36 meses terminó");
    expect(v.retiro.visible).toBe(false);
    expect(v.renovacion.visible).toBe(false);
  });

  it("caminoEstabilidad (carné): mes en curso 1-based, total 36", () => {
    const v = vistaProcesoEjecutivo(fila({}), "2026-09-30");
    expect(caminoEstabilidad(v, "2026-09-30")).toMatchObject({ mesActual: 4, totalMeses: 36 });
    expect(caminoEstabilidad(vistaProcesoEjecutivo(null, "2026-09-30"), "2026-09-30")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe("crédito · conteo de 3 meses (R-07) y regla «solo operando» (§8)", () => {
  const aprobada: FilaSolicitud = {
    estado: "aprobado",
    monto_solicitado: 500000,
    porcentaje_devolucion: "50",
    plazo_meses: 3,
    fecha_solicitud: "2026-09-01T15:00:00Z",
    // 23:30 del 10-sep en Colombia = 04:30Z del 11-sep.
    fecha_respuesta: "2026-09-11T04:30:00Z",
    // §12.2: el conteo arranca con el desembolso, no con la aprobación.
    fecha_desembolso: "2026-09-10",
  };

  it("cuenta desde el desembolso (§12.2) y no antes", () => {
    expect(conteoCredito(aprobada, "2026-09-30")).toMatchObject({
      desde: "2026-09-10",
      hasta: "2026-12-10",
      mesesRestantes: 2,
      diasRestantes: 10,
      vencido: false,
    });
    expect(conteoCredito(aprobada, "2026-12-11")?.vencido).toBe(true);
    expect(conteoCredito({ ...aprobada, fecha_desembolso: null }, "2026-09-30")).toBeNull();
    expect(conteoCredito({ ...aprobada, fecha_desembolso: null }, "2026-09-30")).toBeNull();
  });
  it("solo para aprobadas; vistaSolicitud lo incluye", () => {
    expect(conteoCredito({ ...aprobada, estado: "pendiente" }, "2026-09-30")).toBeNull();
    expect(vistaSolicitud(aprobada, "2026-09-30").conteo?.faltaTexto).toBe("2 meses y 10 días");
    expect(JSON.stringify(vistaSolicitud(aprobada, "2026-09-30"))).not.toMatch(/tasa/i);
  });
  it("textoTope con grado sin cupo", () => {
    expect(textoTope(null, { sinCupo: true })).toBe("Sin cupo configurado");
    expect(textoTope([{ capacidad_maxima: 1000000 }, { capacidad_maxima: 2100000 }])).toBe("$ 2.100.000");
  });

  const base = {
    activo: true,
    tieneGrado: true,
    tieneCupo: true,
    mensajeSinCupo: MENSAJE_SIN_CUPO,
    estadoProceso: "operando",
    tienePendiente: false,
    cantidadTopes: 2,
  };
  it("puede solicitar con todo en regla", () => {
    expect(reglaSolicitarCredito(base)).toEqual({ puedeSolicitar: true, motivo: null, mensaje: null });
  });
  it.each([
    [{ estadoProceso: "sentencia" }, "no_operando", MENSAJE_CREDITO_SOLO_OPERANDO],
    [{ estadoProceso: null }, "no_operando", MENSAJE_CREDITO_SOLO_OPERANDO],
    [{ activo: false }, "inactivo", "Tu cuenta está inactiva. Comunícate con la cooperativa."],
    [{ tieneCupo: false }, "sin_cupo", MENSAJE_SIN_CUPO],
    [{ tienePendiente: true }, "pendiente", expect.stringMatching(/pendiente/)],
    [{ cantidadTopes: 0 }, "sin_topes", expect.stringMatching(/topes/)],
  ])("no puede: %j", (cambio, motivo, mensaje) => {
    expect(reglaSolicitarCredito({ ...base, ...cambio })).toEqual({ puedeSolicitar: false, motivo, mensaje });
  });
  it("activo null (columna sin aplicar) se trata como activo", () => {
    expect(reglaSolicitarCredito({ ...base, activo: null }).puedeSolicitar).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("comisiones del asesor · periodo 16 → 15 (igual que periodo_comision())", () => {
  it.each([
    ["2026-09-15", "2026-08-16", "2026-09-15"],
    ["2026-09-16", "2026-09-16", "2026-10-15"],
    ["2026-01-10", "2025-12-16", "2026-01-15"],
    ["2026-12-31", "2026-12-16", "2027-01-15"],
    ["2026-03-01", "2026-02-16", "2026-03-15"],
  ])("%s → %s a %s", (fecha, inicio, fin) => {
    expect(periodoComision(fecha)).toEqual({ inicio, fin });
  });
  it("opciones del selector: cortes del día 15, del actual hacia atrás", () => {
    const opciones = opcionesPeriodoCorte("2026-09-30", 3);
    expect(opciones.map((o) => o.valor)).toEqual(["2026-10-15", "2026-09-15", "2026-08-15"]);
    expect(opciones.every((o) => esDiaDeCorte(o.valor))).toBe(true);
    expect(esDiaDeCorte("2026-10-16")).toBe(false);
  });
  it("vistaComisiones: valores de la presentación y avance a bonos", () => {
    const v = vistaComisiones({
      periodo_inicio: "2026-09-16",
      periodo_fin: "2026-10-15",
      ingresos_nuevos: 2,
      valor_ingresos_nuevos: "1000000",
      clientes_operativos: 3,
      valor_clientes_operativos: 300000,
      total_operando_hoy: 55,
    });
    expect(v).toMatchObject({
      ingresosNuevos: { cantidad: 2, valor: "$ 1.000.000", valorUnitario: "$ 500.000" },
      clientesOperativos: { cantidad: 3, valor: "$ 300.000", valorUnitario: "$ 100.000" },
      totalPeriodo: "$ 1.300.000",
      bono50: { alcanzado: true, porcentaje: 100, faltan: 0 },
      viaje100: { alcanzado: false, porcentaje: 55, faltan: 45 },
    });
    expect(vistaComisiones(null)).toBeNull();
  });
  it("leerMontoPesos", () => {
    expect(leerMontoPesos("$ 1.000.000")).toBe(1000000);
    expect(leerMontoPesos("-50000")).toBe(-50000);
    expect(leerMontoPesos("12,5")).toBeNull();
    expect(leerMontoPesos("")).toBeNull();
  });
  it("puedeAtender: asesor, o admin con atiende_asociados; activo", () => {
    expect(puedeAtender({ rol: "asesor" })).toBe(true);
    expect(puedeAtender({ rol: "asesor", activo: false })).toBe(false);
    expect(puedeAtender({ rol: "admin", atiende_asociados: true })).toBe(true);
    expect(puedeAtender({ rol: "admin", atiende_asociados: false })).toBe(false);
    expect(puedeAtender({ rol: "asociado", atiende_asociados: true })).toBe(false);
    expect(puedeAtender(null)).toBe(false);
  });
});

describe("búsqueda del asesor · vista del cliente", () => {
  const filaCliente = {
    perfil_id: "p1",
    nombre: "Laura Gómez",
    cedula: "1012345321",
    grado: "TE",
    grado_nombre: "Teniente",
    institucion: "policia",
    estado_proceso: "operando",
    fecha_inicio_embargo: "2026-06-15",
    grupo_credito: "OF",
    cupo_50: "2150000",
    cupo_100: 4200000,
  };
  it("cédula enmascarada, estado y capacidad 50/100", () => {
    const v = vistaClienteBuscado(filaCliente);
    expect(v.cedulaEnmascarada).toBe("1.0••.•••.321");
    expect(JSON.stringify(v)).not.toContain("1012345321");
    expect(v).toMatchObject({
      grado: "Teniente",
      institucion: "Policía Nacional",
      estadoProcesoTexto: "Operando",
      capacidad: { configurada: true, cupo50: "$ 2.150.000", cupo100: "$ 4.200.000" },
    });
  });
  it("sin grupo de crédito: «sin cupo configurado»; sin proceso: «Sin iniciar»", () => {
    const v = vistaClienteBuscado({ ...filaCliente, grupo_credito: null, cupo_50: null, cupo_100: null, estado_proceso: null });
    expect(v.capacidad).toEqual({ configurada: false, texto: "Sin cupo configurado", mensaje: MENSAJE_SIN_CUPO });
    expect(v.estadoProcesoTexto).toBe("Sin iniciar");
  });
});

// ---------------------------------------------------------------------------
/** Imagen RGBA de prueba a partir de una función de gris por píxel. */
function imagen(ancho: number, alto: number, gris: (x: number, y: number) => number): ImagenRGBA {
  const data = new Uint8ClampedArray(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      const v = gris(x, y);
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: ancho, height: alto };
}
const ORIGINAL_OK = { anchoOriginal: 3000, altoOriginal: 2000 };

describe("verificador de foto (calidadFoto)", () => {
  it("una imagen plana (sin bordes) es borrosa; un tablero es nítido", () => {
    expect(varianzaLaplaciano(imagen(64, 64, () => 128))).toBe(0);
    const tablero = imagen(64, 64, (x, y) => ((x + y) % 2 === 0 ? 30 : 220));
    expect(varianzaLaplaciano(tablero)).toBeGreaterThan(UMBRAL_NITIDEZ);
    expect(evaluarCalidadFoto(imagen(64, 64, () => 128), ORIGINAL_OK)).toMatchObject({ borrosa: true, aceptable: false });
    expect(evaluarCalidadFoto(tablero, ORIGINAL_OK)).toMatchObject({ borrosa: false, oscura: false, aceptable: true });
  });
  it("brillo medio y foto oscura", () => {
    expect(brilloMedio(imagen(10, 10, () => 100))).toBeCloseTo(100, 5);
    const oscura = imagen(64, 64, (x, y) => ((x + y) % 2 === 0 ? 0 : UMBRAL_BRILLO_MINIMO));
    expect(evaluarCalidadFoto(oscura, ORIGINAL_OK)).toMatchObject({ oscura: true, aceptable: false });
  });
  it("foto quemada (casi blanca)", () => {
    const quemada = imagen(64, 64, (x, y) => ((x + y) % 2 === 0 ? 240 : 255));
    expect(evaluarCalidadFoto(quemada, ORIGINAL_OK).quemada).toBe(true);
  });
  it("foto original demasiado pequeña", () => {
    const tablero = imagen(64, 64, (x, y) => ((x + y) % 2 === 0 ? 30 : 220));
    expect(evaluarCalidadFoto(tablero, { anchoOriginal: 800, altoOriginal: LADO_MENOR_MINIMO_PX - 1 }).pequena).toBe(true);
  });
  it("una imagen de menos de 3×3 no revienta", () => {
    expect(varianzaLaplaciano(imagen(2, 2, () => 10))).toBe(0);
  });
  it("dimensiones de análisis y de compresión conservan la proporción y nunca agrandan", () => {
    expect(dimensionesAnalisis(4000, 3000)).toEqual({ ancho: 512, alto: 384 });
    expect(dimensionesAnalisis(300, 200)).toEqual({ ancho: 300, alto: 200 });
    expect(dimensionesObjetivo(4000, 3000)).toEqual({ ancho: 2400, alto: 1800 });
    expect(dimensionesObjetivo(1200, 1600)).toEqual({ ancho: 1200, alto: 1600 });
  });
});

// ---------------------------------------------------------------------------
describe("convenios (§4)", () => {
  it("los 5 del respaldo tienen NIT, servicios y enlace wa.me con mensaje", () => {
    expect(CONVENIOS).toHaveLength(5);
    for (const c of CONVENIOS) {
      expect(c.nit).toBeTruthy();
      expect(c.servicios.length).toBeGreaterThan(0);
      expect(c.whatsappUrl).toMatch(/^https:\/\/wa\.me\/573\d{9}\?text=/);
    }
    const racing = CONVENIOS.find((c) => c.nombreCorto === "Racing Tours")!;
    expect(racing.servicios[0]).toBe("Tour en cuatrimoto");
    expect(racing.sedes).toEqual(["Villa de Leyva, Boyacá"]);
  });
  it("mensaje prellenado con la marca; sin número válido no hay enlace", () => {
    expect(mensajeWhatsappConvenio("Racing Tours")).toBe(
      "Hola, soy asociado de Green Alliance y quiero conocer el beneficio con Racing Tours.",
    );
    expect(decodeURIComponent(enlaceWhatsappConvenio("313 800 8830", "X")!)).toContain("wa.me/573138008830?text=Hola");
    expect(enlaceWhatsappConvenio("12345", "X")).toBeNull();
    expect(formatearCelular("3214612714")).toBe("321 461 2714");
    expect(formatearCelular(null)).toBeNull();
  });
});

describe("correos del asociado (§2.8 y RS-02)", () => {
  it("los avisos con datos van SOLO al correo personal, normalizado", () => {
    expect(destinatariosAviso("A@x.co")).toEqual(["a@x.co"]);
    expect(destinatariosAviso(" a@x.co ")).toEqual(["a@x.co"]);
    expect(destinatariosAviso(null)).toEqual([]);
    expect(destinatariosAviso("")).toEqual([]);
    expect(destinatariosAviso("sin-arroba")).toEqual([]);
  });

  it("el aviso sin datos va al institucional si existe y es distinto del personal", () => {
    expect(destinatarioAvisoInstitucional("a@x.co", " B@Y.CO ")).toBe("b@y.co");
    expect(destinatarioAvisoInstitucional("a@x.co", "A@X.CO")).toBeNull();
    expect(destinatarioAvisoInstitucional("a@x.co", null)).toBeNull();
    expect(destinatarioAvisoInstitucional("a@x.co", "")).toBeNull();
    expect(destinatarioAvisoInstitucional(null, "b@y.co")).toBe("b@y.co");
  });
});

describe("afiliación aprobada → perfil (§2.12)", () => {
  it("copia institución, correo institucional, nómina y asesor; nunca el correo personal", () => {
    const datos = datosPerfilDeAfiliacion({
      cedula: "123456",
      grado: "TE",
      institucion: "ejercito",
      correo_institucional: "x@mil.co",
      nomina_entidad: "Nequi",
      nomina_tipo: "deposito_electronico",
      nomina_numero: "3001234567",
      asesor_id: "a1",
    });
    expect(datos).toEqual({
      cedula: "123456",
      grado: "TE",
      institucion: "ejercito",
      correo_institucional: "x@mil.co",
      nomina_entidad: "Nequi",
      nomina_tipo: "deposito_electronico",
      nomina_numero: "3001234567",
      asesor_id: "a1",
    });
  });
  it("una afiliación antigua (sin nómina completa) no manda nómina a medias", () => {
    const datos = datosPerfilDeAfiliacion({ cedula: "1", grado: "PP", nomina_entidad: "Nequi", nomina_tipo: null, nomina_numero: null });
    expect(datos).toEqual({ cedula: "1", grado: "PP" });
  });
  it("textoCuentaNomina y nombreGradoEmbebido", () => {
    expect(textoCuentaNomina("Bancolombia", "ahorros", "123")).toBe("Bancolombia · Ahorros · 123");
    expect(textoCuentaNomina(null, "ahorros", "123")).toBeNull();
    expect(nombreGradoEmbebido({ nombre: "Teniente" })).toBe("Teniente");
    expect(nombreGradoEmbebido([{ nombre: "Mayor" }])).toBe("Mayor");
    expect(nombreGradoEmbebido(null)).toBeNull();
  });
});

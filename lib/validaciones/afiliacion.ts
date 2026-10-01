import { z } from "zod";
import {
  correoInstitucionalValido,
  MENSAJE_DOMINIO_INSTITUCIONAL,
} from "@/lib/validaciones/dominiosInstitucionales";
import {
  esBilletera,
  esEntidadDeLista,
  OPCION_OTRA_ENTIDAD,
  TIPOS_CUENTA_BANCO,
  type TipoCuentaNomina,
} from "@/lib/afiliacion/entidades";
import { gradoAplicaA, type GradoCatalogo } from "@/lib/gradosCatalogo";
import { esquemaCedula, normalizarCelular, normalizarCorreo, textoDe } from "./comunes";
import { esInstitucion, INSTITUCIONES } from "./instituciones";

// Se reexportan para quien ya los importaba desde aquí.
export { INSTITUCIONES, NOMBRE_INSTITUCION, type CodigoInstitucion } from "./instituciones";

/**
 * Formulario «Quiero afiliarme» v3 (spec-requerimientos-ricardo §1–§2;
 * migraciones 20260929100100 y 20260929100200). Un solo esquema para el
 * navegador (antes de subir las fotos) y la Server Action.
 *
 * Como el grado debe existir y corresponder a la institución, y el asesor
 * debe estar en la lista de `obtener_asesores_publico()`, el esquema se
 * arma con ese contexto: `crearEsquemaAfiliacion({ grados, asesores })`.
 * El servidor lo arma con los datos que él mismo lee (nunca con lo que
 * mande el navegador).
 *
 * Fotos: ya no viajan en el envío. El navegador las sube directo al bucket
 * con URLs firmadas (acción `prepararSubidaFotos`) y aquí solo llegan las
 * RUTAS + el `fotos_ticket` firmado; la acción verifica que existan y que
 * sean del prefijo de esa solicitud (lib/afiliacion/fotos.ts).
 */

export type ContextoAfiliacion = {
  /** Catálogo de grados (lib/grados.ts). */
  grados: GradoCatalogo[];
  /** Quienes atienden asociados (obtener_asesores_publico()). */
  asesores: { id: string }[];
};

export const MENSAJES_AFILIACION = {
  grado: "Selecciona tu grado.",
  gradoInstitucion: "Ese grado no corresponde a la institución que elegiste.",
  asesorLista: "Selecciona un asesor de la lista.",
  entidad: "Elige la entidad de tu cuenta de nómina.",
  entidadOtra: "Escribe el nombre de tu banco o entidad.",
  entidadOtraFormato: "El nombre de la entidad debe tener entre 2 y 60 caracteres.",
  tipoCuenta: "Elige el tipo de cuenta.",
  numeroCuenta: "Escribe el número de tu cuenta de nómina.",
  numeroCuentaFormato: "El número de cuenta debe tener solo números, entre 6 y 20 dígitos.",
  numeroBilletera: "El número de tu billetera es tu celular: 10 dígitos que empiezan por 3.",
  correoInstitucional: "Escribe tu correo institucional.",
  correoPersonal: "Escribe tu correo personal.",
  correoFormato: "Revisa el correo: no es válido.",
  correosIguales: "Tu correo personal debe ser distinto del institucional.",
} as const;

/** Texto opcional: sin espacios sobrantes; vacío → null. */
function textoOpcional(maximo: number, mensaje: string) {
  return z
    .string()
    .transform((v) => v.trim())
    .pipe(z.string().max(maximo, { error: mensaje }))
    .transform((v) => (v === "" ? null : v));
}

/** Nombres o apellidos: solo letras (con tildes y ñ) y espacios, 2 a 60 caracteres. */
function esquemaNombrePropio(etiqueta: string, mensajeVacio: string) {
  return z
    .string({ error: mensajeVacio })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, { error: mensajeVacio })
        .min(2, { error: `${etiqueta} debe tener al menos 2 caracteres.` })
        .max(60, { error: `${etiqueta} puede tener máximo 60 caracteres.` })
        .regex(/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]+$/, {
          error: `${etiqueta} solo puede tener letras y espacios.`,
        }),
    );
}

/** Celular o Nequi: 10 dígitos que empiezan por 3 (mismo formato, mensajes propios). */
function esquemaNumeroMovil(mensajeVacio: string) {
  return z
    .string({ error: mensajeVacio })
    .transform(normalizarCelular)
    .pipe(
      z
        .string()
        .min(1, { error: mensajeVacio })
        .regex(/^3[0-9]{9}$/, { error: "Debe tener 10 dígitos y empezar por 3." }),
    );
}

/** Correo de cualquier dominio (R-04), en minúsculas. */
function esquemaCorreoCon(mensajeVacio: string) {
  return z
    .string({ error: mensajeVacio })
    .transform(normalizarCorreo)
    .pipe(
      z
        .string()
        .min(1, { error: mensajeVacio })
        .max(254, { error: MENSAJES_AFILIACION.correoFormato })
        .pipe(z.email({ error: MENSAJES_AFILIACION.correoFormato })),
    );
}

/** Asesor opcional: "" («No tengo asesor») → null; si viene algo, debe ser un uuid. */
const esquemaAsesorId = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v.trim()))
  .pipe(z.union([z.null(), z.uuid({ error: MENSAJES_AFILIACION.asesorLista })]));

/** Número de cuenta tal como lo escriben: se quitan espacios, puntos y guiones. */
function normalizarNumeroCuenta(valor: string) {
  return valor.replace(/[\s.\-]/g, "");
}

// ---------------------------------------------------------------------------
// Fotos (rutas en el bucket privado, no archivos)
// ---------------------------------------------------------------------------

/** Mismo límite del bucket privado `afiliacion-documentos` (migración 20260924000400). */
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;
/** Peso al que apunta la compresión del navegador (spec §2.10: ~1,5 MB, ~2400 px, calidad 0,85). */
export const PESO_OBJETIVO_FOTO = 1.5 * 1024 * 1024;
export const TIPOS_FOTO_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;
export type TipoFotoPermitido = (typeof TIPOS_FOTO_PERMITIDOS)[number];

/** Las 3 fotos: campo del formulario → nombre del archivo en el bucket. */
export const CAMPOS_FOTO = {
  foto_cedula_frente: "frente",
  foto_cedula_reverso: "reverso",
  foto_selfie: "selfie",
} as const;
export type CampoFoto = keyof typeof CAMPOS_FOTO;
export type TipoFoto = (typeof CAMPOS_FOTO)[CampoFoto];

const MENSAJE_FALTA_FOTO: Record<CampoFoto, string> = {
  foto_cedula_frente: "Sube la foto de tu cédula (frente).",
  foto_cedula_reverso: "Sube la foto de tu cédula (reverso).",
  foto_selfie: "Toma tu selfie.",
};

/** Ruta que devuelve `prepararSubidaFotos`: solicitudes/<uuid>/<tipo>.<ext>. */
function esquemaRutaFoto(campo: CampoFoto) {
  const tipo = CAMPOS_FOTO[campo];
  const patron = new RegExp(`^solicitudes/[0-9a-f-]{36}/${tipo}\\.(jpg|png|webp)$`);
  return z
    .string({ error: MENSAJE_FALTA_FOTO[campo] })
    .trim()
    .min(1, { error: MENSAJE_FALTA_FOTO[campo] })
    .max(120, { error: MENSAJE_FALTA_FOTO[campo] })
    .regex(patron, { error: MENSAJE_FALTA_FOTO[campo] });
}

/**
 * Archivo elegido en el navegador, ANTES de subirlo (solo cliente: la
 * Server Action nunca recibe archivos). Tipo y peso máximo del bucket.
 */
export function esquemaArchivoFoto(campo: CampoFoto) {
  const falta = MENSAJE_FALTA_FOTO[campo];
  return z
    .instanceof(File, { error: falta })
    .refine((archivo) => archivo.size > 0, { error: falta })
    .refine((archivo) => archivo.size <= TAMANO_MAXIMO_FOTO, { error: "La foto pesa demasiado (máximo 5 MB)." })
    .refine((archivo) => (TIPOS_FOTO_PERMITIDOS as readonly string[]).includes(archivo.type), {
      error: "La foto debe ser JPG, PNG o WEBP.",
    });
}

export const esquemaArchivosAfiliacion = z.object({
  foto_cedula_frente: esquemaArchivoFoto("foto_cedula_frente"),
  foto_cedula_reverso: esquemaArchivoFoto("foto_cedula_reverso"),
  foto_selfie: esquemaArchivoFoto("foto_selfie"),
});

/** Entrada de `prepararSubidaFotos`: el tipo de cada foto que se va a subir. */
export const esquemaPrepararSubida = z.object({
  foto_cedula_frente: z.enum(TIPOS_FOTO_PERMITIDOS),
  foto_cedula_reverso: z.enum(TIPOS_FOTO_PERMITIDOS),
  foto_selfie: z.enum(TIPOS_FOTO_PERMITIDOS),
});
export type EntradaPrepararSubida = z.infer<typeof esquemaPrepararSubida>;

// ---------------------------------------------------------------------------
// Esquema principal
// ---------------------------------------------------------------------------

const camposTexto = {
  nombres: esquemaNombrePropio("Los nombres", "Escribe tus nombres."),
  apellidos: esquemaNombrePropio("Los apellidos", "Escribe tus apellidos."),
  cedula: esquemaCedula,
  institucion: z.enum(INSTITUCIONES, { error: "Selecciona tu institución." }),
  grado_id: z.string({ error: MENSAJES_AFILIACION.grado }).trim().min(1, { error: MENSAJES_AFILIACION.grado }),
  nequi: esquemaNumeroMovil("Escribe tu número Nequi."),
  // Cuenta de nómina en cascada: se valida en conjunto en superRefine.
  nomina_entidad: z.string().trim(),
  nomina_entidad_otra: z.string().transform((v) => v.trim().replace(/\s+/g, " ")),
  nomina_tipo: z.string().trim(),
  nomina_numero: z.string().transform(normalizarNumeroCuenta),
  celular: esquemaNumeroMovil("Escribe tu número de celular."),
  correo_institucional: esquemaCorreoCon(MENSAJES_AFILIACION.correoInstitucional),
  /** CORREO PERSONAL: es el de Auth (el código de ingreso llega aquí). Columna `email`. */
  email: esquemaCorreoCon(MENSAJES_AFILIACION.correoPersonal),
  asesor_id: esquemaAsesorId,
  mensaje: textoOpcional(500, "El mensaje puede tener máximo 500 caracteres."),
  acepto_datos: z.literal(true, {
    error: "Debes autorizar el tratamiento de tus datos para enviar la solicitud.",
  }),
};

const camposFotos = {
  foto_cedula_frente: esquemaRutaFoto("foto_cedula_frente"),
  foto_cedula_reverso: esquemaRutaFoto("foto_cedula_reverso"),
  foto_selfie: esquemaRutaFoto("foto_selfie"),
  fotos_ticket: z.string({ error: "Vuelve a subir tus fotos." }).trim().min(1, { error: "Vuelve a subir tus fotos." }),
};

type SalidaTexto = z.output<z.ZodObject<typeof camposTexto>>;

/** Reglas que dependen de varios campos o del contexto (grado, asesor, nómina, correos). */
function reglasCruzadas(ctx: ContextoAfiliacion) {
  return (datos: SalidaTexto, z4: z.core.$RefinementCtx<SalidaTexto>) => {
    // Grado: debe existir, ofrecerse en el formulario y corresponder a la institución.
    const grado = ctx.grados.find((g) => g.codigo === datos.grado_id && g.seleccionable);
    if (!grado) {
      z4.addIssue({ code: "custom", path: ["grado_id"], message: MENSAJES_AFILIACION.grado });
    } else if (esInstitucion(datos.institucion) && !gradoAplicaA(grado, datos.institucion)) {
      z4.addIssue({ code: "custom", path: ["grado_id"], message: MENSAJES_AFILIACION.gradoInstitucion });
    }

    // Asesor: de la lista que da la base (asesores + admins que atienden).
    if (datos.asesor_id && !ctx.asesores.some((a) => a.id === datos.asesor_id)) {
      z4.addIssue({ code: "custom", path: ["asesor_id"], message: MENSAJES_AFILIACION.asesorLista });
    }

    // §12.3 (R-04): el correo institucional debe ser del dominio de la institución elegida.
    if (
      esInstitucion(datos.institucion) &&
      datos.correo_institucional &&
      !correoInstitucionalValido(datos.correo_institucional, datos.institucion)
    ) {
      z4.addIssue({
        code: "custom",
        path: ["correo_institucional"],
        message: MENSAJE_DOMINIO_INSTITUCIONAL[datos.institucion],
      });
    }

    // Correos distintos (también lo exige un check de la base).
    if (datos.email && datos.correo_institucional && datos.email === datos.correo_institucional) {
      z4.addIssue({ code: "custom", path: ["email"], message: MENSAJES_AFILIACION.correosIguales });
    }

    // Cuenta de nómina: entidad → (tipo) → número.
    const entidad = datos.nomina_entidad;
    if (!entidad) {
      z4.addIssue({ code: "custom", path: ["nomina_entidad"], message: MENSAJES_AFILIACION.entidad });
      return;
    }
    if (entidad !== OPCION_OTRA_ENTIDAD && !esEntidadDeLista(entidad)) {
      z4.addIssue({ code: "custom", path: ["nomina_entidad"], message: MENSAJES_AFILIACION.entidad });
      return;
    }
    if (entidad === OPCION_OTRA_ENTIDAD) {
      const otra = datos.nomina_entidad_otra;
      if (!otra) {
        z4.addIssue({ code: "custom", path: ["nomina_entidad_otra"], message: MENSAJES_AFILIACION.entidadOtra });
      } else if (otra.length < 2 || otra.length > 60) {
        z4.addIssue({ code: "custom", path: ["nomina_entidad_otra"], message: MENSAJES_AFILIACION.entidadOtraFormato });
      }
    }

    const numero = datos.nomina_numero;
    if (esBilletera(entidad)) {
      // TODO(confirmar: R-03) billetera = depósito electrónico; el número es un celular.
      const celular = normalizarCelular(numero);
      if (!celular) {
        z4.addIssue({ code: "custom", path: ["nomina_numero"], message: MENSAJES_AFILIACION.numeroCuenta });
      } else if (!/^3[0-9]{9}$/.test(celular)) {
        z4.addIssue({ code: "custom", path: ["nomina_numero"], message: MENSAJES_AFILIACION.numeroBilletera });
      }
      return;
    }

    if (!(TIPOS_CUENTA_BANCO as readonly string[]).includes(datos.nomina_tipo)) {
      z4.addIssue({ code: "custom", path: ["nomina_tipo"], message: MENSAJES_AFILIACION.tipoCuenta });
    }
    if (!numero) {
      z4.addIssue({ code: "custom", path: ["nomina_numero"], message: MENSAJES_AFILIACION.numeroCuenta });
    } else if (!/^[0-9]{6,20}$/.test(numero)) {
      z4.addIssue({ code: "custom", path: ["nomina_numero"], message: MENSAJES_AFILIACION.numeroCuentaFormato });
    }
  };
}

/**
 * Las reglas cruzadas corren AUNQUE otros campos tengan error, para mostrar
 * todos los errores de una vez (por defecto zod las salta si ya hay errores).
 */
const SIEMPRE = { when: (payload: { value: unknown }) => typeof payload.value === "object" && payload.value !== null };

/** Deja la cuenta de nómina como la guarda la base (entidad final, tipo del enum, número limpio). */
function resolverNomina<T extends SalidaTexto>(datos: T) {
  const billetera = esBilletera(datos.nomina_entidad);
  const nomina = {
    entidad: datos.nomina_entidad === OPCION_OTRA_ENTIDAD ? datos.nomina_entidad_otra : datos.nomina_entidad,
    tipo: (billetera ? "deposito_electronico" : datos.nomina_tipo) as TipoCuentaNomina,
    numero: billetera ? normalizarCelular(datos.nomina_numero) : datos.nomina_numero,
  };
  return { ...datos, nomina };
}

/**
 * Solo los campos de texto (sin fotos): el navegador lo usa ANTES de pedir
 * las URLs de subida, para no subir fotos de un formulario con errores.
 */
export function crearEsquemaDatosAfiliacion(ctx: ContextoAfiliacion) {
  return z.object(camposTexto).superRefine(reglasCruzadas(ctx), SIEMPRE).transform(resolverNomina);
}

/** Esquema completo del envío final (texto + rutas de las fotos + ticket). */
export function crearEsquemaAfiliacion(ctx: ContextoAfiliacion) {
  return z
    .object({ ...camposTexto, ...camposFotos })
    .superRefine(reglasCruzadas(ctx) as never, SIEMPRE)
    .transform((datos) => resolverNomina(datos as typeof datos & SalidaTexto));
}

export type DatosAfiliacion = z.output<ReturnType<typeof crearEsquemaAfiliacion>>;
export type CampoAfiliacion = keyof typeof camposTexto | keyof typeof camposFotos;

// ---------------------------------------------------------------------------
// FormData ↔ esquema
// ---------------------------------------------------------------------------

/** Campos de texto del formulario (lo único que se puede «recordar» si el envío falla). */
export function leerTextoAfiliacion(formData: FormData) {
  return {
    nombres: textoDe(formData, "nombres"),
    apellidos: textoDe(formData, "apellidos"),
    cedula: textoDe(formData, "cedula"),
    institucion: textoDe(formData, "institucion"),
    grado_id: textoDe(formData, "grado_id"),
    nequi: textoDe(formData, "nequi"),
    nomina_entidad: textoDe(formData, "nomina_entidad"),
    nomina_entidad_otra: textoDe(formData, "nomina_entidad_otra"),
    nomina_tipo: textoDe(formData, "nomina_tipo"),
    nomina_numero: textoDe(formData, "nomina_numero"),
    celular: textoDe(formData, "celular"),
    correo_institucional: textoDe(formData, "correo_institucional"),
    email: textoDe(formData, "email"),
    asesor_id: textoDe(formData, "asesor_id"),
    mensaje: textoDe(formData, "mensaje"),
    acepto_datos: formData.get("acepto_datos") === "on",
  };
}

export type ValoresAfiliacion = ReturnType<typeof leerTextoAfiliacion>;

/** Entrada completa del envío final: texto + rutas de las fotos (strings) + ticket. */
export function leerFormularioAfiliacion(formData: FormData) {
  return {
    ...leerTextoAfiliacion(formData),
    foto_cedula_frente: textoDe(formData, "foto_cedula_frente"),
    foto_cedula_reverso: textoDe(formData, "foto_cedula_reverso"),
    foto_selfie: textoDe(formData, "foto_selfie"),
    fotos_ticket: textoDe(formData, "fotos_ticket"),
  };
}

export type EntradaAfiliacion = ReturnType<typeof leerFormularioAfiliacion>;

/** Los 3 archivos elegidos en el navegador (null si falta alguno). Solo cliente. */
export function leerArchivosAfiliacion(formData: FormData) {
  const archivo = (campo: CampoFoto) => {
    const valor = formData.get(campo);
    return valor instanceof File && valor.size > 0 ? valor : null;
  };
  return {
    foto_cedula_frente: archivo("foto_cedula_frente"),
    foto_cedula_reverso: archivo("foto_cedula_reverso"),
    foto_selfie: archivo("foto_selfie"),
  };
}

/** Quita las rutas y el ticket: lo que se devuelve al navegador para no borrar lo escrito. */
export function valoresDeTextoAfiliacion(entrada: EntradaAfiliacion | ValoresAfiliacion): ValoresAfiliacion {
  return {
    nombres: entrada.nombres,
    apellidos: entrada.apellidos,
    cedula: entrada.cedula,
    institucion: entrada.institucion,
    grado_id: entrada.grado_id,
    nequi: entrada.nequi,
    nomina_entidad: entrada.nomina_entidad,
    nomina_entidad_otra: entrada.nomina_entidad_otra,
    nomina_tipo: entrada.nomina_tipo,
    nomina_numero: entrada.nomina_numero,
    celular: entrada.celular,
    correo_institucional: entrada.correo_institucional,
    email: entrada.email,
    asesor_id: entrada.asesor_id,
    mensaje: entrada.mensaje,
    acepto_datos: entrada.acepto_datos,
  };
}

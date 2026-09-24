import { z } from "zod";
import { esquemaCedula, normalizarCelular, normalizarCorreo, textoDe } from "./comunes";

/** Valores del enum public.grado_policial (mismo orden que en la base). */
export const GRADOS = ["PP", "PT", "SI", "IT", "OF"] as const;
export type CodigoGrado = (typeof GRADOS)[number];

/** Valores del enum public.institucion_afiliacion (spec-fase-2 §2). */
export const INSTITUCIONES = ["policia", "ejercito"] as const;
export type CodigoInstitucion = (typeof INSTITUCIONES)[number];

export const NOMBRE_INSTITUCION: Record<CodigoInstitucion, string> = {
  policia: "Policía Nacional",
  ejercito: "Ejército Nacional",
};

/**
 * Dominio(s) de correo institucional exigido por institución (mismo `check` de
 * public.solicitudes_afiliacion, migración 20260924000200). `texto` es lo que se
 * muestra en el mensaje de error y en la ayuda del campo.
 */
const DOMINIO_INSTITUCION: Record<CodigoInstitucion, { patron: RegExp; texto: string }> = {
  policia: { patron: /@policia\.gov\.co$/, texto: "@policia.gov.co" },
  ejercito: {
    patron: /@(buzonejercito\.mil\.co|ejercito\.mil\.co)$/,
    texto: "@buzonejercito.mil.co o @ejercito.mil.co",
  },
};

/** Texto de ayuda bajo el campo «Correo institucional», según la institución elegida. */
export function dominioEsperado(institucion: string) {
  const regla = DOMINIO_INSTITUCION[institucion as CodigoInstitucion];
  return regla ? `Debe terminar en ${regla.texto}.` : "Selecciona primero tu institución.";
}

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

/** Correo institucional: formato válido; el dominio se valida en el `.check` de abajo. */
const esquemaCorreoInstitucional = z
  .string({ error: "Escribe tu correo institucional." })
  .transform(normalizarCorreo)
  .pipe(
    z
      .string()
      .min(1, { error: "Escribe tu correo institucional." })
      .max(254, { error: "Revisa el correo: no es válido." })
      .pipe(z.email({ error: "Revisa el correo: no es válido." })),
  );

/** Asesor opcional: `""` (o "no tengo asesor") → null; si viene algo, debe ser un uuid. */
const esquemaAsesorId = z
  .string()
  .transform((v) => (v.trim() === "" ? null : v.trim()))
  .pipe(z.union([z.null(), z.uuid({ error: "Selecciona un asesor válido." })]));

const TIPOS_FOTO_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];
/** Mismo límite del bucket privado `afiliacion-documentos` (spec-fase-2 §3). */
export const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024;

/** Foto obligatoria (cédula frente/reverso, selfie): jpeg/png/webp, máx. 5 MB. */
function esquemaFoto(mensajeFalta: string) {
  return z
    .instanceof(File, { error: mensajeFalta })
    .refine((archivo) => archivo.size > 0, { error: mensajeFalta })
    .refine((archivo) => archivo.size <= TAMANO_MAXIMO_FOTO, {
      error: "La foto pesa demasiado (máximo 5 MB).",
    })
    .refine((archivo) => TIPOS_FOTO_PERMITIDOS.includes(archivo.type), {
      error: "La foto debe ser JPG, PNG o WEBP.",
    });
}

/**
 * Formulario «Deseo afiliarme» v2 (docs/spec-fase-2.md §2). Mismo esquema en el
 * navegador (antes de enviar) y en la Server Action. Los límites coinciden con
 * los `check` de public.solicitudes_afiliacion.
 */
export const esquemaAfiliacion = z
  .object({
    nombres: esquemaNombrePropio("Los nombres", "Escribe tus nombres."),
    apellidos: esquemaNombrePropio("Los apellidos", "Escribe tus apellidos."),
    cedula: esquemaCedula,
    grado_id: z.enum(GRADOS, { error: "Selecciona tu grado." }),
    institucion: z.enum(INSTITUCIONES, { error: "Selecciona tu institución." }),
    nequi: esquemaNumeroMovil("Escribe tu número Nequi."),
    celular: esquemaNumeroMovil("Escribe tu número de celular."),
    email: esquemaCorreoInstitucional,
    asesor_id: esquemaAsesorId,
    foto_cedula_frente: esquemaFoto("Sube la foto de tu cédula (frente)."),
    foto_cedula_reverso: esquemaFoto("Sube la foto de tu cédula (reverso)."),
    foto_selfie: esquemaFoto("Sube tu selfie."),
    mensaje: textoOpcional(500, "El mensaje puede tener máximo 500 caracteres."),
    acepto_datos: z.literal(true, {
      error: "Debes autorizar el tratamiento de tus datos para enviar la solicitud.",
    }),
  })
  .check((ctx) => {
    // Correo institucional según la institución elegida (spec-fase-2 §2): solo se
    // valida si los dos campos ya son individualmente válidos (si no, ya hay un
    // error propio en cada uno y este no aporta nada nuevo).
    const { institucion, email } = ctx.value;
    if (!institucion || !email) return;
    const regla = DOMINIO_INSTITUCION[institucion];
    if (!regla.patron.test(email)) {
      ctx.issues.push({
        code: "custom",
        message: `El correo debe ser institucional: termina en ${regla.texto}.`,
        path: ["email"],
        input: ctx.value,
      });
    }
  });

export type DatosAfiliacion = z.output<typeof esquemaAfiliacion>;
export type CampoAfiliacion = keyof z.input<typeof esquemaAfiliacion>;

/** Lee un campo de archivo de un FormData (`null` si no viene o no es un archivo). */
function archivoDe(formData: FormData, campo: string): File | null {
  const valor = formData.get(campo);
  return valor instanceof File ? valor : null;
}

/** Convierte el FormData del formulario en la entrada del esquema. */
export function leerFormularioAfiliacion(formData: FormData) {
  return {
    nombres: textoDe(formData, "nombres"),
    apellidos: textoDe(formData, "apellidos"),
    cedula: textoDe(formData, "cedula"),
    grado_id: textoDe(formData, "grado_id"),
    institucion: textoDe(formData, "institucion"),
    nequi: textoDe(formData, "nequi"),
    celular: textoDe(formData, "celular"),
    email: textoDe(formData, "email"),
    asesor_id: textoDe(formData, "asesor_id"),
    foto_cedula_frente: archivoDe(formData, "foto_cedula_frente"),
    foto_cedula_reverso: archivoDe(formData, "foto_cedula_reverso"),
    foto_selfie: archivoDe(formData, "foto_selfie"),
    mensaje: textoDe(formData, "mensaje"),
    acepto_datos: formData.get("acepto_datos") === "on",
  };
}

export type EntradaAfiliacion = ReturnType<typeof leerFormularioAfiliacion>;

/**
 * Los campos de texto/selección de `EntradaAfiliacion`, sin las 3 fotos: es lo
 * único que se puede «recordar» en pantalla si el envío falla. Un `File` no se
 * puede devolver al navegador desde una Server Action (no es serializable) ni
 * se puede volver a poner en un `<input type="file">` por seguridad del
 * navegador; el componente de cada foto ya conserva su propia vista previa en
 * memoria del lado del cliente, así que no hace falta.
 */
export type ValoresAfiliacion = Omit<
  EntradaAfiliacion,
  "foto_cedula_frente" | "foto_cedula_reverso" | "foto_selfie"
>;

export function valoresDeTextoAfiliacion(entrada: EntradaAfiliacion): ValoresAfiliacion {
  return {
    nombres: entrada.nombres,
    apellidos: entrada.apellidos,
    cedula: entrada.cedula,
    grado_id: entrada.grado_id,
    institucion: entrada.institucion,
    nequi: entrada.nequi,
    celular: entrada.celular,
    email: entrada.email,
    asesor_id: entrada.asesor_id,
    mensaje: entrada.mensaje,
    acepto_datos: entrada.acepto_datos,
  };
}

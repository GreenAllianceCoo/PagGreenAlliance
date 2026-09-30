/**
 * Verificador de foto de /afiliacion (spec-requerimientos-ricardo §2.10).
 * Revisa en el navegador, sin servicios de pago:
 *  - nitidez: varianza del laplaciano sobre la imagen en gris, en un canvas
 *    reducido (lado mayor = LADO_ANALISIS_PX) para que tarde lo mismo con
 *    cualquier celular;
 *  - luz: brillo medio (0–255);
 *  - tamaño mínimo de la foto original.
 * Es un AVISO que se puede ignorar, nunca un bloqueo (para no dejar por fuera
 * a quien tenga un celular malo).
 *
 * Funciones puras sobre un objeto con la forma de `ImageData`
 * ({ data: RGBA, width, height }): se prueban en Node sin canvas.
 * Uso en el navegador (maquetador):
 *   const { ancho, alto } = dimensionesAnalisis(bitmap.width, bitmap.height);
 *   ctx.drawImage(bitmap, 0, 0, ancho, alto);
 *   const r = evaluarCalidadFoto(ctx.getImageData(0, 0, ancho, alto), {
 *     anchoOriginal: bitmap.width, altoOriginal: bitmap.height });
 *   if (!r.aceptable) mostrar(MENSAJE_FOTO_DUDOSA) // con «Usar de todos modos» y «Tomar de nuevo»
 */

/** Lado mayor del canvas reducido donde se mide la nitidez. */
export const LADO_ANALISIS_PX = 512;
/**
 * Por debajo de esta varianza del laplaciano (medida a LADO_ANALISIS_PX), la
 * foto se considera borrosa. Valor de partida habitual para este método;
 * ajustarlo con fotos reales de cédulas si da falsos avisos.
 */
export const UMBRAL_NITIDEZ = 60;
/** Brillo medio (0–255) por debajo del cual la foto se considera oscura. */
export const UMBRAL_BRILLO_MINIMO = 60;
/** Brillo medio por encima del cual la foto se considera quemada (flash o contraluz). */
export const UMBRAL_BRILLO_MAXIMO = 235;
/** Lado MENOR mínimo de la foto original, en píxeles (una cédula legible necesita resolución). */
export const LADO_MENOR_MINIMO_PX = 600;

export const MENSAJE_FOTO_DUDOSA = "La foto se ve borrosa u oscura, tómala de nuevo";

export type ImagenRGBA = {
  data: Uint8ClampedArray | Uint8Array | number[];
  width: number;
  height: number;
};

export type ResultadoCalidadFoto = {
  /** Varianza del laplaciano (más alto = más nítida). */
  nitidez: number;
  /** Brillo medio 0–255. */
  brillo: number;
  borrosa: boolean;
  oscura: boolean;
  quemada: boolean;
  /** La foto original es más pequeña que LADO_MENOR_MINIMO_PX. */
  pequena: boolean;
  /** true = ningún aviso. */
  aceptable: boolean;
};

/** Tamaño del canvas reducido conservando la proporción (nunca agranda). */
export function dimensionesAnalisis(ancho: number, alto: number, ladoMaximo = LADO_ANALISIS_PX) {
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto, 1));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** Luminancia (Rec. 601) de cada píxel. */
export function aGrises(imagen: ImagenRGBA): Float32Array {
  const { data, width, height } = imagen;
  const grises = new Float32Array(width * height);
  for (let i = 0, p = 0; p < grises.length; i += 4, p += 1) {
    grises[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return grises;
}

/** Brillo medio (0–255). */
export function brilloMedio(imagen: ImagenRGBA): number {
  const grises = aGrises(imagen);
  if (grises.length === 0) return 0;
  let suma = 0;
  for (const valor of grises) suma += valor;
  return suma / grises.length;
}

/**
 * Varianza del laplaciano (núcleo 4-vecinos [0 1 0; 1 −4 1; 0 1 0]) sobre
 * los píxeles interiores. Una foto movida o desenfocada tiene pocos bordes y
 * da una varianza baja.
 */
export function varianzaLaplaciano(imagen: ImagenRGBA): number {
  const { width, height } = imagen;
  if (width < 3 || height < 3) return 0;
  const g = aGrises(imagen);
  let suma = 0;
  let sumaCuadrados = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap = g[i - width] + g[i + width] + g[i - 1] + g[i + 1] - 4 * g[i];
      suma += lap;
      sumaCuadrados += lap * lap;
      n += 1;
    }
  }
  const media = suma / n;
  return sumaCuadrados / n - media * media;
}

/**
 * Evalúa la foto. `anchoOriginal`/`altoOriginal` son los de la foto tal como
 * la tomó la cámara (antes de reducirla para el análisis).
 */
export function evaluarCalidadFoto(
  imagen: ImagenRGBA,
  original: { anchoOriginal: number; altoOriginal: number } = {
    anchoOriginal: imagen.width,
    altoOriginal: imagen.height,
  },
): ResultadoCalidadFoto {
  const nitidez = varianzaLaplaciano(imagen);
  const brillo = brilloMedio(imagen);
  const borrosa = nitidez < UMBRAL_NITIDEZ;
  const oscura = brillo < UMBRAL_BRILLO_MINIMO;
  const quemada = brillo > UMBRAL_BRILLO_MAXIMO;
  const pequena = Math.min(original.anchoOriginal, original.altoOriginal) < LADO_MENOR_MINIMO_PX;
  return {
    nitidez,
    brillo,
    borrosa,
    oscura,
    quemada,
    pequena,
    aceptable: !borrosa && !oscura && !quemada && !pequena,
  };
}

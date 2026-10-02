import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import QRCode from "qrcode";
import { LOGO_BLANCO_PNG_BASE64 } from "@/lib/carneLogo";
import { enmascararCedula } from "@/lib/mascara";

/** Datos del carné en PDF. La cédula llega completa y aquí se enmascara. */
export type DatosCarnePdf = {
  nombre: string;
  grado: string;
  institucion?: string | null;
  cedula: string;
  /** Texto que codifica el QR (URL pública de verificación). */
  urlVerificacion: string;
  /** Foto del asociado (JPEG o PNG). Si falta o no se puede leer, el PDF sale sin foto. */
  foto?: { bytes: Uint8Array; tipo: "jpg" | "png" } | null;
};

const ANCHO = 600;
const ALTO = 380;
const VERDE_OSCURO = rgb(0x14 / 255, 0x49 / 255, 0x3a / 255);
const VERDE = rgb(0x1e / 255, 0x66 / 255, 0x52 / 255);
const MENTA = rgb(0xbf / 255, 0xe3 / 255, 0xd2 / 255);
const BLANCO = rgb(1, 1, 1);

/** Helvetica estándar solo codifica Latin-1: lo demás se reemplaza para que nunca falle. */
export function textoSeguroPdf(texto: string): string {
  return texto
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
    .replace(/[^ -~¡-ÿ]/g, "?")
    .replace(/\s+/g, " ")
    .trim();
}

/** Recorta con «…» (en ASCII: «...») hasta que quepa en `max` puntos. */
export function ajustarAncho(texto: string, fuente: PDFFont, tamano: number, max: number): string {
  if (fuente.widthOfTextAtSize(texto, tamano) <= max) return texto;
  let t = texto;
  while (t.length > 1 && fuente.widthOfTextAtSize(`${t}...`, tamano) > max) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Genera el carné como PDF (una página, tarjeta verde con QR). Función pura: sin acceso a la base. */
export async function generarCarnePdf(datos: DatosCarnePdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle("Carné de asociado · Cooperativa Green Alliance");
  pdf.setAuthor("Cooperativa Green Alliance");
  const pagina = pdf.addPage([ANCHO, ALTO]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  pagina.drawRectangle({ x: 0, y: 0, width: ANCHO, height: ALTO, color: VERDE_OSCURO });
  pagina.drawCircle({ x: ANCHO - 20, y: ALTO - 10, size: 95, color: VERDE });

  // Logo
  const logo = await pdf.embedPng(Buffer.from(LOGO_BLANCO_PNG_BASE64, "base64"));
  const altoLogo = 78;
  const anchoLogo = (logo.width / logo.height) * altoLogo;
  pagina.drawImage(logo, { x: 32, y: ALTO - 32 - altoLogo, width: anchoLogo, height: altoLogo });

  // QR (PNG generado en servidor) sobre panel blanco, a la derecha
  const qrPng = await QRCode.toBuffer(datos.urlVerificacion, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 400,
    color: { dark: "#0b3d2e", light: "#ffffff" },
  });
  const qr = await pdf.embedPng(qrPng);
  const lado = 150;
  const qx = ANCHO - 32 - lado;
  const qy = 70;
  pagina.drawRectangle({ x: qx - 8, y: qy - 8, width: lado + 16, height: lado + 16, color: BLANCO });
  pagina.drawImage(qr, { x: qx, y: qy, width: lado, height: lado });
  const leyenda = "Verifica este carné";
  pagina.drawText(leyenda, {
    x: qx + (lado - normal.widthOfTextAtSize(leyenda, 10)) / 2,
    y: qy - 26,
    size: 10,
    font: normal,
    color: MENTA,
  });

  // Foto (cuadrada) sobre el QR, a la derecha, si hay.
  if (datos.foto) {
    try {
      const imagen = datos.foto.tipo === "png" ? await pdf.embedPng(datos.foto.bytes) : await pdf.embedJpg(datos.foto.bytes);
      const ladoFoto = 88;
      const fx = qx + (lado - ladoFoto) / 2;
      pagina.drawRectangle({ x: fx - 3, y: 241, width: ladoFoto + 6, height: ladoFoto + 6, color: BLANCO });
      pagina.drawImage(imagen, { x: fx, y: 244, width: ladoFoto, height: ladoFoto });
    } catch {
      // imagen dañada: el carné sale igual, sin foto
    }
  }

  // Texto, columna izquierda
  const maxTexto = qx - 32 - 24;
  const izq = 32;
  pagina.drawText("AFILIADO TITULAR", { x: izq, y: 218, size: 11, font: negrita, color: MENTA });
  const nombre = ajustarAncho(textoSeguroPdf(datos.nombre) || "Asociado", negrita, 24, maxTexto);
  pagina.drawText(nombre, { x: izq, y: 188, size: 24, font: negrita, color: BLANCO });

  const filas: [string, string][] = [
    ["Grado", textoSeguroPdf(datos.grado) || "Sin asignar"],
    ["Cédula", enmascararCedula(datos.cedula)],
  ];
  const inst = datos.institucion ? textoSeguroPdf(datos.institucion) : "";
  if (inst) filas.push(["Institución", inst]);
  let y = 150;
  for (const [etiqueta, valor] of filas) {
    pagina.drawText(textoSeguroPdf(etiqueta), { x: izq, y, size: 10, font: normal, color: MENTA });
    pagina.drawText(ajustarAncho(textoSeguroPdf(valor.replace(/•/g, "*")), negrita, 14, maxTexto), {
      x: izq,
      y: y - 17,
      size: 14,
      font: negrita,
      color: BLANCO,
    });
    y -= 48;
  }

  pagina.drawText("Muéstralo en cada empresa en convenio. No es un documento de identidad.", {
    x: izq,
    y: 22,
    size: 9,
    font: normal,
    color: MENTA,
  });

  return pdf.save();
}

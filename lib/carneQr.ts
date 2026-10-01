import "server-only";
import QRCode from "qrcode";

/** QR como SVG (se genera en el servidor; no se envía ninguna librería al navegador). */
export async function qrComoSvg(texto: string): Promise<string> {
  return QRCode.toString(texto, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#0b3d2e", light: "#ffffff" },
  });
}

import "server-only";
import { cookies } from "next/headers";
import { enmascararCorreo } from "@/lib/mascara";

/**
 * «Flash» de /afiliacion → /afiliacion/enviada: solo el correo ENMASCARADO,
 * en una cookie httpOnly de 10 minutos. Sin ella, /afiliacion/enviada
 * redirige a /afiliacion (mapa de botones §6).
 */
const COOKIE_ENVIADA = "ga_afiliacion_enviada";

export async function guardarFlashAfiliacion(correo: string) {
  const valor = Buffer.from(enmascararCorreo(correo), "utf8").toString("base64url");
  (await cookies()).set(COOKIE_ENVIADA, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/afiliacion",
    maxAge: 10 * 60,
  });
}

/** Correo enmascarado del último envío, o null si no hay flash. */
export async function leerFlashAfiliacion() {
  const valor = (await cookies()).get(COOKIE_ENVIADA)?.value;
  if (!valor) return null;
  try {
    const texto = Buffer.from(valor, "base64url").toString("utf8");
    return texto.length > 0 && texto.length <= 260 ? texto : null;
  } catch {
    return null;
  }
}
